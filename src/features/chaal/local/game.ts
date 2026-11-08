import { readPgn, writePgn } from "../chess/pgn";
import {
	type Color,
	type GameResult,
	type GameState,
	gameState,
	opposite,
	type PlayedMove,
	START_FEN,
	turnOf,
} from "../chess/rules";
import { addMove, createTree, type GameTree, mainline } from "../chess/tree";
import type { LocalEndReason, LocalGame, LocalGameRecord, LocalMove, LocalSetup } from "./types";

/**
 * A game played in the browser (PLAN Task 76, decision 0265): against the computer
 * (Stockfish at a level 1–8) or over the board (two people at one screen). Pure and
 * isomorphic: the play page, the browser's store, the server's checks and the tests all
 * use it. Hold the game as data, never a chess.js instance; positions are computed.
 *
 * Stored as a `LocalGameRecord` (the moves as PGN, with each move's clock as `[%clk]`),
 * in `ch_local_game` with a session, else in this browser (`browser.ts`).
 */

export function newLocalGame(setup: LocalSetup, id: string, now: Date, random: () => number = Math.random): LocalGame {
	const at = now.toISOString();
	const clock = setup.clock ? { initial: setup.clock.initial, increment: setup.clock.increment } : null;
	const base = {
		id,
		clock,
		startFen: START_FEN,
		moves: [],
		clocks: clock ? { white: clock.initial * 1000, black: clock.initial * 1000 } : null,
		result: null,
		reason: null,
		createdAt: at,
		updatedAt: at,
	};
	if (setup.mode === "engine") {
		const color: Color = setup.color === "random" ? (random() < 0.5 ? "white" : "black") : setup.color;
		return { ...base, mode: "engine", level: clampLevel(setup.level), color, layout: null };
	}
	return { ...base, mode: "board", level: null, color: null, layout: setup.layout };
}

export const clampLevel = (level: number) => Math.min(8, Math.max(1, Math.round(level)));

/** The position now. */
export const fenOf = (game: Pick<LocalGame, "moves" | "startFen">): string => game.moves.at(-1)?.fen ?? game.startFen;

/** Every position from the start, for the repetition rules. */
export const historyOf = (game: Pick<LocalGame, "moves" | "startFen">): string[] => [
	game.startFen,
	...game.moves.map((move) => move.fen),
];

export const stateOf = (game: Pick<LocalGame, "moves" | "startFen">): GameState =>
	gameState(fenOf(game), historyOf(game));

export const isOver = (game: Pick<LocalGame, "result">) => game.result !== null;

/** Whose turn it is to move on this screen: against the computer, the player's turn or the computer's. */
export const computerToMove = (game: LocalGame): boolean =>
	game.mode === "engine" && !isOver(game) && game.color !== null && turnOf(fenOf(game)) !== game.color;

/**
 * Adds a played move (already legal: the board played it). With a clock, `clocks` are the
 * times left after it. A move that ends the game on the board (mate, stalemate, dead
 * material, fivefold, 75 moves) ends it here too.
 */
export function addLocalMove(
	game: LocalGame,
	move: Pick<PlayedMove, "uci" | "san" | "fen">,
	clocks: LocalGame["clocks"],
	now: Date,
): LocalGame {
	if (isOver(game)) return game;
	const mover = turnOf(fenOf(game));
	const entry: LocalMove = {
		uci: move.uci,
		san: move.san,
		fen: move.fen,
		...(clocks ? { clock: Math.round(clocks[mover]) } : {}),
	};
	const next: LocalGame = {
		...game,
		moves: [...game.moves, entry],
		clocks: clocks ? { white: Math.round(clocks.white), black: Math.round(clocks.black) } : game.clocks,
		updatedAt: now.toISOString(),
	};
	const { end } = stateOf(next);
	return end ? { ...next, result: end.result, reason: end.reason } : next;
}

/** Ends the game (a resignation, a draw agreed or claimed, a flag). A finished game stays as it ended. */
export function endLocalGame(
	game: LocalGame,
	result: GameResult,
	reason: LocalEndReason,
	now: Date,
	clocks?: LocalGame["clocks"],
): LocalGame {
	if (isOver(game)) return game;
	return {
		...game,
		result,
		reason,
		...(clocks && game.clocks ? { clocks: { white: Math.round(clocks.white), black: Math.round(clocks.black) } } : {}),
		updatedAt: now.toISOString(),
	};
}

/** The side that resigns loses. */
export const resignResult = (side: Color): GameResult => (side === "white" ? "0-1" : "1-0");

/**
 * A side's flag fell: the other side wins, unless it can't mate by any series of legal
 * moves (FIDE 6.9). Read simply, as most servers do: a lone king never mates; a king and
 * one minor piece mates only when the flagged side has more than its king (a piece of its
 * own can block its king in).
 */
export function flagResult(fen: string, flagged: Color): { result: GameResult; reason: LocalEndReason } {
	const winner = opposite(flagged);
	const draw = { result: "1/2-1/2" as const, reason: "timeout-draw" as const };
	const mine = piecesOf(fen, winner);
	const theirs = piecesOf(fen, flagged);
	if (mine.length === 0) return draw;
	if (mine.length === 1 && (mine[0] === "n" || mine[0] === "b") && theirs.length === 0) return draw;
	return { result: winner === "white" ? "1-0" : "0-1", reason: "timeout" };
}

