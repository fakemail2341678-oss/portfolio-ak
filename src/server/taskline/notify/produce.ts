import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { WorkspaceSettings } from "@/features/taskline/settings";
import type { NotificationData, NotificationEmail, NotificationKind, ProjectRole } from "@/features/taskline/types";
import { tlMember, tlNotification, tlProjectMember, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type ProjectAccess, projectLevel, type WorkspaceAccess } from "../access";

/**
 * Notifications (PLAN 11.5, "Notifications and email"; decision 0214): written in the
 * transaction of the change that causes them, so a refused change tells nobody. Who
 * hears is decided here, never by the caller's list alone:
 *
 * - a member with an account (placeholders and deleted accounts have none), active,
 *   who may see the project (a private project's outsiders don't), and not the actor;
 * - once per change: the first event naming someone wins (being mentioned beats the
 *   plain "new comment" on a task they watch);
 * - in the mode they chose for the kind, else the workspace's default: `off` writes
 *   nothing, `instant` and `digest` write the inbox row and say how it's emailed.
 *   Guests are never emailed (their address can't receive mail).
 *
 * The ids of rows to email at once are returned: the service hands them to its
 * `deliver` after the commit (src/server/taskline/notify/deliver.ts).
 */

export type NotifyEvent = {
	kind: NotificationKind;
	taskId: string | null;
	/** Member ids; filtered as above. */
	to: ReadonlyArray<string | null | undefined>;
	data: NotificationData;
};

/** Who caused the events: their member row (null for an admin without one, or the cron) and account. */
export type NotifyActor = { memberId: string | null; userId: string | null; name: string | null };

export const actorOf = (access: Pick<WorkspaceAccess, "member">, userId: string): NotifyActor => ({
	memberId: access.member?.id ?? null,
	userId,
	name: access.member?.displayName ?? null,
});

type Viewer = {
	memberId: string;
	/** Null for a placeholder teammate (or a deleted account): they're seen, never told. */
	userId: string | null;
	role: "member" | "viewer";
	notify: Partial<Record<string, string>>;
	guest: boolean;
};
type Recipient = Viewer & { userId: string };

type Scope = { workspace: WorkspaceAccess["workspace"]; project: ProjectAccess["project"] };

/** The active members of `memberIds` who may see `project` (placeholders included): who a comment may mention. */
export async function viewers(db: Db, scope: Scope, memberIds: ReadonlyArray<string>): Promise<Viewer[]> {
	if (memberIds.length === 0) return [];
	const rows = await db
		.select({
			memberId: tlMember.id,
			userId: tlMember.userId,
			role: tlMember.role,
			notify: tlMember.notify,
			guest: user.isAnonymous,
		})
		.from(tlMember)
		.leftJoin(user, eq(user.id, tlMember.userId))
		.where(
			and(
				eq(tlMember.workspaceId, scope.workspace.id),
				inArray(tlMember.id, [...memberIds]),
				isNull(tlMember.deactivatedAt),
			),
		);
	if (rows.length === 0) return [];
	const roles = new Map<string, ProjectRole>(
		(
			await db
				.select({ memberId: tlProjectMember.memberId, role: tlProjectMember.role })
				.from(tlProjectMember)
				.where(
					and(
						eq(tlProjectMember.projectId, scope.project.id),
						inArray(
							tlProjectMember.memberId,
							rows.map((row) => row.memberId),
						),
					),
				)
		).map((row) => [row.memberId, row.role]),
	);
	return rows.flatMap((row) => {
		const sandboxOwner = scope.workspace.kind === "sandbox" && scope.workspace.ownerId === row.userId;
		const level = projectLevel(
			{ sandboxOwner, admin: null, member: { role: row.role } },
			scope.project,
			roles.get(row.memberId) ?? null,
		);
		if (level === "none") return [];
		return [
			{ memberId: row.memberId, userId: row.userId, role: row.role, notify: row.notify, guest: row.guest === true },
		];
	});
}

/** The members of `memberIds` who may hear about `project`: viewers with an account. */
export async function recipients(db: Db, scope: Scope, memberIds: ReadonlyArray<string>): Promise<Recipient[]> {
	return (await viewers(db, scope, memberIds)).filter((each): each is Recipient => each.userId !== null);
}

/** How a recipient hears about `kind`: their choice, else the workspace's default. */
export function emailFor(
	recipient: Pick<Recipient, "notify" | "guest">,
	settings: WorkspaceSettings,
	kind: NotificationKind,
): NotificationEmail | "off" {
	const mode = recipient.notify[kind] ?? settings.notify[kind];
	if (mode === "off") return "off";
	if (recipient.guest) return "none";
	return mode === "instant" ? "instant" : "digest";
}

/**
 * Writes the notifications of one change. Returns the ids to email at once.
 * `scope` is the resolved project (with its workspace's settings).
 */
export async function produce(
	tx: Tx,
	scope: Pick<ProjectAccess, "workspace" | "project" | "settings">,
	actor: NotifyActor,
	events: ReadonlyArray<NotifyEvent>,
): Promise<string[]> {
	const wanted = [...new Set(events.flatMap((event) => event.to).filter((id): id is string => Boolean(id)))].filter(
		(id) => id !== actor.memberId,
	);
	if (wanted.length === 0) return [];
	const byMember = new Map((await recipients(tx, scope, wanted)).map((each) => [each.memberId, each]));
	const told = new Set<string>();
	const rows: (typeof tlNotification.$inferInsert)[] = [];
	for (const event of events) {
		for (const memberId of event.to) {
			const recipient = memberId ? byMember.get(memberId) : undefined;
			if (!recipient || told.has(recipient.memberId) || recipient.userId === actor.userId) continue;
			told.add(recipient.memberId);
			const email = emailFor(recipient, scope.settings, event.kind);
			if (email === "off") continue;
			rows.push({
				userId: recipient.userId,
				workspaceId: scope.workspace.id,
				projectId: scope.project.id,
				taskId: event.taskId,
				actorId: actor.memberId,
				kind: event.kind,
				data: actor.name ? { actor: actor.name, ...event.data } : event.data,
				email,
			});
		}
	}
	if (rows.length === 0) return [];
	const inserted = await tx
		.insert(tlNotification)
		.values(rows)
		.returning({ id: tlNotification.id, email: tlNotification.email });
	return inserted.filter((row) => row.email === "instant").map((row) => row.id);
}

/** What a task's notifications carry: its ref and title, and the project's name. */
export const taskData = (access: Pick<ProjectAccess, "project">, task: { number: number; title: string }) => ({
	ref: `${access.project.key}-${task.number}`,
	title: task.title,
	project: access.project.name,
});
