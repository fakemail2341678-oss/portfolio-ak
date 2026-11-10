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

/** Leaderboards (Task 81): which rating's list. Lichess keeps none for correspondence. */
export const playersSearch = z.object({
	perf: z.enum(["bullet", "blitz", "rapid", "classical", "ultraBullet"]).optional().catch(undefined),
});
export type PlayersSearch = z.infer<typeof playersSearch>;

/** A day as `<input type="date">` writes it. */
const searchDay = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.optional()
	.catch(undefined);

/**
 * A player's page (Task 81, decision 0271): the overview with one rating's details
 * (`perf`), or `?tab=games` with its filters (the rating, a side, rated or casual, the
 * result, an opponent, dates) and `before`, the page's cursor (Lichess pages by time).
 * Anything that doesn't read is dropped.
 */
export const playerSearch = z.object({
	tab: z.enum(["games"]).optional().catch(undefined),
	perf: z.enum(["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"]).optional().catch(undefined),
	color: z.enum(["white", "black"]).optional().catch(undefined),
	mode: z.enum(["rated", "casual"]).optional().catch(undefined),
	result: z.enum(["win", "loss", "draw"]).optional().catch(undefined),
	vs: z
		.string()
		.max(30)
		.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/)
		.optional()
		.catch(undefined),
	since: searchDay,
	until: searchDay,
	before: z.coerce.number().int().positive().optional().catch(undefined),
});
export type PlayerSearch = z.infer<typeof playerSearch>;

/** A broadcast's, a round's or a board's id. */
const broadcastId = z
	.string()
	.regex(/^[A-Za-z0-9]{8}$/)
	.optional()
	.catch(undefined);

/**
 * Lichess's broadcasts (Task 82, decision 0272): the top list (live, coming up, a page of the
 * past), `?view=official`, or a search (`q`); `page` pages the past or the search.
 */
export const broadcastsSearch = z.object({
	view: z.enum(["official"]).optional().catch(undefined),
	q: z.string().trim().min(2).max(60).optional().catch(undefined),
	page: z.coerce.number().int().min(2).max(20).optional().catch(undefined),
});
export type BroadcastsSearch = z.infer<typeof broadcastsSearch>;

/** A broadcast (Task 82): which round (else the one Lichess opens), and a board followed on its own. */
export const broadcastPageSearch = z.object({ round: broadcastId, board: broadcastId });
export type BroadcastPageSearch = z.infer<typeof broadcastPageSearch>;

/** Lichess's arenas (Task 83, decision 0273): coming up (the default), being played, or finished. */
export const tournamentsSearch = z.object({
	view: z.enum(["started", "finished"]).optional().catch(undefined),
});
export type TournamentsSearch = z.infer<typeof tournamentsSearch>;

/** A tournament (Task 83): an arena, or a Swiss one (`?kind=swiss`, reached through teams); an arena's standings' page. */
export const tournamentPageSearch = z.object({
	kind: z.enum(["swiss"]).optional().catch(undefined),
	page: z.coerce.number().int().min(2).max(200).optional().catch(undefined),
});
export type TournamentPageSearch = z.infer<typeof tournamentPageSearch>;

/** Teams (Task 83): popular ones a page at a time, a search (`q`), or the player's own (`?view=mine`). */
export const teamsSearch = z.object({
	view: z.enum(["mine"]).optional().catch(undefined),
	q: z.string().trim().min(2).max(60).optional().catch(undefined),
	page: z.coerce.number().int().min(2).max(20).optional().catch(undefined),
});
export type TeamsSearch = z.infer<typeof teamsSearch>;

/** Studies (Task 83): an account's public ones (`by`, else the admin's account), or the player's own (`?view=mine`). */
export const studiesSearch = z.object({
	view: z.enum(["mine"]).optional().catch(undefined),
	by: z
		.string()
		.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/)
		.optional()
		.catch(undefined),
});
export type StudiesSearch = z.infer<typeof studiesSearch>;

/** A study (Task 83): the chapter shown (else the first). */
export const studyPageSearch = z.object({ chapter: broadcastId });
export type StudyPageSearch = z.infer<typeof studyPageSearch>;
