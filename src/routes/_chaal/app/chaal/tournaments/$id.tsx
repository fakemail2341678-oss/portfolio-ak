import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalTournamentPage } from "@/features/chaal/events/tournament-page";
import { tournamentPageSearch } from "@/features/chaal/search";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/tournaments/$id (PLAN Task 83, decision 0273; noindex: people's names): an
 * arena, or a Swiss tournament (`?kind=swiss`), with its standings (`?page=`). One Lichess
 * doesn't know is Chaal's 404; the loader returns the name for the title.
 */
export const Route = createFileRoute("/_chaal/app/chaal/tournaments/$id")({
	validateSearch: tournamentPageSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) =>
		(await import("@/features/chaal/events/queries")).loadTournamentPage(context.queryClient, params.id, deps),
	head: ({ loaderData }) => chaalHead(loaderData?.name ?? m.ch_tournaments_title()),
	component: ChaalTournamentPage,
});
