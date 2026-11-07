import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import type { SavedViewKind } from "@/features/taskline/types";
import { type TlSavedViewRow, tlMember, tlSavedView } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Saved views (Task 51): plain reads and writes; who may do what is in ./service.ts. */

export type SavedViewWithAuthor = TlSavedViewRow & { author: string };

/** A project's views of one kind that `memberId` may use: the shared ones and their own. Shared first, then by name. */
export async function listViews(
	db: Db,
	projectId: string,
	view: SavedViewKind,
	memberId: string | null,
): Promise<SavedViewWithAuthor[]> {
	const rows = await db
		.select({ row: tlSavedView, author: tlMember.displayName })
		.from(tlSavedView)
		.innerJoin(tlMember, eq(tlMember.id, tlSavedView.memberId))
		.where(
			and(
				eq(tlSavedView.projectId, projectId),
				eq(tlSavedView.view, view),
				memberId ? or(eq(tlSavedView.shared, true), eq(tlSavedView.memberId, memberId)) : eq(tlSavedView.shared, true),
			),
		)
		.orderBy(desc(tlSavedView.shared), asc(sql`lower(${tlSavedView.name})`), asc(tlSavedView.id));
	return rows.map(({ row, author }) => ({ ...row, author }));
}

/** The member's view of that name (any case) for this project and kind. */
export async function viewByName(
	db: Db,
	projectId: string,
	memberId: string,
	view: SavedViewKind,
	name: string,
): Promise<TlSavedViewRow | null> {
	const [row] = await db
		.select()
		.from(tlSavedView)
		.where(
			and(
				eq(tlSavedView.projectId, projectId),
				eq(tlSavedView.memberId, memberId),
				eq(tlSavedView.view, view),
				sql`lower(${tlSavedView.name}) = lower(${name})`,
			),
		);
	return row ?? null;
}

export async function getView(db: Db, projectId: string, id: string): Promise<TlSavedViewRow | null> {
	const [row] = await db
		.select()
		.from(tlSavedView)
		.where(and(eq(tlSavedView.projectId, projectId), eq(tlSavedView.id, id)));
	return row ?? null;
}

export async function countViews(db: Db, projectId: string, memberId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(tlSavedView)
		.where(and(eq(tlSavedView.projectId, projectId), eq(tlSavedView.memberId, memberId)));
	return row?.value ?? 0;
}

export async function insertView(tx: Tx, values: typeof tlSavedView.$inferInsert): Promise<TlSavedViewRow> {
	const [row] = await tx.insert(tlSavedView).values(values).returning();
	if (!row) throw new Error("Saved view insert returned no row");
	return row;
}

export async function updateView(
	tx: Tx,
	id: string,
	set: Pick<TlSavedViewRow, "name" | "search" | "shared">,
): Promise<TlSavedViewRow> {
	const [row] = await tx.update(tlSavedView).set(set).where(eq(tlSavedView.id, id)).returning();
	if (!row) throw new Error("Saved view update returned no row");
	return row;
}

export async function deleteView(tx: Tx, id: string): Promise<void> {
	await tx.delete(tlSavedView).where(eq(tlSavedView.id, id));
}
