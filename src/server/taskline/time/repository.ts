import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, type SQL, sql } from "drizzle-orm";
import type { TimeEntry } from "@/features/taskline/types";
import {
	type TlTimeEntryRow,
	tlActivity,
	tlMember,
	tlProject,
	tlTask,
	tlTimeEntry,
	tlWorkspace,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { taskRef } from "../tasks/repository";

/** Time entries: plain reads and writes (who may, the lock and the quota are the service's). */

/** A timer runs while it has a start and no end. */
export const isRunning = and(isNotNull(tlTimeEntry.startedAt), isNull(tlTimeEntry.endedAt));
/** What counts in sums: everything but a running timer (whose minutes are 0 anyway). */
export const isStopped = sql`not (${tlTimeEntry.startedAt} is not null and ${tlTimeEntry.endedAt} is null)`;

/** An entry with what its row on a page names: the task's reference and title, the project, the member. */
export type DescribedEntry = {
	row: TlTimeEntryRow;
	project: { id: string; key: string; name: string };
	task: { number: number; title: string } | null;
	memberName: string;
};

/** Names for entries: their projects, tasks and members, read in three queries. */
export async function describe(db: Db, rows: ReadonlyArray<TlTimeEntryRow>): Promise<DescribedEntry[]> {
	if (rows.length === 0) return [];
	const projectIds = [...new Set(rows.map((row) => row.projectId))];
	const taskIds = [...new Set(rows.flatMap((row) => (row.taskId ? [row.taskId] : [])))];
	const memberIds = [...new Set(rows.map((row) => row.memberId))];
	const [projects, tasks, members] = await Promise.all([
		db
			.select({ id: tlProject.id, key: tlProject.key, name: tlProject.name })
			.from(tlProject)
			.where(inArray(tlProject.id, projectIds)),
		taskIds.length === 0
			? Promise.resolve([])
			: db
					.select({ id: tlTask.id, number: tlTask.number, title: tlTask.title })
					.from(tlTask)
					.where(inArray(tlTask.id, taskIds)),
		db.select({ id: tlMember.id, name: tlMember.displayName }).from(tlMember).where(inArray(tlMember.id, memberIds)),
	]);
	const projectOf = new Map(projects.map((project) => [project.id, project]));
	const taskOf = new Map(tasks.map((task) => [task.id, task]));
	const nameOf = new Map(members.map((member) => [member.id, member.name]));
	return rows.map((row) => ({
		row,
		project: projectOf.get(row.projectId) ?? { id: row.projectId, key: "", name: "" },
		task: row.taskId ? (taskOf.get(row.taskId) ?? null) : null,
		memberName: nameOf.get(row.memberId) ?? "",
	}));
}

/** An entry as pages show it; `canEdit` and `locked` are the caller's (the service's call). */
export function entryDto(entry: DescribedEntry, rights: { canEdit: boolean; locked: boolean }): TimeEntry {
	const { row, project, task } = entry;
	return {
		id: row.id,
		taskId: row.taskId,
		ref: task && project.key ? taskRef(project.key, task.number) : null,
		title: task?.title ?? null,
		project,
		memberId: row.memberId,
		memberName: entry.memberName,
		onDay: row.onDay,
		minutes: row.minutes,
		note: row.note,
		billable: row.billable,
		running: row.startedAt !== null && row.endedAt === null,
		startedAt: row.startedAt?.toISOString() ?? null,
		...rights,
	};
}

export async function getEntry(db: Db, workspaceId: string, id: string): Promise<TlTimeEntryRow | null> {
	const [row] = await db
		.select()
		.from(tlTimeEntry)
		.where(and(eq(tlTimeEntry.workspaceId, workspaceId), eq(tlTimeEntry.id, id)));
	return row ?? null;
}

export async function insertEntry(tx: Tx, values: typeof tlTimeEntry.$inferInsert): Promise<TlTimeEntryRow> {
	const [row] = await tx.insert(tlTimeEntry).values(values).returning();
	if (!row) throw new Error("Time entry insert returned no row");
	return row;
}

export async function insertEntries(tx: Tx, values: ReadonlyArray<typeof tlTimeEntry.$inferInsert>) {
	if (values.length === 0) return [];
	return tx
		.insert(tlTimeEntry)
		.values([...values])
		.returning();
}

export async function patchEntry(
	tx: Tx,
	id: string,
	set: Partial<Pick<TlTimeEntryRow, "onDay" | "minutes" | "note" | "billable" | "endedAt">>,
): Promise<TlTimeEntryRow> {
	const [row] = await tx.update(tlTimeEntry).set(set).where(eq(tlTimeEntry.id, id)).returning();
	if (!row) throw new Error("Time entry update returned no row");
	return row;
}

export async function deleteEntries(tx: Tx, ids: ReadonlyArray<string>): Promise<void> {
	if (ids.length === 0) return;
	await tx.delete(tlTimeEntry).where(inArray(tlTimeEntry.id, [...ids]));
}

/** Entries in a workspace (what its quota counts). */
export async function countEntries(db: Db, workspaceId: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`count(*)`.mapWith(Number) })
		.from(tlTimeEntry)
		.where(eq(tlTimeEntry.workspaceId, workspaceId));
	return row?.total ?? 0;
}

