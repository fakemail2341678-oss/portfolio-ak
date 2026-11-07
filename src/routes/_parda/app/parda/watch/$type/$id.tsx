import { createFileRoute, notFound } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/brand";
import { PardaWatchPage } from "@/features/parda/player/watch-page";
import { titleRouteParams, watchSearchSchema } from "@/features/parda/search";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/watch/movie/550-fight-club, /app/parda/watch/series/1396-breaking-bad?s=1&e=2:
 * the watch page (PLAN Task 64, decision 0236). Private (noindex). A series without
 * `?s=&e=` plays where the viewer is, else its first episode. A blocked or unknown title
 * or episode is Parda's 404; TMDB failing a 503.
 */
export const Route = createFileRoute("/_parda/app/parda/watch/$type/$id")({
	validateSearch: watchSearchSchema,
	loaderDeps: ({ search }) => ({ s: search.s, e: search.e }),
	loader: async ({ context, params, deps }) => {
		const parsed = titleRouteParams(params);
		if (!parsed) throw notFound();
		const { loadWatchPage } = await import("@/features/parda/player/load");
		return loadWatchPage(context.queryClient, getLocale(), parsed, deps);
	},
	head: ({ loaderData }) => pardaHead(loaderData?.title),
	component: PardaWatchPage,
});
