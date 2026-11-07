import "@tanstack/react-start/server-only";
import { type AnyColumn, and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { TasklineLabel, TasklineStatus } from "@/features/taskline/types";
import { type TlLabelRow, type TlStatusRow, tlLabel, tlStatus } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** A project's statuses and the labels its tasks can carry. */

/** Order keys compare by code unit (src/lib/fractional-index.ts), not by the database's locale. */
export const byPosition = (column: AnyColumn) => sql`${column} collate "C"`;

export const statusDto = (row: TlStatusRow): TasklineStatus => ({
	id: row.id,
	name: row.name,
	category: row.category,
	color: row.color,
	position: row.position,
	wipLimit: row.wipLimit,
});

export const labelDto = (row: TlLabelRow): TasklineLabel => ({
	id: row.id,
	name: row.name,
	color: row.color,
	projectId: row.projectId,
});

export async function listStatuses(db: Db, projectId: string): Promise<TlStatusRow[]> {
	return db
		.select()
		.from(tlStatus)
		.where(eq(tlStatus.projectId, projectId))
		.orderBy(byPosition(tlStatus.position), asc(tlStatus.id));
}

export async function getStatus(db: Db, projectId: string, statusId: string): Promise<TlStatusRow | null> {
	const [row] = await db
		.select()
		.from(tlStatus)
		.where(and(eq(tlStatus.projectId, projectId), eq(tlStatus.id, statusId)));
	return row ?? null;
}

export async function countStatuses(db: Db, projectId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlStatus).where(eq(tlStatus.projectId, projectId));
	return row?.total ?? 0;
}

export async function lastStatusPosition(db: Db, projectId: string): Promise<string | null> {
	const [row] = await db
		.select({ position: tlStatus.position })
		.from(tlStatus)
		.where(eq(tlStatus.projectId, projectId))
		.orderBy(desc(byPosition(tlStatus.position)))
		.limit(1);
	return row?.position ?? null;
}

export async function insertStatus(tx: Tx, values: typeof tlStatus.$inferInsert): Promise<TlStatusRow> {
	const [row] = await tx.insert(tlStatus).values(values).returning();
	if (!row) throw new Error("Status insert returned no row");
	return row;
}

export async function updateStatus(
	tx: Tx,
	statusId: string,
	set: Partial<Pick<TlStatusRow, "name" | "category" | "color" | "position" | "wipLimit">>,
): Promise<TlStatusRow> {
	const [row] = await tx.update(tlStatus).set(set).where(eq(tlStatus.id, statusId)).returning();
	if (!row) throw new Error("Status update returned no row");
	return row;
}

export async function deleteStatus(tx: Tx, statusId: string): Promise<void> {
	await tx.delete(tlStatus).where(eq(tlStatus.id, statusId));
}

/** Labels a project's tasks can carry: its own and the workspace's. */
export async function listLabels(db: Db, workspaceId: string, projectId: string): Promise<TlLabelRow[]> {
	return db
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.workspaceId, workspaceId), or(isNull(tlLabel.projectId), eq(tlLabel.projectId, projectId))))
		.orderBy(asc(sql`lower(${tlLabel.name})`), asc(tlLabel.id));
}

/** The workspace's own labels (every project's), by name (Task 56's workspace rules). */
export async function listWorkspaceLabels(db: Db, workspaceId: string): Promise<TlLabelRow[]> {
	return db
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.workspaceId, workspaceId), isNull(tlLabel.projectId)))
		.orderBy(asc(sql`lower(${tlLabel.name})`), asc(tlLabel.id));
}

/** A label of the project itself (not a workspace-wide one), or null. */
export async function getProjectLabel(db: Db, projectId: string, labelId: string): Promise<TlLabelRow | null> {
	const [row] = await db
		.select()
		.from(tlLabel)
		.where(and(eq(tlLabel.projectId, projectId), eq(tlLabel.id, labelId)));
	return row ?? null;
}

export async function insertLabels(tx: Tx, rows: ReadonlyArray<typeof tlLabel.$inferInsert>): Promise<TlLabelRow[]> {
	if (rows.length === 0) return [];
	return tx
		.insert(tlLabel)
		.values([...rows])
		.returning();
}

export async function updateLabel(
	tx: Tx,
	labelId: string,
	set: Partial<Pick<TlLabelRow, "name" | "color">>,
): Promise<TlLabelRow> {
	const [row] = await tx.update(tlLabel).set(set).where(eq(tlLabel.id, labelId)).returning();
	if (!row) throw new Error("Label update returned no row");
	return row;
}

export async function deleteLabel(tx: Tx, labelId: string): Promise<void> {
	await tx.delete(tlLabel).where(eq(tlLabel.id, labelId));
}
