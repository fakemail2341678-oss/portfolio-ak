import "@tanstack/react-start/server-only";
import { DISCOVER_LANGUAGES } from "@/features/parda/discover/options";
import { type DiscoverSearch, TMDB_MAX_PAGE } from "@/features/parda/search";
import type { DiscoverPageData } from "@/features/parda/search/types";
import { isAppError } from "@/lib/errors";
import { applicableFilters, discoverRequest } from "./discover-requests";
import { degrade, toHubTitle } from "./hubs";
import { type CatalogScope, type CatalogServices, keywordName, listTitles } from "./service";
import { namer } from "./title-page";

/**
 * Discover (Task 66, decision 0239): TMDB's discover with the page's filters, a page
 * at a time, minus takedowns (`listTitles`). TMDB failing degrades to "couldn't load"
 * in the grid; the filters still render.
 */

/** A keyword TMDB doesn't know (or can't name right now) leaves the heading generic. */
async function keywordOf(services: CatalogServices, scope: CatalogScope, id: number | undefined) {
	if (id === undefined) return null;
	try {
		return await keywordName(services, scope, id);
	} catch (error) {
		if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "UPSTREAM_UNAVAILABLE")) return null;
		throw error;
	}
}

export async function discoverPage(
	services: CatalogServices,
	scope: CatalogScope,
	search: DiscoverSearch,
	now: Date = new Date(),
): Promise<Extract<DiscoverPageData, { configured: true }>> {
	const filters = applicableFilters(search);
	const request = discoverRequest(filters, now.toISOString().slice(0, 10));
	const [list, keyword] = await Promise.all([
		degrade("discover", async () => {
			try {
				return await listTitles(services, scope, request);
			} catch (error) {
				// TMDB has no such page: nothing to show, rather than Parda's 404.
				if (isAppError(error) && error.code === "NOT_FOUND") return { page: filters.page, totalPages: 0, results: [] };
				throw error;
			}
		}),
		keywordOf(services, scope, filters.keyword),
	]);
	const name = namer(scope.locale, "language");
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		filters,
		titles: list?.results.map(toHubTitle) ?? null,
		page: filters.page,
		pageCount: Math.min(list?.totalPages ?? 0, TMDB_MAX_PAGE),
		// A language from a link that the list doesn't offer is offered too, so the select shows it.
		languages: [...new Set<string>([...DISCOVER_LANGUAGES, ...(filters.language ? [filters.language] : [])])].map(
			(code) => ({ code, name: name(code) }),
		),
		keyword,
	};
}
