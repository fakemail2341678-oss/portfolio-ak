import { fn } from "storybook/test";
import type {
	ChaalCloudEval,
	ChaalExplorerResult,
	ChaalImportedGame,
	ChaalTablebase,
} from "../../../../src/features/chaal/schema";

// Stand-ins for src/functions/chaal/analysis.ts: shapes as the recordings give them (tests/fixtures/lichess).

const explorerAfterE4: ChaalExplorerResult = {
	ok: true,
	data: {
		database: "masters",
		opening: { eco: "B00", name: "King's Pawn Game" },
		white: 419_328,
		draws: 573_290,
		black: 316_848,
		moves: [
			{ uci: "c7c5", san: "c5", white: 188_770, draws: 257_675, black: 154_647, rating: 2401 },
			{ uci: "e7e5", san: "e5", white: 93_250, draws: 141_110, black: 63_903, rating: 2398 },
			{ uci: "e7e6", san: "e6", white: 46_120, draws: 62_811, black: 37_002, rating: 2390 },
			{ uci: "c7c6", san: "c6", white: 31_470, draws: 51_920, black: 24_331, rating: 2393 },
		],
		games: [
			{
				id: "OVBHNsSW",
				white: { name: "Carlsen, M.", rating: 2864 },
				black: { name: "Caruana, F.", rating: 2832 },
				winner: "white",
				year: 2018,
				uci: "c7c5",
			},
		],
		indexing: false,
	},
};

export const getChaalCloudEval = fn(async (): Promise<ChaalCloudEval | null> => null).mockName("getChaalCloudEval");
export const getChaalExplorer = fn(async (): Promise<ChaalExplorerResult> => explorerAfterE4).mockName(
	"getChaalExplorer",
);
export const getChaalTablebase = fn(
	async (): Promise<ChaalTablebase | null> => ({
		result: "win",
		dtz: 1,
		dtm: 17,
		checkmate: false,
		stalemate: false,
		insufficientMaterial: false,
		moves: [
			{ uci: "h7h8q", san: "h8=Q+", result: "win", dtz: 2, dtm: 16 },
			{ uci: "g7f6", san: "Kf6", result: "draw", dtz: 0, dtm: null },
		],
	}),
).mockName("getChaalTablebase");
export const importChaalGame = fn(
	async (): Promise<ChaalImportedGame> => ({ ok: false, reason: "not-found" }),
).mockName("importChaalGame");
