import { z } from "zod";
import type { Score } from "../chess/eval";
import type { ChaalColor } from "../live/events";
import { lichessGameId, lichessUsername } from "../play/schema";

/**
 * Players and games (PLAN Task 81, decision 0271): what the functions take and give. Every
 * answer is Chaal's own lean shape, mapped from Lichess's on the server
 * (src/server/chaal/lichess/schemas.ts), because it travels in the page's HTML.
 */

/** The ratings Chaal shows: standard chess only, as it plays nothing else. */
export const PLAYER_PERFS = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"] as const;
export type PlayerPerf = (typeof PLAYER_PERFS)[number];

/** Lichess keeps leaderboards for these (not correspondence). */
export const LEADERBOARD_PERFS = ["bullet", "blitz", "rapid", "classical", "ultraBullet"] as const;
export type LeaderboardPerf = (typeof LEADERBOARD_PERFS)[number];

/** How many players a leaderboard lists (Lichess gives up to 200). */
export const LEADERBOARD_SIZE = 50;

// --- Inputs ------------------------------------------------------------------------------

export const leaderboardInput = z.strictObject({ perf: z.enum(LEADERBOARD_PERFS) });
export const usernameInput = z.strictObject({ username: lichessUsername });
export const perfStatsInput = z.strictObject({ username: lichessUsername, perf: z.enum(PLAYER_PERFS) });
export const followInput = z.strictObject({ username: lichessUsername, follow: z.boolean() });
export const playerSearchInput = z.strictObject({
	term: z
		.string()
		.trim()
		.min(3)
		.max(30)
		.regex(/^[A-Za-z0-9_-]+$/),
});
export const gameIdInput = z.strictObject({ id: lichessGameId });

const GAME_RESULTS = ["win", "loss", "draw"] as const;

/** A day as the date filter writes it. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A page of a player's games (`?tab=games`): the filters as the URL holds them, and `before`,
 * the page's cursor (the oldest game seen so far, as Lichess's `until` takes it).
 */
export const playerGamesInput = z.strictObject({
	username: lichessUsername,
	perf: z.enum(PLAYER_PERFS).optional(),
	color: z.enum(["white", "black"]).optional(),
	rated: z.boolean().optional(),
	result: z.enum(GAME_RESULTS).optional(),
	vs: lichessUsername.optional(),
	since: day.optional(),
	until: day.optional(),
	before: z.number().int().positive().optional(),
});
export type PlayerGamesInput = z.infer<typeof playerGamesInput>;

/** A page of games. */
export const GAMES_PAGE_SIZE = 20;

// --- Answers -----------------------------------------------------------------------------

export type PlayerRating = {
	perf: PlayerPerf;
	rating: number;
	games: number;
	/** Rating points over the last games: up or down. */
	progress: number;
	provisional: boolean;
};

export type ChaalPlayer = {
	/** Lichess's lowercase id. */
	id: string;
	username: string;
	title: string | null;
	/** The account is closed or was marked for breaking Lichess's terms: no more is shown. */
	closed: boolean;
	online: boolean;
	/** The game they're playing now, if any. */
	playingId: string | null;
	createdAt: number | null;
	seenAt: number | null;
	playSeconds: number | null;
	/** Text as the player wrote it: shown as text, never HTML. */
	profile: {
		flag: string | null;
		location: string | null;
		realName: string | null;
		bio: string | null;
		fideRating: number | null;
		links: string[];
	};
	count: { all: number; rated: number; win: number; loss: number; draw: number };
	ratings: PlayerRating[];
	puzzle: { rating: number; games: number } | null;
};

export type ChaalCrosstable = { you: number; them: number; games: number };

/** The page's viewer, when their Lichess account is connected. */
export type PlayerViewer = {
	lichessId: string;
	username: string;
	/** Whether they follow this player: null when it can't be known (social off, or not allowed). */
	following: boolean | null;
	crosstable: ChaalCrosstable | null;
};

export type ChaalPlayerPage = { player: ChaalPlayer; viewer: PlayerViewer | null };

