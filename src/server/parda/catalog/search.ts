import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";
import type { HubTitle } from "@/features/parda/home/types";
import { type SearchPageSearch, type SearchTab, TMDB_MAX_PAGE } from "@/features/parda/search";
import type { SearchHit, SearchPageData, SearchSuggestData } from "@/features/parda/search/types";
import { pdSearchStat } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { SearchHit as CatalogHit } from "../tmdb/search";
import { degrade, toHubTitle } from "./hubs";
import { PAGE_LAYOUTS, railContext } from "./rails";
import { type CatalogScope, type CatalogServices, listTitles, searchCatalog } from "./service";

/**
 * The search page and the overlay (Task 66, decision 0239). Both read TMDB through
 * `searchCatalog`, so takedowns apply; only the search page counts what was searched.
 */

const KINDS = { all: "multi", movies: "movie", series: "tv", people: "person" } as const satisfies Record<
	SearchTab,
	string
>;

/** How many hits the overlay lists. */
const SUGGEST_SIZE = 8;
/** How many trending titles stand in for nothing found. */
const SUGGESTIONS = 12;

const toHit = (hit: CatalogHit): SearchHit =>
	hit.media === "person"
		? {
				media: "person",
				id: hit.id,
				name: hit.name,
				profile: hit.profile,
				department: hit.department,
				knownFor: hit.knownFor.map((title) => title.title).slice(0, 3),
			}
		: toHubTitle(hit);

/** The home's trending rail: what the empty search page and an empty result suggest. */
async function trending(services: CatalogServices, scope: CatalogScope): Promise<HubTitle[] | null> {
	const spec = PAGE_LAYOUTS.home.rails.find((rail) => rail.id === "trending");
	if (!spec) return null;
	const list = await degrade("search suggestions", () =>
		listTitles(services, scope, spec.request(railContext(scope.region))),
	);
	return list?.results.slice(0, SUGGESTIONS).map(toHubTitle) ?? null;
}

export async function searchPage(
	services: CatalogServices,
	scope: CatalogScope,
	search: SearchPageSearch,
): Promise<Extract<SearchPageData, { configured: true }>> {
	const imageBase = services.tmdb.config.imageBase;
	const base = { configured: true as const, imageBase, q: search.q, tab: search.tab, page: search.page };
	if (!search.q) {
		return { ...base, page: 1, pageCount: 0, total: 0, hits: [], suggestions: await trending(services, scope) };
	}
	const results = await degrade("search", () =>
		searchCatalog(services, scope, KINDS[search.tab], search.q, search.page),
	);
	const found = results !== null && results.totalResults > 0;
	return {
		...base,
		pageCount: Math.min(results?.totalPages ?? 0, TMDB_MAX_PAGE),
		total: results?.totalResults ?? 0,
		hits: results?.hits.map(toHit) ?? null,
		suggestions: results !== null && !found ? await trending(services, scope) : null,
	};
}

/** The page for a caller over the search limit: no TMDB call, and a line that says why. */
export const limitedSearchPage = (
	services: CatalogServices,
	search: SearchPageSearch,
): Extract<SearchPageData, { configured: true }> => ({
	configured: true,
	imageBase: services.tmdb.config.imageBase,
	q: search.q,
	tab: search.tab,
	page: search.page,
	pageCount: 0,
	total: 0,
	hits: null,
	suggestions: null,
	limited: true,
});

/** The overlay's first hits for what's typed: the same TMDB call (and cache entry) as the page's first. */
export async function searchSuggest(
	services: CatalogServices,
	scope: CatalogScope,
	q: string,
): Promise<SearchSuggestData> {
	const results = await searchCatalog(services, scope, "multi", q, 1);
	return { imageBase: services.tmdb.config.imageBase, hits: results.hits.slice(0, SUGGEST_SIZE).map(toHit) };
}

/** A query as the statistics hold it: NFKC, lower case, single spaces, at most 100 characters. */
export const normalizeQuery = (q: string) =>
	q.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim().slice(0, 100);

/**
 * Counts one search for today (UTC) in `pd_search_stat`, with whether it found nothing.
 * No user, profile or IP is kept. The search is read through the cache the page just filled.
 */
export async function noteSearch(
	db: Db,
	services: CatalogServices,
	scope: CatalogScope,
	q: string,
	now: Date = new Date(),
): Promise<void> {
	const query = normalizeQuery(q);
	if (!query) return;
	const results = await degrade("search note", () => searchCatalog(services, scope, "multi", q.trim(), 1));
	// TMDB failing says nothing about the query.
	if (!results) return;
	const zeroResults = results.totalResults === 0;
	await db
		.insert(pdSearchStat)
		.values({ day: now.toISOString().slice(0, 10), query, zeroResults })
		.onConflictDoUpdate({
			target: [pdSearchStat.day, pdSearchStat.query],
			set: { count: sql`${pdSearchStat.count} + 1`, zeroResults, updatedAt: now },
		});
}
