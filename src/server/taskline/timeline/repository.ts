import "@tanstack/react-start/server-only";
import { aliasedTable, and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Dependency, Milestone } from "@/features/taskline/types";
import { generateKeyBetween } from "@/lib/fractional-index";
import {
	type TlMilestoneRow,
	type TlProjectRow,
	type TlTaskRow,
	tlMilestone,
	tlProject,
	tlTask,
	tlTaskDependency,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { byPosition } from "../workflow/repository";

/** Milestones and dependencies (Task 54): plain reads and writes (the rules are the service's). */

export const milestoneDto = (row: TlMilestoneRow): Milestone => ({
	id: row.id,
	name: row.name,
	description: row.description,
	dueOn: row.dueOn,
	completedAt: row.completedAt?.toISOString() ?? null,
	position: row.position,
});

/** A project's milestones in their order. */
export async function listMilestones(db: Db, projectId: string): Promise<TlMilestoneRow[]> {
	return db
		.select()
		.from(tlMilestone)
		.where(eq(tlMilestone.projectId, projectId))
		.orderBy(byPosition(tlMilestone.position), asc(tlMilestone.id));
}

export async function getMilestone(db: Db, projectId: string, id: string): Promise<TlMilestoneRow | null> {
	const [row] = await db
		.select()
		.from(tlMilestone)
		.where(and(eq(tlMilestone.projectId, projectId), eq(tlMilestone.id, id)));
	return row ?? null;
}

export async function countMilestones(db: Db, projectId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlMilestone).where(eq(tlMilestone.projectId, projectId));
	return row?.total ?? 0;
}

/** The order key after the project's last milestone. */
export async function endOfMilestones(db: Db, projectId: string): Promise<string> {
	const [row] = await db
		.select({ position: tlMilestone.position })
		.from(tlMilestone)
		.where(eq(tlMilestone.projectId, projectId))
		.orderBy(desc(byPosition(tlMilestone.position)))
		.limit(1);
	return generateKeyBetween(row?.position ?? null, null);
}

export async function insertMilestone(tx: Tx, values: typeof tlMilestone.$inferInsert): Promise<TlMilestoneRow> {
	const [row] = await tx.insert(tlMilestone).values(values).returning();
	if (!row) throw new Error("Milestone insert returned no row");
	return row;
}

export async function patchMilestone(
	tx: Tx,
	id: string,
	set: Partial<Pick<TlMilestoneRow, "name" | "description" | "dueOn" | "position" | "completedAt">>,
): Promise<TlMilestoneRow> {
	const [row] = await tx.update(tlMilestone).set(set).where(eq(tlMilestone.id, id)).returning();
	if (!row) throw new Error("Milestone update returned no row");
	return row;
}

/** Deletes a milestone; its tasks keep going without one (`on delete set null`). */
export async function deleteMilestone(tx: Tx, id: string): Promise<void> {
	await tx.delete(tlMilestone).where(eq(tlMilestone.id, id));
}

/** The dependencies between a project's tasks outside the trash (the timeline's arrows). */
export async function projectDependencies(db: Db, projectId: string): Promise<Dependency[]> {
	const blocker = aliasedTable(tlTask, "blocker");
	const blocked = aliasedTable(tlTask, "blocked");
	return db
		.select({ blockerId: tlTaskDependency.blockerId, blockedId: tlTaskDependency.blockedId })
		.from(tlTaskDependency)
		.innerJoin(blocker, eq(blocker.id, tlTaskDependency.blockerId))
		.innerJoin(blocked, eq(blocked.id, tlTaskDependency.blockedId))
		.where(
			and(
				eq(blocker.projectId, projectId),
				eq(blocked.projectId, projectId),
				isNull(blocker.deletedAt),
				isNull(blocked.deletedAt),
			),
		)
		.orderBy(asc(tlTaskDependency.createdAt), asc(tlTaskDependency.blockerId));
}

