import { keepPreviousData, type QueryKey, type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

/**
 * Reads a list loaded with `loadList` (src/lib/query.ts). While a new search is
 * loading it returns the previous results with `busy: true`, so the page never
 * blanks out; `data` is only undefined if nothing was ever loaded (the caller
 * shows its skeleton).
 *
 * `busy` starts as soon as the router starts the navigation, not only once the
 * new query runs: route guards (e.g. the admin role check, a server round trip)
 * run first, and the user should see at once that the filter was taken.
 */
export function useListQuery<TData, TKey extends QueryKey>(options: UseQueryOptions<TData, Error, TData, TKey>) {
	const query = useQuery({ ...options, placeholderData: keepPreviousData });
	const navigating = useRouterState({ select: (state) => state.status === "pending" });
	return { data: query.data, busy: query.isPlaceholderData || navigating, error: query.error };
}
