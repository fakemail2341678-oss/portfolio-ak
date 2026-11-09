import { Chess, DEFAULT_POSITION, type PieceSymbol, type Square, validateFen } from "chess.js";

/**
 * The rules of chess for Chaal (PLAN 13.5, "Rules and the board"; decision 0261): a thin
 * wrapper over chess.js (BSD-2) that speaks in FENs, so the game tree, the board and the
 * server can hold plain strings and never a chess.js instance. Legality, SAN, FEN and the
 * draw rules all come from chess.js; this file adds what Chaal needs around them: a FEN
 * check with reasons the UI can name, a game's state with the repetition count taken from
 * its path, the material balance, and a premove's targets.
 *
 * Isomorphic and pure. Only the pages that show a board import it (chess.js is about 15 kB
 * gzipped), never the entry.
 */

export type { PieceSymbol, Square };
export type Color = "white" | "black";
export type Promotion = "q" | "r" | "b" | "n";

/** A move as the board or a person gives it: two squares, and the piece a pawn becomes. */
export type MoveInput = { from: Square; to: Square; promotion?: Promotion };

/** A legal move, played: everything the board, the move list and the spoken text need. */
export type PlayedMove = {
	uci: string;
	san: string;
	from: Square;
	to: Square;
	promotion?: Promotion;
	piece: PieceSymbol;
	color: Color;
	capture: boolean;
	castle: boolean;
	check: boolean;
	mate: boolean;
	/** The position after the move. */
	fen: string;
};

export const START_FEN = DEFAULT_POSITION;

const colorOf = (side: "w" | "b"): Color => (side === "w" ? "white" : "black");
export const opposite = (color: Color): Color => (color === "white" ? "black" : "white");

/** Whose move it is, from the FEN's second field. */
export const turnOf = (fen: string): Color => (fen.split(" ")[1] === "b" ? "black" : "white");

/** Positions compare on placement, turn, castling and en passant (chess.js names an en passant square only when a capture is legal). */
const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/** "e2e4" or "e7e8q" to a move; null when it isn't UCI. */
export function parseUci(uci: string): MoveInput | null {
	const match = UCI.exec(uci.trim().toLowerCase());
	if (!match) return null;
	const [, from, to, promotion] = match;
	return { from: from as Square, to: to as Square, ...(promotion ? { promotion: promotion as Promotion } : {}) };
}

export type FenCheck = { ok: true; fen: string } | { ok: false; reason: "format" | "kings" | "check" };

/**
 * Checks a FEN someone typed or pasted (the analysis board's setup, a link): the format and
 * chess.js's own checks, one king a side, and the side not to move not in check. A FEN of
 * four fields gets the two counters ("0 1"). Returns the normalised FEN.
 */
export function checkFen(input: string): FenCheck {
	const fields = input.trim().split(/\s+/);
	if (fields.length === 4) fields.push("0", "1");
	const fen = fields.join(" ");
	const placement = fields[0] ?? "";
	const count = (king: string) => placement.split("").filter((char) => char === king).length;
	if (/^[1-8pnbrqkPNBRQK/]+$/.test(placement) && (count("K") !== 1 || count("k") !== 1)) {
		return { ok: false, reason: "kings" };
	}
	if (!validateFen(fen).ok) return { ok: false, reason: "format" };
	// The side that just moved can't be in check: flip the turn and ask.
	const flipped = [fields[0], fields[1] === "w" ? "b" : "w", fields[2], "-", "0", "1"].join(" ");
	try {
		if (new Chess(flipped, { skipValidation: true }).inCheck()) return { ok: false, reason: "check" };
	} catch {
		return { ok: false, reason: "format" };
	}
	return { ok: true, fen };
}

/** Every legal move, from square to target squares (a promotion counts once). */
export function legalDests(fen: string): Map<Square, Square[]> {
	const dests = new Map<Square, Square[]>();
	for (const move of new Chess(fen).moves({ verbose: true })) {
		const list = dests.get(move.from) ?? [];
		if (!list.includes(move.to)) list.push(move.to);
		dests.set(move.from, list);
	}
	return dests;
}

/** Whether from → to is a pawn reaching the last rank (the board then asks which piece). */
export function isPromotion(fen: string, from: Square, to: Square): boolean {
	return new Chess(fen).moves({ verbose: true, square: from }).some((move) => move.to === to && move.isPromotion());
}

