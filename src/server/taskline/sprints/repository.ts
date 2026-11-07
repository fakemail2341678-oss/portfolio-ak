import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
	SprintDay,
	SprintState,
	SprintSummary,
	SprintTotals,
	Velocity,
	VelocityRow,
} from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import { type TlSprintRow, tlSprint, tlSprintSnapshot, tlStatus, tlTask } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Sprints: plain reads and writes (the rules, history and notifications are the
 * service's), and what the tasks service needs of them (it can't import the sprints
 * service, which imports it).
 */

/** Velocity is the average of this many last completed sprints. */
const VELOCITY_SPRINTS = 3;

export const completedError = () =>
	ruleError("CONFLICT", "Taskline: sprint completed", m.taskline_sprint_error_completed());

/** The average completed work of the last three completed sprints (oldest first in `rows`). */
export function velocityOf(rows: ReadonlyArray<VelocityRow>): Velocity {
	const last = rows.slice(-VELOCITY_SPRINTS);
	if (last.length === 0) return { points: null, tasks: null, minutes: null, sprints: 0 };
	const average = (pick: (row: VelocityRow) => number) =>
		Math.round((last.reduce((total, row) => total + pick(row), 0) / last.length) * 10) / 10;
	return {
		points: average((row) => row.completedPoints),
		tasks: average((row) => row.completedTasks),
		minutes: Math.round(average((row) => row.completedMinutes)),
		sprints: last.length,
	};
}

/** What the project query carries (every view reads it): the open sprints and the velocity. */
export async function projectSprints(
	db: Db,
	projectId: string,
): Promise<{ sprints: SprintSummary[]; velocity: Velocity; sprintCount: number }> {
	const [open, done, [all]] = await Promise.all([
		listSprints(db, projectId, ["active", "planned"]),
		velocityRows(db, projectId, VELOCITY_SPRINTS),
		db.select({ total: count() }).from(tlSprint).where(eq(tlSprint.projectId, projectId)),
	]);
	return { sprints: open.map(sprintDto), velocity: velocityOf(done), sprintCount: all?.total ?? 0 };
}

/** A sprint a task may be planned in: the project's (else NOT_FOUND), not completed (else CONFLICT). */
export async function checkSprint(db: Db, projectId: string, sprintId: string): Promise<void> {
	const sprint = await getSprint(db, projectId, sprintId);
	if (!sprint) throw notFound("Sprint");
	if (sprint.state === "completed") throw completedError();
}

export const sprintDto = (row: TlSprintRow): SprintSummary => ({
	id: row.id,
	name: row.name,
	goal: row.goal,
	state: row.state,
	startOn: row.startOn,
	endOn: row.endOn,
	startedAt: row.startedAt?.toISOString() ?? null,
	completedAt: row.completedAt?.toISOString() ?? null,
	committed:
		row.committedPoints === null || row.committedTasks === null
			? null
			: { points: row.committedPoints, tasks: row.committedTasks, minutes: row.committedMinutes ?? 0 },
	completed:
		row.completedPoints === null || row.completedTasks === null
			? null
			: { points: row.completedPoints, tasks: row.completedTasks, minutes: row.completedMinutes ?? 0 },
});

/** A project's sprints in some states: the active first, then by start (and when they were made). */
export async function listSprints(
	db: Db,
	projectId: string,
	states: ReadonlyArray<SprintState>,
): Promise<TlSprintRow[]> {
	return db
		.select()
		.from(tlSprint)
		.where(and(eq(tlSprint.projectId, projectId), inArray(tlSprint.state, [...states])))
		.orderBy(sql`${tlSprint.state} <> 'active'`, asc(tlSprint.startOn), asc(tlSprint.createdAt));
}

/** Every sprint of a project, newest first (the report's switcher). */
export async function allSprints(db: Db, projectId: string): Promise<TlSprintRow[]> {
	return db
		.select()
		.from(tlSprint)
		.where(eq(tlSprint.projectId, projectId))
		.orderBy(desc(tlSprint.startOn), desc(tlSprint.createdAt));
}

export async function getSprint(db: Db, projectId: string, sprintId: string): Promise<TlSprintRow | null> {
	const [row] = await db
		.select()
		.from(tlSprint)
		.where(and(eq(tlSprint.projectId, projectId), eq(tlSprint.id, sprintId)));
	return row ?? null;
}

/** The project's active sprint, or null. */
export async function activeSprint(db: Db, projectId: string): Promise<TlSprintRow | null> {
	const [row] = await db
		.select()
		.from(tlSprint)
		.where(and(eq(tlSprint.projectId, projectId), eq(tlSprint.state, "active")));
	return row ?? null;
}

export async function countSprints(db: Db, projectId: string, state: SprintState): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(tlSprint)
		.where(and(eq(tlSprint.projectId, projectId), eq(tlSprint.state, state)));
	return row?.total ?? 0;
}

export async function insertSprint(tx: Tx, values: typeof tlSprint.$inferInsert): Promise<TlSprintRow> {
	const [row] = await tx.insert(tlSprint).values(values).returning();
	if (!row) throw new Error("Sprint insert returned no row");
	return row;
}

export async function patchSprint(
	tx: Tx,
	sprintId: string,
	set: Partial<Omit<typeof tlSprint.$inferInsert, "id" | "projectId">>,
): Promise<TlSprintRow> {
	const [row] = await tx.update(tlSprint).set(set).where(eq(tlSprint.id, sprintId)).returning();
	if (!row) throw new Error("Sprint update returned no row");
	return row;
}

