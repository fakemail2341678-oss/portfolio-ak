import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { getChaalMyTeams, joinChaalTeam, leaveChaalTeam } from "@/functions/chaal/team-membership";
import { getChaalTeam, getChaalTeams, searchChaalTeams } from "@/functions/chaal/teams";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { chaalKeys } from "../keys";
import { chaalConnectionQueryOptions } from "../queries";
import type { TeamsSearch } from "../search";
import type { TeamJoinInput } from "./schema";

/**
 * Teams' reads (Task 83, decision 0273): popular teams, a search, the player's own (with
 * their token), and a team. A page's loader awaits what its first paint shows.
 */

export const teamsQueryOptions = (page: number) =>
	queryOptions({
		queryKey: chaalKeys.teams(page),
		queryFn: () => getChaalTeams({ data: { page } }),
		staleTime: 60_000,
	});

export const teamSearchQueryOptions = (q: string, page: number) =>
	queryOptions({
		queryKey: chaalKeys.teamSearch(q, page),
		queryFn: () => searchChaalTeams({ data: { q, page } }),
		staleTime: 60_000,
	});

export const myTeamsQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.myTeams(), queryFn: () => getChaalMyTeams(), retry: false });

export const teamQueryOptions = (id: string) =>
	queryOptions({ queryKey: chaalKeys.team(id), queryFn: () => getChaalTeam({ data: { id } }), retry: false });

/** Joining and leaving; a test or a story passes its own. */
export const teamCalls = {
	join: (input: TeamJoinInput) => joinChaalTeam({ data: input }),
	leave: (id: string) => leaveChaalTeam({ data: { id } }),
};

/** Whether the viewer's connection may read their teams: connected, with the teams' scopes. */
export function canUseTeams(queryClient: QueryClient): boolean {
	const connection = queryClient.getQueryData(chaalConnectionQueryOptions().queryKey);
	return Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("teams"));
}

/** /teams: the list the URL asks for (a failure is the page's to say). */
export async function loadTeamsPage(queryClient: QueryClient, search: TeamsSearch) {
	const page = search.page ?? 1;
	const read = search.q
		? ensureQuery(queryClient, teamSearchQueryOptions(search.q, page))
		: search.view === "mine"
			? canUseTeams(queryClient)
				? ensureQuery(queryClient, myTeamsQueryOptions())
				: Promise.resolve(undefined)
			: ensureQuery(queryClient, teamsQueryOptions(page));
	await read.catch(() => undefined);
}

/** /teams/$id: the team (one Lichess doesn't know is Chaal's 404); its name for the title. */
export async function loadTeamPage(queryClient: QueryClient, id: string): Promise<{ name: string } | undefined> {
	const page = await ensureQuery(queryClient, teamQueryOptions(id)).catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		return null;
	});
	return page ? { name: page.team.name } : undefined;
}