/**
 * Plays a move on a position: two squares (`MoveInput`), UCI ("g1f3") or SAN ("Nf3",
 * leniently: "0-0" and an over-specified "Ng1f3" pass). Null when it isn't legal.
 */
export function play(fen: string, input: MoveInput | string): PlayedMove | null {
	const chess = new Chess(fen);
	const parsed = typeof input === "string" ? (parseUci(input) ?? input.replaceAll("0", "O")) : input;
	try {
		const move = chess.move(parsed);
		return {
			uci: move.lan,
			san: move.san,
			from: move.from,
			to: move.to,
			...(move.promotion ? { promotion: move.promotion as Promotion } : {}),
			piece: move.piece,
			color: colorOf(move.color),
			capture: move.isCapture(),
			castle: move.isKingsideCastle() || move.isQueensideCastle(),
			check: chess.inCheck(),
			mate: chess.isCheckmate(),
			fen: move.after,
		};
	} catch {
		return null;
	}
}

/** Legal moves in SAN, for the move input's suggestions. */
export function legalSans(fen: string): string[] {
	return new Chess(fen).moves();
}

/** The king's square when the side to move is in check. */
export function checkSquare(fen: string): Square | null {
	const chess = new Chess(fen);
	if (!chess.inCheck()) return null;
	return chess.findPiece({ type: "k", color: chess.turn() })[0] ?? null;
}

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

/** How a game ends on the board by itself: no one has to claim it. */
export type BoardEnd = {
	result: GameResult;
	reason: "checkmate" | "stalemate" | "insufficient" | "fivefold" | "seventy-five";
};

/**
 * Every way a game can end: the board's own, and those a player or a clock decides (the
 * local games, Task 76), and Lichess's own (online play, Task 77).
 */
export type GameEndReason =
	| BoardEnd["reason"]
	| "resign"
	| "timeout"
	/** A flag fell, but the other side can't mate: a draw (FIDE 6.9). */
	| "timeout-draw"
	| "agreement"
	| "threefold"
	| "fifty"
	/** Lichess's own (online play, Task 77): the other player left and the win was claimed. */
	| "left"
	/** Lichess ended it for a fair-play violation. */
	| "cheat"
	/** A player never made a first move. */
	| "no-start";

export type GameState = {
	turn: Color;
	check: boolean;
	end: BoardEnd | null;
	/** A draw the player to move may claim (FIDE 9.2 and 9.3); the game goes on unless they do. */
	claim: "threefold" | "fifty" | null;
};

/**
 * The state of a position reached by `history` (every FEN from the game's start up to and
 * including `fen`; the repetition rules count them). Checkmate outranks everything; then
 * stalemate and dead material; a position seen five times and 75 moves without a capture
 * or a pawn move end the game (FIDE 9.6); three times and 50 moves may be claimed.
 */
export function gameState(fen: string, history: ReadonlyArray<string> = [fen]): GameState {
	const chess = new Chess(fen);
	const turn = colorOf(chess.turn());
	const check = chess.inCheck();
	const state = (end: BoardEnd | null, claim: GameState["claim"] = null): GameState => ({ turn, check, end, claim });
	if (chess.isCheckmate()) return state({ result: turn === "white" ? "0-1" : "1-0", reason: "checkmate" });
	if (chess.isStalemate()) return state({ result: "1/2-1/2", reason: "stalemate" });
	if (chess.isInsufficientMaterial()) return state({ result: "1/2-1/2", reason: "insufficient" });
	const key = positionKey(fen);
	const seen = history.filter((earlier) => positionKey(earlier) === key).length;
	const halfMoves = Number(fen.split(" ")[4] ?? 0);
	if (seen >= 5) return state({ result: "1/2-1/2", reason: "fivefold" });
	if (halfMoves >= 150) return state({ result: "1/2-1/2", reason: "seventy-five" });
	if (seen >= 3) return state(null, "threefold");
	if (halfMoves >= 100) return state(null, "fifty");
	return state(null);
}

const VALUES: Readonly<Record<PieceSymbol, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: ReadonlyArray<PieceSymbol> = ["q", "r", "b", "n", "p"];

