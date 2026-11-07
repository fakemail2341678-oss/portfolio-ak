import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleRouteParams, titleSearchSchema } from "@/features/parda/search";
import { pardaContentHead } from "@/features/parda/title/head";
import { PardaTitlePage } from "@/features/parda/title/parda-title-page";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/movie/550-fight-club, /app/parda/series/1396-breaking-bad: a title's page
 * (PLAN Task 63, decision 0235). Indexable; a wrong slug is a 301 to the right one; a
 * blocked or unknown title is Parda's 404; TMDB failing is a 503. `?season` picks a
 * series' season, `?page` a page of its episodes, `?episode` opens one's sheet.
 */
export const Route = createFileRoute("/_parda/app/parda/$type/$id/")({
	validateSearch: titleSearchSchema,
	loaderDeps: ({ search }) => ({ season: search.season, page: search.page }),
	loader: async ({ context, params, deps }) => {
		const parsed = titleRouteParams(params);
		if (!parsed) throw notFound();
		const { loadTitlePage } = await import("@/features/parda/title/load");
		return loadTitlePage(context.queryClient, getLocale(), parsed, deps, Boolean(context.session));
	},
	head: ({ loaderData }) => pardaContentHead(loaderData),
	component: PardaTitlePage,
});
