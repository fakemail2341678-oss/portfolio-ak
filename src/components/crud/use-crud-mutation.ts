import { type QueryKey, type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { isStaleError } from "@/lib/concurrency";
import type { Paged } from "@/lib/list/paging";
import { m } from "@/paraglide/messages";

/**
 * Patches every cached page of a list before the server answers. `queryKey` is
 * the feature's `keys.lists()`: every page in the cache matches it, so a row
 * deleted here disappears from page 2 as well, not only from the page on screen.
 */
export type Optimistic<TVariables, TCached> = {
	queryKey: QueryKey;
	update: (cached: TCached, variables: TVariables) => TCached;
};

/**
 * Every write of the admin, one way (docs/guides/crud.md, decision 0173): the
 * feature's `mutationOptions` (queries.ts: a key and the server function) plus
 * the shared behaviour around it:
 *
 * - `optimistic`: cancels in-flight reads of the lists, patches every cached page
 *   at once and puts the snapshot back if the server refuses;
 * - afterwards, success or not, invalidates `invalidate` (usually `[keys.all]`), so
 *   totals, other pages and filter options refresh from the server;
 * - a failure is a toast ("nothing was changed", with the reason); a stale
 *   CONFLICT offers to reload instead.
 *
 *   const remove = useCrudMutation(projectMutations.delete(), {
 *     invalidate: [projectKeys.all],
 *     optimistic: { queryKey: projectKeys.lists(), update: withoutRows },
 *   });
 *   remove.mutate(ids, { onSuccess: () => toast.success(…) });
 *
 * Forms don't use it: their failures go on the fields (useCrudForm).
 */
export function useCrudMutation<TData, TVariables, TCached = never>(
	options: Omit<UseMutationOptions<TData, Error, TVariables>, "onMutate" | "onError" | "onSettled">,
	{ invalidate, optimistic }: { invalidate: ReadonlyArray<QueryKey>; optimistic?: Optimistic<TVariables, TCached> },
) {
	const queryClient = useQueryClient();
	const refresh = () => Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
	return useMutation({
		...options,
		onMutate: async (variables) => {
			if (!optimistic) return { snapshot: [] };
			await queryClient.cancelQueries({ queryKey: optimistic.queryKey });
			const snapshot = queryClient.getQueriesData<TCached>({ queryKey: optimistic.queryKey });
			for (const [key, cached] of snapshot) {
				if (cached !== undefined) queryClient.setQueryData(key, optimistic.update(cached, variables));
			}
			return { snapshot };
		},
		onError: (error, _variables, context) => {
			for (const [key, cached] of context?.snapshot ?? []) queryClient.setQueryData(key, cached);
			if (isStaleError(error)) {
				toast.error(m.form_stale_title(), {
					description: errorMessage(error),
					action: { label: m.form_stale_reload(), onClick: () => void refresh() },
				});
			} else {
				toast.error(m.common_toast_failed(), { description: errorMessage(error) });
			}
		},
		// Returned, so `mutateAsync` (and a call's own onSuccess) wait for the fresh lists.
		onSettled: refresh,
	});
}

/** An `optimistic.update` for paginated lists: changes the page's rows, keeps its totals. */
export const onRows =
	<TRow, TVariables>(update: (rows: TRow[], variables: TVariables) => TRow[]) =>
	(page: Paged<TRow>, variables: TVariables): Paged<TRow> => ({ ...page, items: update(page.items, variables) });

/** Changing one row (`variables.id`) on every cached page. */
export const patchRow = <TRow extends { id: string }, TVariables extends { id: string }>(
	patch: (row: TRow, variables: TVariables) => TRow,
) =>
	onRows((rows: TRow[], variables: TVariables) =>
		rows.map((row) => (row.id === variables.id ? patch(row, variables) : row)),
	);

/** Deleting `ids`: the rows leave every cached page at once. */
export const withoutRows = <TRow extends { id: string }>(
	page: Paged<TRow>,
	ids: ReadonlyArray<string>,
): Paged<TRow> => ({
	...page,
	items: page.items.filter((row) => !ids.includes(row.id)),
});
