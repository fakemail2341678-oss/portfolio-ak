import { fn } from "storybook/test";
import type { ChaalTeamPage, ChaalTeams, TeamSummary } from "../../../../src/features/chaal/teams/schema";
import { swissPage, tournaments } from "./tournaments";

// Stand-ins for src/functions/chaal/teams.ts: made-up teams and members.

export const teamSummaries: TeamSummary[] = [
	{
		id: "nepal-chess-club",
		name: "Nepal Chess Club",
		description: "Players from all over Nepal. Weekly rapid Swiss on Saturdays.",
		open: true,
		leader: { id: "pokhara64", name: "Pokhara64", title: null },
		nbMembers: 1_284,
	},
	{
		id: "himalayan-blitz",
		name: "Himalayan Blitz",
		description: null,
		open: false,
		leader: { id: "north_star", name: "North_Star", title: "GM" },
		nbMembers: 312,
	},
];

export const teamsList: ChaalTeams = { teams: teamSummaries, page: 1, next: 2, total: 40 };

export const teamPage: ChaalTeamPage = {
	team: {
		id: "nepal-chess-club",
		name: "Nepal Chess Club",
		description: "Players from all over Nepal.\n\nWeekly rapid Swiss on Saturdays; a blitz arena every first Sunday.",
		open: true,
		nbMembers: 1_284,
		leaders: [
			{ id: "pokhara64", name: "Pokhara64", title: null },
			{ id: "north_star", name: "North_Star", title: "GM" },
		],
		members: ["Lalitpur_Rook", "Everest_Endgame", "Bishop_of_Bhaktapur"].map((name, index) => ({
			id: name.toLowerCase(),
			name,
			title: null,
			joinedAt: Date.UTC(2026, 10, 9 - index),
		})),
		arenas: tournaments.created.slice(0, 1),
		swiss: [swissPage.swiss],
		url: "https://lichess.org/team/nepal-chess-club",
	},
	viewer: null,
};

export const getChaalTeams = fn(async (): Promise<ChaalTeams> => teamsList).mockName("getChaalTeams");
export const searchChaalTeams = fn(async (): Promise<ChaalTeams> => teamsList).mockName("searchChaalTeams");
export const getChaalTeam = fn(async (): Promise<ChaalTeamPage> => teamPage).mockName("getChaalTeam");
