import { type ClockState, pressClock } from "../chess/clock";
import { type Color, type GameEndReason, type GameResult, opposite, play, START_FEN, turnOf } from "../chess/rules";
import type { ChaalChatLine, ChaalGameFull, ChaalGameLine, ChaalGameState } from "../live/events";

/**
 * A game played on Lichess, as its page holds it (PLAN 13.5, "Live play"; decision 0266):
 * Lichess's lines applied in order, the moves replayed from its UCI list, the player's
 * own move shown before Lichess confirms it (`pending`, rolled back on a refusal), the chat
 * and whether the opponent has gone. Pure: the page's hook (./use-live-game.ts) feeds it
 * the stream and the clock.
 */

export type LiveMove = { uci: string; san: string; fen: string };

export type LiveGame = {
	full: ChaalGameFull;
	/** The player's side. */
	color: Color;
	state: ChaalGameState;
	startFen: string;
	/** Lichess's moves, replayed. */
	moves: LiveMove[];
	/** The player's move, shown before Lichess has it; `at` is when it was made (a monotonic time). */
	pending: (LiveMove & { at: number }) | null;
	/** When Lichess's clock times were read (a monotonic time, `performance.now()`). */
	receivedAt: number;
	chat: ChaalChatLine[];
	/** The opponent left: when a win or a draw may be claimed (a monotonic time); null when they're here. */
	gone: { claimAt: number } | null;
};

/** Lichess writes castling in Chess960's way (the king onto its rook) in some games: Chaal plays the king's two squares. */
function standardCastling(fen: string, uci: string): string {
	const castles: Record<string, string> = { e1h1: "e1g1", e1a1: "e1c1", e8h8: "e8g8", e8a8: "e8c8" };
	const standard = castles[uci.slice(0, 4)];
	if (!standard) return uci;
	const placement = fen.split(" ")[0] ?? "";
	const rank = uci[1] === "1" ? placement.split("/")[7] : placement.split("/")[0];
	// Only when a king stands on e1/e8: a rook move from e1 to h1 stays as it is.
	const files = (rank ?? "").replace(/\d/g, (n) => ".".repeat(Number(n)));
	return files[4]?.toLowerCase() === "k" ? standard : uci;
}

/** Replays `ucis` from `startFen`, reusing `known` where it's the same line. Stops at the first move that doesn't play. */
export function replay(startFen: string, ucis: ReadonlyArray<string>, known: ReadonlyArray<LiveMove> = []): LiveMove[] {
	const moves: LiveMove[] = [];
	let fen = startFen;
	for (const [index, raw] of ucis.entries()) {
		const reused = known[index];
		if (reused && reused.uci === raw) {
			moves.push(reused);
			fen = reused.fen;
			continue;
		}
		const played = play(fen, standardCastling(fen, raw));
		if (!played) break;
		moves.push({ uci: raw, san: played.san, fen: played.fen });
		fen = played.fen;
	}
	return moves;
}

export function liveGameOf(full: ChaalGameFull, color: Color, now: number): LiveGame {
	const startFen = full.initialFen ?? START_FEN;
	return {
		full,
		color,
		state: full.state,
		startFen,
		moves: replay(startFen, full.state.moves),
		pending: null,
		receivedAt: now,
		chat: [],
		gone: null,
	};
}

/** Whether Lichess's status means the game is over. */
export const isOver = (status: string) => status !== "created" && status !== "started";

/** The moves shown: Lichess's, then the player's pending one. */
export const shownMoves = (game: LiveGame): LiveMove[] => (game.pending ? [...game.moves, game.pending] : game.moves);

export const fenOf = (game: LiveGame): string => shownMoves(game).at(-1)?.fen ?? game.startFen;

function withState(game: LiveGame, state: ChaalGameState, now: number): LiveGame {
	const moves = replay(game.startFen, state.moves, game.moves);
	// Lichess has the pending move (or moved on, or took it back): it's no longer ours to show.
	const pending =
		game.pending && state.moves.length === game.moves.length && !isOver(state.status) ? game.pending : null;
	return { ...game, state, moves, pending, receivedAt: now };
}