/** The running timers of every member row of an account (in any workspace), with where they run. */
export async function runningOfUser(db: Db, userId: string) {
	return db
		.select({ entry: tlTimeEntry, workspace: tlWorkspace, memberId: tlMember.id })
		.from(tlTimeEntry)
		.innerJoin(tlMember, eq(tlMember.id, tlTimeEntry.memberId))
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlTimeEntry.workspaceId))
		.where(and(eq(tlMember.userId, userId), isRunning))
		.orderBy(desc(tlTimeEntry.startedAt));
}

/** Timers started before `before` and still running (the daily job stops them). */
export async function runningSince(db: Db, before: Date) {
	return db
		.select()
		.from(tlTimeEntry)
		.where(and(isRunning, sql`${tlTimeEntry.startedAt} < ${before}`));
}

/** The task's time: everyone's logged and billable minutes. */
export async function taskTotals(db: Db, taskId: string): Promise<{ logged: number; billable: number }> {
	const [row] = await db
		.select({
			logged: sql<number>`coalesce(sum(${tlTimeEntry.minutes}), 0)`.mapWith(Number),
			billable: sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
				Number,
			),
		})
		.from(tlTimeEntry)
		.where(eq(tlTimeEntry.taskId, taskId));
	return { logged: row?.logged ?? 0, billable: row?.billable ?? 0 };
}

/** Entries matching `where`, newest day first (then newest made), at most `limit`. */
export async function latestEntries(db: Db, where: SQL | undefined, limit: number): Promise<TlTimeEntryRow[]> {
	return db
		.select()
		.from(tlTimeEntry)
		.where(where)
		.orderBy(desc(tlTimeEntry.onDay), desc(tlTimeEntry.createdAt))
		.limit(limit);
}

/** A timesheet cell's stopped entries, oldest first (what `planCell` changes). */
export async function cellEntries(db: Db, memberId: string, taskId: string, day: string): Promise<TlTimeEntryRow[]> {
	return db
		.select()
		.from(tlTimeEntry)
		.where(
			and(eq(tlTimeEntry.memberId, memberId), eq(tlTimeEntry.taskId, taskId), eq(tlTimeEntry.onDay, day), isStopped),
		)
		.orderBy(asc(tlTimeEntry.createdAt), asc(tlTimeEntry.id));
}

