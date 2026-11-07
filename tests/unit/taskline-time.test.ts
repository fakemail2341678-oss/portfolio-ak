import { describe, expect, it } from "vitest";
import { utilizationRange } from "@/features/taskline/admin/search";
import { burnSeries } from "@/features/taskline/sprints/burndown";
import { durationInput, elapsedClock, formatDuration, parseDuration } from "@/features/taskline/time/duration";
import { capacityFor, planCell, sheetTotals } from "@/features/taskline/time/sheet";
import type { SprintReport } from "@/features/taskline/types";

/** Time tracking's pure parts (Task 53): durations as typed, a cell's plan, totals, capacity, hours in sprints. */

describe("durations", () => {
	it("reads hours and minutes as people type them", () => {
		expect(parseDuration("1h 30m")).toBe(90);
		expect(parseDuration("1h30")).toBe(90);
		expect(parseDuration("2h")).toBe(120);
		expect(parseDuration("45m")).toBe(45);
		expect(parseDuration("45 min")).toBe(45);
		expect(parseDuration("1:05")).toBe(65);
		expect(parseDuration("1.5")).toBe(90);
		expect(parseDuration("1,25")).toBe(75);
		expect(parseDuration("0.1")).toBe(6);
		expect(parseDuration("  ")).toBe(0);
	});

	it("reads Devanagari digits and Nepali units", () => {
		expect(parseDuration("१:३०")).toBe(90);
		expect(parseDuration("२ घण्टा ३० मिनेट")).toBe(150);
		expect(parseDuration("१ घ १५ मि")).toBe(75);
	});

	it("refuses what isn't a duration, and more than the limit", () => {
		expect(parseDuration("soon")).toBeNull();
		expect(parseDuration("1:75")).toBeNull();
		expect(parseDuration("-1")).toBeNull();
		expect(parseDuration("25")).toBeNull();
		expect(parseDuration("25", 60_000)).toBe(1500);
	});

	it("writes them back for reading and for editing", () => {
		expect(formatDuration(90)).toBe("1h 30m");
		expect(formatDuration(120)).toBe("2h");
		expect(formatDuration(5)).toBe("5m");
		expect(formatDuration(0)).toBe("0h");
		expect(durationInput(90)).toBe("1:30");
		expect(durationInput(0)).toBe("");
		expect(parseDuration(durationInput(605))).toBe(605);
	});

	it("counts a running timer from its start", () => {
		const start = "2026-11-02T06:00:00.000Z";
		expect(elapsedClock(start, Date.parse("2026-11-02T07:05:09.000Z"))).toBe("1:05:09");
		expect(elapsedClock(start, Date.parse("2026-11-02T05:00:00.000Z"))).toBe("0:00:00");
	});
});

describe("a timesheet cell", () => {
	const entries = [
		{ id: "old", minutes: 60 },
		{ id: "new", minutes: 30 },
	];

	it("adds an entry for more time, and changes nothing for the same", () => {
		expect(planCell(entries, 150)).toEqual({ insert: 60, update: [], remove: [] });
		expect(planCell(entries, 90)).toEqual({ insert: null, update: [], remove: [] });
		expect(planCell([], 45)).toEqual({ insert: 45, update: [], remove: [] });
	});

	it("takes less from the newest entries first, removing those it empties", () => {
		expect(planCell(entries, 70)).toEqual({ insert: null, update: [{ id: "new", minutes: 10 }], remove: [] });
		expect(planCell(entries, 40)).toEqual({ insert: null, update: [{ id: "old", minutes: 40 }], remove: ["new"] });
		expect(planCell(entries, 0)).toEqual({ insert: null, update: [], remove: ["new", "old"] });
	});

	it("totals rows by day and week", () => {
		expect(sheetTotals([{ minutes: [60, 0, 30] }, { minutes: [0, 45, 30] }], 3)).toEqual({
			perDay: [60, 45, 60],
			total: 165,
		});
	});

	it("spreads a weekly capacity over the working days in a range", () => {
		const sunToFri = [0, 1, 2, 3, 4, 5];
		expect(capacityFor(2400, [0, 1, 2, 3, 4, 5, 6], sunToFri)).toBe(2400);
		expect(capacityFor(2400, [6], sunToFri)).toBe(0);
		expect(capacityFor(2400, [1, 2, 3], sunToFri)).toBe(1200);
		expect(capacityFor(2400, [1], [])).toBe(0);
	});
});

describe("utilization's days", () => {
	it("default to this week, swap a reversed range and keep at most 92 days", () => {
		const options = { today: "2026-11-04", weekStart: 0 };
		expect(utilizationRange({}, options)).toEqual({ from: "2026-11-01", to: "2026-11-07" });
		expect(utilizationRange({ from: "2026-11-10", to: "2026-11-01" }, options)).toEqual({
			from: "2026-11-01",
			to: "2026-11-10",
		});
		expect(utilizationRange({ from: "2026-01-01", to: "2026-12-31" }, options)).toEqual({
			from: "2026-01-01",
			to: "2026-04-02",
		});
	});
});

describe("a sprint estimated in time", () => {
	it("burns down estimated hours", () => {
		const report: Pick<SprintReport, "sprint" | "days" | "live" | "today" | "workingDays"> = {
			sprint: {
				id: "s",
				name: "Sprint 1",
				goal: "",
				state: "active",
				startOn: "2026-11-01",
				endOn: "2026-11-02",
				startedAt: "2026-11-01T03:00:00.000Z",
				completedAt: null,
				committed: { points: 0, tasks: 2, minutes: 300 },
				completed: null,
			},
			days: [],
			live: { scopePoints: 0, donePoints: 0, scopeTasks: 2, doneTasks: 1, scopeMinutes: 300, doneMinutes: 90 },
			today: "2026-11-01",
			workingDays: [0, 1, 2, 3, 4, 5],
		};
		const points = burnSeries(report, "hours");
		expect(points[0]).toMatchObject({ scope: 5, remaining: 5 });
		expect(points[1]).toMatchObject({ day: "2026-11-01", scope: 5, done: 1.5, remaining: 3.5 });
	});
});
