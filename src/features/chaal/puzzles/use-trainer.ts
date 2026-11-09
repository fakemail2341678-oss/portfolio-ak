import { useEffect, useRef, useState } from "react";
import { playSound } from "../board/sounds";
import type { PlayedMove } from "../chess/rules";
import type { ChaalPuzzle } from "./schema";
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
	type Trainer,
	tryMove,
} from "./trainer";

/** How long each step waits: the opponent's first move, a reply, a wrong move on the board, a solution move. */
export const TRAINER_DELAYS = { intro: 600, reply: 450, wrong: 800, reveal: 650 } as const;

export type TrainerResult = { won: boolean; ms: number };

/**
 * The trainer on a page (PLAN Task 80, decision 0269): the model (trainer.ts) with its
 * timing. The opponent's move plays a moment after the puzzle opens, replies follow the
 * player's right moves, a wrong move goes back for another try (in the streak, it ends the
 * puzzle and the solution shows), and the solution plays a move at a time. `onResult` is
 * called once: at the first miss, hint or solution (a loss), or when it's solved cleanly.
 * Render it under a `key` of the puzzle's id, so a new puzzle starts afresh.
 */
export function usePuzzleTrainer({
	puzzle,
	streak = false,
	volume = 0,
	onResult,
}: {
	puzzle: ChaalPuzzle;
	streak?: boolean;
	/** The sounds' volume (0 for none). */
	volume?: number;
	onResult: (result: TrainerResult) => void;
}) {
	const [trainer, setTrainer] = useState<Trainer>(() => startTrainer(puzzle));
	const started = useRef<number | null>(null);
	const reported = useRef(false);
	const report = useRef(onResult);
	useEffect(() => {
		report.current = onResult;
	});

	const { phase } = trainer;
	// One timer per phase and move: the solution stays in "reveal" from one move to the next.
	const beat = `${phase}:${trainer.step}`;
	useEffect(() => {
		const now = beat.split(":")[0] as Trainer["phase"];
		const after = (ms: number, next: (current: Trainer) => Trainer) => {
			const timer = window.setTimeout(() => setTrainer(next), ms);
			return () => window.clearTimeout(timer);
		};
		if (now === "intro") return after(TRAINER_DELAYS.intro, showOpponentMove);
		if (now === "reply") return after(TRAINER_DELAYS.reply, reply);
		if (now === "wrong") return after(TRAINER_DELAYS.wrong, streak ? startReveal : retry);
		if (now === "reveal") return after(TRAINER_DELAYS.reveal, revealNext);
		return undefined;
	}, [beat, streak]);

	// The clock starts on the player's first turn.
	useEffect(() => {
		if (phase === "play" && started.current === null) started.current = performance.now();
	}, [phase]);

	// One result per puzzle: the first help makes it a loss; a clean solve a win.
	useEffect(() => {
		if (reported.current) return;
		const lost = trainer.helped !== null;
		const won = isWon(trainer);
		if (!lost && !won) return;
		reported.current = true;
		const ms = started.current === null ? 0 : Math.round(performance.now() - started.current);
		report.current({ won, ms });
	}, [trainer]);

	const move = (played: PlayedMove) => {
		const next = tryMove(trainer, played);
		if (next.verdict === "ignored") return;
		setTrainer(next.trainer);
		if (next.verdict === "wrong") playSound("wrong", volume);
		else if (next.verdict === "solved") playSound("correct", volume);
	};

	return {
		trainer,
		done: isDone(trainer),
		won: isWon(trainer),
		move,
		hint: () => setTrainer(giveHint),
		reveal: () => setTrainer(startReveal),
	};
}
