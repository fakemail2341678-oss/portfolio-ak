import { z } from "zod";
import type { ChaalColor } from "../live/events";

/**
 * Tournaments (PLAN Task 83, decision 0273): what the functions take and give. Lichess's
 * arenas (`/api/tournament`) and Swiss tournaments (reached through teams,
 * `/api/team/{id}/swiss`), each as Chaal's own lean shape, mapped on the server
 * (src/server/chaal/lichess/schemas.ts) because it travels in the page's HTML. Names and
 * descriptions are shown as text.
 */

/** An arena's or a Swiss tournament's id. */
export const tournamentId = z.string().regex(/^[A-Za-z0-9]{8}$/);

/** A team's id: its name as a slug. */
export const teamSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);

export const TOURNAMENT_KINDS = ["arena", "swiss"] as const;
export type TournamentKind = (typeof TOURNAMENT_KINDS)[number];

/** Lichess shows an arena's standings ten players a page. */
export const STANDING_PAGE_SIZE = 10;
export const STANDING_PAGES = 200;

/** How many of a Swiss tournament's players are read (its results, best first). */
export const SWISS_STANDINGS = 100;

export const arenaInput = z.strictObject({ id: tournamentId, page: z.number().int().min(1).max(STANDING_PAGES) });
export const swissInput = z.strictObject({ id: tournamentId });

/** Joining: a password when the tournament has one; for a team battle, the team to play for; "pair me ASAP" (arenas). */
export const tournamentJoinInput = z.strictObject({
	kind: z.enum(TOURNAMENT_KINDS),
	id: tournamentId,
	password: z.string().trim().max(100).optional(),
	team: teamSlug.optional(),
	pairMeAsap: z.boolean().optional(),
});
export type TournamentJoinInput = z.output<typeof tournamentJoinInput>;

export const tournamentWithdrawInput = z.strictObject({ kind: z.enum(TOURNAMENT_KINDS), id: tournamentId });

export type TournamentStatus = "created" | "started" | "finished";

/** A clock in seconds: the start and the increment. */
export type TournamentClock = { limit: number; increment: number };

/** One of a tournament's entry conditions and whether the viewer meets it (Lichess's verdict). */
export type TournamentCondition = { condition: string; ok: boolean };

/** An arena in a list (Lichess's own list, or a team's). */
export type ArenaSummary = {
	id: string;
	name: string;
	status: TournamentStatus;
	clock: TournamentClock;
	/** How long the arena lasts. */
	minutes: number;
	rated: boolean;
	/** Lichess's rating the games count for (`bullet`, `blitz`, ...). */
	perf: string;
	/** `standard` for standard chess; a variant's key otherwise. */
	variant: string;
	nbPlayers: number;
	startsAt: number;
	finishesAt: number;
	/** The winner's name once it's finished. */
	winner: string | null;
	/** Lichess's own (scheduled) arenas, as opposed to a player's or a team's. */
	official: boolean;
};

export type ChaalTournaments = { created: ArenaSummary[]; started: ArenaSummary[]; finished: ArenaSummary[] };

/** A player in an arena's standings. Lichess names them; there's no id. */
export type ArenaStanding = {
	rank: number;
	name: string;
	title: string | null;
	rating: number;
	score: number;
	/** The points of each game, newest last ("4422..."), as Lichess's sheet. */
	sheet: string;
	/** On a streak (Lichess's flame: points doubled). */
	fire: boolean;
	withdraw: boolean;
	/** In a team battle, the team they play for. */
	team: string | null;
};

export type ArenaPodium = {
	rank: number;
	name: string;
	title: string | null;
	rating: number;
	score: number;
	games: number;
	wins: number;
	berserks: number;
	performance: number | null;
};

/** The arena's top game now (Lichess's featured one): a diagram that opens the game. */
export type ArenaFeatured = {
	id: string;
	fen: string;
	orientation: ChaalColor;
	lastMove: string | null;
	white: { name: string; rating: number | null; rank: number | null };
	black: { name: string; rating: number | null; rank: number | null };
};

export type TournamentStats = {
	games: number;
	whiteWins: number;
	blackWins: number;
	draws: number;
	averageRating: number | null;
	/** Arenas only. */
	berserks: number | null;
};

/** What the viewer is in an arena: Lichess says it to their token. */
export type ArenaMe = { rank: number | null; withdraw: boolean; gameId: string | null };

export type ChaalArena = Omit<ArenaSummary, "winner" | "official"> & {
	createdBy: string;
	official: boolean;
	berserkable: boolean;
	secondsToStart: number | null;
	secondsToFinish: number | null;
	/** The organiser's words, as text. */
	description: string | null;
	conditions: TournamentCondition[];
	/** Whether Lichess would let the viewer in now (its verdicts); null when it doesn't say. */
	eligible: boolean | null;
	/** A team battle's teams, the ones a player may play for. */
	teams: Array<{ id: string; name: string }> | null;
	standing: { page: number; players: ArenaStanding[] };
	/** How many pages the standings have. */
	pages: number;
	podium: ArenaPodium[] | null;
	featured: ArenaFeatured | null;
	stats: TournamentStats | null;
	me: ArenaMe | null;
	url: string;
};

/** An arena's page: the arena, and for a connected viewer whether they may act (null otherwise). */
export type ChaalArenaPage = { arena: ChaalArena; viewer: { username: string } | null };

/** A Swiss tournament in a team's list. */
export type SwissSummary = {
	id: string;
	name: string;
	status: TournamentStatus;
	clock: TournamentClock;
	variant: string;
	rated: boolean;
	nbPlayers: number;
	round: number;
	nbRounds: number;
	startsAt: number;
	/** When the next round starts, while there's one to come. */
	nextRoundAt: number | null;
};

export type SwissStanding = {
	rank: number;
	name: string;
	title: string | null;
	rating: number;
	points: number;
	tieBreak: number;
	performance: number | null;
};

export type ChaalSwiss = SwissSummary & {
	createdBy: string;
	nbOngoing: number;
	conditions: TournamentCondition[];
	eligible: boolean | null;
	stats: TournamentStats | null;
	/** The first players, best first (at most `SWISS_STANDINGS`). */
	standings: SwissStanding[];
	url: string;
};

/**
 * A Swiss tournament's page. Lichess doesn't tell a token whether its player has joined:
 * `joined` is whether their name is in the standings read (null while there are more than
 * were read and it isn't).
 */
export type ChaalSwissPage = { swiss: ChaalSwiss; viewer: { username: string; joined: boolean | null } | null };
