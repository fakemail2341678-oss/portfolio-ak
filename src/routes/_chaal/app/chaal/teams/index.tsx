import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { teamsSearch } from "@/features/chaal/search";
import { ChaalTeamsPage } from "@/features/chaal/teams/teams-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/teams (PLAN Task 83, decision 0273; noindex: people's words): popular teams, a
 * search (`?q=`), or the player's own (`?view=mine`).
 */
export const Route = createFileRoute("/_chaal/app/chaal/teams/")({
	validateSearch: teamsSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) =>
		(await import("@/features/chaal/teams/queries")).loadTeamsPage(context.queryClient, deps),
	head: () => chaalHead(m.ch_teams_title()),
	component: ChaalTeamsPage,
});
