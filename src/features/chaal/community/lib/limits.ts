/**
 * Community's controls (PLAN Task 83, decision 0273), set by the admin in
 * `ch_settings.community` on /admin/chaal/settings and sent to every page with the status.
 * The feature switches (`tournaments`, `teams`, `studies`) turn an area off whole; these keep
 * its pages and stop what writes to Lichess with a player's token. Stored values are read
 * through `readCommunityLimits`. Kept apart from the pages' schemas, so the status and the
 * admin's form load nothing else.
 */

/** A Lichess username: letters, digits, `_` and `-`, 2 to 30 long. */
export const LICHESS_USERNAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$/;

export type CommunityLimits = {
	/** Whether players may join and withdraw from tournaments here (the pages stay either way). */
	joinTournaments: boolean;
	/** Whether players may join and leave teams here. */
	joinTeams: boolean;
	/** Whether the analysis board offers "Save to study". */
	saveToStudy: boolean;
	/** The Lichess account whose public studies the studies page opens with. */
	studiesBy: string;
};

export const DEFAULT_COMMUNITY_LIMITS: CommunityLimits = {
	joinTournaments: true,
	joinTeams: true,
	saveToStudy: true,
	studiesBy: "lichess",
};

const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

export function readCommunityLimits(value: Partial<CommunityLimits> | null | undefined): CommunityLimits {
	const by = typeof value?.studiesBy === "string" ? value.studiesBy.trim() : "";
	return {
		joinTournaments: flag(value?.joinTournaments, DEFAULT_COMMUNITY_LIMITS.joinTournaments),
		joinTeams: flag(value?.joinTeams, DEFAULT_COMMUNITY_LIMITS.joinTeams),
		saveToStudy: flag(value?.saveToStudy, DEFAULT_COMMUNITY_LIMITS.saveToStudy),
		studiesBy: LICHESS_USERNAME.test(by) ? by : DEFAULT_COMMUNITY_LIMITS.studiesBy,
	};
}
