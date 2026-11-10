import { createServerFn } from "@tanstack/react-start";
import {
	type ChaalTeamPage,
	type ChaalTeams,
	teamInput,
	teamListInput,
	teamSearchInput,
} from "@/features/chaal/teams/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as teams from "@/server/chaal/teams/service";

/**
 * Teams for everyone (Task 83, decision 0273): popular teams, a search, and a team with its
 * members and tournaments (and, for a connected viewer, whether they're in it). Public: each
 * starts with `withChaalPublic` and checks the `teams` switch.
 */

export const getChaalTeams = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(teamListInput))
	.handler(({ context, data }): Promise<ChaalTeams> => teams.popularTeams(context.chaal, data.page));

export const searchChaalTeams = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(teamSearchInput))
	.handler(({ context, data }): Promise<ChaalTeams> => teams.searchTeams(context.chaal, data.q, data.page));

export const getChaalTeam = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(teamInput))
	.handler(({ context, data }): Promise<ChaalTeamPage> => teams.teamPage(context.chaal, context.session, data.id));