/** Deletes a sprint: its tasks go back to the backlog (`set null`), its snapshots with it. */
export async function deleteSprint(tx: Tx, sprintId: string): Promise<void> {
	await tx.delete(tlSprint).where(eq(tlSprint.id, sprintId));
}

const ZERO: SprintTotals = {
	scopePoints: 0,
	donePoints: 0,
	scopeTasks: 0,
	doneTasks: 0,
	scopeMinutes: 0,
	doneMinutes: 0,
};

/**
 * Each sprint's work now: its tasks outside the trash, canceled ones aside (scope), and
 * those in a completed status (done), as points (unestimated counts 0) and as tasks.
 */
export async function totalsOf(db: Db, sprintIds: ReadonlyArray<string>): Promise<Map<string, SprintTotals>> {
	const totals = new Map<string, SprintTotals>(sprintIds.map((id) => [id, { ...ZERO }]));
	if (sprintIds.length === 0) return totals;
	const inScope = sql`${tlStatus.category} <> 'canceled'`;
	const done = sql`${tlStatus.category} = 'completed'`;
	const rows = await db
		.select({
			sprintId: tlTask.sprintId,
			scopePoints: sql<number>`coalesce(sum(${tlTask.points}) filter (where ${inScope}), 0)`.mapWith(Number),
			donePoints: sql<number>`coalesce(sum(${tlTask.points}) filter (where ${done}), 0)`.mapWith(Number),
			scopeTasks: sql<number>`count(*) filter (where ${inScope})`.mapWith(Number),
			doneTasks: sql<number>`count(*) filter (where ${done})`.mapWith(Number),
			scopeMinutes: sql<number>`coalesce(sum(${tlTask.estimateMinutes}) filter (where ${inScope}), 0)`.mapWith(Number),
			doneMinutes: sql<number>`coalesce(sum(${tlTask.estimateMinutes}) filter (where ${done}), 0)`.mapWith(Number),
		})
		.from(tlTask)
		.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
		.where(and(inArray(tlTask.sprintId, [...sprintIds]), isNull(tlTask.deletedAt)))
		.groupBy(tlTask.sprintId);
	for (const { sprintId, ...row } of rows) if (sprintId) totals.set(sprintId, row);
	return totals;
}

/**
 * A sprint's totals at a day's close. The daily job never overwrites one (`replace`
 * false: running it twice changes nothing); the start and the completion do.
 */
export async function writeSnapshot(
	tx: Db,
	sprintId: string,
	day: string,
	totals: SprintTotals,
	{ replace }: { replace: boolean },
): Promise<boolean> {
	const insert = tx.insert(tlSprintSnapshot).values({ sprintId, day, ...totals });
	const rows = await (replace
		? insert.onConflictDoUpdate({
				target: [tlSprintSnapshot.sprintId, tlSprintSnapshot.day],
				set: { ...totals, takenAt: new Date() },
			})
		: insert.onConflictDoNothing()
	).returning({ day: tlSprintSnapshot.day });
	return rows.length > 0;
}

export async function snapshotsOf(db: Db, sprintId: string): Promise<SprintDay[]> {
	const rows = await db
		.select()
		.from(tlSprintSnapshot)
		.where(eq(tlSprintSnapshot.sprintId, sprintId))
		.orderBy(asc(tlSprintSnapshot.day));
	return rows.map(({ day, scopePoints, donePoints, scopeTasks, doneTasks, scopeMinutes, doneMinutes }) => ({
		day,
		scopePoints,
		donePoints,
		scopeTasks,
		doneTasks,
		scopeMinutes,
		doneMinutes,
	}));
}

/** The last `limit` completed sprints of a project, oldest first: the velocity chart's bars. */
export async function velocityRows(db: Db, projectId: string, limit: number): Promise<VelocityRow[]> {
	const rows = await db
		.select()
		.from(tlSprint)
		.where(and(eq(tlSprint.projectId, projectId), eq(tlSprint.state, "completed")))
		.orderBy(desc(tlSprint.completedAt), desc(tlSprint.endOn))
		.limit(limit);
	return rows.reverse().map((row) => ({
		id: row.id,
		name: row.name,
		committedPoints: row.committedPoints ?? 0,
		completedPoints: row.completedPoints ?? 0,
		committedTasks: row.committedTasks ?? 0,
		completedTasks: row.completedTasks ?? 0,
		committedMinutes: row.committedMinutes ?? 0,
		completedMinutes: row.completedMinutes ?? 0,
	}));
}

/** Moves a sprint's open tasks (not closed, not trashed) to another sprint or the backlog; returns their ids. */
export async function moveOpenTasks(tx: Tx, fromSprintId: string, toSprintId: string | null): Promise<string[]> {
	const rows = await tx
		.update(tlTask)
		.set({ sprintId: toSprintId })
		.where(and(eq(tlTask.sprintId, fromSprintId), isNull(tlTask.completedAt), isNull(tlTask.deletedAt)))
		.returning({ id: tlTask.id });
	return rows.map((row) => row.id);
}

/** Active sprints of some projects (Home, the admin's overview). */
export async function activeSprintsOf(db: Db, projectIds: ReadonlyArray<string>): Promise<TlSprintRow[]> {
	if (projectIds.length === 0) return [];
	return db
		.select()
		.from(tlSprint)
		.where(and(inArray(tlSprint.projectId, [...projectIds]), eq(tlSprint.state, "active")))
		.orderBy(asc(tlSprint.endOn), asc(tlSprint.name));
}
