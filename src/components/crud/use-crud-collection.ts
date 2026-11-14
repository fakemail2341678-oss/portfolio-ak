import { useDbClient, useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import type { CrudCollection, CrudCollectionOptions } from "@/lib/crud/collection";

/**
 * A list's TanStack DB collection (src/lib/crud/collection.ts), from the page's DbClient:
 * what `useCrudMutation`'s `optimistic` changes and what `CrudListPage` shows rows from.
 *
 *   const rows = useCrudCollection(projectRows);
 *   const remove = useCrudMutation(projectMutations.delete(), {
 *     invalidate: [projectKeys.all],
 *     optimistic: (ids) => deleteRows(rows, ids),
 *   });
 *   <CrudListPage collection={rows} … />
 */
export function useCrudCollection<Row extends { id: string }>(
	options: CrudCollectionOptions<Row>,
): CrudCollection<Row> {
	const client = useDbClient();
	// The same collection every render: DB keys its subscriptions by it.
	return useMemo(() => client.collection(options), [client, options]);
}

/**
 * The rows Query read (a page, in the server's order), each as the collection has it now:
 * a row changed optimistically shows its change, a deleted one is left out. Until the
 * collection is ready (the server's render, the first paint) the Query rows themselves
 * render, which are the same rows, so hydration matches.
 */
export function useLiveRows<Row extends { id: string }>(
	collection: CrudCollection<Row>,
	rows: ReadonlyArray<Row>,
): ReadonlyArray<Row>;
export function useLiveRows<Row extends { id: string }>(
	collection: CrudCollection<Row>,
	rows: ReadonlyArray<Row> | undefined,
): ReadonlyArray<Row> | undefined;
export function useLiveRows<Row extends { id: string }>(
	collection: CrudCollection<Row>,
	rows: ReadonlyArray<Row> | undefined,
): ReadonlyArray<Row> | undefined {
	const live = useLiveQuery(collection);
	if (!rows || !live.isReady) return rows;
	return rows.flatMap((row) => {
		const current = live.state.get(row.id);
		return current ? [current as Row] : [];
	});
}
