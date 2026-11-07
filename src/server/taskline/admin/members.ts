import "@tanstack/react-start/server-only";
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import type {
	AccountOption,
	AdminMemberItem,
	AdminMemberPage,
	UpdateMemberInput,
} from "@/features/taskline/admin/schema";
import type { AdminMemberListInput } from "@/features/taskline/admin/search";
import type { TeamRole } from "@/features/taskline/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { changes } from "@/server/audit/record";
import { listPage, notFound, uniqueViolation, withAudit } from "@/server/db/crud";
import { allOf, likePattern, textSearch } from "@/server/db/list";
import { type TlMemberRow, tlMember, tlProjectMember, tlTask, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import { fieldError } from "../rules";
import * as members from "../workspace/repository";
import { bumpRevs, memberTarget, recordTeamActivity, team } from "./team";

/**
 * /admin/taskline/members (PLAN 11.5; decision 0212): the team is Taskline's own
 * list, not an RBAC role. Accounts are added (guests never), given a team role, a
 * title and a weekly capacity, deactivated (their open tasks reassigned or left
 * unassigned; their history stays) and reactivated. Every change is audited.
 */

async function items(db: Db, rows: TlMemberRow[], today: string): Promise<AdminMemberItem[]> {
	const ids = rows.map((row) => row.id);
	const userIds = rows.flatMap((row) => (row.userId ? [row.userId] : []));
	const [emails, workload, projectCounts] = await Promise.all([
		userIds.length === 0
			? Promise.resolve([])
			: db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds)),
		ids.length === 0
			? Promise.resolve([])
			: db
					.select({
						memberId: tlTask.assigneeId,
						open: count(),
						overdue: sql<number>`count(*) filter (where ${tlTask.dueOn} < ${today})`.mapWith(Number),
					})
					.from(tlTask)
					.where(and(inArray(tlTask.assigneeId, ids), isNull(tlTask.completedAt), isNull(tlTask.deletedAt)))
					.groupBy(tlTask.assigneeId),
		ids.length === 0
			? Promise.resolve([])
			: db
					.select({ memberId: tlProjectMember.memberId, total: count() })
					.from(tlProjectMember)
					.where(inArray(tlProjectMember.memberId, ids))
					.groupBy(tlProjectMember.memberId),
	]);
	const emailOf = new Map(emails.map((row) => [row.id, row.email]));
	const load = new Map(workload.map((row) => [row.memberId, row]));
	const onProjects = new Map(projectCounts.map((row) => [row.memberId, row.total]));
	return rows.map((row) => ({
		id: row.id,
		userId: row.userId,
		name: row.displayName,
		email: row.userId ? (emailOf.get(row.userId) ?? null) : null,
		role: row.role,
		title: row.title,
		capacityMinutesWeek: row.capacityMinutesWeek,
		open: load.get(row.id)?.open ?? 0,
		overdue: load.get(row.id)?.overdue ?? 0,
		projects: onProjects.get(row.id) ?? 0,
		deactivated: row.deactivatedAt !== null,
		joinedAt: row.createdAt.toISOString(),
	}));
}

export async function list({ db }: Pick<Services, "db">, input: AdminMemberListInput): Promise<AdminMemberPage> {
	const { workspace, settings } = await team(db);
	const today = todayInZone(settings.timeZone);
	const byEmail = input.q
		? inArray(
				tlMember.userId,
				db
					.select({ id: user.id })
					.from(user)
					.where(ilike(user.email, likePattern(input.q))),
			)
		: undefined;
	return listPage(db, tlMember, {
		input,
		where: allOf(
			eq(tlMember.workspaceId, workspace.id),
			input.state === "all"
				? undefined
				: input.state === "active"
					? isNull(tlMember.deactivatedAt)
					: isNotNull(tlMember.deactivatedAt),
			input.role === "all" ? undefined : eq(tlMember.role, input.role),
			input.q ? or(textSearch(input.q, [tlMember.displayName, tlMember.title]), byEmail) : undefined,
		),
		sort: { columns: { name: sql`lower(${tlMember.displayName})`, joined: tlMember.createdAt }, fallback: "name" },
		map: (rows) => items(db, rows, today),
	});
}

