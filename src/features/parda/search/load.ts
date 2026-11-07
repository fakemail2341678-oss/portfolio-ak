import type { QueryClient } from "@tanstack/react-query";
import { ensureQuery } from "@/lib/query";
import type { Locale } from "@/paraglide/runtime";
import type { DiscoverSearch, SearchPageSearch } from "../search";

/**
 * The search page's and Discover's loaders (routes import this with `await import()`,
 * 0194). The search page counts a search (`notePardaSearch`) when it's really shown:
 * its first page of every kind, never a preload on hover.
 */
export async function loadSearchPage(
	queryClient: QueryClient,
	locale: Locale,
	search: SearchPageSearch,
	shown: boolean,
): Promise<void> {
	const { pardaSearchQueryOptions } = await import("./queries");
	const data = await ensureQuery(queryClient, pardaSearchQueryOptions(locale, search));
	if (
		!shown ||
		!data.configured ||
		!search.q ||
		search.page !== 1 ||
		search.tab !== "all" ||
		data.hits === null ||
		data.limited
	)
		return;
	const { notePardaSearch } = await import("@/functions/parda/search");
	// Statistics never hold the page up, and their failure (the per-IP limit) is nobody's concern.
	void notePardaSearch({ data: { q: search.q, locale } }).catch(() => undefined);
}

export async function loadDiscoverPage(queryClient: QueryClient, locale: Locale, filters: DiscoverSearch) {
	const { pardaDiscoverQueryOptions } = await import("./queries");
	await ensureQuery(queryClient, pardaDiscoverQueryOptions(locale, filters));
}
