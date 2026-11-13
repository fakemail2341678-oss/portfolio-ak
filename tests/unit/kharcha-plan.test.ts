import { describe, expect, it } from "vitest";
import {
	amountFor,
	budgetState,
	daysLeft,
	percentOf,
	periodCounts,
	periodOf,
	periodShift,
	thresholdsReached,
} from "@/features/kharcha/budgets/period";
import { budgetTarget, notifyPath } from "@/features/kharcha/notifications";
import { type Cadence, dueOccurrences, firstOnOrAfter, occurrenceOn } from "@/features/kharcha/recurring/cadence";
import { statementOf } from "@/features/kharcha/search";

/** Task 94: budget periods and their alerts, recurrence dates, and a statement's days (pure). */

describe("budget periods", () => {
	it("weeks start on Sunday, months and years are the calendar's", () => {
		// 2026-11-13 is a Friday.
		expect(periodOf("week", "2026-11-13")).toEqual({ start: "2026-11-08", end: "2026-11-14" });
		expect(periodOf("week", "2026-11-08")).toEqual({ start: "2026-11-08", end: "2026-11-14" });
		expect(periodOf("month", "2024-02-10")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
		expect(periodOf("month", "2025-02-10")).toEqual({ start: "2025-02-01", end: "2025-02-28" });
		expect(periodOf("year", "2026-07-01")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
	});

	it("steps back and forward across month and year ends", () => {
		expect(periodShift("month", "2026-01-31", -1)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
		expect(periodShift("month", "2026-03-31", -1)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
		expect(periodShift("week", "2026-01-01", -1)).toEqual({ start: "2025-12-21", end: "2025-12-27" });
		expect(periodShift("year", "2026-05-05", 1)).toEqual({ start: "2027-01-01", end: "2027-12-31" });
	});

	it("applies from the period that holds its first day", () => {
		expect(periodCounts("month", "2026-11-20", "2026-11-01")).toBe(true);
		expect(periodCounts("month", "2026-11-20", "2026-10-01")).toBe(false);
		expect(periodCounts("week", "2026-11-13", "2026-11-08")).toBe(true);
	});

	it("takes a month's own amount over the budget's", () => {
		const budget = { period: "month" as const, amountMinor: 1_000_000 };
		const months = [{ month: "2026-12", amountMinor: 2_500_000 }];
		expect(amountFor(budget, months, "2026-12-01")).toBe(2_500_000);
		expect(amountFor(budget, months, "2026-11-01")).toBe(1_000_000);
		// A weekly budget has no months of its own.
		expect(amountFor({ period: "week", amountMinor: 50_000 }, months, "2026-12-06")).toBe(50_000);
	});

	it("reaches 80% and 100% in integers", () => {
		expect(thresholdsReached(7_999, 10_000)).toEqual([]);
		expect(thresholdsReached(8_000, 10_000)).toEqual([80]);
		expect(thresholdsReached(10_000, 10_000)).toEqual([80, 100]);
		expect(thresholdsReached(-500, 10_000)).toEqual([]);
		// One paisa short of 80% of an odd amount.
		expect(thresholdsReached(26_666, 33_333)).toEqual([]);
		expect(thresholdsReached(26_667, 33_333)).toEqual([80]);
		expect(budgetState(9_000, 10_000)).toBe("near");
		expect(budgetState(12_000, 10_000)).toBe("over");
		expect(budgetState(100, 10_000)).toBe("ok");
		expect(percentOf(12_345, 10_000)).toBe(123);
		expect(percentOf(-1, 10_000)).toBe(0);
	});

	it("counts the days left, today included", () => {
		const range = { start: "2026-11-01", end: "2026-11-30" };
		expect(daysLeft(range, "2026-11-13")).toBe(18);
		expect(daysLeft(range, "2026-11-30")).toBe(1);
		expect(daysLeft(range, "2026-12-01")).toBe(0);
	});
});

describe("recurrence dates", () => {
	const monthly: Cadence = { unit: "month", every: 1 };

	it("keeps a month end through short months, counted from the first", () => {
		const days = [0, 1, 2, 3, 4].map((n) => occurrenceOn("2026-01-31", monthly, n));
		expect(days).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
		expect(occurrenceOn("2024-01-31", monthly, 1)).toBe("2024-02-29");
	});

	it("puts a leap day on the 28th in other years", () => {
		const yearly: Cadence = { unit: "year", every: 1 };
		expect([1, 2, 3, 4].map((n) => occurrenceOn("2024-02-29", yearly, n))).toEqual([
			"2025-02-28",
			"2026-02-28",
			"2027-02-28",
			"2028-02-29",
		]);
	});

	it("counts weeks and every n", () => {
		expect(occurrenceOn("2026-11-13", { unit: "week", every: 2 }, 3)).toBe("2026-12-25");
		expect(occurrenceOn("2026-11-30", { unit: "month", every: 3 }, 1)).toBe("2027-02-28");
		expect(occurrenceOn("2026-11-30", { unit: "month", every: 3 }, 2)).toBe("2027-05-30");
	});

	it("finds the first occurrence on or after a day", () => {
		expect(firstOnOrAfter("2026-01-31", monthly, "2026-03-01")).toEqual({ n: 2, on: "2026-03-31" });
		expect(firstOnOrAfter("2026-01-31", monthly, "2026-02-28")).toEqual({ n: 1, on: "2026-02-28" });
		expect(firstOnOrAfter("2026-11-13", monthly, "2026-11-01")).toEqual({ n: 0, on: "2026-11-13" });
		// Years later, still exact.
		expect(firstOnOrAfter("2020-05-15", { unit: "week", every: 1 }, "2026-11-13")).toEqual({
			n: 339,
			on: "2026-11-13",
		});
	});

	it("catches up on what was missed, until the end and at most the cap", () => {
		const recurring = { startsOn: "2026-08-05", cadence: monthly, nextN: 1, endsOn: null };
		expect(dueOccurrences(recurring, "2026-11-13")).toEqual([
			{ n: 1, on: "2026-09-05" },
			{ n: 2, on: "2026-10-05" },
			{ n: 3, on: "2026-11-05" },
		]);
		expect(dueOccurrences({ ...recurring, endsOn: "2026-10-10" }, "2026-11-13")).toHaveLength(2);
		expect(dueOccurrences(recurring, "2026-11-13", 2)).toHaveLength(2);
		expect(dueOccurrences({ ...recurring, nextN: 4 }, "2026-11-13")).toEqual([]);
	});
});

describe("statement days and budget notifications", () => {
	it("orders the days and keeps a statement within two years", () => {
		expect(statementOf({ from: "2026-11-30", to: "2026-11-01" })).toEqual({ from: "2026-11-01", to: "2026-11-30" });
		expect(statementOf({ from: "2020-01-01", to: "2026-11-13" })).toEqual({ from: "2024-11-13", to: "2026-11-13" });
		expect(statementOf({})).toEqual({});
	});

	it("points a budget's alert at Insights' budgets", () => {
		expect(notifyPath(budgetTarget("4b0f6c1e-1c47-4f8b-9a63-8f1d2c3b4a59"))).toBe("/app/kharcha/insights/budgets");
		expect(notifyPath("g:4b0f6c1e-1c47-4f8b-9a63-8f1d2c3b4a59")).toBe(
			"/app/kharcha/g/4b0f6c1e-1c47-4f8b-9a63-8f1d2c3b4a59",
		);
	});
});
