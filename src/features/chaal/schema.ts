import type { Localized } from "@/lib/i18n/localized";
import type { EngineLimits } from "./engine/limits";
import type { ChaalFeature } from "./features";
import type { PlayLimits } from "./play/controls";

/** Shapes Chaal's server functions return (Task 71). */

/** What any Chaal page may know before it renders (getChaalStatus). */
export type ChaalStatus = {
	features: Record<ChaalFeature, boolean>;
	/** Whether this visitor could connect Lichess now: off without CHAAL_TOKEN_KEY, or for a guest when the admin says so. */
	connect: "on" | "off";
	/** The explorer answers visitors who haven't connected (LICHESS_APP_TOKEN is set). */
	explorerForVisitors: boolean;
	/** The admin's notice under the top bar (Task 73), or null. */
	banner: Localized | null;
	/** The engine's limits in the browser (Task 75). */
	engine: EngineLimits;
	/** Online play's limits (Task 77): the Lichess AI's highest level, whether rated games may be asked for. */
	play: PlayLimits;
};

/** A connected Lichess account as a page sees it: never the token (src/server/chaal/connect/service.ts). */
export type ChaalConnection = {
	lichessId: string;
	username: string;
	title: string | null;
	scopes: string[];
	connectedAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	/** Lichess refused the token, or it ran out: "Reconnect". */
	revoked: boolean;
	/** Enabled features it lacks a scope for: "Reconnect to allow …". */
	needsScopesFor: ChaalFeature[];
};

export type ChaalCallCounts = {
	endpoint: string;
	calls: number;
	errors: number;
	rateLimited: number;
	avgMs: number;
	lastStatus: number;
};

/** /admin/chaal/lab: the setup, what connecting asks for, the stream's window and this server's calls. */
export type ChaalLabState = {
	setup: {
		tokenKey: boolean;
		/** The key id new tokens are sealed with. */
		keyId: string | null;
		appToken: boolean;
		clientId: string;
		apiBase: string;
		redirectUri: string;
	};
	scopes: string[];
	streamWindowSeconds: number;
	publicCooldownUntil: string | null;
	counters: ChaalCallCounts[];
};

/** The lab's check of the public lane: the daily puzzle, through the client and the cache. */
export type ChaalLaneCheck = { puzzleId: string; rating: number | null; ms: number };

// --- Analysis (Task 75, decision 0264) -----------------------------------------------------

/** A score from White's side: centipawns, or mate in n (negative: Black mates). */
export type ChaalScore = { cp: number } | { mate: number };

/** Lichess's cloud eval of a position (only positions it has cached; null otherwise). */
export type ChaalCloudEval = {
	depth: number;
	knodes: number;
	/** Best first, each a score from White's side and the line in UCI. */
	lines: Array<{ score: ChaalScore; moves: string[] }>;
};

export const EXPLORER_DATABASES = ["masters", "lichess", "player"] as const;
export type ExplorerDatabase = (typeof EXPLORER_DATABASES)[number];

/** Lichess's speeds, as its explorer filters them. */
export const EXPLORER_SPEEDS = ["bullet", "blitz", "rapid", "classical", "correspondence"] as const;
export type ExplorerSpeed = (typeof EXPLORER_SPEEDS)[number];

/** Lichess's rating groups (each is "this rating and up to the next"). */
export const EXPLORER_RATINGS = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;
export type ExplorerRating = (typeof EXPLORER_RATINGS)[number];

export type ChaalOpening = { eco: string; name: string };

export type ChaalExplorerGame = {
	id: string;
	white: { name: string; rating: number | null };
	black: { name: string; rating: number | null };
	winner: "white" | "black" | null;
	year: number | null;
	/** The move played in this position. */
	uci: string | null;
};

export type ChaalExplorerMove = {
	uci: string;
	san: string;
	white: number;
	draws: number;
	black: number;
	/** The players' average rating (masters, Lichess) or the opponents' (a player's games). */
	rating: number | null;
};

export type ChaalExplorer = {
	database: ExplorerDatabase;
	opening: ChaalOpening | null;
	white: number;
	draws: number;
	black: number;
	moves: ChaalExplorerMove[];
	/** Masters' and Lichess's best games here, or a player's latest. */
	games: ChaalExplorerGame[];
	/** A player's games are still being indexed: the numbers will grow. */
	indexing: boolean;
};

/** What the explorer answers: its data, or why it can't (no token for a visitor). */
export type ChaalExplorerResult = { ok: true; data: ChaalExplorer } | { ok: false; reason: "token" };

/** A position's result with perfect play, from the side to move (or the mover's, for a move). */
export const TABLEBASE_RESULTS = [
	"win",
	"maybe-win",
	"cursed-win",
	"draw",
	"blessed-loss",
	"maybe-loss",
	"loss",
	"unknown",
] as const;
export type TablebaseResult = (typeof TABLEBASE_RESULTS)[number];

export type ChaalTablebase = {
	result: TablebaseResult;
	/** Moves to a capture or pawn move (zeroing), or to mate, when known. */
	dtz: number | null;
	dtm: number | null;
	checkmate: boolean;
	stalemate: boolean;
	insufficientMaterial: boolean;
	/** Each move with its result for the side that plays it, best first. */
	moves: Array<{ uci: string; san: string; result: TablebaseResult; dtz: number | null; dtm: number | null }>;
};

/** A Lichess game brought into analysis: its PGN, or why not. */
export type ChaalImportedGame =
	| { ok: true; id: string; pgn: string }
	| { ok: false; reason: "not-found" | "in-progress" | "variant" };
