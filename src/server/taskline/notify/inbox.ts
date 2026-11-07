import "@tanstack/react-start/server-only";
import { and, count, desc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import { INBOX_PAGE, type InboxInput, type MarkReadInput, type NotifySettingsInput } from "@/features/taskline/schema";
import { NOTIFY_DEFAULTS, workspaceSettings } from "@/features/taskline/settings";
import {
	type InboxPage,
	NOTIFY_KINDS,
	type NotifySettingsView,
	SANDBOX_SEGMENT,
	type UnreadCount,
} from "@/features/taskline/types";
import { tlMember, tlNotification, tlProject, tlWorkspace, user as userTable } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { TasklineServices } from "../access";
import { taskRef } from "../tasks/repository";
import { teamWorkspace } from "../workspace/repository";

/**
 * The caller's inbox and notification settings (Task 50). Notifications belong to an
 * account, across its workspaces; only those of workspaces the caller still belongs
 * to show (a deactivated member's stay hidden, as everything else of the team).
 */

/** Rows of `userId` in workspaces where they're still an active member. */
const mine = (userId: string): SQL =>
	and(
		eq(tlNotification.userId, userId),
		sql`exists (select 1 from ${tlMember} where ${tlMember.workspaceId} = ${tlNotification.workspaceId} and ${tlMember.userId} = ${userId} and ${tlMember.deactivatedAt} is null)`,
	) as SQL;

async function unreadOf(db: Db, userId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(tlNotification)
		.where(and(mine(userId), isNull(tlNotification.readAt)));
	return row?.value ?? 0;
}

export async function listInbox({ db, user }: TasklineServices, input: InboxInput): Promise<InboxPage> {
	const where = input.filter === "unread" ? and(mine(user.id), isNull(tlNotification.readAt)) : mine(user.id);
	const rows = await db
		.select({
			id: tlNotification.id,
			kind: tlNotification.kind,
			data: tlNotification.data,
			createdAt: tlNotification.createdAt,
			readAt: tlNotification.readAt,
			taskId: tlNotification.taskId,
			workspaceKind: tlWorkspace.kind,
			slug: tlWorkspace.slug,
			key: tlProject.key,
		})
		.from(tlNotification)
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlNotification.workspaceId))
		.innerJoin(tlProject, eq(tlProject.id, tlNotification.projectId))
		.where(where)
		.orderBy(desc(tlNotification.createdAt), desc(tlNotification.id))
		.limit(INBOX_PAGE * input.page + 1);
	const shown = rows.slice(0, INBOX_PAGE * input.page);
	return {
		items: shown.map((row) => ({
			id: row.id,
			kind: row.kind,
			data: row.data,
			ws: row.workspaceKind === "sandbox" ? SANDBOX_SEGMENT : row.slug,
			workspaceKind: row.workspaceKind,
			projectKey: row.key,
			// The ref's key is the project's (keys never change; a sandbox claim's rename moves it).
			ref: row.taskId && row.data.ref ? taskRef(row.key, Number(row.data.ref.split("-")[1])) : null,
			createdAt: row.createdAt.toISOString(),
			read: row.readAt !== null,
		})),
		unread: await unreadOf(db, user.id),
		hasMore: rows.length > shown.length,
		readAt: new Date().toISOString(),
	};
}

export async function unreadCount({ db, user }: TasklineServices): Promise<UnreadCount> {
	return { unread: await unreadOf(db, user.id) };
}

/** Marks the caller's own notifications; someone else's ids change nothing. */
export async function markRead({ db, user }: TasklineServices, input: MarkReadInput): Promise<UnreadCount> {
	if ("all" in input) {
		await db
			.update(tlNotification)
			.set({ readAt: new Date() })
			.where(and(eq(tlNotification.userId, user.id), isNull(tlNotification.readAt)));
	} else {
		await db
			.update(tlNotification)
			.set({ readAt: input.read ? new Date() : null })
			.where(and(eq(tlNotification.userId, user.id), inArray(tlNotification.id, input.ids)));
	}
	return { unread: await unreadOf(db, user.id) };
}

/** The defaults the caller's choices sit on: the team's when they're on it, else the built-in ones. */
async function defaultsFor(db: Db, userId: string) {
	const team = await teamWorkspace(db);
	if (!team) return NOTIFY_DEFAULTS;
	const [onTeam] = await db
		.select({ id: tlMember.id })
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, team.id), eq(tlMember.userId, userId), isNull(tlMember.deactivatedAt)));
	return onTeam ? workspaceSettings.parse(team.settings).notify : NOTIFY_DEFAULTS;
}

export async function getNotifySettings({ db, user }: TasklineServices): Promise<NotifySettingsView> {
	const rows = await db
		.select({ notify: tlMember.notify, locale: tlMember.locale, workspaceKind: tlWorkspace.kind })
		.from(tlMember)
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlMember.workspaceId))
		.where(and(eq(tlMember.userId, user.id), isNull(tlMember.deactivatedAt)));
	// The team's row speaks for the account when it has one (the same values are saved on every row).
	const first = rows.find((row) => row.workspaceKind === "team") ?? rows[0];
	const modes = Object.fromEntries(
		Object.entries(first?.notify ?? {}).filter(([kind]) => (NOTIFY_KINDS as ReadonlyArray<string>).includes(kind)),
	);
	const [account] = await db
		.select({ isAnonymous: userTable.isAnonymous })
		.from(userTable)
		.where(eq(userTable.id, user.id));
	return {
		defaults: await defaultsFor(db, user.id),
		modes,
		locale: first?.locale === "en" || first?.locale === "ne" ? first.locale : null,
		member: rows.length > 0,
		email: account?.isAnonymous !== true,
	};
}

/**
 * Saves the caller's modes and email language on every member row of theirs (the
 * team's and their sandbox's): settings belong to the person, not the workspace.
 * A mode equal to the default isn't stored, so a later change of the default reaches them.
 */
export async function saveNotifySettings(
	services: TasklineServices,
	input: NotifySettingsInput,
): Promise<NotifySettingsView> {
	const { db, user } = services;
	const defaults = await defaultsFor(db, user.id);
	const modes = Object.fromEntries(
		Object.entries(input.modes).filter(([kind, mode]) => defaults[kind as keyof typeof defaults] !== mode),
	);
	await db.update(tlMember).set({ notify: modes, locale: input.locale }).where(eq(tlMember.userId, user.id));
	return getNotifySettings(services);
}
