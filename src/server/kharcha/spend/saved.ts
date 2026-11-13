import "@tanstack/react-start/server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { SavedSearch } from "@/features/kharcha/types";
import { notFound } from "@/server/db/crud";
import { khSavedSearch } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { bumpRevs } from "../rev";
import { assertQuota } from "../settings";

/**
 * Saved searches (Task 93): a name for a query, the caller's own, in their order. Spend
 * lists them after the built-in ones (in code: `BUILT_IN_SEARCHES`). Each change
 * answers with the whole list and bumps the caller's `rev`, so their other tabs redraw.
 */

/** How many one person may keep. */
export const SAVED_SEARCHES_MAX = 30;

export const searchesOf = async (db: Db | Tx, personId: string): Promise<SavedSearch[]> =>
	db
		.select({ id: khSavedSearch.id, name: khSavedSearch.name, query: khSavedSearch.query })
		.from(khSavedSearch)
		.where(eq(khSavedSearch.ownerId, personId))
		.orderBy(asc(khSavedSearch.position), asc(khSavedSearch.createdAt));

async function change({ db, user }: KharchaServices, work: (tx: Tx, me: Me) => Promise<void>): Promise<SavedSearch[]> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		await work(tx, me);
		await bumpRevs(tx, [me.personId]);
		return searchesOf(tx, me.personId);
	});
}

/** One of the caller's, or NOT_FOUND (another's is as good as missing). */
async function ownSearch(tx: Tx, me: Me, id: string) {
	const [row] = await tx
		.select({ id: khSavedSearch.id })
		.from(khSavedSearch)
		.where(and(eq(khSavedSearch.id, id), eq(khSavedSearch.ownerId, me.personId)));
	if (!row) throw notFound("Saved search");
	return row;
}

export const saveSearch = (services: KharchaServices, input: { name: string; query: string }) =>
	change(services, async (tx, me) => {
		await assertQuota(tx, `${me.personId}:searches`, {
			table: khSavedSearch,
			where: eq(khSavedSearch.ownerId, me.personId),
			max: SAVED_SEARCHES_MAX,
		});
		const [last] = await tx
			.select({ position: sql<number>`coalesce(max(${khSavedSearch.position}), -1)`.mapWith(Number) })
			.from(khSavedSearch)
			.where(eq(khSavedSearch.ownerId, me.personId));
		await tx.insert(khSavedSearch).values({
			ownerId: me.personId,
			name: input.name,
			query: input.query,
			position: (last?.position ?? -1) + 1,
		});
	});

export const renameSearch = (services: KharchaServices, input: { id: string; name: string }) =>
	change(services, async (tx, me) => {
		await ownSearch(tx, me, input.id);
		await tx.update(khSavedSearch).set({ name: input.name }).where(eq(khSavedSearch.id, input.id));
	});

/** A new order: every one of the caller's searches, first to last (a missing or foreign id is NOT_FOUND). */
export const reorderSearches = (services: KharchaServices, ids: ReadonlyArray<string>) =>
	change(services, async (tx, me) => {
		const mine = await searchesOf(tx, me.personId);
		if (ids.length !== mine.length || ids.some((id) => !mine.some((search) => search.id === id))) {
			throw notFound("Saved search");
		}
		for (const [position, id] of ids.entries()) {
			await tx.update(khSavedSearch).set({ position }).where(eq(khSavedSearch.id, id));
		}
	});

export const deleteSearch = (services: KharchaServices, id: string) =>
	change(services, async (tx, me) => {
		await ownSearch(tx, me, id);
		await tx.delete(khSavedSearch).where(eq(khSavedSearch.id, id));
	});
