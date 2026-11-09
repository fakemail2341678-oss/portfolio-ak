import "@tanstack/react-start/server-only";
import { PGN_MAX_BYTES } from "@/features/chaal/chess/pgn";
import { readWatchLimits } from "@/features/chaal/watch/limits";
import type {
	BroadcastTourSummary,
	ChaalBroadcastGame,
	ChaalBroadcastRound,
	ChaalBroadcastSearch,
	ChaalBroadcasts,
	ChaalBroadcastTour,
	ChaalStreamer,
	ChaalTv,
	ChaalTvGame,
} from "@/features/chaal/watch/schema";
import { log } from "@/server/log";
import { requireFeature } from "../connect/service";
import type { ChaalPublic } from "../context";
import {
	broadcastRoundAnswer,
	broadcastSearchAnswer,
	broadcastTopAnswer,
	broadcastTourAnswer,
	gameLineAnswer,
	officialBroadcastAnswer,
	streamersAnswer,
	tvChannelsAnswer,
} from "../lichess/schemas";

/**
 * Watch (PLAN Task 82, decision 0272): what the server reads for the pages' first paint,
 * all public on Lichess, on the public lane through the cache, each checking the `watch`
 * switch. What's live after that (the TV's feeds, a game being played, a round's PGN) the
 * browser reads from Lichess itself, so viewers don't share our server's limits.
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const TTL = {
	/** PLAN 13.5: the TV's channels, and their games' positions with them. */
	tv: 5 * SECOND,
	streamers: MINUTE,
	/** PLAN 13.5: broadcasts five minutes; what's being played changes sooner. */
	broadcasts: 5 * MINUTE,
	live: 20 * SECOND,
	liveTour: MINUTE,
} as const;

/** How many official broadcasts the list shows (Lichess allows 100). */
const OFFICIAL_COUNT = 20;

/** What the TV asks of its games' export: their last positions, without the moves. */
const TV_EXPORT = { moves: false, lastFen: true } as const;

type Public = Pick<ChaalPublic, "cache" | "lichess" | "settings">;

/**
 * The TV's channels (the ones the admin shows) with their games: who plays and, from one
 * export of their ids, each game's last position. A failed export leaves the positions out;
 * the browser's feeds bring them.
 */
export async function tv(chaal: Public): Promise<ChaalTv> {
	requireFeature(chaal.settings, "watch");
	const epoch = chaal.settings.cacheEpoch;
	const channels = await chaal.cache.read({ endpoint: "tv-channels", path: "/api/tv/channels", epoch }, TTL.tv, () =>
		chaal.lichess.json({ endpoint: "tv-channels", path: "/api/tv/channels", lane: "public" }, tvChannelsAnswer),
	);
	const shown = readWatchLimits(chaal.settings.watch).channels.flatMap((channel) => {
		const entry = channels[channel];
		return entry ? [{ channel, id: entry.gameId, color: entry.color ?? "white" }] : [];
	});
	if (shown.length === 0) return { games: [] };
	const ids = [...new Set(shown.map((each) => each.id))].join(",");
	const path = "/api/games/export/_ids";
	const exported = await chaal.cache
		.read({ endpoint: "tv-games", path, params: { ids }, epoch }, TTL.tv, () =>
			chaal.lichess.lines(
				{ endpoint: "tv-games", path, params: TV_EXPORT, method: "POST", text: ids, lane: "public" },
				gameLineAnswer,
			),
		)
		.catch((error: unknown) => {
			log("warn", "chaal tv: the games' export failed", { error: error instanceof Error ? error.message : "unknown" });
			return [];
		});
	const byId = new Map(exported.map((game) => [game.id, game]));
	return {
		games: shown.flatMap(({ channel, id, color }): ChaalTvGame[] => {
			const game = byId.get(id);
			// A game the export doesn't have yet is still on the TV: its feed names the players.
			if (!game) return [];
			return [
				{
					channel,
					id,
					orientation: color,
					white: game.white,
					black: game.black,
					fen: game.lastFen,
					lastMove: game.lastMove,
					perf: game.perf,
					rated: game.rated,
					clock: game.clock,
				},
			];
		}),
	};
}

