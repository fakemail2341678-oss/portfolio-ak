import { describe, expect, it } from "vitest";
import { play } from "@/features/chaal/chess/rules";
import { isPuzzleAngle, PUZZLE_ANGLES } from "@/features/chaal/puzzles/angles";
import { readPuzzleLimits } from "@/features/chaal/puzzles/limits";
import { progressOf, weakestThemes } from "@/features/chaal/puzzles/progress";
import type { ChaalPuzzle } from "@/features/chaal/puzzles/schema";
import { THEME_NAMES } from "@/features/chaal/puzzles/themes";
import {
	giveHint,
	isDone,
	isWon,
	reply,
	retry,
	revealNext,
	showOpponentMove,
	startReveal,
	startTrainer,
	streakDifficulty,
	type Trainer,
	tryMove,
} from "@/features/chaal/puzzles/trainer";
import {
	puzzleAnswer,
	puzzleBatchAnswer,
	puzzleDashboardAnswer,
	puzzleSolveAnswer,
} from "@/server/chaal/lichess/schemas";
import { readLichessFixture } from "../../e2e/harness/lichess";

/**
 * Puzzles (PLAN Task 80, decision 0269): Lichess's answers mapped (the PGN replayed to the
 * puzzle's position), the trainer's model, the progress panel's figures, the themes' names
 * and the admin's limits.
 */

const fixture = (name: string): unknown => JSON.parse(readLichessFixture(name) ?? "null");
const daily = (): ChaalPuzzle => puzzleAnswer.parse(fixture("api_puzzle_daily.json"));

/** Plays a UCI move on the trainer's board, as the board hands it over. */
const move = (trainer: Trainer, uci: string) => {
	const played = play(trainer.fen, uci);
	if (!played) throw new Error(`${uci} isn't legal`);
	return tryMove(trainer, played);
};

describe("Lichess's puzzle answers", () => {
	it("replays the game to the position before the opponent's move, and that move", () => {
		const recorded = fixture("api_puzzle_daily.json") as { puzzle: { id: string; fen: string; solution: string[] } };
		const puzzle = daily();
		expect(puzzle.id).toBe(recorded.puzzle.id);
		// Lichess's own FEN (when it sends one) has the same placement and side to move.
		expect(puzzle.fen.split(" ").slice(0, 2)).toEqual(recorded.puzzle.fen.split(" ").slice(0, 2));
		expect(play(puzzle.before, puzzle.lastMove.uci)?.fen).toBe(puzzle.fen);
		expect(puzzle.solution).toEqual(recorded.puzzle.solution);
		expect(puzzle.color).toBe("white");
		expect(puzzle.game.white.name).toBeTruthy();
	});

	it("maps every puzzle of a recorded batch, and drops one that doesn't replay", () => {
		const recorded = fixture("api_puzzle_batch_mix.ee86ce24.json") as { puzzles: Array<Record<string, unknown>> };
		expect(puzzleBatchAnswer.parse(recorded).puzzles).toHaveLength(recorded.puzzles.length);
		const broken = structuredClone(recorded.puzzles[0]) as { puzzle: { solution: string[] } };
		broken.puzzle.solution = ["a1a8"];
		const batch = puzzleBatchAnswer.parse({ puzzles: [broken, recorded.puzzles[1]], glicko: { rating: 1815.86 } });
		expect(batch.puzzles).toHaveLength(1);
		expect(batch.glicko).toEqual({ rating: 1816, provisional: false });
	});

	it("reads the solutions' answer and the dashboard", () => {
		const solved = puzzleSolveAnswer.parse({ rounds: [{ id: "0haqU", win: true, ratingDiff: 7 }] });
		expect(solved).toEqual({ puzzles: [], glicko: null, rounds: [{ id: "0haqU", ratingDiff: 7 }] });
		const dashboard = puzzleDashboardAnswer.parse({
			days: 30,
			global: { nb: 11, firstWins: 6, replayWins: 0, puzzleRatingAvg: 1564, performance: 1609 },
			themes: {
				fork: { theme: "Fork", results: { nb: 3, firstWins: 1, performance: 1444 } },
				middlegame: { theme: "Middlegame", results: { nb: 9, firstWins: 5, performance: 1690 } },
			},
		});
		expect(dashboard.nb).toBe(11);
		expect(dashboard.themes.map((theme) => theme.key)).toEqual(["middlegame", "fork"]);
	});
});

