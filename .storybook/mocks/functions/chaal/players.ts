import { fn } from "storybook/test";
import type {
	ActivityDay,
	ChaalGameSummary,
	ChaalLeaderboard,
	ChaalPerfStats,
	ChaalPlayerGames,
	ChaalPlayerPage,
	ChaalReplay,
	PlayerSuggestion,
	RatingSeries,
} from "../../../../src/features/chaal/players/schema";

// Stand-ins for src/functions/chaal/players.ts: a made-up player and a short game, as Chaal maps Lichess's answers.
export const leaderboard: ChaalLeaderboard = {
	perf: "blitz",
	players: [
		{ id: "north_star", username: "North_Star", title: "GM", online: true, rating: 3012, progress: 14 },
		{ id: "kathmandu_knight", username: "Kathmandu_Knight", title: "IM", online: false, rating: 2951, progress: -6 },
		{ id: "pokhara64", username: "Pokhara64", title: null, online: true, rating: 2903, progress: 0 },
	],
};

export const playerPage: ChaalPlayerPage = {
	player: {
		id: "kathmandu_knight",
		username: "Kathmandu_Knight",
		title: "IM",
		closed: false,
		online: true,
		playingId: null,
		createdAt: Date.UTC(2019, 2, 4),
		seenAt: Date.UTC(2026, 10, 9, 8),
		playSeconds: 3_600_000,
		profile: {
			flag: "NP",
			location: "Kathmandu",
			realName: null,
			bio: "Blitz most evenings. Rapid at weekends.",
			fideRating: 2310,
			links: ["example.com/chess"],
		},
		count: { all: 4210, rated: 4012, win: 2203, loss: 1650, draw: 357 },
		ratings: [
			{ perf: "bullet", rating: 2804, games: 1200, progress: 12, provisional: false },
			{ perf: "blitz", rating: 2951, games: 2400, progress: -6, provisional: false },
			{ perf: "rapid", rating: 2640, games: 410, progress: 3, provisional: false },
			{ perf: "classical", rating: 2420, games: 12, progress: 0, provisional: true },
		],
		puzzle: { rating: 2650, games: 3100 },
	},
	viewer: {
		lichessId: "e2e_player",
		username: "E2E_Player",
		following: false,
		crosstable: { you: 2.5, them: 5.5, games: 8 },
	},
};

export const ratingHistory: RatingSeries[] = [
	{
		perf: "blitz",
		points: [
			["2026-05-01", 2860],
			["2026-06-01", 2895],
			["2026-07-01", 2920],
			["2026-08-01", 2901],
			["2026-09-01", 2944],
			["2026-10-01", 2957],
			["2026-11-01", 2951],
		],
	},
];

export const perfStats: ChaalPerfStats = {
	perf: "blitz",
	rating: 2951,
	deviation: 45,
	provisional: false,
	games: 2400,
	progress: -6,
	rank: 12,
	percentile: 99.9,
	highest: { rating: 2988, at: "2026-10-12T10:00:00.000Z", gameId: "aBcD1234" },
	lowest: { rating: 1830, at: "2019-03-10T10:00:00.000Z", gameId: null },
	count: { all: 2400, rated: 2380, win: 1300, loss: 900, draw: 200, tournament: 640, berserk: 30 },
	opponentAverage: 2711,
	streak: { win: 2, winBest: 19, loss: 0, lossBest: 7 },
	bestWins: [{ name: "North_Star", rating: 3021, at: "2026-09-02T10:00:00.000Z", gameId: "aBcD1234" }],
	worstLosses: [],
};

export const activity: ActivityDay[] = [
	{
		start: Date.UTC(2026, 10, 8),
		games: [{ perf: "blitz", win: 5, loss: 2, draw: 1, before: 2940, after: 2951 }],
		puzzles: { win: 12, loss: 3, before: 2640, after: 2650 },
		tournaments: 1,
		followers: 4,
		correspondenceMoves: 0,
	},
];

