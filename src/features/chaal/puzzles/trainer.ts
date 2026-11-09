import type { Square } from "chess.js";
import { type PlayedMove, play } from "../chess/rules";
import { type ChaalPuzzle, PUZZLE_DIFFICULTIES, type PuzzleDifficulty } from "./schema";

/**
 * The puzzle trainer's model (PLAN Task 80, decision 0269), pure: the page's hook
 * (use-trainer.ts) adds the timing. A puzzle opens one move early, the opponent's move
 * plays, and the player finds the solution's moves while the opponent's replies play
 * themselves. A wrong move shows, then goes back for another try; any mate wins (as on
 * Lichess). A miss, a hint or the solution makes the attempt a loss, though the puzzle
 * can still be finished.
 */

export type TrainerPhase =
	/** The position before the opponent's move. */
	| "intro"
	/** The player's move. */
	| "play"
	/** The opponent replies next. */
	| "reply"
	/** The player's wrong move is on the board, before it goes back. */
	| "wrong"
	/** The solution plays itself, a move at a time. */
	| "reveal"
	| "solved"
	| "failed";

export type TrainerMove = { uci: string; san: string };

export type Trainer = {
	puzzle: ChaalPuzzle;
	phase: TrainerPhase;
	fen: string;
	lastMove: TrainerMove | null;
	/** The next move of the solution. */
	step: number;
	/** The position of the player's turn, to go back to after a wrong move. */
	turn: { fen: string; lastMove: TrainerMove | null };
	/** The first help the player had, which makes the attempt a loss. */
	helped: "miss" | "hint" | "solution" | null;
	/** The square of the piece to move, after a hint. */
	hint: Square | null;
	/** The moves played from the puzzle's position (for "Analyse"). */
	moves: TrainerMove[];
};

export type Verdict = "right" | "solved" | "wrong" | "ignored";

export function startTrainer(puzzle: ChaalPuzzle): Trainer {
	return {
		puzzle,
		phase: "intro",
		fen: puzzle.before,
		lastMove: null,
		step: 0,
		turn: { fen: puzzle.fen, lastMove: puzzle.lastMove },
		helped: null,
		hint: null,
		moves: [],
	};
}

export const isDone = (trainer: Trainer) => trainer.phase === "solved" || trainer.phase === "failed";

/** Solved without a miss, a hint or the solution. */
export const isWon = (trainer: Trainer) => trainer.phase === "solved" && trainer.helped === null;

/** The opponent's move into the puzzle's position: the player's turn begins. */
export function showOpponentMove(trainer: Trainer): Trainer {
	if (trainer.phase !== "intro") return trainer;
	return { ...trainer, phase: "play", fen: trainer.puzzle.fen, lastMove: trainer.puzzle.lastMove };
}

const asMove = (move: PlayedMove): TrainerMove => ({ uci: move.uci, san: move.san });

/** The player's move: right (the reply follows), solved, or wrong. */
export function tryMove(trainer: Trainer, move: PlayedMove): { trainer: Trainer; verdict: Verdict } {
	if (trainer.phase !== "play") return { trainer, verdict: "ignored" };
	const expected = trainer.puzzle.solution[trainer.step];
	if (move.uci === expected || move.mate) {
		const step = trainer.step + 1;
		const solved = move.mate || step >= trainer.puzzle.solution.length;
		return {
			trainer: {
				...trainer,
				phase: solved ? "solved" : "reply",
				fen: move.fen,
				lastMove: asMove(move),
				step,
				hint: null,
				moves: [...trainer.moves, asMove(move)],
			},
			verdict: solved ? "solved" : "right",
		};
	}
	return {
		trainer: { ...trainer, phase: "wrong", fen: move.fen, lastMove: asMove(move), helped: trainer.helped ?? "miss" },
		verdict: "wrong",
	};
}

/** Plays the solution's next move on the board; null when the data doesn't fit the position. */
function playNext(trainer: Trainer): { fen: string; move: TrainerMove } | null {
	const uci = trainer.puzzle.solution[trainer.step];
	const played = uci ? play(trainer.fen, uci) : null;
	return played ? { fen: played.fen, move: asMove(played) } : null;
}

/** The opponent's reply, then the player's turn again. */
export function reply(trainer: Trainer): Trainer {
	if (trainer.phase !== "reply") return trainer;
	const next = playNext(trainer);
	if (!next) return { ...trainer, phase: "failed" };
	const step = trainer.step + 1;
	if (step >= trainer.puzzle.solution.length) {
		return {
			...trainer,
			phase: "solved",
			fen: next.fen,
			lastMove: next.move,
			step,
			moves: [...trainer.moves, next.move],
		};
	}
	return {
		...trainer,
		phase: "play",
		fen: next.fen,
		lastMove: next.move,
		step,
		turn: { fen: next.fen, lastMove: next.move },
		moves: [...trainer.moves, next.move],
	};
}

/** After a wrong move: back to the player's turn for another try. */
export function retry(trainer: Trainer): Trainer {
	if (trainer.phase !== "wrong") return trainer;
	return { ...trainer, phase: "play", fen: trainer.turn.fen, lastMove: trainer.turn.lastMove };
}

/** Shows which piece moves (the attempt is a loss from here). */
export function giveHint(trainer: Trainer): Trainer {
	if (trainer.phase !== "play") return trainer;
	const expected = trainer.puzzle.solution[trainer.step];
	if (!expected) return trainer;
	return { ...trainer, hint: expected.slice(0, 2) as Square, helped: trainer.helped ?? "hint" };
}

/** Starts showing the solution from the player's turn (a wrong move on the board goes back first). */
export function startReveal(trainer: Trainer): Trainer {
	if (isDone(trainer) || trainer.phase === "reveal") return trainer;
	const from = trainer.phase === "wrong" || trainer.phase === "intro" ? retry(showOpponentMove(trainer)) : trainer;
	return { ...from, phase: "reveal", hint: null, helped: from.helped ?? "solution" };
}

/** The solution's next move, while it shows; then the puzzle is over (failed). */
export function revealNext(trainer: Trainer): Trainer {
	if (trainer.phase !== "reveal") return trainer;
	const next = playNext(trainer);
	if (!next) return { ...trainer, phase: "failed" };
	const step = trainer.step + 1;
	return {
		...trainer,
		phase: step >= trainer.puzzle.solution.length ? "failed" : "reveal",
		fen: next.fen,
		lastMove: next.move,
		step,
		moves: [...trainer.moves, next.move],
	};
}

/** The streak's puzzles get harder every STREAK_TIER solved: easiest first, hardest from the 20th. */
export const STREAK_TIER = 5;

export function streakDifficulty(streak: number): PuzzleDifficulty {
	const index = Math.min(PUZZLE_DIFFICULTIES.length - 1, Math.floor(Math.max(0, streak) / STREAK_TIER));
	return PUZZLE_DIFFICULTIES[index] ?? "hardest";
}
