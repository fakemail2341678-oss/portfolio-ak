import { queryOptions } from "@tanstack/react-query";
import { getChaalMyTeams, joinChaalTeam, leaveChaalTeam } from "@/functions/chaal/team-membership";
import { getChaalTeam, getChaalTeams, searchChaalTeams } from "@/functions/chaal/teams";
import { chaalKeys } from "../keys";
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
export const chaalTeamsMutations = {
	join: (input: TeamJoinInput) => joinChaalTeam({ data: input }),
	leave: (id: string) => leaveChaalTeam({ data: { id } }),
};
