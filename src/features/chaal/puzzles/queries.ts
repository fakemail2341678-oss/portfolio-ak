import { type QueryClient, type QueryKey, queryOptions } from "@tanstack/react-query";
import {
	getChaalPuzzleProgress,
	getChaalPuzzleReplay,
	importChaalPuzzleAttempts,
	recordChaalPuzzleAttempt,
} from "@/functions/chaal/puzzle-attempts";
import { getChaalDailyPuzzle, getChaalPuzzle, getChaalPuzzleBatch } from "@/functions/chaal/puzzles";
import { ensureQuery, type LoaderQueryOptions } from "@/lib/query";
import { chaalKeys } from "../keys";
import type { PuzzlesSearch } from "../search";
import { isPuzzleAngle, type PuzzleAngle } from "./angles";
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

export const recordAttemptOnAccount = (attempt: PuzzleAttempt) => recordChaalPuzzleAttempt({ data: { attempt } });
export const importAttemptsToAccount = (attempts: PuzzleAttempt[]) => importChaalPuzzleAttempts({ data: { attempts } });

/** The theme a URL names, when Chaal knows it; else a mix. */
export const angleOf = (theme: string | undefined): PuzzleAngle => (theme && isPuzzleAngle(theme) ? theme : "mix");

/** Training's choice from the URL: the loader and the page ask for the same first batch. */
export const trainingInput = (search: PuzzlesSearch): Omit<PuzzleBatchInput, "round"> => ({
	angle: angleOf(search.theme),
	difficulty: search.difficulty,
	color: search.color,
	streak: false,
});

/** The streak's first batch: anyone's easiest puzzles. */
export const STREAK_FIRST: PuzzleBatchInput = { angle: "mix", difficulty: "easiest", streak: true, round: 0 };

/** Ensures a read for the first paint; a failed one is the page's to say. */
const ensureQuietly = <TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
) => ensureQuery(queryClient, options).catch(() => undefined);

/**
 * The puzzles page's loader (here, not in the route: a route's options are in every page's
 * JavaScript, 0151): a session's progress, and the mode's first puzzle or batch.
 */
export async function loadPuzzlesPage(queryClient: QueryClient, signedIn: boolean, search: PuzzlesSearch) {
	const reads: Promise<unknown>[] = [];
	if (signedIn) reads.push(ensureQuietly(queryClient, puzzleProgressQueryOptions()));
	if (search.mode === "train") {
		reads.push(ensureQuietly(queryClient, puzzleBatchQueryOptions({ ...trainingInput(search), round: 0 })));
	} else if (search.mode === "streak") {
		reads.push(ensureQuietly(queryClient, puzzleBatchQueryOptions(STREAK_FIRST)));
	} else if (search.mode === "replay") {
		if (signedIn) reads.push(ensureQuietly(queryClient, puzzleReplayQueryOptions(angleOf(search.theme))));
	} else reads.push(ensureQuietly(queryClient, dailyPuzzleQueryOptions()));
	await Promise.all(reads);
}

/** One puzzle's page: the puzzle, and a session's progress. */
export async function loadPuzzlePage(queryClient: QueryClient, signedIn: boolean, id: string) {
	await Promise.all([
		ensureQuietly(queryClient, puzzleQueryOptions(id)),
		signedIn ? ensureQuietly(queryClient, puzzleProgressQueryOptions()) : undefined,
	]);
}
