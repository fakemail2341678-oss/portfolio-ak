import { createServerFn } from "@tanstack/react-start";
import {
	type ChaalPuzzleProgress,
	type ChaalPuzzleReplay,
	importPuzzleAttemptsInput,
	type PuzzleAttempt,
	puzzleReplayInput,
	recordPuzzleAttemptInput,
} from "@/features/chaal/puzzles/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as puzzles from "@/server/chaal/puzzles/service";

/**
 * A player's puzzles (Task 80, decision 0269): recording a finished one, importing this
 * browser's when a session starts, the progress panel (with Lichess's dashboard when
 * connected), and Lichess's misses to replay. Anyone with a session, guests included;
 * each acts on the caller's own attempts and token only (tests/server/chaal-access.test.ts).
 */

export const recordChaalPuzzleAttempt = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(recordPuzzleAttemptInput))
	.handler(
		({ context, data }): Promise<void> =>
			puzzles.recordAttempt(context, context.user.id, data.attempt as PuzzleAttempt),
	);

export const importChaalPuzzleAttempts = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(importPuzzleAttemptsInput))
	.handler(
		({ context, data }): Promise<{ imported: string[] }> =>
			puzzles.importAttempts(context, context.user.id, data.attempts as PuzzleAttempt[]),
	);

export const getChaalPuzzleProgress = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalPuzzleProgress> => puzzles.progress(context, context.user.id));

export const getChaalPuzzleReplay = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(puzzleReplayInput))
	.handler(({ context, data }): Promise<ChaalPuzzleReplay> => puzzles.replay(context, context.user.id, data.theme));
