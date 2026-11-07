import { describe, expect, it } from "vitest";
import { heatLevel, heatmapCells, heatmapStart, monthStarts } from "@/features/apps/habits/heatmap";
import {
	completion,
	currentStreak,
	daysMask,
	habitStats,
	isScheduled,
	longestStreak,
	weekdaysOf,
} from "@/features/apps/habits/streaks";
import { EVERY_DAY } from "@/features/apps/habits/types";
import { addDays, addMonths, monthDays, todayInZone, weekdayOf } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";

/**
 * Habits' streaks and rates (decision 0193) on calendar days: across month, year and
 * leap-day boundaries, with days a habit isn't meant for, and "today" as Kathmandu
 * has it.
 */
const done = (...days: string[]) => new Map(days.map((day) => [day, 1]));
const daily = (startedOn = "2026-01-01") => ({ days: EVERY_DAY, target: 1, startedOn });
/** Monday to Friday. */
const weekdays = (startedOn = "2026-01-01") => ({ days: daysMask([1, 2, 3, 4, 5]), target: 1, startedOn });

describe("calendar days", () => {
	it("moves across months, years and leap days", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
		expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
		expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
		expect(addMonths("2026-01", -1)).toBe("2025-12");
		expect(addMonths("2026-11", 2)).toBe("2027-01");
		expect(monthDays("2024-02")).toEqual({ first: "2024-02-01", last: "2024-02-29" });
		expect(monthDays("2026-12")).toEqual({ first: "2026-12-01", last: "2026-12-31" });
	});

	it("knows the day of the week of a date, whatever the machine's zone", () => {
		expect(weekdayOf("2026-01-04")).toBe(0);
		expect(weekdayOf("2026-10-30")).toBe(5);
		expect(weekdayOf("2027-01-01")).toBe(5);
		expect(weekdaysOf(daysMask([1, 3, 5]))).toEqual([1, 3, 5]);
		expect(isScheduled(daysMask([1, 2, 3, 4, 5]), "2026-03-01")).toBe(false);
		expect(isScheduled(daysMask([1, 2, 3, 4, 5]), "2026-10-30")).toBe(true);
	});
});

describe("current streak", () => {
	it("counts done days in a row across the new year", () => {
		const counts = done("2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01");
		expect(currentStreak(daily(), counts, "2027-01-01")).toBe(4);
	});

	it("leaves today open until it is done, and breaks on a missed day", () => {
		const counts = done("2026-10-27", "2026-10-28", "2026-10-29");
		expect(currentStreak(daily(), counts, "2026-10-30")).toBe(3);
		expect(currentStreak(daily(), done("2026-10-27", "2026-10-29"), "2026-10-30")).toBe(1);
		expect(currentStreak(daily(), done("2026-10-28"), "2026-10-30")).toBe(0);
	});

	it("skips days the habit isn't meant for (a weekend doesn't break a weekday habit)", () => {
		// Wed 30 Dec missed, Thu 31 and Fri 1 Jan done, the weekend skipped, Mon 4 Jan still open.
		const counts = done("2026-12-29", "2026-12-31", "2027-01-01");
		expect(currentStreak(weekdays(), counts, "2027-01-04")).toBe(2);
		// A check-in on a Saturday neither counts nor breaks.
		expect(currentStreak(weekdays(), new Map([...counts, ["2027-01-02", 1]]), "2027-01-04")).toBe(2);
	});

	it("counts a day as done only at its target", () => {
		const water = { days: EVERY_DAY, target: 8, startedOn: "2026-10-01" };
		const counts = new Map([
			["2026-10-28", 8],
			["2026-10-29", 8],
			["2026-10-30", 5],
		]);
		expect(currentStreak(water, counts, "2026-10-30")).toBe(2);
		expect(currentStreak(water, new Map([...counts, ["2026-10-30", 8]]), "2026-10-30")).toBe(3);
	});

	it("starts at the habit's first day, or an earlier check-in entered for the past", () => {
		expect(currentStreak(daily("2026-10-29"), done("2026-10-29", "2026-10-30"), "2026-10-30")).toBe(2);
		expect(currentStreak(daily("2026-10-29"), done("2026-10-27", "2026-10-28", "2026-10-29"), "2026-10-30")).toBe(3);
	});

	it("takes today in Kathmandu: 00:05 on 1 January there is still 31 December in UTC", () => {
		const today = todayInZone(APP_TIME_ZONE, new Date("2026-12-31T18:20:00Z"));
		expect(today).toBe("2027-01-01");
		expect(currentStreak(daily(), done("2026-12-30", "2026-12-31", "2027-01-01"), today)).toBe(3);
		// The day before, at 23:50 in Kathmandu, a check-in for 31 December is still today's.
		const before = todayInZone(APP_TIME_ZONE, new Date("2026-12-31T18:05:00Z"));
		expect(before).toBe("2026-12-31");
		expect(currentStreak(daily(), done("2026-12-30", "2026-12-31"), before)).toBe(2);
	});
});

