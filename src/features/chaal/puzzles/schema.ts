import { z } from "zod";
import { PUZZLE_ANGLES } from "./angles";

/**
 * Puzzles (PLAN Task 80, decision 0269): what the functions return and take. Route files
 * import the URL contract from ../search.ts, never this file.
 */

export const PUZZLE_DIFFICULTIES = ["easiest", "easier", "normal", "harder", "hardest"] as const;
export type PuzzleDifficulty = (typeof PUZZLE_DIFFICULTIES)[number];

export const PUZZLE_COLORS = ["white", "black"] as const;
export type PuzzleColor = (typeof PUZZLE_COLORS)[number];

/** How a puzzle was met: the day's, one by its id, training, the streak, or replaying misses (Lichess's). */
export const PUZZLE_MODES = ["daily", "single", "train", "streak", "replay"] as const;
export type PuzzleMode = (typeof PUZZLE_MODES)[number];

export type PuzzlePlayer = { name: string; title: string | null; rating: number | null };

/** A Lichess puzzle as Chaal shows it (src/server/chaal/lichess/schemas.ts maps Lichess's answer). */
export type ChaalPuzzle = {
	id: string;
	rating: number;
	plays: number;
	themes: string[];
	/** The position before the opponent's last move: the board shows it, then plays the move. */
	before: string;
	lastMove: { uci: string; san: string };
	/** The position the player solves from. */
	fen: string;
	/** The player's side. */
	color: PuzzleColor;
	/** UCI moves from `fen`: the player's, the opponent's reply, and so on, ending with the player's. */
	solution: string[];
	/** The game it comes from (names are Lichess's, shown as text). */
	game: { id: string; perf: string; clock: string | null; white: PuzzlePlayer; black: PuzzlePlayer };
};

/** The player's puzzle rating on Lichess, when the batch was theirs. */
export type PuzzleGlicko = { rating: number; provisional: boolean };

export type ChaalPuzzleBatch = {
	puzzles: ChaalPuzzle[];
	/** `account`: unseen puzzles at the player's rating, with their token; `public`: anyone's (rated at 1500). */
	source: "account" | "public";
	glicko: PuzzleGlicko | null;
};

/** Lichess puzzle ids: five letters and digits (a few older ones differ in length). */
const puzzleId = z.string().regex(/^[A-Za-z0-9]{4,10}$/);
/** Lichess theme keys: camelCase letters and digits. */
const themeKey = z.string().regex(/^[A-Za-z0-9]{1,40}$/);

export const puzzleIdInput = z.strictObject({ id: puzzleId });

export const puzzleBatchInput = z.strictObject({
	angle: z.enum(PUZZLE_ANGLES),
	difficulty: z.enum(PUZZLE_DIFFICULTIES).optional(),
	color: z.enum(PUZZLE_COLORS).optional(),
	/**
	 * The page's batch so far (0 for the first). A visitor's batches are cached by it, so two
	 * visitors share a batch but one visitor's next batch is a new one (decision 0269).
	 */
	round: z.number().int().min(0).max(10_000),
	/** The streak's puzzles are anyone's, never the player's own (they aren't rated). */
	streak: z.boolean(),
});
export type PuzzleBatchInput = z.output<typeof puzzleBatchInput>;

/** A finished puzzle, as the browser keeps it and the server stores it. */
export const puzzleAttemptSchema = z.strictObject({
	id: z.uuid(),
	puzzleId,
	won: z.boolean(),
	ms: z
		.number()
		.int()
		.min(0)
		.max(24 * 60 * 60_000),
	rating: z.number().int().min(0).max(4000),
	themes: z.array(themeKey).max(20),
	mode: z.enum(PUZZLE_MODES),
	angle: z.enum(PUZZLE_ANGLES),
	streak: z.number().int().min(0).max(100_000).nullable(),
	at: z.iso.datetime(),
});
export type PuzzleAttempt = z.output<typeof puzzleAttemptSchema>;

export const recordPuzzleAttemptInput = z.strictObject({ attempt: puzzleAttemptSchema });

/** What a session imports from this browser at once. */
export const PUZZLE_IMPORT_MAX = 200;
export const importPuzzleAttemptsInput = z.strictObject({
	attempts: z.array(puzzleAttemptSchema).max(PUZZLE_IMPORT_MAX),
});

export const puzzleReplayInput = z.strictObject({ theme: z.enum(PUZZLE_ANGLES) });

/** How many days the progress panel and Lichess's dashboard look back. */
export const PROGRESS_DAYS = 30;

export type PuzzleThemeStats = { key: string; nb: number; won: number };

/** The progress panel's figures, from the attempts (the server's or this browser's: ./progress.ts). */
export type PuzzleStats = {
	days: number;
	nb: number;
	won: number;
	/** The average rating of the puzzles solved, or null when none was. */
	solvedRating: number | null;
	/** By theme, the most played first. */
	themes: PuzzleThemeStats[];
	bestStreak: number;
	recent: Array<{ id: string; puzzleId: string; won: boolean; rating: number; ratingDiff: number | null; at: string }>;
};

/** Lichess's own dashboard (`/api/puzzle/dashboard/30`), for a player connected with the puzzle scopes. */
export type LichessPuzzleDashboard = {
	days: number;
	nb: number;
	firstWins: number;
	performance: number;
	themes: Array<{ key: string; nb: number; firstWins: number; performance: number }>;
};

export type ChaalPuzzleProgress = {
	stats: PuzzleStats;
	/** Attempts waiting to be posted to Lichess. */
	pending: number;
	lichess:
		| { state: "ok"; dashboard: LichessPuzzleDashboard }
		/** Not connected, missing the scopes, Lichess asks us to wait or can't be reached, or puzzles' data is off. */
		| { state: "connect" | "reconnect" | "wait" | "unavailable" };
};

/** Lichess's misses to replay for a theme: their ids, oldest first (none: nothing to replay). */
export type ChaalPuzzleReplay = { theme: string; remaining: string[] };
