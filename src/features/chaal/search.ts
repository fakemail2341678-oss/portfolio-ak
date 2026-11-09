import { z } from "zod";
import { CONNECT_RESULTS } from "./links";

/**
 * Chaal's URL contracts (route files import this, never a form schema, 0194). Search
 * schemas aren't strict: links carry utm tags.
 */

/** A page connecting returns to (settings, the admin's lab): `?lichess=` says how it ended. */
export const connectResultSearch = z.object({ lichess: z.enum(CONNECT_RESULTS).optional().catch(undefined) });

/**
 * The analysis board's URL (Task 75, src/features/chaal/analysis/url.ts): the start
 * position, a line of UCI moves joined by "_", how far along it the board is, the side at
 * the bottom, or a saved analysis's id. Anything that doesn't read is dropped, so a mangled
 * link opens the board at the start.
 */
export const analysisSearch = z.object({
	fen: z.string().max(100).optional().catch(undefined),
	moves: z
		.string()
		.max(12_000)
		.regex(/^[a-h1-8qrbn_]*$/)
		.optional()
		.catch(undefined),
	ply: z.coerce.number().int().min(0).max(2_000).optional().catch(undefined),
	orientation: z.enum(["white", "black"]).optional().catch(undefined),
	id: z.uuid().optional().catch(undefined),
});

/**
 * The play hub's URL (Task 77): an online setup to open, filled in. "Play again" against a
 * player links here with the game's settings; anything that doesn't read is dropped.
 */
export const playSearch = z.object({
	with: z.enum(["ai", "friend", "link"]).optional().catch(undefined),
	opponent: z
		.string()
		.max(30)
		.regex(/^[A-Za-z0-9_-]+$/)
		.optional()
		.catch(undefined),
	/** A pace key: "600+5" or "d3" (src/features/chaal/play/controls.ts). */
	pace: z
		.string()
		.max(12)
		.regex(/^(\d+\+\d+|d\d+)$/)
		.optional()
		.catch(undefined),
	color: z.enum(["white", "random", "black"]).optional().catch(undefined),
	rated: z.boolean().optional().catch(undefined),
});
export type PlaySearch = z.infer<typeof playSearch>;

/**
 * The puzzles page's URL (Task 80, decision 0269): the daily puzzle without a mode, else
 * training (a theme, a difficulty, a side), the streak, or replaying Lichess's misses in a
 * theme. The theme is checked against Chaal's names on the page (the list's names aren't
 * in every page's JavaScript); anything that doesn't read is dropped.
 */
export const puzzlesSearch = z.object({
	mode: z.enum(["train", "streak", "replay"]).optional().catch(undefined),
	theme: z
		.string()
		.max(40)
		.regex(/^[A-Za-z0-9]+$/)
		.optional()
		.catch(undefined),
	difficulty: z.enum(["easiest", "easier", "normal", "harder", "hardest"]).optional().catch(undefined),
	color: z.enum(["white", "black"]).optional().catch(undefined),
});
export type PuzzlesSearch = z.infer<typeof puzzlesSearch>;
