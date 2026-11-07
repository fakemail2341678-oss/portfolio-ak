import { z } from "zod";
import { addDays, type IsoDate, weekdayOf } from "@/lib/i18n/date-only";
import { isoDate } from "@/lib/validation";
import { RECURRENCE_COUNT_MAX, RECURRENCE_FREQS, RECURRENCE_INTERVAL_MAX, type Recurrence } from "./types";

/**
 * Recurring tasks (Task 56, decision 0221): pure and shared. Days are calendar days
 * (`YYYY-MM-DD`) in the workspace's time zone; the caller passes today. A series moves
 * from task to task: closing one creates the next, due on the next occurrence, and
 * the daily job creates it when an occurrence comes while the last one is still open.
 */

/** What a member sets (the server adds `anchor` and `n`). */
export const recurrenceRule = z
	.strictObject({
		freq: z.enum(RECURRENCE_FREQS),
		interval: z.number().int().min(1).max(RECURRENCE_INTERVAL_MAX),
		weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
		until: isoDate().nullable().optional(),
		count: z.number().int().min(2).max(RECURRENCE_COUNT_MAX).nullable().optional(),
	})
	.refine((rule) => rule.freq === "weekly" || rule.weekdays === undefined, { path: ["weekdays"] })
	.refine((rule) => !(rule.until && rule.count), { path: ["count"] });
export type RecurrenceRule = z.infer<typeof recurrenceRule>;

/** The rule as stored: from `anchor` (the task's due day, else today), this task the `n`th. */
export function storedRecurrence(rule: RecurrenceRule, anchor: IsoDate, n = 1): Recurrence {
	return {
		freq: rule.freq,
		interval: rule.interval,
		...(rule.freq === "weekly" ? { weekdays: [...new Set(rule.weekdays ?? [weekdayOf(anchor)])].sort() } : {}),
		...(rule.until ? { until: rule.until } : {}),
		...(rule.count ? { count: rule.count } : {}),
		anchor,
		n,
	};
}

const parts = (day: IsoDate) => {
	const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
	return { year, month, date };
};
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const iso = (year: number, month: number, date: number) =>
	`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

/** `months` after `day`'s month, on the anchor's day of the month (the last day when the month is shorter). */
function monthsLater(day: IsoDate, months: number, anchorDate: number): IsoDate {
	const { year, month } = parts(day);
	const index = year * 12 + (month - 1) + months;
	const nextYear = Math.floor(index / 12);
	const nextMonth = (index % 12) + 1;
	return iso(nextYear, nextMonth, Math.min(anchorDate, lastDayOf(nextYear, nextMonth)));
}

/**
 * The first occurrence after `after`. Weeks start on the workspace's `weekStart`, so
 * "every 2 weeks on Sunday and Wednesday" takes the rest of `after`'s week first, then
 * the chosen days of the week two weeks on.
 */
export function nextOccurrence(rule: Recurrence, after: IsoDate, weekStart = 0): IsoDate {
	const anchor = parts(rule.anchor);
	switch (rule.freq) {
		case "daily":
			return addDays(after, rule.interval);
		case "weekly": {
			const days = new Set(rule.weekdays?.length ? rule.weekdays : [weekdayOf(rule.anchor)]);
			const weekFirst = addDays(after, -((weekdayOf(after) - weekStart + 7) % 7));
			for (let day = addDays(after, 1); day <= addDays(weekFirst, 6); day = addDays(day, 1)) {
				if (days.has(weekdayOf(day))) return day;
			}
			const later = addDays(weekFirst, 7 * rule.interval);
			for (let offset = 0; offset < 7; offset++) {
				const day = addDays(later, offset);
				if (days.has(weekdayOf(day))) return day;
			}
			return addDays(after, 7 * rule.interval);
		}
		case "monthly":
			return monthsLater(after, rule.interval, anchor.date);
		case "yearly": {
			const { year } = parts(after);
			const nextYear = year + rule.interval;
			return iso(nextYear, anchor.month, Math.min(anchor.date, lastDayOf(nextYear, anchor.month)));
		}
	}
}

/** Enough steps for a daily rule a few years behind; a guard, never reached in use. */
const STEPS_MAX = 5000;

/** Whether the series goes on to an occurrence on `day`: within its end date and its count. */
export const continues = (rule: Recurrence, day: IsoDate) =>
	!(rule.until && day > rule.until) && !(rule.count && rule.n >= rule.count);

/**
 * When a task of the series closes: the next one's due day, the first occurrence after
 * the closed one's that isn't before today (a late task doesn't make a late next one).
 * Null when the series ends there.
 */
export function nextDue(rule: Recurrence, base: IsoDate, today: IsoDate, weekStart = 0): IsoDate | null {
	let day = nextOccurrence(rule, base, weekStart);
	for (let step = 0; day < today && step < STEPS_MAX; step++) day = nextOccurrence(rule, day, weekStart);
	return continues(rule, day) ? day : null;
}

/**
 * The daily job's catch-up, while the last task is still open: the latest occurrence
 * after it that has come (up to today), skipping the ones missed in between. Null when
 * none has come yet or the series has ended.
 */
export function dueByNow(rule: Recurrence, base: IsoDate, today: IsoDate, weekStart = 0): IsoDate | null {
	let day = nextOccurrence(rule, base, weekStart);
	if (day > today) return null;
	for (let step = 0; step < STEPS_MAX; step++) {
		const after = nextOccurrence(rule, day, weekStart);
		if (after > today) break;
		day = after;
	}
	return continues(rule, day) ? day : null;
}

/** The next task's start: as far before its due day as the closed one's was (null without one). */
export const shiftedStart = (startOn: IsoDate | null, dueOn: IsoDate | null, nextDueOn: IsoDate): IsoDate | null => {
	if (!startOn || !dueOn) return null;
	const gap = Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${startOn}T00:00:00Z`)) / 86_400_000);
	return addDays(nextDueOn, -Math.max(0, gap));
};
