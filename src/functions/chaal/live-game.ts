import { createServerFn } from "@tanstack/react-start";
import type { ChaalChatLine } from "@/features/chaal/live/events";
import {
	type ChaalLiveGame,
	challengeIdInput,
	chatInput,
	gameActionInput,
	moveInput,
} from "@/features/chaal/play/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as play from "@/server/chaal/play/service";

/**
 * A game the caller plays on Lichess (Task 77, decision 0266): its first paint, a move, the
 * game's actions (resign, abort, draw and takeback offers and answers, the claims when the
 * opponent has gone) and the players' chat. Lichess judges each; a game the caller isn't
 * in is refused there. The game's live lines come through the stream route.
 */

export const getChaalLiveGame = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengeIdInput))
	.handler(({ context, data }): Promise<ChaalLiveGame> => play.liveGame(context, context.user.id, data.id));

export const playChaalMove = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(moveInput))
	.handler(
		({ context, data }): Promise<void> =>
			play.playMove(context, context.user.id, data.id, data.uci, data.offeringDraw ?? false),
	);

export const actOnChaalGame = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(gameActionInput))
	.handler(({ context, data }): Promise<void> => play.gameAction(context, context.user.id, data.id, data.action));

export const getChaalChat = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(challengeIdInput))
	.handler(({ context, data }): Promise<ChaalChatLine[]> => play.chatHistory(context, context.user.id, data.id));

export const sendChaalChat = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(chatInput))
	.handler(({ context, data }): Promise<void> => play.sendChat(context, context.user.id, data.id, data.text));
