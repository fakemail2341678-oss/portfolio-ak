import { addDays, type IsoDate, weekdayOf } from "@/lib/i18n/date-only";
import { type DayCounts, isScheduled } from "./streaks";

/** The heatmap's size: 53 weeks (columns) of 7 days (rows, Sunday on top), as GitHub draws a year. */
export const HEATMAP_WEEKS = 53;

/** The heatmap's first day: the Sunday 52 weeks before the one starting today's week. */
export const heatmapStart = (today: IsoDate): IsoDate => addDays(today, -weekdayOf(today) - (HEATMAP_WEEKS - 1) * 7);

/** How full a day is: 0 nothing, 1–3 part of the target, 4 done. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatCell = {
	day: IsoDate;
	week: number;
	weekday: number;
	count: number;
	level: HeatLevel;
	scheduled: boolean;
};

export const heatLevel = (count: number, target: number): HeatLevel => {
	if (count <= 0) return 0;
	if (count >= target) return 4;
	return Math.min(3, Math.max(1, Math.ceil((count / target) * 3))) as HeatLevel;
};

/** Every day from the heatmap's start to today, placed in its week and weekday. */
export function heatmapCells(today: IsoDate, counts: DayCounts, rule: { days: number; target: number }): HeatCell[] {
	const start = heatmapStart(today);
	const cells: HeatCell[] = [];
	for (let index = 0, day = start; day <= today; index++, day = addDays(day, 1)) {
		const count = counts.get(day) ?? 0;
		cells.push({
			day,
			week: Math.floor(index / 7),
			weekday: index % 7,
			count,
			level: heatLevel(count, rule.target),
			scheduled: isScheduled(rule.days, day),
		});
	}
	return cells;
}

/**
 * Where months' labels go: the week holding each month's first day ("YYYY-MM"). A month
 * starting in the last two columns has no room for its label, so it gets none.
 */
export const monthStarts = (cells: ReadonlyArray<HeatCell>): Array<{ week: number; month: string }> =>
	cells
		.filter((cell) => cell.day.endsWith("-01") && cell.week <= HEATMAP_WEEKS - 3)
		.map((cell) => ({ week: cell.week, month: cell.day.slice(0, 7) }));
