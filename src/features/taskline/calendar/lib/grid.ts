import { addDays, addMonths, monthDays, weekdayOf } from "@/lib/i18n/date-only";

/**
 * Calendar days for Taskline (Task 51): weeks start on the workspace's week start
 * (0 Sunday … 6 Saturday; Sunday by default), days are "YYYY-MM-DD" strings, and
 * nothing here reads the clock, so the server and the browser draw the same grid.
 */

/** The first day of the week holding `day`. */
export const startOfWeek = (day: string, weekStart: number): string =>
	addDays(day, -((weekdayOf(day) - weekStart + 7) % 7));

/** The seven days of the week holding `day`. */
export const weekOf = (day: string, weekStart: number): string[] => {
	const first = startOfWeek(day, weekStart);
	return Array.from({ length: 7 }, (_, index) => addDays(first, index));
};

/** The last day of the week holding `day` (My work's "this week"). */
export const endOfWeek = (day: string, weekStart: number): string => addDays(startOfWeek(day, weekStart), 6);

/** The month of a day: "2026-11-05" → "2026-11". */
export const monthOf = (day: string): string => day.slice(0, 7);

/** A month as whole weeks: from the week holding its first day to the week holding its last (4 to 6 rows of 7). */
export function monthGrid(month: string, weekStart: number): string[][] {
	const { first, last } = monthDays(month);
	const weeks: string[][] = [];
	for (let start = startOfWeek(first, weekStart); start <= last; start = addDays(start, 7)) {
		weeks.push(Array.from({ length: 7 }, (_, index) => addDays(start, index)));
	}
	return weeks;
}

/** The day `steps` months or weeks from `day` (a month step keeps the day of the month where it can). */
export function stepCalendar(day: string, mode: "month" | "week", steps: number): string {
	if (mode === "week") return addDays(day, steps * 7);
	const month = addMonths(monthOf(day), steps);
	const { last } = monthDays(month);
	const wanted = `${month}-${day.slice(8, 10)}`;
	return wanted > last ? last : wanted;
}

/** The days a calendar shows: a month's grid, or one week as a single row. */
export const calendarWeeks = (day: string, mode: "month" | "week", weekStart: number): string[][] =>
	mode === "month" ? monthGrid(monthOf(day), weekStart) : [weekOf(day, weekStart)];

export type MyWorkBucket = "overdue" | "today" | "week" | "later" | "none";
export const MY_WORK_BUCKETS: ReadonlyArray<MyWorkBucket> = ["overdue", "today", "week", "later", "none"];

/** Where a task's due date puts it on My work: overdue, today, the rest of this week, later, or no date. */
export function bucketOf(dueOn: string | null, today: string, weekEnd: string): MyWorkBucket {
	if (dueOn === null) return "none";
	if (dueOn < today) return "overdue";
	if (dueOn === today) return "today";
	return dueOn <= weekEnd ? "week" : "later";
}