/** Accounts to add: by name or email, never guests, nobody already on the team (active or not). */
export async function searchAccounts({ db }: Pick<Services, "db">, q: string): Promise<AccountOption[]> {
	const { workspace } = await team(db);
	const onTeam = db
		.select({ id: sql<string>`${tlMember.userId}` })
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspace.id), isNotNull(tlMember.userId)));
	const rows = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(
			allOf(
				or(isNull(user.isAnonymous), eq(user.isAnonymous, false)),
				notInArray(user.id, onTeam),
				textSearch(q, [user.name, user.email]),
			),
		)
		.orderBy(asc(user.name), asc(user.email))
		.limit(20);
	return rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.email}` }));
}

/** Puts accounts on the team with `role`. A guest, a missing account or one already on it is refused. */
export async function add(
	{ db, actor }: Services,
	{ userIds, role }: { userIds: ReadonlyArray<string>; role: TeamRole },
): Promise<{ added: number }> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const accounts = await tx
			.select({ id: user.id, name: user.name, guest: user.isAnonymous })
			.from(user)
			.where(inArray(user.id, [...userIds]));
		if (accounts.length !== new Set(userIds).size || accounts.some((account) => account.guest === true)) {
			throw fieldError("BAD_REQUEST", "userIds", m.taskline_admin_error_account());
		}
		let rows: TlMemberRow[];
		try {
			rows = await members.insertMembers(
				tx,
				accounts.map((account) => ({ workspaceId: workspace.id, userId: account.id, displayName: account.name, role })),
			);
		} catch (error) {
			throw uniqueViolation(error, {
				tl_member_workspace_user_unique: { field: "userIds", message: m.taskline_admin_error_already_member },
			});
		}
		audit(
			...rows.map((row) => ({
				action: "taskline.member.add" as const,
				target: memberTarget(row),
				after: { role: row.role },
			})),
		);
		return { added: rows.length };
	});
}

async function teamMember(db: Db, workspaceId: string, id: string): Promise<TlMemberRow> {
	const row = await members.memberById(db, workspaceId, id);
	if (!row) throw notFound("Member");
	return row;
}

export async function update({ db, actor }: Services, { id, ...fields }: UpdateMemberInput): Promise<AdminMemberItem> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace, settings } = await team(tx);
		const before = await teamMember(tx, workspace.id, id);
		const [after] = await tx.update(tlMember).set(fields).where(eq(tlMember.id, id)).returning();
		if (!after) throw notFound("Member");
		const changed = changes(before, after, ["role", "title", "capacityMinutesWeek"] as const);
		if (changed) audit({ action: "taskline.member.update", target: memberTarget(after), ...changed });
		const [item] = await items(tx, [after], todayInZone(settings.timeZone));
		if (!item) throw notFound("Member");
		return item;
	});
}

/**
 * Takes a member off the team: they keep their name in the history and lose all
 * access (a 404 everywhere, 0204). Their open tasks go to `reassignTo` (another active
 * member) or are left unassigned, each change in the task's history.
 */
export async function deactivate(
	{ db, actor }: Services,
	{ id, reassignTo }: { id: string; reassignTo: string | null },
): Promise<{ reassigned: number }> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const member = await teamMember(tx, workspace.id, id);
		if (member.deactivatedAt) return { reassigned: 0 };
		if (reassignTo) {
			const next = await members.memberById(tx, workspace.id, reassignTo);
			if (!next || next.deactivatedAt || next.id === member.id) {
				throw fieldError("BAD_REQUEST", "reassignTo", m.taskline_admin_error_member());
			}
		}
		const open = await tx
			.select({ id: tlTask.id, projectId: tlTask.projectId })
			.from(tlTask)
			.where(and(eq(tlTask.assigneeId, member.id), isNull(tlTask.completedAt), isNull(tlTask.deletedAt)));
		if (open.length > 0) {
			await tx
				.update(tlTask)
				.set({ assigneeId: reassignTo })
				.where(
					inArray(
						tlTask.id,
						open.map((task) => task.id),
					),
				);
			const self = await members.memberOf(tx, workspace.id, actor.id);
			await recordTeamActivity(
				tx,
				open.map((task) => ({
					workspaceId: workspace.id,
					projectId: task.projectId,
					taskId: task.id,
					actorId: self && !self.deactivatedAt && self.id !== member.id ? self.id : null,
					kind: "task.updated" as const,
					data: { field: "assigneeId", from: member.id, to: reassignTo },
				})),
			);
			await bumpRevs(tx, [...new Set(open.map((task) => task.projectId))]);
		}
		await members.setMemberDeactivated(tx, member.id, new Date());
		audit({
			action: "taskline.member.deactivate",
			target: memberTarget(member),
			after: { reassigned: open.length, reassignTo },
		});
		return { reassigned: open.length };
	});
}

export async function reactivate({ db, actor }: Services, { id }: { id: string }): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const member = await teamMember(tx, workspace.id, id);
		if (!member.deactivatedAt) return;
		if (!member.userId) throw notFound("Member");
		await members.setMemberDeactivated(tx, member.id, null);
		audit({ action: "taskline.member.reactivate", target: memberTarget(member) });
	});
}

/** The team's active members, for pickers (a project's lead, where tasks go). */
export async function options({ db }: Pick<Services, "db">): Promise<{ id: string; name: string }[]> {
	const { workspace } = await team(db);
	return db
		.select({ id: tlMember.id, name: tlMember.displayName })
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspace.id), isNull(tlMember.deactivatedAt), isNotNull(tlMember.userId)))
		.orderBy(asc(tlMember.displayName), asc(tlMember.id));
}
