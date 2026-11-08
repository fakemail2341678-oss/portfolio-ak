import type { TimeControl } from "../chess/clock";
import type { Color, GameEndReason, GameResult } from "../chess/rules";

/**
 * Local games' types and constants (PLAN Task 76, decision 0265), apart from the model
 * (`game.ts`) so the browser's store and the frame's import read them without chess.js.
 */

export type LocalMode = "engine" | "board";

/** Over the board: the board turns to the side to move, or stays put with the far side's strip upside down. */
export type BoardLayout = "flip" | "tablet";

/** How a local game ended: the board's own reasons, plus the ones a player or a clock decides. */
export type LocalEndReason = GameEndReason;

export const LOCAL_END_REASONS = [
	"checkmate",
	"stalemate",
	"insufficient",
	"fivefold",
	"seventy-five",
	"resign",
	"timeout",
	"timeout-draw",
	"agreement",
	"threefold",
	"fifty",
] as const satisfies ReadonlyArray<LocalEndReason>;

/** A move as the game keeps it: the mover's clock after it (ms), when the game has a clock. */
export type LocalMove = { uci: string; san: string; fen: string; clock?: number };

export type LocalGame = {
	id: string;
	mode: LocalMode;
	/** The computer's level, 1–8 (engine games only). */
	level: number | null;
	/** The player's side against the computer (engine games only). */
	color: Color | null;
	/** Start and increment in seconds; null for no clock. */
	clock: TimeControl | null;
	/** Over the board only. */
	layout: BoardLayout | null;
	startFen: string;
	moves: LocalMove[];
	/** Each side's time left after the last move, in ms (null without a clock). */
	clocks: { white: number; black: number } | null;
	result: GameResult | null;
	reason: LocalEndReason | null;
	createdAt: string;
	updatedAt: string;
};

/** How a game is stored: the moves as PGN, the rest as fields (PLAN 13.5, `ch_local_game`). */
export type LocalGameRecord = Omit<LocalGame, "moves" | "startFen"> & {
	pgn: string;
	status: "playing" | "ended";
};

/** What the play hub's forms choose. "random" picks a side when the game starts. */
export type LocalSetup =
	| { mode: "engine"; level: number; color: Color | "random"; clock: TimeControl | null }
	| { mode: "board"; clock: TimeControl | null; layout: BoardLayout };

export const LOCAL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * The clocks the hub offers (minutes + seconds of increment), slow enough to play at one
 * screen; null is "no clock".
 */
export const LOCAL_TIME_CONTROLS: ReadonlyArray<TimeControl> = [
	{ initial: 180, increment: 2 },
	{ initial: 300, increment: 3 },
	{ initial: 600, increment: 0 },
	{ initial: 600, increment: 5 },
	{ initial: 900, increment: 10 },
	{ initial: 1800, increment: 0 },
];

/** Games a player keeps, here and in the browser: the oldest go beyond it. */
export const LOCAL_GAMES_MAX = 100;
