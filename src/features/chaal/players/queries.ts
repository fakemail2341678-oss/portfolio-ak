import { queryOptions } from "@tanstack/react-query";
import { followChaalPlayer, getChaalFollowing } from "@/functions/chaal/follows";
import {
	getChaalActivity,
	getChaalLeaderboard,
	getChaalPerfStats,
	getChaalPlayer,
	getChaalPlayerGames,
	getChaalRatingHistory,
	getChaalReplay,
	searchChaalPlayers,
} from "@/functions/chaal/players";
import { chaalKeys } from "../keys";
import type { LeaderboardPerf, PlayerGamesInput, PlayerPerf } from "./schema";

/**
 * Players' and games' reads (Task 81, decision 0271). A page's loader awaits what its first
 * paint needs (the leaderboard; the profile, or the games tab's page) and starts the rest
 * (the rating's history and details, the activity, the latest games), which stream into the
 * page as they arrive (`prefetch` + `useSuspenseQuery` under a sized Suspense).
 */

export const leaderboardQueryOptions = (perf: LeaderboardPerf) =>
	queryOptions({ queryKey: chaalKeys.leaderboard(perf), queryFn: () => getChaalLeaderboard({ data: { perf } }) });

export const playerQueryOptions = (username: string) =>
	queryOptions({
		queryKey: chaalKeys.player(username),
		queryFn: () => getChaalPlayer({ data: { username } }),
		retry: false,
	});

export const ratingHistoryQueryOptions = (username: string) =>
	queryOptions({
		queryKey: chaalKeys.ratingHistory(username),
		queryFn: () => getChaalRatingHistory({ data: { username } }),
		staleTime: 10 * 60_000,
	});

export const perfStatsQueryOptions = (username: string, perf: PlayerPerf) =>
	queryOptions({
		queryKey: chaalKeys.perfStats(username, perf),
		queryFn: () => getChaalPerfStats({ data: { username, perf } }),
		staleTime: 10 * 60_000,
	});

export const activityQueryOptions = (username: string) =>
	queryOptions({
		queryKey: chaalKeys.activity(username),
		queryFn: () => getChaalActivity({ data: { username } }),
		staleTime: 10 * 60_000,
	});

export const playerGamesQueryOptions = (input: PlayerGamesInput) =>
	queryOptions({
		queryKey: chaalKeys.playerGames(input),
		queryFn: () => getChaalPlayerGames({ data: input }),
	});

export const playerSearchQueryOptions = (term: string) =>
	queryOptions({
		queryKey: chaalKeys.playerSearch(term),
		queryFn: () => searchChaalPlayers({ data: { term } }),
		staleTime: 60_000,
	});

export const followingQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.following(), queryFn: () => getChaalFollowing(), retry: false });

export const replayQueryOptions = (id: string) =>
	queryOptions({ queryKey: chaalKeys.replay(id), queryFn: () => getChaalReplay({ data: { id } }), retry: false });

/** Following and unfollowing; a test or a story passes its own. */
export const chaalPlayersMutations = {
	follow: (username: string, follow: boolean) => followChaalPlayer({ data: { username, follow } }),
};
