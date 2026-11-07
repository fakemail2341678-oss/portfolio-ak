import { noop, QueryClient, type QueryExecuteOptions, type QueryKey } from "@tanstack/react-query";
import { isAppError } from "./errors";

/** What `queryOptions(...)` produces, as `queryClient.query()` accepts it. */
export type LoaderQueryOptions<TData, TKey extends QueryKey> = QueryExecuteOptions<TData, Error, TData, TData, TKey>;

/**
 * One QueryClient per request on the server (created in getRouter), one per tab
 * in the browser. The SSR integration dehydrates it into the HTML and hydrates it
 * on the client.
 *
 * staleTime > 0 is what stops a refetch right after hydration: data that just
 * arrived from the server is treated as fresh for a minute.
 */
export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60_000,
				// Don't retry 4xx-style app errors; they won't succeed on retry.
				retry: (failureCount, error) => !isAppError(error) && failureCount < 2,
			},
		},
	});

/**
 * Loader read: the cached data when there is any (fresh or stale), otherwise
 * fetched and awaited. Components then read the same options with
 * `useSuspenseQuery`, which refreshes stale data in the background.
 *
 *   loader: ({ context }) => ensureQuery(context.queryClient, thingQueryOptions(id)),
 *
 * Query 5.104 deprecated `ensureQueryData`; this is its documented replacement
 * (`query()` with `staleTime: "static"`), kept in one place (decisions.md 0111).
 */
export const ensureQuery = <TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
): Promise<TData> => queryClient.query({ ...options, staleTime: "static" });

/** Starts loading a query without waiting for it or failing on errors (replaces `prefetchQuery`). */
export const prefetch = <TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
): void => {
	queryClient.query(options).catch(noop);
};

/**
 * Loader body for a list driven by URL search (filters, sort, page).
 *
 * - Entering the route and SSR (`cause` "enter"/"preload"): await the data, so the
 *   page renders complete on the server and on first client navigation.
 * - Changing the search on the same route (`cause` "stay"): only prefetch. The
 *   navigation commits at once, so the URL and the filter controls update without
 *   a pending screen (and without stealing focus from a filter being typed in).
 *   The page keeps showing the previous results, marked busy, until the new ones
 *   arrive: read the data with `useListQuery`.
 */
export function loadList<TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
	cause: "enter" | "stay" | "preload",
): Promise<unknown> | undefined {
	if (cause === "stay") {
		prefetch(queryClient, options);
		return undefined;
	}
	return ensureQuery(queryClient, options);
}
