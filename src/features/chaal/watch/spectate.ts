import { play, START_FEN } from "../chess/rules";
import type { ChaalColor } from "../live/events";
import type { ChaalReplay } from "../players/schema";

/**
 * Following a game being played (PLAN Task 82, decision 0272): `/api/stream/game/{id}`, read by
 * the browser from Lichess. It sends the game's description, then every position so far
 * (the first without a move), then each new one, three moves behind (Lichess's rule for
 * spectators), and the description again when the game ends. The server's first paint comes
 * from Lichess's export, which may be a few moves ahead of the stream: the stream's restated
 * positions are checked against the moves already shown, so nothing is taken back.
 */

export type SpectatedMove = { uci: string; san: string; fen: string };

export type Spectated = {
	startFen: string;
	moves: SpectatedMove[];
	/**
	 * While the stream restates the game: the index of the next move it should repeat. Null
	 * once it has caught up with what's shown (then each position is a new move).
	 */
	cursor: number | null;
	/** Seconds left on each clock at `at` (a `performance.now()` time), or null without a clock. */
	clocks: Record<ChaalColor, number> | null;
	at: number;
	/** How the game ended (the stream's last description), or null while it's played. */
	over: { status: string; winner: ChaalColor | null } | null;
};

/** The first paint: the export's moves, as far as they read. */
export function spectatedFrom(game: Pick<ChaalReplay, "initialFen" | "moves">): Spectated {
	const startFen = game.initialFen ?? START_FEN;
	const moves: SpectatedMove[] = [];
	let fen = startFen;
	for (const san of game.moves) {
		const move = play(fen, san);
		if (!move) break;
		moves.push({ uci: move.uci, san: move.san, fen: move.fen });
		fen = move.fen;
	}
	return { startFen, moves, cursor: null, clocks: null, at: 0, over: null };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const STILL_PLAYED = new Set(["created", "started"]);

/** Two FENs show the same position: the placement, side, castling and en passant (not the counters). */
const samePosition = (a: string, b: string) =>
	a.split(" ").slice(0, 4).join(" ") === b.split(" ").slice(0, 4).join(" ");

/** Applies one line of a game's stream; anything that doesn't read leaves it as it was. */
export function applySpectateLine(state: Spectated, value: unknown, at: number): Spectated {
	if (!isRecord(value)) return state;
	// The game's description: at the start, and again when it ends.
	if (typeof value.id === "string") {
		const status = typeof value.status === "string" ? value.status : isRecord(value.status) ? value.status.name : null;
		if (typeof status === "string" && !STILL_PLAYED.has(status)) {
			const winner = value.winner === "white" || value.winner === "black" ? value.winner : null;
			return { ...state, over: { status, winner } };
		}
		return state;
	}
	if (typeof value.fen !== "string" || value.fen.length > 100) return state;
	const fen = value.fen;
	const wc = typeof value.wc === "number" ? value.wc : null;
	const bc = typeof value.bc === "number" ? value.bc : null;
	const clocks = wc !== null && bc !== null ? { white: wc, black: bc } : state.clocks;
	const lm = typeof value.lm === "string" && UCI.test(value.lm) ? value.lm : null;
	// A position without a move: the start, as the stream restates the game from it.
	if (!lm) {
		if (samePosition(fen, state.startFen)) return { ...state, cursor: state.moves.length > 0 ? 0 : null, clocks, at };
		return { startFen: fen, moves: [], cursor: null, clocks, at, over: state.over };
	}
	let moves = state.moves;
	const cursor = state.cursor;
	if (cursor !== null && cursor < moves.length) {
		// Restating: a move already shown is passed over.
		if (moves[cursor]?.uci === lm) {
			const next = cursor + 1;
			return { ...state, cursor: next < moves.length ? next : null, clocks, at };
		}
		// Lichess's line differs from what was shown: its own wins from here.
		moves = moves.slice(0, cursor);
	}
	const before = moves.at(-1)?.fen ?? state.startFen;
	const move = play(before, lm);
	if (!move || !samePosition(move.fen, fen)) {
		// Lost the thread (a line missed): show the position as it is now.
		return { startFen: fen, moves: [], cursor: null, clocks, at, over: state.over };
	}
	return { ...state, moves: [...moves, { uci: move.uci, san: move.san, fen: move.fen }], cursor: null, clocks, at };
}

/** The position now. */
export const spectatedFen = (state: Spectated) => state.moves.at(-1)?.fen ?? state.startFen;
