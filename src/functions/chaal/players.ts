import { createServerFn } from "@tanstack/react-start";
import {
	type ActivityDay,
	type ChaalLeaderboard,
	type ChaalPerfStats,
	type ChaalPlayerGames,
	type ChaalPlayerPage,
	type ChaalReplay,
	gameIdInputSchema,
	leaderboardInputSchema,
	type PlayerSuggestion,
	perfStatsInputSchema,
	playerGamesInputSchema,
	playerSearchInputSchema,
	type RatingSeries,
	usernameInputSchema,
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
	.validator(zodInput(leaderboardInputSchema))
	.handler(({ context, data }): Promise<ChaalLeaderboard> => players.leaderboard(context.chaal, data.perf));

export const getChaalPlayer = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInputSchema))
	.handler(
		({ context, data }): Promise<ChaalPlayerPage> => players.playerPage(context.chaal, context.session, data.username),
	);

export const getChaalRatingHistory = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInputSchema))
	.handler(({ context, data }): Promise<RatingSeries[]> => players.ratingHistory(context.chaal, data.username));

export const getChaalPerfStats = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(perfStatsInputSchema))
	.handler(
		({ context, data }): Promise<ChaalPerfStats | null> => players.perfStats(context.chaal, data.username, data.perf),
	);

export const getChaalActivity = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(usernameInputSchema))
	.handler(({ context, data }): Promise<ActivityDay[]> => players.activity(context.chaal, data.username));

export const getChaalPlayerGames = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(playerGamesInputSchema))
	.handler(({ context, data }): Promise<ChaalPlayerGames> => players.playerGames(context.chaal, data));

export const searchChaalPlayers = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(playerSearchInputSchema))
	.handler(({ context, data }): Promise<PlayerSuggestion[]> => players.searchPlayers(context.chaal, data.term));

export const getChaalReplay = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(gameIdInputSchema))
	.handler(({ context, data }): Promise<ChaalReplay | null> => players.replay(context.chaal, data.id));
