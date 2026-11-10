import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { studiesSearch } from "@/features/chaal/search";
import { ChaalStudiesPage } from "@/features/chaal/studies/studies-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/studies (PLAN Task 83, decision 0273; noindex: people's work): an account's
 * public studies (`?by=`), or the player's own (`?view=mine`).
 */
export const Route = createFileRoute("/_chaal/app/chaal/studies/")({
	validateSearch: studiesSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) =>
		(await import("@/features/chaal/studies/queries")).loadStudiesPage(context.queryClient, deps),
	head: () => chaalHead(m.ch_studies_title()),
	component: ChaalStudiesPage,
});
