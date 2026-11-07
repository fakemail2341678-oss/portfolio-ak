import { describe, expect, it } from "vitest";
import {
	bucketOf,
	calendarWeeks,
	endOfWeek,
	monthGrid,
	startOfWeek,
	stepCalendar,
	weekOf,
} from "@/features/taskline/calendar/grid";

/** Taskline's calendar days (Task 51): weeks from the workspace's week start (Sunday by default), My work's groups. */
describe("the calendar grid", () => {
	it("starts weeks on Sunday by default, or on the day given", () => {
		// 2026-11-04 is a Wednesday.
		expect(startOfWeek("2026-11-04", 0)).toBe("2026-11-01");
		expect(startOfWeek("2026-11-01", 0)).toBe("2026-11-01");
		expect(startOfWeek("2026-11-04", 1)).toBe("2026-11-02");
		expect(startOfWeek("2026-11-01", 1)).toBe("2026-10-26");
		expect(weekOf("2026-11-07", 0)).toEqual([
			"2026-11-01",
			"2026-11-02",
			"2026-11-03",
			"2026-11-04",
			"2026-11-05",
			"2026-11-06",
			"2026-11-07",
		]);
		expect(endOfWeek("2026-11-04", 0)).toBe("2026-11-07");
	});

	it("draws a month as whole Sunday-first weeks, across month and year ends", () => {
		const november = monthGrid("2026-11", 0);
		// November 2026 starts on a Sunday and ends on a Monday: five weeks.
		expect(november).toHaveLength(5);
		expect(november[0]?.[0]).toBe("2026-11-01");
		expect(november.at(-1)).toEqual([
			"2026-11-29",
			"2026-11-30",
			"2026-12-01",
			"2026-12-02",
			"2026-12-03",
			"2026-12-04",
			"2026-12-05",
		]);
		const january = monthGrid("2027-01", 0);
		expect(january[0]?.[0]).toBe("2026-12-27");
		expect(january.every((week) => week.length === 7)).toBe(true);
		// February 2026 starts on a Sunday and has exactly four weeks.
		expect(monthGrid("2026-02", 0)).toHaveLength(4);
		expect(monthGrid("2026-02", 1)).toHaveLength(5);
		expect(calendarWeeks("2026-11-18", "week", 0)).toEqual([weekOf("2026-11-18", 0)]);
	});

	it("steps by months (keeping the day where it can) and by weeks", () => {
		expect(stepCalendar("2026-01-31", "month", 1)).toBe("2026-02-28");
		expect(stepCalendar("2026-03-15", "month", -1)).toBe("2026-02-15");
		expect(stepCalendar("2026-12-10", "month", 1)).toBe("2027-01-10");
		expect(stepCalendar("2026-11-04", "week", -1)).toBe("2026-10-28");
	});

	it("groups My work by when it's due", () => {
		const today = "2026-11-04";
		const weekEnd = endOfWeek(today, 0);
		expect(bucketOf("2026-11-01", today, weekEnd)).toBe("overdue");
		expect(bucketOf(today, today, weekEnd)).toBe("today");
		expect(bucketOf("2026-11-07", today, weekEnd)).toBe("week");
		expect(bucketOf("2026-11-08", today, weekEnd)).toBe("later");
		expect(bucketOf(null, today, weekEnd)).toBe("none");
	});
});
