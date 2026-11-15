import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleRouteParams } from "@/features/parda/search";
import { PardaCreditsPage } from "@/features/parda/title/components/parda-credits-page";
import { pardaContentHead } from "@/features/parda/title/head";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/movie/550-fight-club/credits: the full cast and crew, by department (PLAN Task 63). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/$type/$id/credits")({
	loader: async ({ context, params }) => {
		const parsed = titleRouteParams(params);
		if (!parsed) throw notFound();
		const { loadCreditsPage } = await import("@/features/parda/title/load");
		return loadCreditsPage(context.queryClient, getLocale(), parsed);
	},
	head: ({ loaderData }) => pardaContentHead(loaderData),
	component: PardaCreditsPage,
});
