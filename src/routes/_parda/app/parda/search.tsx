import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/brand";
import { searchPageSchema } from "@/features/parda/search";
import { PardaSearchPage } from "@/features/parda/search/search-page";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/search?q=: TMDB's search in tabs (PLAN Task 66). Noindex. A search shown
 * (not a preload) is counted in `pd_search_stat`.
 */
export const Route = createFileRoute("/_parda/app/parda/search")({
	validateSearch: searchPageSchema,
	search: { middlewares: [stripSearchParams({ q: "", tab: "all", page: 1 })] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, preload }) => {
		const { loadSearchPage } = await import("@/features/parda/search/load");
		await loadSearchPage(context.queryClient, getLocale(), deps, !preload);
	},
	head: ({ match }) => pardaHead(match.search.q ? m.pd_search_title_for({ q: match.search.q }) : m.pd_search_title()),
	component: PardaSearchPage,
});