/** A member's stopped time from `from` to `to`, summed per project, task and day. */
export async function sumsByCell(db: Db, memberId: string, from: string, to: string) {
	return db
		.select({
			projectId: tlTimeEntry.projectId,
			taskId: tlTimeEntry.taskId,
			onDay: tlTimeEntry.onDay,
			minutes: sql<number>`sum(${tlTimeEntry.minutes})`.mapWith(Number),
		})
		.from(tlTimeEntry)
		.where(and(eq(tlTimeEntry.memberId, memberId), gte(tlTimeEntry.onDay, from), lte(tlTimeEntry.onDay, to), isStopped))
		.groupBy(tlTimeEntry.projectId, tlTimeEntry.taskId, tlTimeEntry.onDay);
}

/** The same, billable and non-billable time apart (what "Copy last week" copies). */
export async function sumsByCellAndBillable(db: Db, memberId: string, from: string, to: string) {
	return db
		.select({
			projectId: tlTimeEntry.projectId,
			taskId: tlTimeEntry.taskId,
			onDay: tlTimeEntry.onDay,
			billable: tlTimeEntry.billable,
			minutes: sql<number>`sum(${tlTimeEntry.minutes})`.mapWith(Number),
		})
		.from(tlTimeEntry)
		.where(and(eq(tlTimeEntry.memberId, memberId), gte(tlTimeEntry.onDay, from), lte(tlTimeEntry.onDay, to), isStopped))
		.groupBy(tlTimeEntry.projectId, tlTimeEntry.taskId, tlTimeEntry.onDay, tlTimeEntry.billable);
}

/** Per task of a project: logged and billable minutes (tasks deleted for good sum under null). */
export async function sumsByTask(db: Db, projectId: string) {
	return db
		.select({
			taskId: tlTimeEntry.taskId,
			logged: sql<number>`sum(${tlTimeEntry.minutes})`.mapWith(Number),
			billable: sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
				Number,
			),
		})
		.from(tlTimeEntry)
		.where(eq(tlTimeEntry.projectId, projectId))
		.groupBy(tlTimeEntry.taskId);
}

/** Per member of a project: logged and billable minutes. */
export async function sumsByMember(db: Db, projectId: string) {
	return db
		.select({
			memberId: tlTimeEntry.memberId,
			logged: sql<number>`sum(${tlTimeEntry.minutes})`.mapWith(Number),
			billable: sql<number>`coalesce(sum(${tlTimeEntry.minutes}) filter (where ${tlTimeEntry.billable}), 0)`.mapWith(
				Number,
			),
		})
		.from(tlTimeEntry)
		.where(eq(tlTimeEntry.projectId, projectId))
		.groupBy(tlTimeEntry.memberId);
}

/** Open tasks assigned to a member in the given projects, recently changed first: the timesheet's suggestions. */
export async function assignedOpenTasks(db: Db, memberId: string, projectIds: ReadonlyArray<string>, limit: number) {
	if (projectIds.length === 0) return [];
	return db
		.select()
		.from(tlTask)
		.where(
			and(
				eq(tlTask.assigneeId, memberId),
				inArray(tlTask.projectId, [...projectIds]),
				isNull(tlTask.deletedAt),
				isNull(tlTask.completedAt),
			),
		)
		.orderBy(desc(tlTask.updatedAt))
		.limit(limit);
}

/** A `time.logged` entry in a project's history, for writes made without a resolved project (a timer stopping). */
export async function recordLogged(
	tx: Tx,
	entry: Pick<TlTimeEntryRow, "id" | "workspaceId" | "projectId" | "taskId" | "memberId" | "minutes">,
	extra: { auto?: true; actorId?: string | null } = {},
): Promise<void> {
	await tx.insert(tlActivity).values({
		workspaceId: entry.workspaceId,
		projectId: entry.projectId,
		taskId: entry.taskId,
		actorId: extra.actorId === undefined ? entry.memberId : extra.actorId,
		kind: "time.logged",
		data: { minutes: entry.minutes, entryId: entry.id, ...(extra.auto ? { auto: true } : {}) },
	});
}
