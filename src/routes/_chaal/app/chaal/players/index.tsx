import { createFileRoute } from "@tanstack/react-router";
import { chaalPageHead } from "@/features/chaal/head";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { ChaalPlayersPage } from "@/features/chaal/players/players-page";
import { playersSearch } from "@/features/chaal/search";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/players (PLAN Task 81, decision 0271; indexable): Lichess's leaderboards by
 * rating (`?perf=`), and the players a connected viewer follows. The loader reads what the
 * first paint shows; a failed read is the page's to say.
 */
export const Route = createFileRoute("/_chaal/app/chaal/players/")({
	validateSearch: playersSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) =>
		(await import("@/features/chaal/players/queries")).loadPlayersPage(context.queryClient, deps),
	head: () => chaalPageHead(CHAAL_PATHS.players, m.ch_players_title(), m.ch_players_description()),
	component: ChaalPlayersPage,
});