describe("the trainer", () => {
	it("opens one move early, then the player solves while the replies play", () => {
		const puzzle = daily();
		let trainer = startTrainer(puzzle);
		expect(trainer.phase).toBe("intro");
		expect(trainer.fen).toBe(puzzle.before);
		trainer = showOpponentMove(trainer);
		expect(trainer).toMatchObject({ phase: "play", fen: puzzle.fen, lastMove: puzzle.lastMove });
		const first = move(trainer, puzzle.solution[0] ?? "");
		expect(first.verdict).toBe("right");
		trainer = reply(first.trainer);
		expect(trainer.phase).toBe("play");
		expect(trainer.lastMove?.uci).toBe(puzzle.solution[1]);
		const last = move(trainer, puzzle.solution[2] ?? "");
		expect(last.verdict).toBe("solved");
		expect(isDone(last.trainer)).toBe(true);
		expect(isWon(last.trainer)).toBe(true);
		expect(last.trainer.moves.map((entry) => entry.uci)).toEqual(puzzle.solution);
	});

	it("shows a wrong move, then goes back for another try; the attempt is a loss", () => {
		const puzzle = daily();
		const trainer = showOpponentMove(startTrainer(puzzle));
		const wrong = move(trainer, "h4h5");
		expect(wrong.verdict).toBe("wrong");
		expect(wrong.trainer.phase).toBe("wrong");
		expect(wrong.trainer.helped).toBe("miss");
		const again = retry(wrong.trainer);
		expect(again).toMatchObject({ phase: "play", fen: puzzle.fen });
		const right = move(again, puzzle.solution[0] ?? "");
		const done = move(reply(right.trainer), puzzle.solution[2] ?? "");
		expect(done.trainer.phase).toBe("solved");
		expect(isWon(done.trainer)).toBe(false);
	});

	it("takes any checkmate, as Lichess does", () => {
		// White mates in one two ways: Qa8# (the solution) or Qg7#.
		const fen = "6k1/8/6K1/8/8/8/8/Q7 w - - 0 1";
		const puzzle: ChaalPuzzle = { ...daily(), before: fen, fen, solution: ["a1a8"], color: "white" };
		const result = move(showOpponentMove(startTrainer(puzzle)), "a1g7");
		expect(result.verdict).toBe("solved");
		expect(isWon(result.trainer)).toBe(true);
	});

	it("a hint shows the piece and counts as help; the solution plays out to the end", () => {
		const puzzle = daily();
		const hinted = giveHint(showOpponentMove(startTrainer(puzzle)));
		expect(hinted.hint).toBe(puzzle.solution[0]?.slice(0, 2));
		expect(hinted.helped).toBe("hint");
		let shown = startReveal(hinted);
		expect(shown.phase).toBe("reveal");
		for (let step = 0; step < puzzle.solution.length; step++) shown = revealNext(shown);
		expect(shown.phase).toBe("failed");
		expect(shown.moves.map((entry) => entry.uci)).toEqual(puzzle.solution);
		expect(isWon(shown)).toBe(false);
	});

	it("the streak gets harder every five solved", () => {
		expect([0, 4, 5, 9, 10, 15, 20, 99].map(streakDifficulty)).toEqual([
			"easiest",
			"easiest",
			"easier",
			"easier",
			"normal",
			"harder",
			"hardest",
			"hardest",
		]);
	});
});

describe("the progress panel", () => {
	const at = (daysAgo: number) => new Date(Date.UTC(2026, 10, 9) - daysAgo * 86_400_000).toISOString();
	const NOW = Date.UTC(2026, 10, 9);
	const attempt = (won: boolean, themes: string[], daysAgo: number, streak: number | null = null) => ({
		id: crypto.randomUUID(),
		puzzleId: "abcde",
		won,
		rating: won ? 1600 : 1400,
		themes,
		streak,
		at: at(daysAgo),
	});

	it("counts the last 30 days, the best streak ever, and themes Chaal names", () => {
		const stats = progressOf(
			[
				attempt(true, ["fork", "newTheme"], 1),
				attempt(false, ["fork"], 2),
				attempt(false, ["fork", "pin"], 3),
				attempt(true, ["pin"], 40, 14),
			],
			NOW,
		);
		expect(stats).toMatchObject({ nb: 3, won: 1, solvedRating: 1600, bestStreak: 14 });
		expect(stats.themes).toEqual([
			{ key: "fork", nb: 3, won: 1 },
			{ key: "pin", nb: 1, won: 0 },
		]);
		expect(stats.recent[0]?.at).toBe(at(1));
		expect(weakestThemes(stats).map((theme) => theme.key)).toEqual(["fork"]);
	});

	it("is empty without attempts", () => {
		expect(progressOf([], NOW)).toMatchObject({ nb: 0, won: 0, solvedRating: null, bestStreak: 0, themes: [] });
	});
});

describe("themes and limits", () => {
	it("every theme Chaal offers has a name in both languages", () => {
		expect(PUZZLE_ANGLES[0]).toBe("mix");
		expect(new Set(PUZZLE_ANGLES).size).toBe(PUZZLE_ANGLES.length);
		for (const angle of PUZZLE_ANGLES) expect(THEME_NAMES[angle]()).toBeTruthy();
		expect(isPuzzleAngle("fork")).toBe(true);
		expect(isPuzzleAngle("playerGames")).toBe(false);
	});

	it("the admin's limits are clamped", () => {
		expect(readPuzzleLimits(null)).toEqual({ ahead: 15, streak: true });
		expect(readPuzzleLimits({ ahead: 200, streak: false })).toEqual({ ahead: 30, streak: false });
		expect(readPuzzleLimits({ ahead: 1 })).toEqual({ ahead: 5, streak: true });
	});
});