describe("best streak and completion rate", () => {
	it("finds the longest run, across the end of February", () => {
		const counts = done(
			"2026-02-24",
			"2026-02-25",
			"2026-02-26",
			"2026-02-27",
			"2026-02-28",
			"2026-03-01",
			"2026-03-03",
			"2026-03-04",
		);
		expect(longestStreak(daily("2026-02-24"), counts, "2026-03-04")).toBe(6);
		expect(currentStreak(daily("2026-02-24"), counts, "2026-03-04")).toBe(2);
	});

	it("rates scheduled days only, today once done, nothing before the start", () => {
		// Started Tue 27 Oct; Fri 30 Oct is today and not done yet: Tue, Wed, Thu scheduled.
		const counts = done("2026-10-27", "2026-10-29");
		expect(completion(daily("2026-10-27"), counts, "2026-10-30", 30)).toEqual({ done: 2, scheduled: 3, rate: 2 / 3 });
		expect(completion(daily("2026-10-27"), new Map([...counts, ["2026-10-30", 1]]), "2026-10-30", 30).rate).toBe(3 / 4);
		// A weekday habit over a window holding a weekend: 5 of 7 days are scheduled.
		const week = done("2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30");
		expect(completion(weekdays(), week, "2026-11-01", 7)).toEqual({ done: 5, scheduled: 5, rate: 1 });
	});

	it("has no rate before any scheduled day has passed", () => {
		expect(completion(daily("2026-10-30"), new Map(), "2026-10-30", 30).rate).toBeNull();
		expect(habitStats(daily("2026-10-30"), new Map(), "2026-10-30", 30)).toEqual({ streak: 0, best: 0, rate: null });
	});
});

describe("heatmap", () => {
	it("draws 53 weeks starting on a Sunday and ending today", () => {
		const today = "2026-10-30";
		const start = heatmapStart(today);
		expect(weekdayOf(start)).toBe(0);
		const cells = heatmapCells(today, done(today), { days: EVERY_DAY, target: 1 });
		expect(cells).toHaveLength(52 * 7 + weekdayOf(today) + 1);
		expect(cells[0]?.day).toBe(start);
		expect(cells.at(-1)).toMatchObject({ day: today, week: 52, weekday: 5, level: 4 });
		expect(new Set(cells.map((cell) => cell.week)).size).toBe(53);
	});

	it("fills a day by how much of the target was done, and labels months that fit", () => {
		expect([0, 1, 3, 6, 8, 9].map((count) => heatLevel(count, 8))).toEqual([0, 1, 2, 3, 4, 4]);
		const cells = heatmapCells("2026-10-30", new Map(), { days: EVERY_DAY, target: 1 });
		const months = monthStarts(cells).map((start) => start.month);
		expect(months[0]).toBe("2025-11");
		expect(months).toContain("2026-10");
		expect(new Set(months).size).toBe(months.length);
	});
});
