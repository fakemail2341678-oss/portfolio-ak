import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { PardaDiscoverPage } from "@/features/parda/discover/discover-page";
import { pardaDiscoverHead } from "@/features/parda/home/head";
import { DISCOVER_DEFAULTS, discoverSearchSchema } from "@/features/parda/search";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/discover: TMDB's discover under Parda's filters, all in the address (PLAN Task 66). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/discover")({
	validateSearch: discoverSearchSchema,
	search: { middlewares: [stripSearchParams(DISCOVER_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const { loadDiscoverPage } = await import("@/features/parda/search/load");
		await loadDiscoverPage(context.queryClient, getLocale(), deps);
	},
	head: () => pardaDiscoverHead(),
	component: PardaDiscoverPage,
});