export type LeaderboardRow = {
	id: string;
	username: string;
	title: string | null;
	online: boolean;
	rating: number;
	progress: number;
};
export type ChaalLeaderboard = { perf: LeaderboardPerf; players: LeaderboardRow[] };

/** One perf's rating over time: the rating at the end of each day it changed. */
export type RatingSeries = { perf: PlayerPerf; points: ReadonlyArray<readonly [day: string, rating: number]> };

export type RatingMoment = { rating: number; at: string; gameId: string | null };
export type RatingOpponent = { name: string; rating: number; at: string; gameId: string | null };

export type ChaalPerfStats = {
	perf: PlayerPerf;
	rating: number;
	deviation: number;
	provisional: boolean;
	games: number;
	progress: number;
	rank: number | null;
	percentile: number | null;
	highest: RatingMoment | null;
	lowest: RatingMoment | null;
	count: { all: number; rated: number; win: number; loss: number; draw: number; tournament: number; berserk: number };
	/** The average rating of the opponents. */
	opponentAverage: number | null;
	streak: { win: number; winBest: number; loss: number; lossBest: number };
	bestWins: RatingOpponent[];
	worstLosses: RatingOpponent[];
};

export type ActivityGames = {
	perf: PlayerPerf;
	win: number;
	loss: number;
	draw: number;
	before: number;
	after: number;
};

/** One day of a player's activity, as Lichess counts it. */
export type ActivityDay = {
	start: number;
	games: ActivityGames[];
	puzzles: { win: number; loss: number; before: number; after: number } | null;
	tournaments: number;
	followers: number;
	correspondenceMoves: number;
};

export type GamePlayerSummary = {
	id: string | null;
	name: string;
	title: string | null;
	rating: number | null;
	ratingDiff: number | null;
	aiLevel: number | null;
};

/** A game in a list: who, what, how it ended, and its last position. */
export type ChaalGameSummary = {
	id: string;
	rated: boolean;
	perf: string;
	/** Standard chess, from the start or a position. */
	standard: boolean;
	ongoing: boolean;
	status: string;
	winner: ChaalColor | null;
	createdAt: number;
	lastMoveAt: number;
	white: GamePlayerSummary;
	black: GamePlayerSummary;
	opening: { eco: string; name: string } | null;
	clock: { initial: number; increment: number } | null;
	daysPerTurn: number | null;
	plies: number;
	lastFen: string | null;
	lastMove: string | null;
};

export type ChaalPlayerGames = {
	games: ChaalGameSummary[];
	/** The next page's cursor, or null when Lichess has no more. */
	next: number | null;
};

export type FollowedPlayer = { id: string; username: string; title: string | null; online: boolean };

export type PlayerSuggestion = { id: string; username: string; title: string | null; online: boolean };

// --- A finished game (`/game/$id`) -------------------------------------------------------

export const JUDGEMENTS = ["inaccuracy", "mistake", "blunder"] as const;
export type Judgement = (typeof JUDGEMENTS)[number];

export type MoveAnalysis = { eval: Score | null; judgement: Judgement | null; best: string | null };

export type ReplayPlayer = GamePlayerSummary & {
	/** Lichess's summary of the side's play, when the game was analysed. */
	analysis: { inaccuracy: number; mistake: number; blunder: number; acpl: number; accuracy: number | null } | null;
};

export type ChaalReplay = {
	id: string;
	rated: boolean;
	perf: string;
	standard: boolean;
	ongoing: boolean;
	status: string;
	winner: ChaalColor | null;
	createdAt: number;
	lastMoveAt: number;
	/** The start, or the position the game began from. */
	initialFen: string | null;
	clock: { initial: number; increment: number } | null;
	daysPerTurn: number | null;
	white: ReplayPlayer;
	black: ReplayPlayer;
	opening: { eco: string; name: string } | null;
	/** SAN, from the start. */
	moves: string[];
	/** The mover's clock after each move, in ms; null without a clock. */
	clocks: number[] | null;
	/** One per move when Lichess analysed the game: the eval after it, and Lichess's judgement. */
	analysis: MoveAnalysis[] | null;
	/** Lichess's PGN, to copy or download. */
	pgn: string;
};