/** One of the game stream's lines, received at `now`. */
export function applyLine(game: LiveGame, line: ChaalGameLine, now: number): LiveGame {
	switch (line.type) {
		case "gameFull": {
			// A reconnect: everything again, the pending move kept if Lichess hasn't seen it yet.
			const next = withState({ ...game, full: line.game }, line.game.state, now);
			return next;
		}
		case "gameState":
			return withState(game, line.state, now);
		case "chatLine":
			return {
				...game,
				chat: [...game.chat, { room: line.room, username: line.username, text: line.text }].slice(-200),
			};
		case "opponentGone":
			return { ...game, gone: line.gone ? { claimAt: now + (line.claimWinInSeconds ?? 0) * 1000 } : null };
		default:
			return game;
	}
}

/** The player's move, shown at once. */
export function withPending(game: LiveGame, move: LiveMove, now: number): LiveGame {
	return { ...game, pending: { ...move, at: now } };
}

/** Lichess refused the move: the board goes back. */
export const rollback = (game: LiveGame): LiveGame => (game.pending ? { ...game, pending: null } : game);

/** Whose turn it is on the board shown. */
export const turnIn = (game: LiveGame): Color => turnOf(fenOf(game));

/** Whether it's the player's move now (the game going on, nothing pending). */
export const myTurn = (game: LiveGame): boolean =>
	!isOver(game.state.status) && !game.pending && turnOf(fenOf(game)) === game.color;

/**
 * The clocks now: Lichess's times when they arrived, the side to move running once both
 * sides have moved (Lichess starts the clocks then). A pending move presses the player's
 * clock where it was made, so the display turns at once. Null for correspondence.
 */
export function clockOf(game: LiveGame): ClockState | null {
	if (!game.full.clock) return null;
	const { state } = game;
	const running: Color | null =
		!isOver(state.status) && game.moves.length >= 2 ? turnOf(fenOf({ ...game, pending: null })) : null;
	const base: ClockState = { white: state.wtime, black: state.btime, running, since: game.receivedAt };
	if (!game.pending || !running) return base;
	const increment = game.color === "white" ? state.winc : state.binc;
	return pressClock(base, game.pending.at, increment);
}

export type LiveOffers = {
	/** The opponent offers a draw, or a takeback. */
	draw: boolean;
	takeback: boolean;
	/** The player's own offers, waiting. */
	myDraw: boolean;
	myTakeback: boolean;
};

export function offersOf(game: LiveGame): LiveOffers {
	const { state, color } = game;
	const white = color === "white";
	return {
		draw: white ? state.bdraw : state.wdraw,
		takeback: white ? state.btakeback : state.wtakeback,
		myDraw: white ? state.wdraw : state.bdraw,
		myTakeback: white ? state.wtakeback : state.btakeback,
	};
}

/** The opponent: a player, or the Lichess AI. */
export const opponentOf = (game: LiveGame) => game.full[opposite(game.color)];

export const againstAi = (game: LiveGame): boolean => opponentOf(game).aiLevel !== null;

/** Until both sides have moved, a game is aborted rather than resigned. */
export const canAbort = (game: LiveGame): boolean => !isOver(game.state.status) && game.moves.length < 2;

/** A takeback asks for the player's own last move back: there must be one. */
export const canTakeBack = (game: LiveGame): boolean => {
	if (isOver(game.state.status) || game.pending) return false;
	const mine = game.color === "white" ? Math.ceil(game.moves.length / 2) : Math.floor(game.moves.length / 2);
	return mine > 0;
};

export type LiveEnding = { result: GameResult | null; reason: GameEndReason | null; aborted: boolean };

/** How a finished game ended, from Lichess's status and winner. */
export function endingOf(state: Pick<ChaalGameState, "status" | "winner">): LiveEnding | null {
	const { status, winner } = state;
	if (!isOver(status)) return null;
	const result: GameResult = winner === "white" ? "1-0" : winner === "black" ? "0-1" : "1/2-1/2";
	if (status === "aborted" || (status === "noStart" && !winner)) return { result: null, reason: null, aborted: true };
	const reasons: Readonly<Record<string, GameEndReason>> = {
		mate: "checkmate",
		resign: "resign",
		stalemate: "stalemate",
		timeout: "left",
		outoftime: winner ? "timeout" : "timeout-draw",
		cheat: "cheat",
		noStart: "no-start",
		insufficientMaterialClaim: "insufficient",
	};
	return { result, reason: reasons[status] ?? null, aborted: false };
}

/** The moves as the analysis board's URL takes them (`moves`: UCI joined by "_"). */
export const analysisLineOfLive = (game: LiveGame) => game.moves.map((move) => move.uci).join("_");
