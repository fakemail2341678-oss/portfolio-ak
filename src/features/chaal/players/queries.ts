import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
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
import { isAppError } from "@/lib/errors";
import { ensureQuery, prefetch } from "@/lib/query";
import { chaalKeys } from "../keys";
import { chaalConnectionQueryOptions } from "../queries";
import type { PlayerSearch, PlayersSearch } from "../search";
import type { ChaalPlayer, LeaderboardPerf, PlayerGamesInput, PlayerPerf } from "./schema";

/**
 * Players' and games' reads (Task 81, decision 0271). A page's loader awaits what its first
 * paint needs (the leaderboard; the profile, or the games tab's page) and starts the rest
 * (the rating's history and details, the activity, the latest games), which stream into the
 * page as they arrive (`prefetch` + `useSuspenseQuery` under a sized Suspense).
 */

/** Lichess's own leaderboard first: blitz. */
export const DEFAULT_LEADERBOARD: LeaderboardPerf = "blitz";

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
export const followCalls = {
	follow: (username: string, follow: boolean) => followChaalPlayer({ data: { username, follow } }),
};

/** The games tab's input from the URL: only what's set, so equal filters share a key. */
export function gamesInputOf(username: string, search: PlayerSearch): PlayerGamesInput {
	const input: PlayerGamesInput = { username };
	if (search.perf) input.perf = search.perf;
	if (search.color) input.color = search.color;
	if (search.mode) input.rated = search.mode === "rated";
	if (search.result) input.result = search.result;
	if (search.vs) input.vs = search.vs;
	if (search.since) input.since = search.since;
	if (search.until) input.until = search.until;
	if (search.before) input.before = search.before;
	return input;
}

/** The rating the overview opens on: the one with the most games (blitz for a new player). */
export function mainPerf(player: ChaalPlayer): PlayerPerf {
	let best: { perf: PlayerPerf; games: number } | null = null;
	for (const rating of player.ratings) if (!best || rating.games > best.games) best = rating;
	return best?.perf ?? "blitz";
}

/** Whether the viewer may read whom they follow: connected with the social scopes. */
function canReadFollowing(queryClient: QueryClient): boolean {
	const connection = queryClient.getQueryData(chaalConnectionQueryOptions().queryKey);
	return Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("social"));
}

export async function loadPlayersPage(queryClient: QueryClient, search: PlayersSearch) {
	await Promise.all([
		// A failure is the page's to say.
		ensureQuery(queryClient, leaderboardQueryOptions(search.perf ?? DEFAULT_LEADERBOARD)).catch(() => undefined),
		canReadFollowing(queryClient)
			? ensureQuery(queryClient, followingQueryOptions()).catch(() => undefined)
			: Promise.resolve(undefined),
	]);
}

/** The latest games on the overview: the first page with no filter (the games in progress first). */
export const latestGamesInput = (username: string): PlayerGamesInput => ({ username });

export async function loadPlayerPage(queryClient: QueryClient, username: string, search: PlayerSearch) {
	const page = await ensureQuery(queryClient, playerQueryOptions(username)).catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		// Off, or Lichess away: the page says which.
		return null;
	});
	if (!page || page.player.closed) return;
	if (search.tab === "games") {
		await ensureQuery(queryClient, playerGamesQueryOptions(gamesInputOf(username, search))).catch(() => undefined);
		return;
	}
	const perf = search.perf ?? mainPerf(page.player);
	prefetch(queryClient, playerGamesQueryOptions(latestGamesInput(username)));
	prefetch(queryClient, ratingHistoryQueryOptions(username));
	prefetch(queryClient, perfStatsQueryOptions(username, perf));
	prefetch(queryClient, activityQueryOptions(username));
}
