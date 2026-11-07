import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, inArray, isNull, max, or, sql } from "drizzle-orm";
import type { TaskPriority } from "@/features/taskline/types";
import { tlActivity, tlStatus, tlTask, tlTaskWatcher } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** Reads across one workspace's projects for the shell and Home: plain queries (rules are in ./service.ts). */

/** The projects among `projectIds` the member worked on (recorded activity in), most recent first. */
export async function recentProjectIds(db: Db, memberId: string, projectIds: string[], limit: number) {
	if (projectIds.length === 0) return [];
	const last = max(tlActivity.at);
	const rows = await db
		.select({ projectId: tlActivity.projectId, at: last })
		.from(tlActivity)
		.where(and(eq(tlActivity.actorId, memberId), inArray(tlActivity.projectId, projectIds)))
		.groupBy(tlActivity.projectId)
		.orderBy(desc(last))
		.limit(limit);
	return rows.map((row) => ({ projectId: row.projectId, at: row.at ?? new Date(0) }));
}

/**
 * Open tasks (not closed, not in the trash) in `projectIds` assigned to the member or
 * watched by them (My work, Task 51): soonest due first, undated last.
 */
export async function openTasksOf(db: Db, memberId: string, projectIds: string[], limit: number) {
	if (projectIds.length === 0) return [];
	const watching = sql<boolean>`exists (select 1 from ${tlTaskWatcher} where ${tlTaskWatcher.taskId} = ${tlTask.id} and ${tlTaskWatcher.memberId} = ${memberId})`;
	const rows = await db
		.select({
			id: tlTask.id,
			projectId: tlTask.projectId,
			number: tlTask.number,
			type: tlTask.type,
			title: tlTask.title,
			priority: tlTask.priority,
			dueOn: tlTask.dueOn,
			assigneeId: tlTask.assigneeId,
			watching,
			statusName: tlStatus.name,
			statusCategory: tlStatus.category,
			statusColor: tlStatus.color,
		})
		.from(tlTask)
		.innerJoin(tlStatus, eq(tlStatus.id, tlTask.statusId))
		.where(
			and(
				or(eq(tlTask.assigneeId, memberId), watching),
				inArray(tlTask.projectId, projectIds),
				isNull(tlTask.completedAt),
				isNull(tlTask.deletedAt),
			),
		)
		.orderBy(sql`${tlTask.dueOn} asc nulls last`, desc(tlTask.priority), asc(tlTask.number))
		.limit(limit);
	return rows.map((row) => ({ ...row, priority: row.priority as TaskPriority, assigned: row.assigneeId === memberId }));
}
