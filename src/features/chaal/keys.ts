import type { ChaalBlockListInput, ChaalConnectionListInput, ChaalHealthRange } from "./admin/search";

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
	/** Online play (Task 77): the player's challenges, a game they play, its chat. */
	challenges: () => [...all, "challenges"] as const,
	liveGame: (id: string) => [...all, "live-game", id] as const,
	chat: (id: string) => [...all, "live-game", id, "chat"] as const,
};
