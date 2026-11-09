import { fn } from "storybook/test";
import type { ChaalPuzzleProgress, ChaalPuzzleReplay } from "../../../../src/features/chaal/puzzles/schema";

// Stand-ins for src/functions/chaal/puzzle-attempts.ts: a player with a week of puzzles, connected to Lichess.
export const puzzleProgress: ChaalPuzzleProgress = {
	stats: {
		days: 30,
		nb: 24,
		won: 17,
		solvedRating: 1712,
		themes: [
			{ key: "fork", nb: 8, won: 7 },
			{ key: "middlegame", nb: 14, won: 10 },
			{ key: "pin", nb: 5, won: 2 },
			{ key: "endgame", nb: 6, won: 3 },
		],
		bestStreak: 12,
		recent: [
			{ id: "1", puzzleId: "xSeW5", won: true, rating: 1894, ratingDiff: 9, at: "2026-11-09T09:00:00.000Z" },
			{ id: "2", puzzleId: "1Uimg", won: false, rating: 1503, ratingDiff: -14, at: "2026-11-09T08:55:00.000Z" },
			{ id: "3", puzzleId: "0haqU", won: true, rating: 1650, ratingDiff: null, at: "2026-11-08T20:10:00.000Z" },
		],
	},
	pending: 2,
	lichess: {
		state: "ok",
		dashboard: {
			days: 30,
			nb: 120,
			firstWins: 78,
			performance: 1750,
			themes: [
				{ key: "middlegame", nb: 64, firstWins: 41, performance: 1760 },
				{ key: "fork", nb: 22, firstWins: 18, performance: 1840 },
				{ key: "pin", nb: 11, firstWins: 5, performance: 1580 },
			],
		},
	},
};

export const recordChaalPuzzleAttempt = fn(async (): Promise<void> => {}).mockName("recordChaalPuzzleAttempt");
export const importChaalPuzzleAttempts = fn(async (): Promise<{ imported: string[] }> => ({ imported: [] })).mockName(
	"importChaalPuzzleAttempts",
);
export const getChaalPuzzleProgress = fn(async (): Promise<ChaalPuzzleProgress> => puzzleProgress).mockName(
	"getChaalPuzzleProgress",
);
export const getChaalPuzzleReplay = fn(
	async (): Promise<ChaalPuzzleReplay> => ({ theme: "pin", remaining: ["xSeW5"] }),
).mockName("getChaalPuzzleReplay");
