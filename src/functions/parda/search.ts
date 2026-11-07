import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { discoverSearchSchema, QUERY_MAX, searchPageSchema } from "@/features/parda/search";
import type { DiscoverPageData, SearchPageData, SearchSuggestData } from "@/features/parda/search/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPardaCatalog } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { db } from "@/server/db/client";
import { catalogScope, limitAnonymousSearch, withinSearchLimit } from "@/server/parda/catalog/context";
import { discoverPage } from "@/server/parda/catalog/discover";
import { limitedSearchPage, noteSearch, searchPage, searchSuggest } from "@/server/parda/catalog/search";

/**
 * Parda's search and Discover (Task 66, decision 0239): open to everyone, each starting
 * with `withPardaCatalog`, so takedowns apply in catalog/service.ts. A search without a
 * session also counts against its own per-IP limit (`limitAnonymousSearch`).
 */

const locale = z.enum(locales);
const query = z.string().trim().min(1).max(QUERY_MAX);
const searchInput = z.strictObject({
	q: searchPageSchema.shape.q,
	tab: searchPageSchema.shape.tab,
	page: searchPageSchema.shape.page,
	locale,
});
const suggestInput = z.strictObject({ q: query, locale });
const discoverInput = discoverSearchSchema.extend({ locale }).strict();

export const getPardaSearch = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(searchInput))
	.handler(async ({ data, context }): Promise<SearchPageData> => {
		if (!context.catalog) return { configured: false };
		const scope = catalogScope(context.catalog, data.locale);
		// Over the limit, the page says so in place of results, rather than failing.
		if (data.q && !(await withinSearchLimit(context.session))) return limitedSearchPage(context.catalog.services, data);
		return searchPage(context.catalog.services, scope, data);
	});

/** The overlay's hits for what's typed. Never counted in the statistics. */
export const getPardaSuggest = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(suggestInput))
	.handler(async ({ data, context }): Promise<SearchSuggestData> => {
		if (!context.catalog) return { imageBase: "", hits: [] };
		await limitAnonymousSearch(context.session);
		return searchSuggest(context.catalog.services, catalogScope(context.catalog, data.locale), data.q);
	});

/**
 * Counts a search the search page showed (its first page, all kinds), for Task 69's overview.
 * It reads the answer the page just cached, so it doesn't count against the search limit
 * (an anonymous call over HTTP still does against the catalogue's).
 */
export const notePardaSearch = createServerFn({ method: "POST" })
	.middleware([withPardaCatalog])
	.validator(zodInput(suggestInput))
	.handler(async ({ data, context }): Promise<void> => {
		if (!context.catalog) return;
		await noteSearch(db, context.catalog.services, catalogScope(context.catalog, data.locale), data.q);
	});

export const getPardaDiscover = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(discoverInput))
	.handler(
		({ data: { locale: pageLocale, ...filters }, context }): Promise<DiscoverPageData> =>
			context.catalog
				? discoverPage(context.catalog.services, catalogScope(context.catalog, pageLocale), filters)
				: Promise.resolve({ configured: false }),
	);
