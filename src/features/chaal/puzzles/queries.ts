import { queryOptions } from "@tanstack/react-query";
import {
	getChaalPuzzleProgress,
	getChaalPuzzleReplay,
	importChaalPuzzleAttempts,
	recordChaalPuzzleAttempt,
} from "@/functions/chaal/puzzle-attempts";
import { getChaalDailyPuzzle, getChaalPuzzle, getChaalPuzzleBatch } from "@/functions/chaal/puzzles";
import { chaalKeys } from "../keys";
import type { PuzzleAngle } from "./lib/angles";
import type { PuzzleAttempt, PuzzleBatchInput } from "./schema";

/**
 * Puzzles' reads (Task 80, decision 0269). The route's loader ensures what the first paint
 * shows (the daily puzzle, one by id, training's first batch, a session's progress); the
 * trainer asks for the next batches itself (use-queue.ts). A puzzle doesn't change while
 * the page is open, so they're kept for the visit.
 */

const FOR_THE_VISIT = { staleTime: Number.POSITIVE_INFINITY, gcTime: 30 * 60_000, retry: false } as const;

export const dailyPuzzleQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.dailyPuzzle(), queryFn: () => getChaalDailyPuzzle(), ...FOR_THE_VISIT });

export const puzzleQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.puzzle(id),
		queryFn: () => getChaalPuzzle({ data: { id } }),
		...FOR_THE_VISIT,
	});

export const puzzleBatchQueryOptions = (input: PuzzleBatchInput) =>
	queryOptions({
		queryKey: chaalKeys.puzzleBatch(input),
		queryFn: () => getChaalPuzzleBatch({ data: input }),
		...FOR_THE_VISIT,
	});

export const puzzleProgressQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.puzzleProgress(), queryFn: () => getChaalPuzzleProgress() });

export const puzzleReplayQueryOptions = (theme: PuzzleAngle) =>
	queryOptions({
		queryKey: chaalKeys.puzzleReplay(theme),
		queryFn: () => getChaalPuzzleReplay({ data: { theme } }),
		...FOR_THE_VISIT,
	});

export const chaalPuzzlesMutations = {
	recordAttempt: (attempt: PuzzleAttempt) => recordChaalPuzzleAttempt({ data: { attempt } }),
	importAttempts: (attempts: PuzzleAttempt[]) => importChaalPuzzleAttempts({ data: { attempts } }),
};
