import { fn } from "storybook/test";
import type { ChaalPuzzle, ChaalPuzzleBatch } from "../../../../src/features/chaal/puzzles/schema";

// Stand-ins for src/functions/chaal/puzzles.ts: the recorded daily puzzle (tests/fixtures/lichess), as Chaal maps it.
export const dailyPuzzle: ChaalPuzzle = {
	id: "xSeW5",
	rating: 1894,
	plays: 36_117,
	themes: ["middlegame", "advantage", "short", "skewer"],
	before: "r3r1k1/ppp2p2/3p1Pp1/4q2p/2PbP2Q/8/PP1B2PP/R4R1K b - - 3 19",
	lastMove: { uci: "e5e4", san: "Qxe4" },
	fen: "r3r1k1/ppp2p2/3p1Pp1/7p/2Pbq2Q/8/PP1B2PP/R4R1K w - - 0 20",
	color: "white",
	solution: ["f1f4", "e4c2", "f4d4"],
	game: {
		id: "T8myeL3d",
		perf: "rapid",
		clock: "10+0",
		white: { name: "KangHeri", title: null, rating: 2005 },
		black: { name: "mnel84", title: null, rating: 1958 },
	},
};

export const getChaalDailyPuzzle = fn(async (): Promise<ChaalPuzzle> => dailyPuzzle).mockName("getChaalDailyPuzzle");
export const getChaalPuzzle = fn(async (): Promise<ChaalPuzzle> => dailyPuzzle).mockName("getChaalPuzzle");
export const getChaalPuzzleBatch = fn(
	async (): Promise<ChaalPuzzleBatch> => ({ puzzles: [dailyPuzzle], source: "public", glicko: null }),
).mockName("getChaalPuzzleBatch");