/** A side's pieces other than its king, as lowercase letters. */
function piecesOf(fen: string, color: Color): string[] {
	const board = fen.split(" ")[0] ?? "";
	const letters = board.replace(/[^a-zA-Z]/g, "").split("");
	return letters
		.filter((letter) => (color === "white" ? letter === letter.toUpperCase() : letter === letter.toLowerCase()))
		.map((letter) => letter.toLowerCase())
		.filter((letter) => letter !== "k");
}

/**
 * Takes back the last move over the board, or against the computer the player's last move
 * and the computer's answer (back to the player's turn). Clocks go back with the moves:
 * each side's time is what it had after its last move left, else the start.
 */
export function takeBack(game: LocalGame, now: Date): LocalGame {
	if (!canTakeBack(game)) return game;
	let moves = game.moves.slice(0, -1);
	if (game.mode === "engine") {
		// Back to a position where it's the player's turn.
		while (moves.length > 0 && turnOf(fenOf({ moves, startFen: game.startFen })) !== game.color) {
			moves = moves.slice(0, -1);
		}
	}
	return { ...game, moves, clocks: clocksAfter(game, moves), updatedAt: now.toISOString() };
}

/** Whether there's a move of the player's to take back (and the game isn't over). */
export function canTakeBack(game: LocalGame): boolean {
	if (isOver(game) || game.moves.length === 0) return false;
	if (game.mode === "board") return true;
	// Against the computer: the player must have moved (the computer's first move as White can't be taken back).
	const playerFirst = turnOf(game.startFen) === game.color;
	return game.moves.length >= (playerFirst ? 1 : 2);
}

function clocksAfter(game: LocalGame, moves: ReadonlyArray<LocalMove>): LocalGame["clocks"] {
	if (!game.clock) return null;
	const start = game.clock.initial * 1000;
	const startTurn = turnOf(game.startFen);
	const left = { white: start, black: start };
	moves.forEach((move, index) => {
		const mover: Color = index % 2 === 0 ? startTurn : opposite(startTurn);
		if (move.clock !== undefined) left[mover] = move.clock;
	});
	return left;
}

/** The game as a tree (one line), for the move list and PGN. */
export function treeOf(game: Pick<LocalGame, "moves" | "startFen">): GameTree {
	let tree = createTree(game.startFen);
	let at = tree.root;
	for (const move of game.moves) {
		const added = addMove(tree, at, move, move.clock !== undefined ? { clock: move.clock } : {});
		tree = added.tree;
		at = added.id;
	}
	return tree;
}

/** The moves as the analysis board's URL takes them (`moves`: UCI joined by "_"). */
export const analysisLineOf = (game: Pick<LocalGame, "moves">) => game.moves.map((move) => move.uci).join("_");

const TERMINATION: Readonly<Record<LocalEndReason, string>> = {
	checkmate: "Normal",
	stalemate: "Normal",
	insufficient: "Normal",
	fivefold: "Normal",
	"seventy-five": "Normal",
	resign: "Normal",
	agreement: "Normal",
	threefold: "Normal",
	fifty: "Normal",
	timeout: "Time forfeit",
	"timeout-draw": "Time forfeit",
};

/**
 * The game as PGN: the seven tags (the names when given, "?" otherwise), the time control,
 * how it ended, each move's clock. What's stored has no names; an export adds them in the
 * reader's language.
 */
export function localGamePgn(game: LocalGame, names: { white?: string; black?: string; event?: string } = {}): string {
	const tags: Record<string, string> = {
		Event: names.event ?? "?",
		Site: "Chaal",
		Date: game.createdAt.slice(0, 10).replaceAll("-", "."),
		White: names.white ?? "?",
		Black: names.black ?? "?",
		TimeControl: game.clock ? `${game.clock.initial}+${game.clock.increment}` : "-",
		...(game.reason ? { Termination: TERMINATION[game.reason] } : {}),
	};
	return writePgn({ tags, tree: treeOf(game), result: game.result ?? "*" });
}

export function toRecord(game: LocalGame): LocalGameRecord {
	const { moves: _moves, startFen: _startFen, ...rest } = game;
	return { ...rest, pgn: localGamePgn(game), status: game.result ? "ended" : "playing" };
}

export type RecordRead = { ok: true; game: LocalGame } | { ok: false; reason: string };

/**
 * A stored game, read back: its PGN must be one line of legal moves (no variations), as
 * this module writes it. The server reads every write this way before storing it.
 */
export function fromRecord(record: LocalGameRecord, maxMoves = Number.POSITIVE_INFINITY): RecordRead {
	const read = readPgn(record.pgn);
	if (!read.ok) return { ok: false, reason: `pgn: ${read.reason}${read.move ? ` (${read.move})` : ""}` };
	const { tree } = read.game;
	const line = mainline(tree);
	if (line.length !== Object.keys(tree.nodes).length - 1) return { ok: false, reason: "variations" };
	if (line.length > maxMoves) return { ok: false, reason: "too-long" };
	const root = tree.nodes[tree.root];
	if (!root) return { ok: false, reason: "root" };
	const { pgn: _pgn, status: _status, ...rest } = record;
	const game: LocalGame = {
		...rest,
		startFen: root.fen,
		moves: line.map((node) => ({
			uci: node.uci ?? "",
			san: node.san ?? "",
			fen: node.fen,
			...(node.clock !== undefined ? { clock: node.clock } : {}),
		})),
	};
	// An unfinished game can't stand on a position that has already ended.
	if (!game.result && stateOf(game).end) return { ok: false, reason: "ended" };
	return { ok: true, game };
}
