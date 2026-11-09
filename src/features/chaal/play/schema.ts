import { z } from "zod";
import type { ChaalColor, ChaalEventChallenge, ChaalGameFull } from "../live/events";
import { boardLegal, CORRESPONDENCE_DAYS } from "./controls";

/**
 * Online play's inputs and answers (Task 77, decision 0266): what the functions and the
 * challenge stream take, checked the same way in the browser and on the server.
 */

/** A Lichess username: 2–30 letters, digits, `_` or `-`, starting and ending with a letter or digit. */
export const lichessUsername = z
	.string()
	.trim()
	.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/);

/** A game's or a challenge's id on Lichess. */
export const lichessGameId = z.string().regex(/^[A-Za-z0-9]{8}$/);

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
export const onlinePace = z.union([clockPace, daysPace]);

export const challengeColor = z.enum(["white", "random", "black"]);
export type ChallengeColor = z.infer<typeof challengeColor>;

/** A challenge to a player: kept open by a stream for a clock, a function call for days. */
export const challengePlayerInput = z.strictObject({
	username: lichessUsername,
	pace: onlinePace,
	color: challengeColor,
	rated: z.boolean(),
});
export type ChallengePlayerInput = z.infer<typeof challengePlayerInput>;

export const challengeAiInput = z.strictObject({
	level: z.number().int().min(1).max(8),
	pace: onlinePace,
	color: challengeColor,
});
export type ChallengeAiInput = z.infer<typeof challengeAiInput>;

export const openChallengeInput = z.strictObject({ pace: onlinePace, color: challengeColor, rated: z.boolean() });
export type OpenChallengeInput = z.infer<typeof openChallengeInput>;

/** Why a challenge is declined: Lichess's reasons a person would give (it translates them for the challenger). */
export const DECLINE_REASONS = ["generic", "later", "tooFast", "tooSlow", "timeControl", "rated", "casual"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const challengeIdInput = z.strictObject({ id: lichessGameId });
export const declineInput = z.strictObject({ id: lichessGameId, reason: z.enum(DECLINE_REASONS) });

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
] as const;
export type GameAction = (typeof GAME_ACTIONS)[number];

export const moveInput = z.strictObject({
	id: lichessGameId,
	uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
	offeringDraw: z.boolean().optional(),
});
export const gameActionInput = z.strictObject({ id: lichessGameId, action: z.enum(GAME_ACTIONS) });

/** Lichess's own limit on a chat line. */
export const CHAT_MAX = 140;
export const chatInput = z.strictObject({ id: lichessGameId, text: z.string().trim().min(1).max(CHAT_MAX) });

/** The caller's challenges: theirs to answer, and theirs waiting for an answer. */
export type ChaalChallenges = { incoming: ChaalEventChallenge[]; outgoing: ChaalEventChallenge[] };

/** A game the caller plays, as its page first draws it: the game and the caller's side. */
export type ChaalLiveGame = { game: ChaalGameFull; color: ChaalColor };

/** An open challenge's link for the friend, and the side the caller took. */
export type ChaalOpenChallenge = { id: string; link: string; color: ChaalColor };
