import { addDays, type IsoDate, weekdayOf } from "@/lib/i18n/date-only";
import type { HabitStats } from "./types";

/**
 * Streaks and completion rates (decision 0193), on calendar days ("YYYY-MM-DD") only:
 * no Date objects, no time zones. "Today" comes from the caller, as the app's time
 * zone has it (`todayInZone(APP_TIME_ZONE)`), so a check-in at 00:30 in Kathmandu
 * counts for that day wherever the server runs.
 *
 * A habit is meant for some days of the week (`days`, bit 0 Sunday); other days
 * neither count nor break a streak. A day is done when its count reaches `target`.
 * Today, until it is done, is still open: it doesn't break the streak.
 */
export type HabitRule = {
	/** Days of the week it is meant for: bit 0 Sunday … bit 6 Saturday. */
	days: number;
	target: number;
	/** Its first day: nothing before it counts or breaks anything. */
	startedOn: IsoDate;
};

export type DayCounts = ReadonlyMap<IsoDate, number>;

export const isScheduled = (days: number, day: IsoDate) => (days & (1 << weekdayOf(day))) !== 0;

export const isDone = (rule: Pick<HabitRule, "target">, counts: DayCounts, day: IsoDate) =>
	(counts.get(day) ?? 0) >= rule.target;

/** Where history starts: the habit's first day, or an earlier check-in (one entered for a past day). */
const firstDay = (rule: HabitRule, counts: DayCounts): IsoDate => {
	let first = rule.startedOn;
	for (const day of counts.keys()) if (day < first) first = day;
	return first;
};

/** Scheduled days done in a row, ending today (or yesterday while today is still open). */
export function currentStreak(rule: HabitRule, counts: DayCounts, today: IsoDate): number {
	const first = firstDay(rule, counts);
	let streak = 0;
	for (let day = today; day >= first; day = addDays(day, -1)) {
		if (!isScheduled(rule.days, day)) continue;
		if (isDone(rule, counts, day)) streak++;
		else if (day !== today) break;
	}
	return streak;
}

/** The longest run of scheduled days done, up to today. */
export function longestStreak(rule: HabitRule, counts: DayCounts, today: IsoDate): number {
	let best = 0;
	let run = 0;
	for (let day = firstDay(rule, counts); day <= today; day = addDays(day, 1)) {
		if (!isScheduled(rule.days, day)) continue;
		if (isDone(rule, counts, day)) {
			run++;
			best = Math.max(best, run);
		} else if (day !== today) {
			run = 0;
		}
	}
	return best;
}

/**
 * Of the scheduled days in the `length` days ending today (none before the habit
 * started), how many were done. Today counts only once done, so a morning doesn't
 * lower the rate. `rate` is null when no day was scheduled yet.
 */
export function completion(
	rule: HabitRule,
	counts: DayCounts,
	today: IsoDate,
	length: number,
): { done: number; scheduled: number; rate: number | null } {
	const windowStart = addDays(today, -(length - 1));
	const start = windowStart > rule.startedOn ? windowStart : rule.startedOn;
	let done = 0;
	let scheduled = 0;
	for (let day = start; day <= today; day = addDays(day, 1)) {
		if (!isScheduled(rule.days, day)) continue;
		const finished = isDone(rule, counts, day);
		if (day === today && !finished) continue;
		scheduled++;
		if (finished) done++;
	}
	return { done, scheduled, rate: scheduled === 0 ? null : done / scheduled };
}

/** A habit's streak, best streak and completion rate over `rateDays`. */
export function habitStats(rule: HabitRule, counts: DayCounts, today: IsoDate, rateDays: number): HabitStats {
	return {
		streak: currentStreak(rule, counts, today),
		best: longestStreak(rule, counts, today),
		rate: completion(rule, counts, today, rateDays).rate,
	};
}

/** The weekdays (0 Sunday … 6 Saturday) a `days` mask holds, in order. */
export const weekdaysOf = (days: number): number[] =>
	[0, 1, 2, 3, 4, 5, 6].filter((weekday) => (days & (1 << weekday)) !== 0);

/** A mask from weekdays (0 Sunday … 6 Saturday). */
export const daysMask = (weekdays: ReadonlyArray<number>): number =>
	weekdays.reduce((mask, weekday) => mask | (1 << weekday), 0);
