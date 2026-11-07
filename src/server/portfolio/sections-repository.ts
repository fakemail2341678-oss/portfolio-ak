import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, max, ne, notInArray, sql } from "drizzle-orm";
import type { PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { notFound, updateVersioned } from "@/server/db/crud";
import { portfolioExperience, portfolioProcessStep, portfolioSkill, portfolioTestimonial } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * The portfolio's ordered sections (decision 0176): experience, skills,
 * process steps and testimonials. Each is a short list in display order
 * (`sortOrder`), with the same operations, so one set of functions serves the
 * four tables; the services map each one's input and rows (./sections-service.ts).
 */

export const SECTION_TABLES = {
	experience: portfolioExperience,
	skill: portfolioSkill,
	"process-step": portfolioProcessStep,
	testimonial: portfolioTestimonial,
} as const;
export type SectionKind = keyof typeof SECTION_TABLES;
type SectionTable = (typeof SECTION_TABLES)[SectionKind];
export type SectionRow<K extends SectionKind> = (typeof SECTION_TABLES)[K]["$inferSelect"];

// The four tables share id, sortOrder and updatedAt; Drizzle can't type a query over a union of tables.
const anyTable = (kind: SectionKind) => SECTION_TABLES[kind] as typeof portfolioSkill;
const WHAT: Record<SectionKind, string> = {
	experience: "Experience",
	skill: "Skill",
	"process-step": "Process step",
	testimonial: "Testimonial",
};

export async function listSection<K extends SectionKind>(db: Db, kind: K): Promise<SectionRow<K>[]> {
	const table = anyTable(kind);
	return (await db.select().from(table).orderBy(asc(table.sortOrder), asc(table.createdAt))) as SectionRow<K>[];
}

export async function findSection<K extends SectionKind>(db: Db | Tx, kind: K, id: string): Promise<SectionRow<K>> {
	const table = anyTable(kind);
	const [row] = await db.select().from(table).where(eq(table.id, id));
	if (!row) throw notFound(WHAT[kind]);
	return row as SectionRow<K>;
}

/** Adds an entry last in the order. */
export async function createSection<K extends SectionKind>(
	tx: Tx,
	kind: K,
	values: Omit<SectionTable["$inferInsert"], "id" | "sortOrder">,
): Promise<SectionRow<K>> {
	const table = anyTable(kind);
	const [last] = await tx.select({ order: max(table.sortOrder) }).from(table);
	const [row] = await tx
		.insert(table as PgTable)
		.values({ ...values, sortOrder: (last?.order ?? -1) + 1 })
		.returning();
	if (!row) throw notFound(WHAT[kind]);
	return row as SectionRow<K>;
}

/** Saves an entry if it still has `version` (else a stale CONFLICT). Returns it before and after. */
export async function updateSection<K extends SectionKind>(
	tx: Tx,
	kind: K,
	{ id, version, set }: { id: string; version: string; set: Record<string, unknown> },
): Promise<{ before: SectionRow<K>; row: SectionRow<K> }> {
	const before = await findSection(tx, kind, id);
	const row = await updateVersioned(tx, anyTable(kind), {
		id,
		version,
		set: set as PgUpdateSetSource<typeof portfolioSkill>,
		what: WHAT[kind],
	});
	return { before, row: row as SectionRow<K> };
}

export async function deleteSection<K extends SectionKind>(
	tx: Tx,
	kind: K,
	ids: ReadonlyArray<string>,
): Promise<SectionRow<K>[]> {
	const table = anyTable(kind);
	return (await tx
		.delete(table)
		.where(inArray(table.id, [...ids]))
		.returning()) as SectionRow<K>[];
}

/**
 * Puts the entries in the order of `ids`; unlisted ones keep their place after
 * them. Versions are kept (moving an entry doesn't make an open edit stale).
 */
export async function reorderSection(tx: Tx, kind: SectionKind, ids: ReadonlyArray<string>): Promise<number> {
	const table = anyTable(kind);
	const keepVersion = { updatedAt: sql`${table.updatedAt}` };
	let moved = 0;
	for (const [index, id] of ids.entries()) {
		const rows = await tx
			.update(table)
			.set({ sortOrder: index, ...keepVersion })
			.where(and(eq(table.id, id), ne(table.sortOrder, index)))
			.returning({ id: table.id });
		moved += rows.length;
	}
	const rest = await tx
		.select({ id: table.id })
		.from(table)
		.where(notInArray(table.id, [...ids]))
		.orderBy(asc(table.sortOrder), asc(table.createdAt));
	for (const [offset, row] of rest.entries()) {
		await tx
			.update(table)
			.set({ sortOrder: ids.length + offset, ...keepVersion })
			.where(eq(table.id, row.id));
	}
	return moved;
}
