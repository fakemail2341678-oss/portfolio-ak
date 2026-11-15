/**
 * Puzzles' limits (PLAN Task 80, decision 0269), set by the admin in `ch_settings.puzzles`
 * on /admin/chaal/settings and sent to every page with the status. Stored values are read
 * through `readPuzzleLimits`, which clamps them.
 */
export type PuzzleLimits = {
	/** How many puzzles training keeps ready ahead of the one on the board (a batch of this many). */
	ahead: number;
	/** Whether the streak (our own: one miss ends it) is offered. */
	streak: boolean;
};

export const DEFAULT_PUZZLE_LIMITS: PuzzleLimits = { ahead: 15, streak: true };

/** Lichess's batch call takes 1–50; fewer than 5 would ask too often. */
export const PUZZLE_AHEAD_BOUNDS = { min: 5, max: 30 } as const;

export function readPuzzleLimits(value: Partial<PuzzleLimits> | null | undefined): PuzzleLimits {
	const ahead = value?.ahead;
	return {
		ahead:
			typeof ahead === "number" && Number.isFinite(ahead)
				? Math.min(PUZZLE_AHEAD_BOUNDS.max, Math.max(PUZZLE_AHEAD_BOUNDS.min, Math.round(ahead)))
				: DEFAULT_PUZZLE_LIMITS.ahead,
		streak: typeof value?.streak === "boolean" ? value.streak : DEFAULT_PUZZLE_LIMITS.streak,
	};
}
