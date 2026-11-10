import { createServerFn } from "@tanstack/react-start";
import { tournamentJoinInput, tournamentWithdrawInput } from "@/features/chaal/events/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as events from "@/server/chaal/events/service";

/**
 * Joining and withdrawing from tournaments on Lichess (Task 83, decision 0273), with the
 * caller's own token (`tournament:write`, the `tournaments` switch, and the admin's
 * `community.joinTournaments`). Anyone with a session, guests included
 * (tests/server/chaal-access.test.ts).
 */

export const joinChaalTournament = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(tournamentJoinInput))
	.handler(({ context, data }): Promise<void> => events.join(context, context.user.id, data));

export const withdrawChaalTournament = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(tournamentWithdrawInput))
	.handler(({ context, data }): Promise<void> => events.withdraw(context, context.user.id, data.kind, data.id));
