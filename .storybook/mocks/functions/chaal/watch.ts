import { fn } from "storybook/test";
import type { GamePlayerSummary } from "../../../../src/features/chaal/players/schema";
import type {
	BroadcastTourSummary,
	ChaalBroadcastGame,
	ChaalBroadcastRound,
	ChaalBroadcastSearch,
	ChaalBroadcasts,
	ChaalBroadcastTour,
	ChaalStreamer,
	ChaalTv,
} from "../../../../src/features/chaal/watch/schema";

// Stand-ins for src/functions/chaal/watch.ts: made-up players, a made-up tournament, as Chaal maps Lichess's answers.

const player = (name: string, rating: number, title: string | null = null): GamePlayerSummary => ({
	id: name.toLowerCase(),
	name,
	title,
	rating,
	ratingDiff: null,
	aiLevel: null,
});

const POSITIONS = [
	"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
	"r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2Q1RK1 w - - 4 10",
	"8/5pk1/6p1/8/3R4/6P1/5PKP/r7 w - - 0 40",
	"rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
] as const;

export const tv: ChaalTv = {
	games: [
		{
			channel: "best",
			id: "tvBest01",
			orientation: "white",
			white: player("North_Star", 3012, "GM"),
			black: player("Kathmandu_Knight", 2951, "IM"),
			fen: POSITIONS[1],
			lastMove: "c1d2",
			perf: "blitz",
			rated: true,
			clock: { initial: 180, increment: 2 },
		},
		{
			channel: "bullet",
			id: "tvBull01",
			orientation: "black",
			white: player("Pokhara64", 2740),
			black: player("Annapurna_Gambit", 2802, "FM"),
			fen: POSITIONS[2],
			lastMove: "a2a1",
			perf: "bullet",
			rated: true,
			clock: { initial: 60, increment: 0 },
		},
		{
			channel: "rapid",
			id: "tvRapi01",
			orientation: "white",
			white: player("Bagmati_Rook", 2410),
			black: player("Lalitpur_Ladder", 2388),
			fen: POSITIONS[0],
			lastMove: "f1c4",
			perf: "rapid",
			rated: true,
			clock: { initial: 600, increment: 5 },
		},
		{
			channel: "computer",
			id: "tvComp01",
			orientation: "white",
			white: player("Tansen_Tactics", 1820),
			black: { id: null, name: "?", title: null, rating: null, ratingDiff: null, aiLevel: 5 },
			fen: POSITIONS[3],
			lastMove: "g1f3",
			perf: "blitz",
			rated: false,
			clock: { initial: 300, increment: 3 },
		},
	],
};

export const streamers: ChaalStreamer[] = [
	{
		id: "kathmandu_knight",
		username: "Kathmandu_Knight",
		title: "IM",
		name: "Kathmandu Knight",
		status: "Blitz arenas and your questions",
		lang: "en",
		service: "twitch",
		url: "https://www.twitch.tv/example",
	},
	{
		id: "pokhara64",
		username: "Pokhara64",
		title: null,
		name: "Pokhara64",
		status: "Rapid games, explained move by move",
		lang: "ne",
		service: "youtube",
		url: "https://www.youtube.com/@example",
	},
];

const tour = (
	id: string,
	name: string,
	state: "ongoing" | "upcoming" | "finished",
	tier: number | null,
): BroadcastTourSummary => ({
	id,
	name,
	tier,
	dates: [Date.UTC(2026, 10, 8), Date.UTC(2026, 10, 16)],
	info: {
		format: "9-round Swiss",
		timeControl: "90 min + 30 s",
		location: "Kathmandu",
		players: null,
		website: null,
		standings: null,
	},
	round: {
		id: `${id.slice(0, 6)}R1`,
		name: state === "upcoming" ? "Round 1" : "Round 5",
		state,
		startsAt: Date.UTC(2026, 10, 12, 9),
		finishedAt: state === "finished" ? Date.UTC(2026, 10, 12, 15) : null,
	},
});

export const broadcasts: ChaalBroadcasts = {
	active: [
		tour("himalOpe", "Himalayan Open 2026", "ongoing", 4),
		tour("valleyCh", "Valley Championship", "ongoing", null),
	],
	upcoming: [tour("terailRa", "Terai Rapid", "upcoming", 3)],
	past: [tour("lakesCup", "Lakes Cup 2026", "finished", 3), tour("riverBli", "River Blitz", "finished", null)],
	page: 1,
	next: 2,
};

export const search: ChaalBroadcastSearch = {
	results: [tour("himalOpe", "Himalayan Open 2026", "ongoing", 4)],
	page: 1,
	next: null,
};