export type MaterialSide = { pieces: PieceSymbol[]; points: number };

/**
 * What each side has more of (the pieces, strongest first) and its lead in points
 * (1, 3, 3, 5, 9). Only the side ahead has points; equal material gives both none.
 */
export function materialBalance(fen: string): Record<Color, MaterialSide> {
	const counts = { white: new Map<PieceSymbol, number>(), black: new Map<PieceSymbol, number>() };
	for (const char of fen.split(" ")[0] ?? "") {
		if (!/[pnbrqPNBRQ]/.test(char)) continue;
		const side = char === char.toUpperCase() ? counts.white : counts.black;
		const type = char.toLowerCase() as PieceSymbol;
		side.set(type, (side.get(type) ?? 0) + 1);
	}
	const extra = (mine: Map<PieceSymbol, number>, theirs: Map<PieceSymbol, number>) =>
		ORDER.flatMap((type) =>
			Array<PieceSymbol>(Math.max(0, (mine.get(type) ?? 0) - (theirs.get(type) ?? 0))).fill(type),
		);
	const total = (side: Map<PieceSymbol, number>) =>
		[...side].reduce((sum, [type, count]) => sum + VALUES[type] * count, 0);
	const lead = total(counts.white) - total(counts.black);
	return {
		white: { pieces: extra(counts.white, counts.black), points: Math.max(0, lead) },
		black: { pieces: extra(counts.black, counts.white), points: Math.max(0, -lead) },
	};
}

const FILES = "abcdefgh";
const at = (file: number, rank: number): Square | null =>
	file >= 0 && file < 8 && rank >= 0 && rank < 8 ? (`${FILES[file]}${rank + 1}` as Square) : null;

/**
 * Where a piece of `color` could go if it were its turn, by geometry alone (pieces in the
 * way don't stop a slider, any diagonal may become a capture), for a premove made while
 * the opponent thinks. Whether it's legal is judged when the turn comes.
 */
export function premoveDests(fen: string, color: Color): Map<Square, Square[]> {
	const chess = new Chess(fen, { skipValidation: true });
	const side = color === "white" ? "w" : "b";
	const dests = new Map<Square, Square[]>();
	const rays = (dirs: ReadonlyArray<readonly [number, number]>, file: number, rank: number, reach: number) =>
		dirs.flatMap(([df, dr]) => {
			const out: Square[] = [];
			for (let step = 1; step <= reach; step++) {
				const square = at(file + df * step, rank + dr * step);
				if (!square) break;
				out.push(square);
			}
			return out;
		});
	const straight = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
	] as const;
	const diagonal = [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	] as const;
	const knight = [
		[1, 2],
		[2, 1],
		[2, -1],
		[1, -2],
		[-1, -2],
		[-2, -1],
		[-2, 1],
		[-1, 2],
	] as const;
	for (const row of chess.board()) {
		for (const piece of row) {
			if (!piece || piece.color !== side) continue;
			const file = FILES.indexOf(piece.square[0] ?? "a");
			const rank = Number(piece.square[1]) - 1;
			let targets: Square[] = [];
			if (piece.type === "n") targets = rays(knight, file, rank, 1);
			else if (piece.type === "b") targets = rays(diagonal, file, rank, 7);
			else if (piece.type === "r") targets = rays(straight, file, rank, 7);
			else if (piece.type === "q") targets = rays([...straight, ...diagonal], file, rank, 7);
			else if (piece.type === "k") {
				targets = rays([...straight, ...diagonal], file, rank, 1);
				const home = color === "white" ? 0 : 7;
				const rights = chess.getCastlingRights(side);
				if (rank === home && file === 4) {
					if (rights.k) targets.push(at(6, home) as Square);
					if (rights.q) targets.push(at(2, home) as Square);
				}
			} else {
				const forward = color === "white" ? 1 : -1;
				const start = color === "white" ? 1 : 6;
				targets = [at(file, rank + forward), at(file - 1, rank + forward), at(file + 1, rank + forward)].filter(
					(square): square is Square => square !== null,
				);
				const double = at(file, rank + 2 * forward);
				if (rank === start && double) targets.push(double);
			}
			if (targets.length > 0) dests.set(piece.square, targets);
		}
	}
	return dests;
}
