import { z } from "zod";
import { CHAAL_BOARD_THEMES } from "../look/board-themes";

/**
 * A player's preferences (PLAN 13.5, `ch_preference`; decision 0259): how the board looks,
 * sounds and behaves. A session keeps them on the server; without one they live in this
 * browser (`local.ts`) and are brought in once a session exists. Each is read by the
 * pages that use it: the board theme from Task 73 (the home's diagram), the rest with the
 * board kit and play (Tasks 74–77).
 */

/** Piece sets: the cburnett set only for now (decision 0258); a new set is a folder in public/chaal/pieces. */
export const CHAAL_PIECE_SETS = ["cburnett"] as const;

/** Notation on screen: figurines (♘f3, the default: it reads the same in both languages) or letters (Nf3). */
export const CHAAL_NOTATIONS = ["figurine", "letters"] as const;

export const chaalPreferencesSchema = z.strictObject({
	board: z.enum(CHAAL_BOARD_THEMES),
	pieces: z.enum(CHAAL_PIECE_SETS),
	sounds: z.boolean(),
	/** 0–100. */
	volume: z.number().int().min(0).max(100),
	autoQueen: z.boolean(),
	premove: z.boolean(),
	confirmMoves: z.boolean(),
	coordinates: z.boolean(),
	notation: z.enum(CHAAL_NOTATIONS),
	zen: z.boolean(),
});

export type ChaalPreferences = z.infer<typeof chaalPreferencesSchema>;

export const DEFAULT_CHAAL_PREFERENCES: ChaalPreferences = {
	board: "diagram",
	pieces: "cburnett",
	sounds: true,
	volume: 70,
	autoQueen: false,
	premove: true,
	confirmMoves: false,
	coordinates: true,
	notation: "figurine",
	zen: false,
};

/**
 * Reads stored preferences (a row, or this browser's copy) field by field: a value that no
 * longer fits (a board theme since removed, a hand-edited copy) falls back to its default
 * rather than losing the rest.
 */
export function readPreferences(value: unknown): ChaalPreferences {
	const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
	const shape = chaalPreferencesSchema.shape;
	const read = <K extends keyof ChaalPreferences>(key: K): ChaalPreferences[K] => {
		const parsed = shape[key].safeParse(source[key]);
		return parsed.success ? (parsed.data as ChaalPreferences[K]) : DEFAULT_CHAAL_PREFERENCES[key];
	};
	return {
		board: read("board"),
		pieces: read("pieces"),
		sounds: read("sounds"),
		volume: read("volume"),
		autoQueen: read("autoQueen"),
		premove: read("premove"),
		confirmMoves: read("confirmMoves"),
		coordinates: read("coordinates"),
		notation: read("notation"),
		zen: read("zen"),
	};
}