/** The streamers live now, unless the admin hides them. */
export async function streamers(chaal: Public): Promise<ChaalStreamer[]> {
	requireFeature(chaal.settings, "watch");
	if (!readWatchLimits(chaal.settings.watch).streamers) return [];
	const path = "/api/streamer/live";
	return chaal.cache.read({ endpoint: "streamers", path, epoch: chaal.settings.cacheEpoch }, TTL.streamers, () =>
		chaal.lichess.json({ endpoint: "streamers", path, lane: "public" }, streamersAnswer),
	);
}

/** Lichess's broadcasts page: live now, coming up, and a page of the past. */
export async function broadcasts(chaal: Public, page: number): Promise<ChaalBroadcasts> {
	requireFeature(chaal.settings, "watch");
	const path = "/api/broadcast/top";
	const params = { page };
	return chaal.cache.read(
		{ endpoint: "broadcast-top", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.broadcasts,
		() => chaal.lichess.json({ endpoint: "broadcast-top", path, params, lane: "public" }, broadcastTopAnswer),
	);
}

/** The official broadcasts: the live ones by tier, then the latest finished. */
export async function officialBroadcasts(chaal: Public): Promise<BroadcastTourSummary[]> {
	requireFeature(chaal.settings, "watch");
	const path = "/api/broadcast";
	const params = { nb: OFFICIAL_COUNT };
	return chaal.cache.read(
		{ endpoint: "broadcast-official", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.broadcasts,
		() =>
			chaal.lichess.lines({ endpoint: "broadcast-official", path, params, lane: "public" }, officialBroadcastAnswer),
	);
}

/** Broadcasts whose names match. */
export async function searchBroadcasts(chaal: Public, q: string, page: number): Promise<ChaalBroadcastSearch> {
	requireFeature(chaal.settings, "watch");
	const path = "/api/broadcast/search";
	const params = { q: q.trim().toLowerCase(), page };
	return chaal.cache.read(
		{ endpoint: "broadcast-search", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.broadcasts,
		() => chaal.lichess.json({ endpoint: "broadcast-search", path, params, lane: "public" }, broadcastSearchAnswer),
	);
}

/** A tournament and its rounds; NOT_FOUND when Lichess has no such broadcast. */
export async function broadcastTour(chaal: Public, id: string): Promise<ChaalBroadcastTour> {
	requireFeature(chaal.settings, "watch");
	const path = `/api/broadcast/${id}`;
	return chaal.cache.read(
		{ endpoint: "broadcast-tour", path, epoch: chaal.settings.cacheEpoch },
		(tour: ChaalBroadcastTour) =>
			tour.rounds.some((round) => round.state === "ongoing") ? TTL.liveTour : TTL.broadcasts,
		() => chaal.lichess.json({ endpoint: "broadcast-tour", path, lane: "public" }, broadcastTourAnswer),
	);
}

/** A round and its boards: kept 20 s while it isn't finished (the browser's stream follows it), five minutes after. */
export async function broadcastRound(chaal: Public, id: string): Promise<ChaalBroadcastRound> {
	requireFeature(chaal.settings, "watch");
	const path = `/api/broadcast/-/-/${id}`;
	return chaal.cache.read(
		{ endpoint: "broadcast-round", path, epoch: chaal.settings.cacheEpoch },
		(round: ChaalBroadcastRound) => (round.round.state === "finished" ? TTL.broadcasts : TTL.live),
		() => chaal.lichess.json({ endpoint: "broadcast-round", path, lane: "public" }, broadcastRoundAnswer),
	);
}

/** A game still being played: its PGN's result is "*". */
const unfinished = (pgn: string) => /\[Result "\*"\]/.test(pgn);

/**
 * A board's game as PGN (Lichess keeps each board as a chapter of the round's study), for
 * the focused board's first paint. NOT_FOUND when the round has no such board.
 */
export async function broadcastGame(chaal: Public, round: string, board: string): Promise<ChaalBroadcastGame> {
	requireFeature(chaal.settings, "watch");
	const path = `/api/study/${round}/${board}.pgn`;
	const pgn = await chaal.cache.read(
		{ endpoint: "broadcast-game", path, epoch: chaal.settings.cacheEpoch },
		(text: string) => (unfinished(text) ? TTL.live : TTL.broadcasts),
		() => chaal.lichess.pgn({ endpoint: "broadcast-game", path, lane: "public" }, PGN_MAX_BYTES),
	);
	return { round, board, pgn };
}
