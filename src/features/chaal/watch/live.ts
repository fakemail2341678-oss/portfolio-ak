import type { Square } from "../board/fen";
import type { ChaalColor } from "../live/events";
import type { GamePlayerSummary } from "../players/schema";
import type { ChaalTvGame } from "./schema";

/**
 * The TV's feeds (PLAN Task 82, decision 0272): `/api/tv/{channel}/feed`, read by the browser
 * from Lichess. A `featured` line names a game (its players, their clocks and its position)
 * when the feed opens and whenever the channel moves to another game; a `fen` line is each
 * move after (the position, the move in UCI, both clocks in seconds). Pure, without chess.js:
 * the grid's diagrams need nothing more.
 */

export type TvPlayer = Pick<GamePlayerSummary, "name" | "title" | "rating" | "aiLevel">;

export type TvState = {
	id: string;
	orientation: ChaalColor;
	fen: string | null;
	lastMove: string | null;
	white: TvPlayer;
	black: TvPlayer;
	/** Seconds left on each side's clock at `at`, or null before a feed said. */
	clocks: Record<ChaalColor, number> | null;
	/** When the clocks were read: a `performance.now()` time. */
	at: number;
};

/** The TV's first paint, from the server's read (a few seconds behind). */
export function tvStateOf(game: ChaalTvGame): TvState {
	const player = (side: GamePlayerSummary): TvPlayer => ({
		name: side.name,
		title: side.title,
		rating: side.rating,
		aiLevel: side.aiLevel,
	});
	return {
		id: game.id,
		orientation: game.orientation,
		fen: game.fen,
		lastMove: game.lastMove,
		white: player(game.white),
		black: player(game.black),
		clocks: null,
		at: 0,
	};
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown, max: number) => (typeof value === "string" && value.length <= max ? value : null);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const GAME_ID = /^[A-Za-z0-9]{8}$/;

function featuredPlayer(players: unknown[], color: ChaalColor): (TvPlayer & { seconds: number | null }) | null {
	const entry = players.find((each) => isRecord(each) && each.color === color);
	if (!isRecord(entry)) return null;
	const user = isRecord(entry.user) ? entry.user : {};
	const aiLevel = count(entry.ai);
	return {
		// The Lichess AI has no account: it's named by its level where it's shown.
		name: text(user.name, 30) ?? "?",
		title: text(user.title, 4),
		rating: count(entry.rating),
		aiLevel,
		seconds: count(entry.seconds),
	};
}

/** Applies one line of a TV feed; anything that doesn't read leaves the state as it was. */
export function applyTvLine(state: TvState | null, value: unknown, at: number): TvState | null {
	if (!isRecord(value) || !isRecord(value.d)) return state;
	const data = value.d;
	if (value.t === "featured") {
		const id = text(data.id, 8);
		const players = Array.isArray(data.players) ? data.players : [];
		const white = featuredPlayer(players, "white");
		const black = featuredPlayer(players, "black");
		const fen = text(data.fen, 100);
		if (!id || !GAME_ID.test(id) || !white || !black || !fen) return state;
		return {
			id,
			orientation: data.orientation === "black" ? "black" : "white",
			fen,
			// A feed restating the game shown keeps its last move; a new game has none yet.
			lastMove: state && state.id === id && state.fen === fen ? state.lastMove : null,
			white: { name: white.name, title: white.title, rating: white.rating, aiLevel: white.aiLevel },
			black: { name: black.name, title: black.title, rating: black.rating, aiLevel: black.aiLevel },
			clocks: white.seconds !== null && black.seconds !== null ? { white: white.seconds, black: black.seconds } : null,
			at,
		};
	}
	if (value.t === "fen" && state) {
		const fen = text(data.fen, 100);
		if (!fen) return state;
		const lm = text(data.lm, 5);
		const wc = count(data.wc);
		const bc = count(data.bc);
		return {
			...state,
			fen,
			lastMove: lm && UCI.test(lm) ? lm : null,
			clocks: wc !== null && bc !== null ? { white: wc, black: bc } : state.clocks,
			at,
		};
	}
	return state;
}

/** The side to move in a FEN (its second field). */
export const sideToMove = (fen: string): ChaalColor => (fen.split(" ")[1] === "b" ? "black" : "white");

/** A move's two squares, to ring on a diagram. */
export const squaresOfMove = (uci: string | null): Square[] =>
	uci && UCI.test(uci) ? [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square] : [];

/** Where the browser reads a TV channel's feed. */
export const tvFeedUrl = (live: string, channel: string) => `${live}/api/tv/${channel}/feed`;

/** Where the browser follows a game being played (three moves behind, as Lichess shows spectators). */
export const gameStreamUrl = (live: string, id: string) => `${live}/api/stream/game/${id}`;

/** Where the browser follows a broadcast round: every board's PGN, then each board again as it moves. */
export const roundStreamUrl = (live: string, round: string) => `${live}/api/stream/broadcast/round/${round}.pgn`;
