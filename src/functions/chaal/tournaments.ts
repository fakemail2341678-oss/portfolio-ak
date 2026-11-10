import { createServerFn } from "@tanstack/react-start";
import {
	arenaInput,
	type ChaalArenaPage,
	type ChaalSwissPage,
	type ChaalTournaments,
	swissInput,
} from "@/features/chaal/events/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as events from "@/server/chaal/events/service";

/**
 * Tournaments for everyone (Task 83, decision 0273): Lichess's arenas, an arena with a page
 * of its standings (and, for a connected viewer, where they stand), and a Swiss tournament
 * with its standings. Public: each starts with `withChaalPublic` and checks the
 * `tournaments` switch.
 */

export const getChaalTournaments = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<ChaalTournaments> => events.tournaments(context.chaal));

export const getChaalArena = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(arenaInput))
	.handler(
		({ context, data }): Promise<ChaalArenaPage> =>
			events.arenaPage(context.chaal, context.session, data.id, data.page),
	);

export const getChaalSwiss = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(swissInput))
	.handler(({ context, data }): Promise<ChaalSwissPage> => events.swissPage(context.chaal, context.session, data.id));
