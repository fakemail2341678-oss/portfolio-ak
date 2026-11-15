import { z } from "zod";
import type { ChaalColor, ChaalEventChallenge, ChaalEventGame, ChaalGameFull } from "../live/lib/events";
import { boardLegal, CORRESPONDENCE_DAYS, RATING_RANGES, seekLegal } from "./lib/controls";

/**
 * Online play's inputs and answers (Task 77, decision 0266): what the functions and the
 * challenge stream take, checked the same way in the browser and on the server.
 */

/** A Lichess username: 2–30 letters, digits, `_` or `-`, starting and ending with a letter or digit. */
export const lichessUsernameSchema = z
	.string()
	.trim()
	.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/);

/** A game's or a challenge's id on Lichess. */
export const lichessGameIdSchema = z.string().regex(/^[A-Za-z0-9]{8}$/);

const clockPace = z
	.strictObject({
		kind: z.literal("clock"),
		clock: z.strictObject({ initial: z.number().int(), increment: z.number().int() }),
	})
	.refine((pace) => boardLegal(pace.clock), { message: "not-board-legal" });
const daysPace = z.strictObject({
	kind: z.literal("days"),
	days: z.literal([...CORRESPONDENCE_DAYS]),
});
export const onlinePaceSchema = z.union([clockPace, daysPace]);

export const challengeColorSchema = z.enum(["white", "random", "black"]);
export type ChallengeColor = z.infer<typeof challengeColorSchema>;

/** A challenge to a player: kept open by a stream for a clock, a function call for days. */
export const challengePlayerInputSchema = z.strictObject({
	username: lichessUsernameSchema,
	pace: onlinePaceSchema,
	color: challengeColorSchema,
	rated: z.boolean(),
});
export type ChallengePlayerInput = z.infer<typeof challengePlayerInputSchema>;

export const challengeAiInputSchema = z.strictObject({
	level: z.number().int().min(1).max(8),
	pace: onlinePaceSchema,
	color: challengeColorSchema,
});
export type ChallengeAiInput = z.infer<typeof challengeAiInputSchema>;

export const openChallengeInputSchema = z.strictObject({
	pace: onlinePaceSchema,
	color: challengeColorSchema,
	rated: z.boolean(),
});
export type OpenChallengeInput = z.infer<typeof openChallengeInputSchema>;

/**
 * A seek in the lobby (quick pairing, Task 78): a clock the Board API may seek on, or days.
 * A clock's seek is kept open by its stream route; a correspondence seek is a function call.
 */
const seekClock = z
	.strictObject({
		kind: z.literal("clock"),
		clock: z.strictObject({ initial: z.number().int(), increment: z.number().int() }),
	})
	.refine((pace) => seekLegal(pace.clock), { message: "not-seekable" });
export const seekInputSchema = z.strictObject({
	pace: z.union([seekClock, daysPace]),
	rated: z.boolean(),
	range: z.enum(RATING_RANGES),
});
export type SeekInput = z.infer<typeof seekInputSchema>;

/** Why a challenge is declined: Lichess's reasons a person would give (it translates them for the challenger). */
export const DECLINE_REASONS = ["generic", "later", "tooFast", "tooSlow", "timeControl", "rated", "casual"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const challengeIdInputSchema = z.strictObject({ id: lichessGameIdSchema });
export const declineInputSchema = z.strictObject({ id: lichessGameIdSchema, reason: z.enum(DECLINE_REASONS) });

/** What a player may do in a game besides moving (the Board API's endpoints). */
export const GAME_ACTIONS = [
	"resign",
	"abort",
	"draw-offer",
	"draw-decline",
	"takeback-offer",
	"takeback-decline",
	"claim-victory",
	"claim-draw",
	/** An arena game only, before the player's first move (Task 78). */
	"berserk",
] as const;
export type GameAction = (typeof GAME_ACTIONS)[number];

export const moveInputSchema = z.strictObject({
	id: lichessGameIdSchema,
	uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
	offeringDraw: z.boolean().optional(),
});
export const gameActionInputSchema = z.strictObject({ id: lichessGameIdSchema, action: z.enum(GAME_ACTIONS) });

/** Lichess's own limit on a chat line. */
export const CHAT_MAX = 140;
export const chatInputSchema = z.strictObject({
	id: lichessGameIdSchema,
	text: z.string().trim().min(1).max(CHAT_MAX),
});

/** The caller's challenges: theirs to answer, and theirs waiting for an answer. */
export type ChaalChallenges = { incoming: ChaalEventChallenge[]; outgoing: ChaalEventChallenge[] };

/** A game the caller plays, as its page first draws it: the game and the caller's side. */
export type ChaalLiveGame = { game: ChaalGameFull; color: ChaalColor };

/** An open challenge's link for the friend, and the side the caller took. */
export type ChaalOpenChallenge = { id: string; link: string; color: ChaalColor };

/** The player's games in progress on Lichess (GET /api/account/playing, Task 78): the most urgent first. */
export type ChaalPlaying = { games: ChaalEventGame[] };

/** A correspondence seek waiting in Lichess's lobby: its id (Lichess has no call to take one back). */
export type ChaalSeek = { id: string };