const summary = (id: string, winner: "white" | "black" | null): ChaalGameSummary => ({
	id,
	rated: true,
	perf: "blitz",
	standard: true,
	ongoing: false,
	status: winner ? "resign" : "draw",
	winner,
	createdAt: Date.UTC(2026, 10, 8, 18),
	lastMoveAt: Date.UTC(2026, 10, 8, 18, 9),
	white: {
		id: "kathmandu_knight",
		name: "Kathmandu_Knight",
		title: "IM",
		rating: 2951,
		ratingDiff: winner === "white" ? 5 : -5,
		aiLevel: null,
	},
	black: {
		id: "pokhara64",
		name: "Pokhara64",
		title: null,
		rating: 2903,
		ratingDiff: winner === "black" ? 5 : -5,
		aiLevel: null,
	},
	opening: { eco: "C50", name: "Italian Game" },
	clock: { initial: 180, increment: 2 },
	daysPerTurn: null,
	plies: 64,
	lastFen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 7",
	lastMove: "e8g8",
});

export const playerGames: ChaalPlayerGames = {
	games: [summary("gAme0001", "white"), summary("gAme0002", "black"), summary("gAme0003", null)],
	next: Date.UTC(2026, 10, 1),
};

export const replay: ChaalReplay = {
	id: "gAme0001",
	rated: true,
	perf: "blitz",
	standard: true,
	ongoing: false,
	status: "mate",
	winner: "white",
	createdAt: Date.UTC(2026, 10, 8, 18),
	lastMoveAt: Date.UTC(2026, 10, 8, 18, 4),
	initialFen: null,
	clock: { initial: 180, increment: 2 },
	daysPerTurn: null,
	white: {
		id: "kathmandu_knight",
		name: "Kathmandu_Knight",
		title: "IM",
		rating: 2951,
		ratingDiff: 5,
		aiLevel: null,
		analysis: { inaccuracy: 0, mistake: 0, blunder: 0, acpl: 12, accuracy: 96 },
	},
	black: {
		id: "pokhara64",
		name: "Pokhara64",
		title: null,
		rating: 2903,
		ratingDiff: -5,
		aiLevel: null,
		analysis: { inaccuracy: 1, mistake: 1, blunder: 1, acpl: 160, accuracy: 41 },
	},
	opening: { eco: "C20", name: "King's Pawn Game: Napoleon Attack" },
	moves: ["e4", "e5", "Qf3", "Nc6", "Bc4", "Nd4", "Qxf7#"],
	clocks: [18000, 17950, 17800, 17600, 17500, 16900, 17300],
	analysis: [
		{ eval: { cp: 30 }, judgement: null, best: null },
		{ eval: { cp: 25 }, judgement: null, best: null },
		{ eval: { cp: -40 }, judgement: "inaccuracy", best: "g1f3" },
		{ eval: { cp: -30 }, judgement: null, best: null },
		{ eval: { cp: 20 }, judgement: null, best: null },
		{ eval: { mate: 1 }, judgement: "blunder", best: "g8f6" },
		{ eval: null, judgement: null, best: null },
	],
	pgn: '[Event "Rated blitz game"]\n[White "Kathmandu_Knight"]\n[Black "Pokhara64"]\n[Result "1-0"]\n\n1. e4 e5 2. Qf3 Nc6 3. Bc4 Nd4 4. Qxf7# 1-0\n',
};

export const suggestions: PlayerSuggestion[] = [
	{ id: "kathmandu_knight", username: "Kathmandu_Knight", title: "IM", online: true },
];

export const getChaalLeaderboard = fn(async (): Promise<ChaalLeaderboard> => leaderboard).mockName(
	"getChaalLeaderboard",
);
export const getChaalPlayer = fn(async (): Promise<ChaalPlayerPage> => playerPage).mockName("getChaalPlayer");
export const getChaalRatingHistory = fn(async (): Promise<RatingSeries[]> => ratingHistory).mockName(
	"getChaalRatingHistory",
);
export const getChaalPerfStats = fn(async (): Promise<ChaalPerfStats | null> => perfStats).mockName(
	"getChaalPerfStats",
);
export const getChaalActivity = fn(async (): Promise<ActivityDay[]> => activity).mockName("getChaalActivity");
export const getChaalPlayerGames = fn(async (): Promise<ChaalPlayerGames> => playerGames).mockName(
	"getChaalPlayerGames",
);
export const searchChaalPlayers = fn(async (): Promise<PlayerSuggestion[]> => suggestions).mockName(
	"searchChaalPlayers",
);
export const getChaalReplay = fn(async (): Promise<ChaalReplay | null> => replay).mockName("getChaalReplay");