/** One end of a task's dependency: the other task, its project, and which side it's on. */
export type LinkedRow = { relation: "blocked_by" | "blocks"; task: TlTaskRow; project: TlProjectRow };

/** Everything a task is blocked by and blocks, outside the trash, with the other task's project. */
export async function linksOf(db: Db, taskId: string): Promise<LinkedRow[]> {
	const rows = await db
		.select({ dependency: tlTaskDependency, task: tlTask, project: tlProject })
		.from(tlTaskDependency)
		.innerJoin(
			tlTask,
			or(
				and(eq(tlTaskDependency.blockedId, taskId), eq(tlTask.id, tlTaskDependency.blockerId)),
				and(eq(tlTaskDependency.blockerId, taskId), eq(tlTask.id, tlTaskDependency.blockedId)),
			),
		)
		.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
		.where(isNull(tlTask.deletedAt))
		.orderBy(asc(tlTaskDependency.createdAt), asc(tlTask.number));
	return rows.map(({ dependency, task, project }) => ({
		relation: dependency.blockedId === taskId ? "blocked_by" : "blocks",
		task,
		project,
	}));
}

/** The open tasks (outside the trash, not closed) blocking each of `taskIds`. */
export async function openBlockersOf(
	db: Db,
	taskIds: ReadonlyArray<string>,
): Promise<Array<{ blockedId: string; task: TlTaskRow; project: TlProjectRow }>> {
	if (taskIds.length === 0) return [];
	const rows = await db
		.select({ blockedId: tlTaskDependency.blockedId, task: tlTask, project: tlProject })
		.from(tlTaskDependency)
		.innerJoin(tlTask, eq(tlTask.id, tlTaskDependency.blockerId))
		.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
		.where(and(inArray(tlTaskDependency.blockedId, [...taskIds]), isNull(tlTask.deletedAt), isNull(tlTask.completedAt)))
		.orderBy(asc(tlProject.key), asc(tlTask.number));
	return rows;
}

/** How many dependencies a task has on one side (what blocks it, or what it blocks). */
export async function countSide(db: Db, taskId: string, side: "blocked_by" | "blocks"): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(tlTaskDependency)
		.where(side === "blocked_by" ? eq(tlTaskDependency.blockedId, taskId) : eq(tlTaskDependency.blockerId, taskId));
	return row?.total ?? 0;
}

/**
 * Whether `blocker` blocking `blocked` would close a loop: `blocked` already blocks
 * `blocker`, directly or through other tasks (a recursive CTE over the edges; `union`
 * stops at tasks already reached). Trashed tasks count: they come back when restored.
 */
export async function wouldCycle(db: Db, blockerId: string, blockedId: string): Promise<boolean> {
	const [row] = await db
		.select({
			cycle: sql<boolean>`exists (
				with recursive reach(id) as (
					select d.blocked_id from tl_task_dependency d where d.blocker_id = ${blockedId}
					union
					select d.blocked_id from tl_task_dependency d join reach on d.blocker_id = reach.id
				)
				select 1 from reach where reach.id = ${blockerId}
			)`,
		})
		.from(tlTask)
		.where(eq(tlTask.id, blockerId));
	return row?.cycle === true;
}

/** Adds a dependency; false when it was already there. */
export async function insertDependency(tx: Tx, blockerId: string, blockedId: string): Promise<boolean> {
	const rows = await tx
		.insert(tlTaskDependency)
		.values({ blockerId, blockedId })
		.onConflictDoNothing()
		.returning({ blockerId: tlTaskDependency.blockerId });
	return rows.length > 0;
}

/** Removes a dependency; false when there was none. */
export async function deleteDependency(tx: Tx, blockerId: string, blockedId: string): Promise<boolean> {
	const rows = await tx
		.delete(tlTaskDependency)
		.where(and(eq(tlTaskDependency.blockerId, blockerId), eq(tlTaskDependency.blockedId, blockedId)))
		.returning({ blockerId: tlTaskDependency.blockerId });
	return rows.length > 0;
}
