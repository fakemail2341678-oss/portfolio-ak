import { createServerFn } from "@tanstack/react-start";
import {
	type BroadcastTourSummary,
	broadcastBoardInput,
	broadcastListInput,
	broadcastRoundInput,
	broadcastSearchInput,
	broadcastTourInput,
	type ChaalBroadcastGame,
	type ChaalBroadcastRound,
	type ChaalBroadcastSearch,
	type ChaalBroadcasts,
	type ChaalBroadcastTour,
	type ChaalStreamer,
	type ChaalTv,
} from "@/features/chaal/watch/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as watch from "@/server/chaal/watch/service";

/**
 * Watch for everyone (Task 82, decision 0272): the TV's channels with their games, the
 * streamers live now, Lichess's broadcasts (top, official, a search), a tournament, a round
 * and a board's game. Public: each starts with `withChaalPublic` and checks the `watch`
 * switch. The live parts the browser reads from Lichess itself.
 */

export const getChaalTv = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<ChaalTv> => watch.tv(context.chaal));

export const getChaalStreamers = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<ChaalStreamer[]> => watch.streamers(context.chaal));

export const getChaalBroadcasts = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(broadcastListInput))
	.handler(({ context, data }): Promise<ChaalBroadcasts> => watch.broadcasts(context.chaal, data.page));

export const getChaalOfficialBroadcasts = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<BroadcastTourSummary[]> => watch.officialBroadcasts(context.chaal));

export const searchChaalBroadcasts = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(broadcastSearchInput))
	.handler(
		({ context, data }): Promise<ChaalBroadcastSearch> => watch.searchBroadcasts(context.chaal, data.q, data.page),
	);

export const getChaalBroadcastTour = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(broadcastTourInput))
	.handler(({ context, data }): Promise<ChaalBroadcastTour> => watch.broadcastTour(context.chaal, data.id));

export const getChaalBroadcastRound = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(broadcastRoundInput))
	.handler(({ context, data }): Promise<ChaalBroadcastRound> => watch.broadcastRound(context.chaal, data.id));

export const getChaalBroadcastGame = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(broadcastBoardInput))
	.handler(
		({ context, data }): Promise<ChaalBroadcastGame> => watch.broadcastGame(context.chaal, data.round, data.board),
	);
