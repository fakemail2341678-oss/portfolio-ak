import { createServerFn } from "@tanstack/react-start";
import { type TeamSummary, teamInput, teamJoinInput } from "@/features/chaal/teams/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as teams from "@/server/chaal/teams/service";

/**
 * The player's teams on Lichess (Task 83, decision 0273): the teams they're in, joining (or
 * asking to) and leaving, with their own token (`team:read`, `team:write`, the `teams`
 * switch, and the admin's `community.joinTeams` for joining and leaving). Anyone with a
 * session, guests included (tests/server/chaal-access.test.ts).
 */

export const getChaalMyTeams = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<TeamSummary[]> => teams.myTeams(context, context.user.id));

export const joinChaalTeam = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(teamJoinInput))
	.handler(({ context, data }): Promise<void> => teams.joinTeam(context, context.user.id, data));

export const leaveChaalTeam = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(teamInput))
	.handler(({ context, data }): Promise<void> => teams.leaveTeam(context, context.user.id, data.id));
