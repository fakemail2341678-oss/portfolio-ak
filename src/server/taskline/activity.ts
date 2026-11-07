import "@tanstack/react-start/server-only";
import { asc, eq } from "drizzle-orm";
import type { ActivityData, ActivityKind, ActivityValue, TaskActivity } from "@/features/taskline/types";
import { tlActivity } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { ProjectAccess } from "./access";

/**
 * Taskline's history (decision 0205): every app write leaves a row here, in its own
 * transaction. It is the app's record for members (a task's history, a project's
 * feed), not the admin audit log (`withAudit`), which holds admin-area writes only.
 * The actor is a member, so the name survives the account; an admin acting through
 * `taskline:manage` without a member row is recorded as `{ via: "admin" }`.
 */
export type ActivityEntry = { kind: ActivityKind; taskId?: string | null; data?: ActivityData };

export async function recordActivity(tx: Tx, access: ProjectAccess, ...entries: ActivityEntry[]): Promise<void> {
	if (entries.length === 0) return;
	const actorId = access.member?.id ?? null;
	await tx.insert(tlActivity).values(
		entries.map((entry) => ({
			workspaceId: access.workspace.id,
			projectId: access.project.id,
			taskId: entry.taskId ?? null,
			actorId,
			kind: entry.kind,
			data: actorId ? (entry.data ?? {}) : { ...entry.data, via: "admin" },
		})),
	);
}

/**
 * What Taskline did by itself (Task 56): an automation (`{ via: "automation", automation:
 * its name }`) or a repeating task's next one made by the daily job (`{ via: "repeat" }`).
 * No member acted, so `actor_id` is null.
 */
export type SystemActor = { via: "automation"; automation: string } | { via: "repeat" };

export async function recordSystemActivity(
	tx: Tx,
	scope: Pick<ProjectAccess, "workspace" | "project">,
	actor: SystemActor,
	...entries: ActivityEntry[]
): Promise<void> {
	if (entries.length === 0) return;
	await tx.insert(tlActivity).values(
		entries.map((entry) => ({
			workspaceId: scope.workspace.id,
			projectId: scope.project.id,
			taskId: entry.taskId ?? null,
			actorId: null,
			kind: entry.kind,
			data: { ...entry.data, ...actor },
		})),
	);
}

/**
 * One `task.updated` entry per field of `after` that differs from the row `before`:
 * `{ field, from, to }`. The fields are scalars (type, priority, ids, dates).
 */
export function fieldChanges(
	taskId: string,
	before: object,
	after: Readonly<Record<string, ActivityValue | undefined>>,
): ActivityEntry[] {
	const old = before as Readonly<Record<string, ActivityValue | undefined>>;
	return Object.entries(after).flatMap(([field, to]) =>
		to === undefined || JSON.stringify(old[field] ?? null) === JSON.stringify(to)
			? []
			: [{ kind: "task.updated" as const, taskId, data: { field, from: old[field] ?? null, to } }],
	);
}

const dto = (row: typeof tlActivity.$inferSelect): TaskActivity => ({
	id: row.id,
	kind: row.kind,
	actorId: row.actorId,
	data: row.data,
	at: row.at.toISOString(),
});

/** A task's history, oldest first (the task page's timeline). */
export async function taskActivity(db: Db, taskId: string, limit = 100): Promise<TaskActivity[]> {
	const rows = await db
		.select()
		.from(tlActivity)
		.where(eq(tlActivity.taskId, taskId))
		.orderBy(asc(tlActivity.at), asc(tlActivity.id))
		.limit(limit);
	return rows.map(dto);
}
