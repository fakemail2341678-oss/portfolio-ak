import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalPlayerPage } from "@/features/chaal/players/player-page";
import { playerSearch } from "@/features/chaal/search";

/**
 * /app/chaal/players/$username (PLAN Task 81, decision 0271; noindex: a person's page): the
 * overview (ratings, a rating's history and details, the activity, the current game, the
 * score with the viewer, the latest games) or `?tab=games` with filters. A name Lichess
 * doesn't know is Chaal's 404.
 */
export const Route = createFileRoute("/_chaal/app/chaal/players/$username")({
	validateSearch: playerSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) =>
		(await import("@/features/chaal/players/queries")).loadPlayerPage(context.queryClient, params.username, deps),
	head: ({ params }) => chaalHead(params.username),
	component: ChaalPlayerPage,
});
