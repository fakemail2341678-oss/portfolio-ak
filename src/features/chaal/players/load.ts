import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { isAppError } from "@/lib/errors";
import { ensureQuery, prefetch } from "@/lib/query";
import { chaalConnectionQueryOptions } from "../queries";
import type { PlayerSearch, PlayersSearch } from "../search";
import { DEFAULT_LEADERBOARD } from "./constants";
import { gamesInputOf, latestGamesInput } from "./lib/games-input";
import { mainPerf } from "./lib/perf";
import {
	activityQueryOptions,
	followingQueryOptions,
	leaderboardQueryOptions,
	perfStatsQueryOptions,
	playerGamesQueryOptions,
	playerQueryOptions,
	ratingHistoryQueryOptions,
} from "./queries";

export async function loadPlayersPage(queryClient: QueryClient, search: PlayersSearch) {
	await Promise.all([
		// A failure is the page's to say.
		ensureQuery(queryClient, leaderboardQueryOptions(search.perf ?? DEFAULT_LEADERBOARD)).catch(() => undefined),
		canReadFollowing(queryClient)
			? ensureQuery(queryClient, followingQueryOptions()).catch(() => undefined)
			: Promise.resolve(undefined),
	]);
}

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

/** Whether the viewer may read whom they follow: connected with the social scopes. */
export function canReadFollowing(queryClient: QueryClient): boolean {
	const connection = queryClient.getQueryData(chaalConnectionQueryOptions().queryKey);
	return Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("social"));
}
