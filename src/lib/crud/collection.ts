import {
	type Collection,
	type CollectionOptions,
	collectionOptions,
	type NonSingleResult,
	type UtilsRecord,
} from "@tanstack/react-db";
import { matchQuery, type QueryKey } from "@tanstack/react-query";
import { queryClientOf } from "@/lib/tanstack-db";

/**
 * A list's rows as a TanStack DB collection (docs/guides/crud.md, decision 0294): the
 * way every admin write shows before the server answers.
 *
 *   // features/projects/collection.ts
 *   export const projectRows = crudCollection<ProjectListItem>("projects", projectKeys.lists());
 *
 * The collection holds the rows of **every cached page** of the list (each query under
 * `queryKey`, a row's newest copy winning), and follows the Query cache: the loader's
 * rows are in it from the first paint, and a refetch updates it. So there is one
 * descriptor per list, not one per page and search (what 0174 gave up on), and a row
 * deleted here leaves every page at once.
 *
 * Reads stay Query's (the page, its totals, the order); the page shows each of its rows
 * as the collection has it (`useLiveRows`, which `CrudListPage` calls). Writes are DB
 * transactions made by `useCrudMutation`: `deleteRows`/`updateRows` change the rows at
 * once, and DB drops the change when the server refuses.
 *
 * Only pages below `<DbScope>` may import a collection module (the admin layout mounts
 * it): never a route file or `queries.ts` (0189).
 */

type Identified = { id: string };

/** The rows of one cached list: a page's `items`, or a list read whole. */
const rowsIn = (cached: unknown): ReadonlyArray<unknown> => {
	if (Array.isArray(cached)) return cached;
	if (typeof cached === "object" && cached !== null && "items" in cached && Array.isArray(cached.items)) {
		return cached.items;
	}
	return [];
};

export function crudCollection<Row extends Identified>(
	name: string,
	queryKey: QueryKey,
	/** How to read the rows out of a cached answer, when it is neither a page nor an array. */
	rowsOf: (cached: unknown) => ReadonlyArray<Row> = rowsIn as (cached: unknown) => ReadonlyArray<Row>,
): CrudCollectionOptions<Row> {
	const id = `crud:${name}`;
	const options = collectionOptions(id, (client) => {
		const cache = queryClientOf(client).getQueryCache();
		return {
			id,
			getKey: (row: Row) => row.id,
			sync: {
				sync: ({ begin, write, commit, markReady }) => {
					let known = new Map<string, Row>();
					const read = () => {
						const next = new Map<string, Row>();
						// Oldest first, so the copy read last from the server is the one kept.
						const queries = cache.findAll({ queryKey }).sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
						for (const query of queries) {
							for (const row of rowsOf(query.state.data)) next.set(row.id, row);
						}
						const gone = [...known.keys()].filter((key) => !next.has(key));
						// Query keeps an unchanged row's identity (structural sharing), so `!==` is "changed".
						const changed = [...next].filter(([key, row]) => known.get(key) !== row);
						if (gone.length === 0 && changed.length === 0) return;
						begin();
						for (const [key, row] of changed) write({ type: known.has(key) ? "update" : "insert", value: row });
						for (const key of gone) write({ type: "delete", key });
						commit();
						known = next;
					};
					read();
					markReady();
					// The cache tells its listeners at once, so a refetch a write awaited is in the
					// collection before DB drops that write's optimistic rows (no flicker).
					return cache.subscribe((event) => {
						if (matchQuery({ queryKey }, event.query)) read();
					});
				},
			},
		};
	});
	// DB types the descriptor's row as `Extract<Row, object>`, which TypeScript can't reduce to a generic `Row`.
	return options as unknown as CrudCollectionOptions<Row>;
}

/** A list's collection descriptor (`crudCollection`'s result). */
export type CrudCollectionOptions<Row extends Identified> = CollectionOptions<Row, string> & NonSingleResult;

/** A list's collection, as `useCrudCollection` gives it. */
export type CrudCollection<Row extends Identified> = Collection<Row, string, UtilsRecord, never, Row> & NonSingleResult;

/** An `optimistic` change: the rows `ids` leave the list (the ones it holds). */
export function deleteRows<Row extends Identified>(collection: CrudCollection<Row>, ids: ReadonlyArray<string>) {
	const held = ids.filter((id) => collection.has(id));
	if (held.length > 0) collection.delete(held);
}

/** An `optimistic` change: `change` edits each of the rows `ids` in place (a draft, as in Immer). */
export function updateRows<Row extends Identified>(
	collection: CrudCollection<Row>,
	ids: ReadonlyArray<string>,
	change: (row: Row) => void,
) {
	for (const id of ids) {
		if (collection.has(id)) collection.update(id, (draft) => change(draft as Row));
	}
}
