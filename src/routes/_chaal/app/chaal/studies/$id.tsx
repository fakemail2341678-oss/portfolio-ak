import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { studyPageSearch } from "@/features/chaal/search";
import { ChaalStudyPage } from "@/features/chaal/studies/study-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/studies/$id (PLAN Task 83, decision 0273; noindex): a study's chapters and the
 * one shown (`?chapter=`). One Lichess doesn't have, or won't show this viewer, is Chaal's 404.
 */
export const Route = createFileRoute("/_chaal/app/chaal/studies/$id")({
	validateSearch: studyPageSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) =>
		(await import("@/features/chaal/studies/queries")).loadStudyPage(context.queryClient, params.id, deps),
	head: ({ loaderData }) => chaalHead(loaderData?.name ?? m.ch_studies_title()),
	component: ChaalStudyPage,
});
