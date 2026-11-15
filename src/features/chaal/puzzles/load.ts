import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { ensureQuery, type LoaderQueryOptions } from "@/lib/query";
import type { PuzzlesSearch } from "../search";
import { STREAK_FIRST } from "./constants";
import { angleOf, trainingInput } from "./lib/training-input";
import {
	dailyPuzzleQueryOptions,
	puzzleBatchQueryOptions,
	puzzleProgressQueryOptions,
	puzzleQueryOptions,
	puzzleReplayQueryOptions,
} from "./queries";

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

/** Ensures a read for the first paint; a failed one is the page's to say. */
export const ensureQuietly = <TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
) => ensureQuery(queryClient, options).catch(() => undefined);
