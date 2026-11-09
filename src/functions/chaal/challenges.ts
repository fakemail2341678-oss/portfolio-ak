import { createServerFn } from "@tanstack/react-start";
import type { ChaalEventChallenge } from "@/features/chaal/live/events";
import {
	type ChaalChallenges,
	type ChaalOpenChallenge,
	challengeAiInput,
	challengeIdInput,
	challengePlayerInput,
	declineInput,
	openChallengeInput,
} from "@/features/chaal/play/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as play from "@/server/chaal/play/service";

/**
 * Challenges and the Lichess AI (Task 77, decision 0266): the caller's challenges, a
 * correspondence challenge to a player (a clock's is kept open by the stream route), an
 * open challenge's link, accepting, declining and cancelling, and a game against the AI.
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
