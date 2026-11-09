import { createServerFn } from "@tanstack/react-start";
import {
	type ChaalPuzzle,
	type ChaalPuzzleBatch,
	puzzleBatchInput,
	puzzleIdInput,
} from "@/features/chaal/puzzles/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as puzzles from "@/server/chaal/puzzles/service";

/**
 * Puzzles for everyone (Task 80, decision 0269): the daily puzzle, one by its id, and the
 * next batch for training or the streak. Public: each starts with `withChaalPublic` and
 * checks the `puzzles` switch. A player connected with the puzzle scopes gets their own
 * batches (unseen puzzles at their rating, with their token); everyone else anyone's.
 */

export const getChaalDailyPuzzle = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<ChaalPuzzle> => puzzles.dailyPuzzle(context.chaal));

export const getChaalPuzzle = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(puzzleIdInput))
	.handler(({ context, data }): Promise<ChaalPuzzle> => puzzles.puzzleById(context.chaal, data.id));

export const getChaalPuzzleBatch = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(puzzleBatchInput))
	.handler(({ context, data }): Promise<ChaalPuzzleBatch> => puzzles.puzzleBatch(context.chaal, context.session, data));
