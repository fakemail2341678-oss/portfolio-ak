import { createFileRoute, notFound } from "@tanstack/react-router";
import { pardaPageHead } from "@/features/parda/home/head";
import { PardaHubPage } from "@/features/parda/home/parda-page";
import { isPardaHub } from "@/features/parda/search";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/movies, /series and /anime: a hub's billboard and rails (PLAN Task 62). Anything else is Parda's 404. */
export const Route = createFileRoute("/_parda/app/parda/$hub")({
	loader: async ({ context, params }) => {
		if (!isPardaHub(params.hub)) throw notFound();
		const { loadPardaPage } = await import("@/features/parda/home/load");
		return loadPardaPage(context.queryClient, getLocale(), params.hub);
	},
	head: ({ params }) => pardaPageHead(isPardaHub(params.hub) ? params.hub : "home"),
	component: PardaHubPage,
});
