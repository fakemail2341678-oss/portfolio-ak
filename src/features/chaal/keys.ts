import type {
	ChaalBlockListInput,
	ChaalConnectionListInput,
	ChaalHealthRange,
	ChaalOverviewRange,
} from "./admin/search";

/** Chaal's reads, under one root so a write can refresh what it touched. */
const all = ["chaal"] as const;

export const chaalKeys = {
	all,
	status: () => [...all, "status"] as const,
	connection: () => [...all, "connection"] as const,
	preferences: () => [...all, "preferences"] as const,
	lab: () => [...all, "admin", "lab"] as const,
	/** The admin's pages (Task 79). */
	admin: () => [...all, "admin"] as const,
	adminSettings: () => [...all, "admin", "settings"] as const,
	adminConnections: () => [...all, "admin", "connections"] as const,
	adminConnectionList: (input: ChaalConnectionListInput) => [...all, "admin", "connections", input] as const,
	adminBlocks: () => [...all, "admin", "blocks"] as const,
	adminBlockList: (input: ChaalBlockListInput) => [...all, "admin", "blocks", input] as const,
	adminHealth: (range: ChaalHealthRange) => [...all, "admin", "health", range] as const,
	/** The overview and curation (Task 84). */
	adminOverview: (range: ChaalOverviewRange) => [...all, "admin", "overview", range] as const,
	adminCuration: () => [...all, "admin", "curation"] as const,
	/** The home's curated sections (Task 84). */
	home: () => [...all, "home"] as const,
	/** Lichess's analysis data, by position (Task 75). */
	cloudEval: (fen: string, multiPv: number) => [...all, "cloud-eval", fen, multiPv] as const,
	explorer: (query: Readonly<Record<string, unknown>>) => [...all, "explorer", query] as const,
	tablebase: (fen: string) => [...all, "tablebase", fen] as const,
	/** "My analyses" (Task 75). */
	analyses: () => [...all, "analyses"] as const,
	analysis: (id: string) => [...all, "analyses", id] as const,
	/** Local games on the account (Task 76). */
	localGames: () => [...all, "local-games"] as const,
	localGame: (id: string) => [...all, "local-games", id] as const,
	/** Puzzles (Task 80): the daily one, one by id, a batch, the progress panel, misses to replay. */
	dailyPuzzle: () => [...all, "puzzles", "daily"] as const,
	puzzle: (id: string) => [...all, "puzzles", "id", id] as const,
	puzzleBatch: (input: Readonly<Record<string, unknown>>) => [...all, "puzzles", "batch", input] as const,
	puzzleProgress: () => [...all, "puzzles", "progress"] as const,
	puzzleReplay: (theme: string) => [...all, "puzzles", "replay", theme] as const,
	/** Players and games (Task 81). */
	leaderboard: (perf: string) => [...all, "players", "top", perf] as const,
	player: (username: string) => [...all, "players", "user", username.toLowerCase()] as const,
	ratingHistory: (username: string) => [...all, "players", "user", username.toLowerCase(), "history"] as const,
	perfStats: (username: string, perf: string) =>
		[...all, "players", "user", username.toLowerCase(), "perf", perf] as const,
	activity: (username: string) => [...all, "players", "user", username.toLowerCase(), "activity"] as const,
	playerGames: (input: Readonly<Record<string, unknown>>) => [...all, "players", "games", input] as const,
	playerSearch: (term: string) => [...all, "players", "search", term.toLowerCase()] as const,
	following: () => [...all, "players", "following"] as const,
	replay: (id: string) => [...all, "replay", id] as const,
	/** Watch (Task 82): the TV, the streamers, the broadcasts' lists, a broadcast, a round, a board. */
	tv: () => [...all, "watch", "tv"] as const,
	streamers: () => [...all, "watch", "streamers"] as const,
	broadcasts: (page: number) => [...all, "watch", "broadcasts", "top", page] as const,
	officialBroadcasts: () => [...all, "watch", "broadcasts", "official"] as const,
	broadcastSearch: (q: string, page: number) =>
		[...all, "watch", "broadcasts", "search", q.trim().toLowerCase(), page] as const,
	broadcastTour: (id: string) => [...all, "watch", "broadcast", id] as const,
	broadcastRound: (id: string) => [...all, "watch", "round", id] as const,
	broadcastGame: (round: string, board: string) => [...all, "watch", "round", round, "board", board] as const,
	/** Community (Task 83): tournaments, teams, studies, and the player's own. */
	tournaments: () => [...all, "community", "tournaments"] as const,
	arena: (id: string, page: number) => [...all, "community", "arena", id, page] as const,
	arenaAll: (id: string) => [...all, "community", "arena", id] as const,
	swiss: (id: string) => [...all, "community", "swiss", id] as const,
	teams: (page: number) => [...all, "community", "teams", "popular", page] as const,
	teamSearch: (q: string, page: number) =>
		[...all, "community", "teams", "search", q.trim().toLowerCase(), page] as const,
	team: (id: string) => [...all, "community", "team", id] as const,
	myTeams: () => [...all, "community", "teams", "mine"] as const,
	studiesBy: (username: string) => [...all, "community", "studies", "by", username.toLowerCase()] as const,
	myStudies: () => [...all, "community", "studies", "mine"] as const,
	study: (id: string) => [...all, "community", "study", id] as const,
	studyChapter: (id: string, chapter: string) => [...all, "community", "study", id, "chapter", chapter] as const,
	/** Online play (Task 77): the player's challenges, a game they play, its chat. */
	challenges: () => [...all, "challenges"] as const,
	liveGame: (id: string) => [...all, "live-game", id] as const,
	chat: (id: string) => [...all, "live-game", id, "chat"] as const,
};
