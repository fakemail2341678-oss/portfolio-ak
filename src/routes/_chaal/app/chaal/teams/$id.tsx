import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalTeamPage } from "@/features/chaal/teams/team-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/teams/$id (PLAN Task 83, decision 0273; noindex): a team, its members and
 * tournaments, joining or leaving. One Lichess doesn't know is Chaal's 404.
 */
export const Route = createFileRoute("/_chaal/app/chaal/teams/$id")({
	loader: async ({ context, params }) =>
		(await import("@/features/chaal/teams/queries")).loadTeamPage(context.queryClient, params.id),
	head: ({ loaderData }) => chaalHead(loaderData?.name ?? m.ch_teams_title()),
	component: ChaalTeamPage,
});
