import { createServerFn } from "@tanstack/react-start";
import type { ChaalEventChallenge } from "@/features/chaal/live/events";
import {
	type ChaalChallenges,
	type ChaalOpenChallenge,
	type ChaalPlaying,
	type ChaalSeek,
	challengeAiInput,
	challengeIdInput,
	challengePlayerInput,
	declineInput,
	openChallengeInput,
	seekInput,
} from "@/features/chaal/play/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as play from "@/server/chaal/play/service";

/**
 * Challenges and the Lichess AI (Task 77, decision 0266): the caller's challenges, a
 * correspondence challenge to a player (a clock's is kept open by the stream route), an
 * open challenge's link, accepting, declining and cancelling, and a game against the AI;
 * quick pairing by days and the games in progress (Task 78).
 * Anyone with a session and a Lichess connection with play's scopes; each acts with the
 * caller's own token (tests/server/chaal-access.test.ts).
 */

export const getChaalChallenges = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalChallenges> => play.listChallenges(context, context.user.id));

export const challengeChaalPlayer = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengePlayerInput))
	.handler(({ context, data }): Promise<ChaalEventChallenge> => play.challengePlayer(context, context.user.id, data));

export const openChaalChallenge = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(openChallengeInput))
	.handler(({ context, data }): Promise<ChaalOpenChallenge> => play.openChallenge(context, context.user.id, data));

export const acceptChaalChallenge = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengeIdInput))
	.handler(({ context, data }): Promise<{ id: string }> => play.acceptChallenge(context, context.user.id, data.id));

export const declineChaalChallenge = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(declineInput))
	.handler(({ context, data }): Promise<void> => play.declineChallenge(context, context.user.id, data.id, data.reason));

export const cancelChaalChallenge = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengeIdInput))
	.handler(({ context, data }): Promise<void> => play.cancelChallenge(context, context.user.id, data.id));

export const challengeChaalAi = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengeAiInput))
	.handler(({ context, data }): Promise<{ id: string }> => play.challengeAi(context, context.user.id, data));

/** Quick pairing by days (Task 78): a correspondence seek in the lobby. A clock's seek is kept open by the stream route. */
export const seekChaalCorrespondence = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(seekInput))
	.handler(({ context, data }): Promise<ChaalSeek> => play.seekCorrespondence(context, context.user.id, data));

/** The caller's games in progress on Lichess, with whose turn it is (Task 78): the tab leader reads it for correspondence. */
export const getChaalPlaying = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalPlaying> => play.playingGames(context, context.user.id));
