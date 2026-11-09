import { z } from "zod";
import type { ChaalColor } from "../live/events";
import type { GamePlayerSummary } from "../players/schema";
import type { TvChannel } from "./limits";

/**
 * Watch (PLAN Task 82, decision 0272): what the functions take and give. Every answer is
 * Chaal's own lean shape, mapped from Lichess's on the server
 * (src/server/chaal/lichess/schemas.ts), because it travels in the page's HTML. What's live
 * (the TV's feeds, a game being played, a broadcast round's PGN) the browser reads from
 * Lichess itself (./live.ts).
 */

// --- TV ----------------------------------------------------------------------------------

/** A channel's game as the TV's first paint shows it, before its feed takes over. */
export type ChaalTvGame = {
	channel: TvChannel;
	id: string;
	/** The side the channel follows (its featured player's): the board's orientation. */
	orientation: ChaalColor;
	white: GamePlayerSummary;
	black: GamePlayerSummary;
	/** The last position Lichess exported (a few seconds behind), or null when it had none. */
	fen: string | null;
	lastMove: string | null;
	perf: string;
	rated: boolean;
	clock: { initial: number; increment: number } | null;
};

export type ChaalTv = { games: ChaalTvGame[] };

/** A streamer live now (links out: Twitch or YouTube). Their words are shown as text. */
export type ChaalStreamer = {
	id: string;
	username: string;
	title: string | null;
	/** The streamer's own name for their stream, else their username. */
	name: string;
	/** The stream's title now. */
	status: string;
	lang: string | null;
	service: "twitch" | "youtube";
	url: string;
};

// --- Broadcasts --------------------------------------------------------------------------

/** A broadcast id: a tournament's, a round's or a board's (a study chapter). */
export const broadcastId = z.string().regex(/^[A-Za-z0-9]{8}$/);

export const BROADCAST_PAGES = 20;
export const broadcastPage = z.number().int().min(1).max(BROADCAST_PAGES);

export const broadcastListInput = z.strictObject({ page: broadcastPage });
export const broadcastSearchInput = z.strictObject({ q: z.string().trim().min(2).max(60), page: broadcastPage });
export const broadcastTourInput = z.strictObject({ id: broadcastId });
export const broadcastRoundInput = z.strictObject({ id: broadcastId });
export const broadcastBoardInput = z.strictObject({ round: broadcastId, board: broadcastId });

export type RoundState = "upcoming" | "ongoing" | "finished";

export type BroadcastRoundSummary = {
	id: string;
	name: string;
	state: RoundState;
	startsAt: number | null;
	finishedAt: number | null;
};

/** What a broadcast says about itself; its links are web addresses only. */
export type BroadcastInfo = {
	format: string | null;
	timeControl: string | null;
	location: string | null;
	players: string | null;
	website: string | null;
	standings: string | null;
};

/** A broadcast in a list: its name, when, and the round to open. */
export type BroadcastTourSummary = {
	id: string;
	name: string;
	/** Lichess's tier for an official broadcast (3 to 5), null for anyone else's. */
	tier: number | null;
	/** The first and last day, as Lichess gives them. */
	dates: number[];
	info: BroadcastInfo;
	round: BroadcastRoundSummary | null;
};

export type ChaalBroadcasts = {
	active: BroadcastTourSummary[];
	upcoming: BroadcastTourSummary[];
	past: BroadcastTourSummary[];
	page: number;
	next: number | null;
};

export type ChaalBroadcastSearch = { results: BroadcastTourSummary[]; page: number; next: number | null };

export type ChaalBroadcastTour = {
	id: string;
	name: string;
	tier: number | null;
	dates: number[];
	info: BroadcastInfo;
	/** The group a tournament belongs to (its open and its women's, say), as Lichess names it. */
	group: string | null;
	rounds: BroadcastRoundSummary[];
	/** The round Lichess opens first: the one being played, else the latest. */
	defaultRound: string | null;
	url: string;
};

export type BroadcastPlayer = {
	name: string;
	title: string | null;
	rating: number | null;
	/** The federation's three letters. */
	fed: string | null;
	/** Time left, in ms, as the board last reported it. */
	clock: number | null;
};

export const BOARD_RESULTS = ["*", "1-0", "0-1", "½-½"] as const;
export type BoardResult = (typeof BOARD_RESULTS)[number];

/** A board in a round (a game; Lichess keeps each as a study chapter). */
export type BroadcastBoard = {
	id: string;
	fen: string;
	lastMove: string | null;
	result: BoardResult;
	white: BroadcastPlayer;
	black: BroadcastPlayer;
};

export type ChaalBroadcastRound = {
	tour: { id: string; name: string };
	round: BroadcastRoundSummary & { url: string };
	boards: BroadcastBoard[];
};

/** A board's game as PGN, with its clocks and evals: the focused board's first paint. */
export type ChaalBroadcastGame = { round: string; board: string; pgn: string };
