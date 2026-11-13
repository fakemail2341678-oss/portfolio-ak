import { addDays, addMonths, type IsoDate, monthDays } from "@/lib/i18n/date-only";

/**
 * When a recurring expense is made (Task 94, decision 0288; docs/guides/kharcha.md
 * "Recurring expenses"). Pure and isomorphic. Occurrence `n` is counted from the first
 * (`startsOn`, occurrence 0), never from the one before, so a monthly expense on the 31st
 * is made on the 28th or 29th in February and on the 31st again in March, and a yearly one
 * on 29 February falls on the 28th in other years.
 */

export const RECURRING_UNITS = ["week", "month", "year"] as const;
export type RecurringUnit = (typeof RECURRING_UNITS)[number];

/** "Every n": from 1 to this. */
export const RECURRING_EVERY_MAX = 52;

/** How many occurrences one run of the daily job makes of one recurring expense at most (catch-up). */
export const CATCH_UP_MAX = 60;

export type Cadence = { unit: RecurringUnit; every: number };

/** A month's day, kept within the month ("2025-02" and 31 is 2025-02-28). */
const dayInMonth = (month: string, day: number): IsoDate => {
	const last = Number(monthDays(month).last.slice(8, 10));
	return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
};

/** The day of occurrence `n` of a cadence that started on `startsOn`. */
export function occurrenceOn(startsOn: IsoDate, cadence: Cadence, n: number): IsoDate {
	if (cadence.unit === "week") return addDays(startsOn, 7 * cadence.every * n);
	const months = (cadence.unit === "year" ? 12 : 1) * cadence.every * n;
	return dayInMonth(addMonths(startsOn.slice(0, 7), months), Number(startsOn.slice(8, 10)));
}

/** The first occurrence on or after `day` (the one to make next after resuming), as its number and day. */
export function firstOnOrAfter(startsOn: IsoDate, cadence: Cadence, day: IsoDate): { n: number; on: IsoDate } {
	if (day <= startsOn) return { n: 0, on: startsOn };
	const days = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000;
	// A guess a little under the answer, then forward: cheap even after years.
	const span = cadence.unit === "week" ? 7 : cadence.unit === "month" ? 31 : 366;
	let n = Math.max(0, Math.floor(days / (span * cadence.every)) - 1);
	while (occurrenceOn(startsOn, cadence, n) < day) n += 1;
	return { n, on: occurrenceOn(startsOn, cadence, n) };
}

/** Whether occurrence day `on` is within the end date. */
export const beforeEnd = (on: IsoDate, endsOn: IsoDate | null): boolean => endsOn === null || on <= endsOn;

/**
 * What is due by `today`: from occurrence `nextN`, every one on or before today and the end
 * date, at most `max` (the rest wait for the next run).
 */
export function dueOccurrences(
	recurring: { startsOn: IsoDate; cadence: Cadence; nextN: number; endsOn: IsoDate | null },
	today: IsoDate,
	max = CATCH_UP_MAX,
): Array<{ n: number; on: IsoDate }> {
	const due: Array<{ n: number; on: IsoDate }> = [];
	for (let n = recurring.nextN; due.length < max; n += 1) {
		const on = occurrenceOn(recurring.startsOn, recurring.cadence, n);
		if (on > today || !beforeEnd(on, recurring.endsOn)) break;
		due.push({ n, on });
	}
	return due;
}