export const broadcastTour: ChaalBroadcastTour = {
	id: "himalOpe",
	name: "Himalayan Open 2026",
	tier: 4,
	dates: [Date.UTC(2026, 10, 8), Date.UTC(2026, 10, 16)],
	info: {
		format: "9-round Swiss",
		timeControl: "90 min + 30 s",
		location: "Kathmandu",
		players: null,
		website: "https://example.com/open",
		standings: "https://example.com/open/standings",
	},
	group: null,
	rounds: [
		{
			id: "himalR01",
			name: "Round 1",
			state: "finished",
			startsAt: Date.UTC(2026, 10, 8, 9),
			finishedAt: Date.UTC(2026, 10, 8, 15),
		},
		{ id: "himalR02", name: "Round 2", state: "ongoing", startsAt: Date.UTC(2026, 10, 9, 9), finishedAt: null },
		{ id: "himalR03", name: "Round 3", state: "upcoming", startsAt: Date.UTC(2026, 10, 10, 9), finishedAt: null },
	],
	defaultRound: "himalR02",
	url: "https://lichess.org/broadcast/himalayan-open-2026/himalOpe",
};

const side = (name: string, rating: number, clock: number | null, title: string | null = null) => ({
	name,
	title,
	rating,
	fed: "NEP",
	clock,
});

export const broadcastRound: ChaalBroadcastRound = {
	tour: { id: "himalOpe", name: "Himalayan Open 2026" },
	round: {
		id: "himalR02",
		name: "Round 2",
		state: "ongoing",
		startsAt: Date.UTC(2026, 10, 9, 9),
		finishedAt: null,
		url: "https://lichess.org/broadcast/himalayan-open-2026/round-2/himalR02",
	},
	boards: [
		{
			id: "board001",
			fen: POSITIONS[1],
			lastMove: "c1d2",
			result: "*",
			white: side("Shrestha, Anil", 2412, 3_120_000, "IM"),
			black: side("Gurung, Maya", 2290, 2_870_000, "WFM"),
		},
		{
			id: "board002",
			fen: POSITIONS[2],
			lastMove: "a2a1",
			result: "½-½",
			white: side("Thapa, Bikash", 2201, 640_000),
			black: side("Rai, Sunita", 2188, 412_000),
		},
		{
			id: "board003",
			fen: POSITIONS[0],
			lastMove: "f1c4",
			result: "1-0",
			white: side("Karki, Ramesh", 2150, 1_800_000),
			black: side("Magar, Deepa", 2099, 1_500_000),
		},
	],
};

export const broadcastGame: ChaalBroadcastGame = {
	round: "himalR02",
	board: "board001",
	pgn: `[Event "Himalayan Open 2026"]
[Site "https://lichess.org/broadcast/himalayan-open-2026/round-2/himalR02/board001"]
[White "Shrestha, Anil"]
[Black "Gurung, Maya"]
[Result "*"]
[GameURL "https://lichess.org/broadcast/himalayan-open-2026/round-2/himalR02/board001"]

1. d4 { [%eval 0.2] [%clk 1:30:12] } 1... d5 { [%eval 0.25] [%clk 1:30:20] } 2. c4 { [%eval 0.2] [%clk 1:29:40] } 2... e6 { [%eval 0.3] [%clk 1:29:01] } 3. Nc3 { [%eval 0.25] [%clk 1:28:55] } 3... Nf6 { [%eval 0.3] [%clk 1:27:30] } *
`,
};

export const getChaalTv = fn(async (): Promise<ChaalTv> => tv).mockName("getChaalTv");
export const getChaalStreamers = fn(async (): Promise<ChaalStreamer[]> => streamers).mockName("getChaalStreamers");
export const getChaalBroadcasts = fn(async (): Promise<ChaalBroadcasts> => broadcasts).mockName("getChaalBroadcasts");
export const getChaalOfficialBroadcasts = fn(
	async (): Promise<BroadcastTourSummary[]> => [...broadcasts.active, ...broadcasts.past].filter((each) => each.tier),
).mockName("getChaalOfficialBroadcasts");
export const searchChaalBroadcasts = fn(async (): Promise<ChaalBroadcastSearch> => search).mockName(
	"searchChaalBroadcasts",
);
export const getChaalBroadcastTour = fn(async (): Promise<ChaalBroadcastTour> => broadcastTour).mockName(
	"getChaalBroadcastTour",
);
export const getChaalBroadcastRound = fn(async (): Promise<ChaalBroadcastRound> => broadcastRound).mockName(
	"getChaalBroadcastRound",
);
export const getChaalBroadcastGame = fn(async (): Promise<ChaalBroadcastGame> => broadcastGame).mockName(
	"getChaalBroadcastGame",
);
