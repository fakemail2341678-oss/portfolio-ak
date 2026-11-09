import { isPuzzleAngle } from "./angles";
import { PROGRESS_DAYS, type PuzzleAttempt, type PuzzleStats } from "./schema";

/**
 * The progress panel's figures (PLAN Task 80, "a local dashboard"; decision 0269), from a
 * player's attempts: the server's rows or this browser's. Pure, so both draw the same thing.
 */

const DAY = 24 * 60 * 60_000;
const RECENT = 10;

export type AttemptLike = Pick<PuzzleAttempt, "id" | "puzzleId" | "won" | "rating" | "themes" | "streak" | "at"> & {
	ratingDiff?: number | null;
};

export function progressOf(attempts: ReadonlyArray<AttemptLike>, now: number, days = PROGRESS_DAYS): PuzzleStats {
	const since = now - days * DAY;
	const inRange = attempts.filter((attempt) => Date.parse(attempt.at) >= since);
	const solved = inRange.filter((attempt) => attempt.won);
	const themes = new Map<string, { nb: number; won: number }>();
	for (const attempt of inRange) {
		for (const key of attempt.themes) {
			// Only the themes Chaal has a name for are shown.
			if (!isPuzzleAngle(key)) continue;
			const entry = themes.get(key) ?? { nb: 0, won: 0 };
			entry.nb += 1;
			if (attempt.won) entry.won += 1;
			themes.set(key, entry);
		}
	}
	const newestFirst = [...attempts].sort((a, b) => b.at.localeCompare(a.at));
	return {
		days,
		nb: inRange.length,
		won: solved.length,
		solvedRating:
			solved.length > 0 ? Math.round(solved.reduce((sum, attempt) => sum + attempt.rating, 0) / solved.length) : null,
		themes: [...themes]
			.map(([key, entry]) => ({ key, ...entry }))
			.sort((a, b) => b.nb - a.nb || a.key.localeCompare(b.key)),
		// The best streak is every attempt's, not only the last 30 days'.
		bestStreak: attempts.reduce((best, attempt) => Math.max(best, attempt.streak ?? 0), 0),
		recent: newestFirst.slice(0, RECENT).map((attempt) => ({
			id: attempt.id,
			puzzleId: attempt.puzzleId,
			won: attempt.won,
			rating: attempt.rating,
			ratingDiff: attempt.ratingDiff ?? null,
			at: attempt.at,
		})),
	};
}

/** Themes to work on: played at least twice, the lowest share solved first. */
export function weakestThemes(stats: PuzzleStats, count = 3) {
	return stats.themes
		.filter((theme) => theme.nb >= 2 && theme.won < theme.nb)
		.sort((a, b) => a.won / a.nb - b.won / b.nb || b.nb - a.nb)
		.slice(0, count);
}
