import "@tanstack/react-start/server-only";
import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { staleError } from "@/lib/concurrency";
import { notFound } from "@/server/db/crud";
import { tlProject } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";

/**
 * A project's `rev` and the rows' `version`s (docs/guides/taskline.md, "Concurrency").
 *
 * - `rev` goes up with every change to a project or its tasks, in the change's
 *   transaction: open pages poll it and refetch when it moved (Task 48).
 * - `version` goes up only when a form saves (a task's title and description, the
 *   project form, the settings): a save from an older version is refused as stale.
 *   Single-field changes (status, assignee, dates…) are last-write-wins and leave
 *   the version alone, so moving a card never makes someone's open description stale.
 *
 * `rev` and `task_seq` keep `updated_at` as it was (Drizzle's `$onUpdate` would move it):
 * they are bookkeeping, not an edit of the project.
 */

/** `updated_at` unchanged, for bookkeeping updates. */
const keepUpdatedAt = () => sql`${tlProject.updatedAt}`;

export async function bumpRev(tx: Tx, projectId: string): Promise<void> {
	await tx
		.update(tlProject)
		.set({ rev: sql`${tlProject.rev} + 1`, updatedAt: keepUpdatedAt() })
		.where(eq(tlProject.id, projectId));
}

/**
 * The project's next task number. The update takes the project's row lock until the
 * transaction ends, so two creates can't get the same number (the unique index on
 * (project, number) is the backstop).
 */
export async function nextTaskNumber(tx: Tx, projectId: string): Promise<number> {
	const [row] = await tx
		.update(tlProject)
		.set({ taskSeq: sql`${tlProject.taskSeq} + 1`, updatedAt: keepUpdatedAt() })
		.where(eq(tlProject.id, projectId))
		.returning({ taskSeq: tlProject.taskSeq });
	if (!row) throw notFound("Project");
	return row.taskSeq;
}

/** `count` consecutive task numbers (the CSV import), under the same row lock: the first of them. */
export async function reserveTaskNumbers(tx: Tx, projectId: string, count: number): Promise<number> {
	const [row] = await tx
		.update(tlProject)
		.set({ taskSeq: sql`${tlProject.taskSeq} + ${count}`, updatedAt: keepUpdatedAt() })
		.where(eq(tlProject.id, projectId))
		.returning({ taskSeq: tlProject.taskSeq });
	if (!row) throw notFound("Project");
	return row.taskSeq - count + 1;
}

type WithVersion = PgTable & { id: AnyPgColumn; version: AnyPgColumn };

/**
 * Saves `set` only while the row still has `version`, and bumps it, in one UPDATE.
 * Zero rows: deleted (NOT_FOUND) or saved by someone else since (a stale CONFLICT,
 * which forms turn into "reload").
 */
export async function saveVersioned<T extends WithVersion>(
	tx: Tx,
	table: T,
	{ id, version, set, what }: { id: string; version: number; set: PgUpdateSetSource<T>; what: string },
): Promise<T["$inferSelect"]> {
	const [row] = (await tx
		.update(table as PgTable)
		.set({ ...set, version: sql`${table.version} + 1` } as PgUpdateSetSource<PgTable>)
		.where(and(eq(table.id, id), eq(table.version, version)))
		.returning()) as T["$inferSelect"][];
	if (row) return row;
	const [exists] = await tx
		.select({ id: table.id })
		.from(table as PgTable)
		.where(eq(table.id, id));
	throw exists ? staleError(what) : notFound(what);
}
