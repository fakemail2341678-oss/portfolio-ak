import { createFileRoute } from "@tanstack/react-router";
import { ChaalTournamentsPage } from "@/features/chaal/events/tournaments-page";
import { chaalPageHead } from "@/features/chaal/head";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { tournamentsSearch } from "@/features/chaal/search";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/tournaments (PLAN Task 83, decision 0273; indexable): Lichess's arenas, coming
 * up, being played (`?view=started`) and finished (`?view=finished`).
 */
export const Route = createFileRoute("/_chaal/app/chaal/tournaments/")({
	validateSearch: tournamentsSearch,
	loader: async ({ context }) =>
		(await import("@/features/chaal/events/queries")).loadTournamentsPage(context.queryClient),
	head: () => chaalPageHead(CHAAL_PATHS.tournaments, m.ch_tournaments_title(), m.ch_tournaments_description()),
	component: ChaalTournamentsPage,
});
