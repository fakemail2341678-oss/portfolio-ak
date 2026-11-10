import { fn } from "storybook/test";
import type {
	ArenaStanding,
	ArenaSummary,
	ChaalArena,
	ChaalArenaPage,
	ChaalSwissPage,
	ChaalTournaments,
} from "../../../../src/features/chaal/events/schema";

// Stand-ins for src/functions/chaal/tournaments.ts: made-up arenas and players, as Chaal maps Lichess's answers.

const HOUR = 3_600_000;
const START = Date.UTC(2026, 10, 10, 12, 0, 0);

const arena = (id: string, name: string, status: ArenaSummary["status"], offset: number): ArenaSummary => ({
	id,
	name,
	status,
	clock: { limit: 180, increment: 2 },
	minutes: 57,
	rated: true,
	perf: "blitz",
	variant: "standard",
	nbPlayers: status === "created" ? 12 : 184,
	startsAt: START + offset,
	finishesAt: START + offset + 57 * 60_000,
	winner: status === "finished" ? "Kathmandu_Knight" : null,
	official: true,
});

export const tournaments: ChaalTournaments = {
	created: [
		arena("blitzUp1", "Hourly Blitz Arena", "created", HOUR),
		arena("rapidUp1", "Rapid Arena", "created", 2 * HOUR),
	],
	started: [arena("blitzNow", "Himalayan Blitz Arena", "started", 0)],
	finished: [arena("blitzDon", "Hourly Blitz Arena", "finished", -2 * HOUR)],
};

const NAMES = [
	"Kathmandu_Knight",
	"North_Star",
	"Pokhara64",
	"Everest_Endgame",
	"Lalitpur_Rook",
	"Bishop_of_Bhaktapur",
];

const standing = (rank: number): ArenaStanding => ({
	rank,
	name: NAMES[(rank - 1) % NAMES.length] ?? "Player",
	title: rank === 1 ? "GM" : null,
	rating: 2600 - rank * 37,
	score: 40 - rank * 4,
	sheet: "4422302".slice(0, 7 - (rank % 3)),
	fire: rank === 1,
	withdraw: rank === 6,
	team: null,
});

const played: ChaalArena = {
	...arena("blitzNow", "Himalayan Blitz Arena", "started", 0),
	createdBy: "lichess",
	official: true,
	berserkable: true,
	secondsToStart: null,
	secondsToFinish: 1_800,
	description: "Every hour, three minutes and two seconds a move.",
	conditions: [
		{ condition: "≥ 20 rated Blitz games", ok: true },
		{ condition: "Rated ≤ 2000 in Blitz", ok: false },
	],
	eligible: false,
	teams: null,
	standing: { page: 1, players: [1, 2, 3, 4, 5, 6].map(standing) },
	pages: 19,
	podium: null,
	featured: {
		id: "topGame1",
		fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 1 6",
		orientation: "white",
		lastMove: "e8g8",
		white: { name: "Kathmandu_Knight", rating: 2563, rank: 1 },
		black: { name: "North_Star", rating: 2526, rank: 2 },
	},
	stats: null,
	me: null,
	url: "https://lichess.org/tournament/blitzNow",
};

export const arenaPlayed: ChaalArenaPage = { arena: played, viewer: null };

export const arenaFinished: ChaalArenaPage = {
	arena: {
		...played,
		id: "blitzDon",
		status: "finished",
		secondsToFinish: null,
		featured: null,
		podium: [1, 2, 3].map((rank) => ({
			rank,
			name: NAMES[rank - 1] ?? "Player",
			title: rank === 1 ? "GM" : null,
			rating: 2600 - rank * 37,
			score: 40 - rank * 4,
			games: 14,
			wins: 11 - rank,
			berserks: 2,
			performance: 2700 - rank * 40,
		})),
		stats: { games: 412, whiteWins: 198, blackWins: 176, draws: 38, berserks: 61, averageRating: 1874 },
		url: "https://lichess.org/tournament/blitzDon",
	},
	viewer: null,
};

export const swissPage: ChaalSwissPage = {
	swiss: {
		id: "swissNp1",
		name: "Nepal Rapid Swiss",
		status: "started",
		clock: { limit: 600, increment: 5 },
		variant: "standard",
		rated: true,
		nbPlayers: 6,
		round: 3,
		nbRounds: 7,
		startsAt: START,
		nextRoundAt: START + HOUR,
		createdBy: "Pokhara64",
		nbOngoing: 3,
		conditions: [],
		eligible: true,
		stats: null,
		standings: NAMES.map((name, index) => ({
			rank: index + 1,
			name,
			title: null,
			rating: 2100 - index * 50,
			points: 3 - index * 0.5,
			tieBreak: 6 - index,
			performance: 2200 - index * 60,
		})),
		url: "https://lichess.org/swiss/swissNp1",
	},
	viewer: null,
};

export const getChaalTournaments = fn(async (): Promise<ChaalTournaments> => tournaments).mockName(
	"getChaalTournaments",
);
export const getChaalArena = fn(async (): Promise<ChaalArenaPage> => arenaPlayed).mockName("getChaalArena");
export const getChaalSwiss = fn(async (): Promise<ChaalSwissPage> => swissPage).mockName("getChaalSwiss");
