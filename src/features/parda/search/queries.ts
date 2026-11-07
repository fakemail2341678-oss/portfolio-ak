import { queryOptions } from "@tanstack/react-query";
import { getPardaDiscover, getPardaSearch, getPardaSuggest } from "@/functions/parda/search";
import type { Locale } from "@/paraglide/runtime";
import { pardaKeys } from "../keys";
import type { DiscoverSearch, SearchPageSearch } from "../search";

/**
 * Search and Discover reads (Task 66). Loaders and the overlay import this module with
 * `await import()` or `lazy()` (0194), so its server-function stubs stay out of every page.
 */

/** The server caches searches for 10 minutes; a tab reuses an answer for 5. */
const SEARCH_STALE = 5 * 60_000;
/** Discover is a list: the server caches it for an hour. */
const DISCOVER_STALE = 10 * 60_000;

export const pardaSearchQueryOptions = (locale: Locale, search: SearchPageSearch) =>
	queryOptions({
		queryKey: pardaKeys.search(locale, search.q, search.tab, search.page),
		queryFn: () => getPardaSearch({ data: { ...search, locale } }),
		staleTime: SEARCH_STALE,
	});

export const pardaSuggestQueryOptions = (locale: Locale, q: string) =>
	queryOptions({
		queryKey: pardaKeys.suggest(locale, q),
		queryFn: () => getPardaSuggest({ data: { q, locale } }),
		staleTime: SEARCH_STALE,
		// A refusal (the per-IP limit) is shown, not retried.
		retry: false,
	});

export const pardaDiscoverQueryOptions = (locale: Locale, filters: DiscoverSearch) =>
	queryOptions({
		queryKey: pardaKeys.discover(locale, filters),
		queryFn: () => getPardaDiscover({ data: { ...filters, locale } }),
		staleTime: DISCOVER_STALE,
	});
