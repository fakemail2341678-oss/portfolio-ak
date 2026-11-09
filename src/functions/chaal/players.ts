import { createServerFn } from "@tanstack/react-start";
import {
	type ActivityDay,
	type ChaalLeaderboard,
	type ChaalPerfStats,
	type ChaalPlayerGames,
	type ChaalPlayerPage,
	type ChaalReplay,
	gameIdInput,
	leaderboardInput,
	type PlayerSuggestion,
	perfStatsInput,
	playerGamesInput,
	playerSearchInput,
	type RatingSeries,
	usernameInput,
} from "@/features/chaal/players/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as players from "@/server/chaal/players/service";

/**
 * Players and games for everyone (Task 81, decision 0271): leaderboards, a player's page
 * (with whether a connected viewer follows them and their score against them), a rating's
 * history and details, the activity, a page of games, the palette's search, and a game to
 * replay. Public: each starts with `withChaalPublic` and checks the `players` switch.
 */

export const getChaalLeaderboard = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(leaderboardInput))
	.handler(({ context, data }): Promise<ChaalLeaderboard> => players.leaderboard(context.chaal, data.perf));

export const getChaalPlayer = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInput))
	.handler(
		({ context, data }): Promise<ChaalPlayerPage> => players.playerPage(context.chaal, context.session, data.username),
	);

export const getChaalRatingHistory = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInput))
	.handler(({ context, data }): Promise<RatingSeries[]> => players.ratingHistory(context.chaal, data.username));

export const getChaalPerfStats = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(perfStatsInput))
	.handler(
		({ context, data }): Promise<ChaalPerfStats | null> => players.perfStats(context.chaal, data.username, data.perf),
	);

export const getChaalActivity = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInput))
	.handler(({ context, data }): Promise<ActivityDay[]> => players.activity(context.chaal, data.username));

export const getChaalPlayerGames = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(playerGamesInput))
	.handler(({ context, data }): Promise<ChaalPlayerGames> => players.playerGames(context.chaal, data));

export const searchChaalPlayers = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(playerSearchInput))
	.handler(({ context, data }): Promise<PlayerSuggestion[]> => players.searchPlayers(context.chaal, data.term));

export const getChaalReplay = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(gameIdInput))
	.handler(({ context, data }): Promise<ChaalReplay | null> => players.replay(context.chaal, data.id));
