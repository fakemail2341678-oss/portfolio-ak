import "@tanstack/react-start/server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { templateDefinition } from "@/features/taskline/template-definition";
import { type TlTemplateRow, tlTemplate } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * The team's saved templates: plain reads and writes (Task 57). A row is read through the
 * schema, so a definition holding only part of itself (a seed's SQL, one saved before a
 * new setting) still has every list and default.
 */

const read = (row: TlTemplateRow): TlTemplateRow => ({ ...row, definition: templateDefinition.parse(row.definition) });

export async function listTemplates(db: Db, workspaceId: string): Promise<TlTemplateRow[]> {
	const rows = await db
		.select()
		.from(tlTemplate)
		.where(eq(tlTemplate.workspaceId, workspaceId))
		.orderBy(asc(sql`lower(${tlTemplate.name})`), asc(tlTemplate.id));
	return rows.map(read);
}

export async function getTemplate(db: Db, workspaceId: string, id: string): Promise<TlTemplateRow | null> {
	const [row] = await db
		.select()
		.from(tlTemplate)
		.where(and(eq(tlTemplate.workspaceId, workspaceId), eq(tlTemplate.id, id)));
	return row ? read(row) : null;
}

export async function countTemplates(db: Db, workspaceId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(tlTemplate).where(eq(tlTemplate.workspaceId, workspaceId));
	return row?.total ?? 0;
}

export async function insertTemplate(tx: Tx, values: typeof tlTemplate.$inferInsert): Promise<TlTemplateRow> {
	const [row] = await tx.insert(tlTemplate).values(values).returning();
	if (!row) throw new Error("Template insert returned no row");
	return row;
}

export async function deleteTemplate(tx: Tx, id: string): Promise<void> {
	await tx.delete(tlTemplate).where(eq(tlTemplate.id, id));
}
