import { fn } from "storybook/test";
import type { TeamSummary } from "../../../../src/features/chaal/teams/schema";
import { teamSummaries } from "./teams";

// Stand-ins for src/functions/chaal/team-membership.ts: a player in one team; joining and leaving answer at once.
export const getChaalMyTeams = fn(async (): Promise<TeamSummary[]> => teamSummaries.slice(0, 1)).mockName(
	"getChaalMyTeams",
);
export const joinChaalTeam = fn(async (): Promise<void> => {}).mockName("joinChaalTeam");
export const leaveChaalTeam = fn(async (): Promise<void> => {}).mockName("leaveChaalTeam");
