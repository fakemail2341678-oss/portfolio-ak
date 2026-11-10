import { z } from "zod";
import { type ArenaSummary, type SwissSummary, teamSlug } from "../events/schema";

/**
 * Teams (PLAN Task 83, decision 0273): what the functions take and give. A team's words
 * (its description) are shown as text, never HTML; members and leaders by name.
 */

/** Lichess's team lists go to page 20 here: enough to browse, not a crawl. */
export const TEAM_PAGES = 20;
const teamPage = z.number().int().min(1).max(TEAM_PAGES);

export const teamListInput = z.strictObject({ page: teamPage });
export const teamSearchInput = z.strictObject({ q: z.string().trim().min(2).max(60), page: teamPage });
export const teamInput = z.strictObject({ id: teamSlug });

/** Joining a team: a closed team wants a message to its leaders, a private one a password. */
export const teamJoinInput = z.strictObject({
	id: teamSlug,
	message: z.string().trim().max(2000).optional(),
	password: z.string().trim().max(100).optional(),
});
export type TeamJoinInput = z.output<typeof teamJoinInput>;

/** How many of a team's members, and of its tournaments of each kind, the page shows. */
export const TEAM_MEMBERS_SHOWN = 30;
export const TEAM_TOURNAMENTS_SHOWN = 10;

export type TeamPerson = { id: string; name: string; title: string | null };

export type TeamSummary = {
	id: string;
	name: string;
	/** The start of its description, as text. */
	description: string | null;
	/** Anyone may join at once (else the leaders accept a request). */
	open: boolean;
	leader: TeamPerson | null;
	nbMembers: number;
};

export type ChaalTeams = { teams: TeamSummary[]; page: number; next: number | null; total: number };

export type TeamMember = TeamPerson & { joinedAt: number | null };

export type ChaalTeam = Omit<TeamSummary, "leader"> & {
	leaders: TeamPerson[];
	/** The newest members first. */
	members: TeamMember[];
	arenas: ArenaSummary[];
	swiss: SwissSummary[];
	url: string;
};

/** A team's page: the team, and for a connected viewer whether they're in it or have asked to be. */
export type ChaalTeamPage = { team: ChaalTeam; viewer: { joined: boolean; requested: boolean } | null };
