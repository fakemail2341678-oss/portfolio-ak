import type { PlayerPerf, RatingSeries } from "./schema";

/** The chart draws at most this many points: a long history keeps the last of each stretch. */
export const HISTORY_POINTS = 120;

/**
 * One rating's history as the chart's rows (Task 81): the days in order, thinned to
 * `HISTORY_POINTS` by keeping the last rating of each stretch (the latest always stays).
 */
export function historyRows(
	series: ReadonlyArray<RatingSeries>,
	perf: PlayerPerf,
	max: number = HISTORY_POINTS,
): Array<{ day: string; rating: number }> {
	const points = series.find((each) => each.perf === perf)?.points ?? [];
	if (points.length <= max) return points.map(([day, rating]) => ({ day, rating }));
	const stretch = Math.ceil(points.length / max);
	const rows: Array<{ day: string; rating: number }> = [];
	// From the end, so the latest point is always one of them.
	for (let index = points.length - 1; index >= 0; index -= stretch) {
		const point = points[index];
		if (point) rows.push({ day: point[0], rating: point[1] });
	}
	return rows.reverse();
}
