import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import type { FieldValue, TaskField } from "@/features/taskline/types";
import { type TlFieldRow, tlField, tlTask } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { byPosition } from "../workflow/repository";

/**
 * Custom fields' rows (Task 55): definitions in `tl_field`, values in `tl_task.fields`
 * (jsonb by field id). A scope is a workspace's own fields (`projectId` null) or one
 * project's.
 */

export type FieldScope = { workspaceId: string; projectId: string | null };

export const fieldDto = (row: TlFieldRow): TaskField => ({
	id: row.id,
	projectId: row.projectId,
	name: row.name,
	type: row.type,
	options: row.options,
	required: row.required,
	position: row.position,
	archived: row.archivedAt !== null,
});

const inScope = ({ workspaceId, projectId }: FieldScope) =>
	and(eq(tlField.workspaceId, workspaceId), projectId ? eq(tlField.projectId, projectId) : isNull(tlField.projectId));

/** The fields a project's tasks can have: the workspace's first, then its own, each in order (archived too). */
export async function listFields(db: Db, workspaceId: string, projectId: string): Promise<TlFieldRow[]> {
	return db
		.select()
		.from(tlField)
		.where(and(eq(tlField.workspaceId, workspaceId), or(isNull(tlField.projectId), eq(tlField.projectId, projectId))))
		.orderBy(sql`${tlField.projectId} is not null`, byPosition(tlField.position), asc(tlField.id));
}

/** One scope's fields in order (the admin's workspace fields, a lead's project fields). */
export async function scopeFields(db: Db, scope: FieldScope): Promise<TlFieldRow[]> {
	return db.select().from(tlField).where(inScope(scope)).orderBy(byPosition(tlField.position), asc(tlField.id));
}

export async function getField(db: Db, scope: FieldScope, id: string): Promise<TlFieldRow | null> {
	const [row] = await db
		.select()
		.from(tlField)
		.where(and(inScope(scope), eq(tlField.id, id)));
	return row ?? null;
}

export async function countFields(db: Db, scope: FieldScope): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlField).where(inScope(scope));
	return row?.total ?? 0;
}

export async function lastPosition(db: Db, scope: FieldScope): Promise<string | null> {
	const [row] = await db
		.select({ position: tlField.position })
		.from(tlField)
		.where(inScope(scope))
		.orderBy(desc(byPosition(tlField.position)))
		.limit(1);
	return row?.position ?? null;
}

export async function insertField(tx: Tx, values: typeof tlField.$inferInsert): Promise<TlFieldRow> {
	const [row] = await tx.insert(tlField).values(values).returning();
	if (!row) throw new Error("Field insert returned no row");
	return row;
}

export async function updateField(
	tx: Tx,
	id: string,
	set: Partial<Pick<TlFieldRow, "name" | "required" | "options" | "position" | "archivedAt">>,
): Promise<TlFieldRow> {
	const [row] = await tx.update(tlField).set(set).where(eq(tlField.id, id)).returning();
	if (!row) throw new Error("Field update returned no row");
	return row;
}

export async function deleteField(tx: Tx, id: string): Promise<void> {
	await tx.delete(tlField).where(eq(tlField.id, id));
}

/** The tasks a field's values can be on: the workspace's, or one project's. */
const tasksOf = ({ workspaceId, projectId }: FieldScope) =>
	projectId ? eq(tlTask.projectId, projectId) : eq(tlTask.workspaceId, workspaceId);

/** Whether a task has a value of the field (jsonb `?`, which the GIN index serves). */
export const hasValue = (fieldId: string) => sql`${tlTask.fields} ? ${fieldId}`;

/** How many tasks (outside the trash) have a value of each field. */
export async function valueCounts(db: Db, fields: ReadonlyArray<TlFieldRow>): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	for (const field of fields) {
		const [row] = await db
			.select({ total: count() })
			.from(tlTask)
			.where(and(tasksOf(field), isNull(tlTask.deletedAt), hasValue(field.id)));
		counts.set(field.id, row?.total ?? 0);
	}
	return counts;
}

/** Takes a field's values off every task (deleting it for good). Bookkeeping: `updated_at` stays. */
export async function removeValues(tx: Tx, field: TlFieldRow): Promise<number> {
	const rows = await tx
		.update(tlTask)
		.set({ fields: sql`${tlTask.fields} - ${field.id}::text`, updatedAt: sql`${tlTask.updatedAt}` })
		.where(and(tasksOf(field), hasValue(field.id)))
		.returning({ id: tlTask.id });
	return rows.length;
}

/**
 * Takes removed options out of a select's values: a single choice goes, a multiple
 * choice keeps its other options (and goes when none is left).
 */
export async function removeOptions(tx: Tx, field: TlFieldRow, optionIds: ReadonlyArray<string>): Promise<void> {
	if (optionIds.length === 0) return;
	const removed = sql.join(
		optionIds.map((id) => sql`${id}`),
		sql`, `,
	);
	const keep = { updatedAt: sql`${tlTask.updatedAt}` };
	if (field.type === "select") {
		await tx
			.update(tlTask)
			.set({ ...keep, fields: sql`${tlTask.fields} - ${field.id}::text` })
			.where(and(tasksOf(field), sql`(${tlTask.fields} ->> ${field.id}) in (${removed})`));
		return;
	}
	await tx
		.update(tlTask)
		.set({
			...keep,
			fields: sql`jsonb_set(${tlTask.fields}, array[${field.id}::text], coalesce((select jsonb_agg(item) from jsonb_array_elements(${tlTask.fields} -> ${field.id}::text) as item where item #>> '{}' not in (${removed})), '[]'::jsonb))`,
		})
		.where(and(tasksOf(field), hasValue(field.id)));
	await tx
		.update(tlTask)
		.set({ ...keep, fields: sql`${tlTask.fields} - ${field.id}::text` })
		.where(and(tasksOf(field), sql`${tlTask.fields} -> ${field.id}::text = '[]'::jsonb`));
}

/**
 * Sets some of a task's values and removes others in one statement (`||` then `-`),
 * so two people changing two fields at once both keep theirs: each field is
 * last-write-wins, as the task's other single fields are.
 */
export async function patchValues(
	tx: Tx,
	taskId: string,
	set: Readonly<Record<string, FieldValue>>,
	remove: ReadonlyArray<string>,
): Promise<void> {
	let value: SQL = sql`(${tlTask.fields} || ${JSON.stringify(set)}::jsonb)`;
	for (const id of remove) value = sql`(${value} - ${id}::text)`;
	await tx.update(tlTask).set({ fields: value }).where(eq(tlTask.id, taskId));
}
