import { describe, expect, it } from "vitest";
import {
	firstWeekOf,
	milestoneAtRisk,
	percentile,
	taskDurations,
	type WeeklyTask,
	weeklySeries,
	workloadRows,
} from "@/features/taskline/reports/metrics";
import type { StatusCategory } from "@/features/taskline/types";

/** The reports' arithmetic (Task 57, decision 0225): cycle and lead time from the activity's status changes, and the rest. */

const CATEGORIES: Record<string, StatusCategory> = {
	todo: "unstarted",
	doing: "started",
	review: "started",
	done: "completed",
};
const categoryOf = (id: string) => CATEGORIES[id];
const at = (day: number, hour = 0) => new Date(Date.UTC(2026, 9, day, hour));
const task = { createdAt: at(1), completedAt: at(11) };

describe("taskDurations", () => {
	it("counts cycle time from the first move into a started status", () => {
		const moves = [
			{ at: at(3), from: "todo", to: "doing" },
			{ at: at(5), from: "doing", to: "review" },
			{ at: at(11), from: "review", to: "done" },
		];
		expect(taskDurations(task, moves, categoryOf)).toEqual({ leadDays: 10, cycleDays: 8 });
	});

	it("reads the moves in time order, whatever order they come in", () => {
		const moves = [
			{ at: at(11), from: "doing", to: "done" },
			{ at: at(3), from: "todo", to: "doing" },
		];
		expect(taskDurations(task, moves, categoryOf).cycleDays).toBe(8);
	});

	it("starts at creation when the first move is out of a started status", () => {
		const moves = [{ at: at(11), from: "doing", to: "done" }];
		expect(taskDurations(task, moves, categoryOf)).toEqual({ leadDays: 10, cycleDays: 10 });
	});

	it("doesn't restart the clock when a task is reopened and started again", () => {
		const moves = [
			{ at: at(2), from: "todo", to: "doing" },
			{ at: at(4), from: "doing", to: "done" },
			{ at: at(6), from: "done", to: "doing" },
			{ at: at(11), from: "doing", to: "done" },
		];
		expect(taskDurations(task, moves, categoryOf).cycleDays).toBe(9);
	});

	it("has no cycle time for a task never started", () => {
		expect(taskDurations(task, [], categoryOf)).toEqual({ leadDays: 10, cycleDays: null });
		const straight = [{ at: at(11), from: "todo", to: "done" }];
		expect(taskDurations(task, straight, categoryOf).cycleDays).toBeNull();
	});

	it("ignores statuses since deleted", () => {
		const moves = [{ at: at(3), from: "gone", to: "also-gone" }];
		expect(taskDurations(task, moves, categoryOf).cycleDays).toBeNull();
	});

	it("keeps fractions of a day", () => {
		const moves = [{ at: at(10, 12), from: "todo", to: "doing" }];
		expect(taskDurations(task, moves, categoryOf).cycleDays).toBe(0.5);
	});
});

describe("percentile", () => {
	it("takes the nearest rank", () => {
		expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
		expect(percentile([5, 1, 3], 0.5)).toBe(3);
		expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.85)).toBe(9);
		expect(percentile([7], 0.85)).toBe(7);
		expect(percentile([], 0.5)).toBeNull();
	});
});

describe("weeklySeries", () => {
	const first = "2026-10-04";
	const options = { first, weeks: 2, today: "2026-10-14" };
	const base: WeeklyTask = { createdOn: "2026-10-05", completedOn: null, closedOn: null, dueOn: null };

	it("counts created and completed by week", () => {
		const weeks = weeklySeries(
			[
				base,
				{ ...base, createdOn: "2026-10-12" },
				{ ...base, createdOn: "2026-09-01", completedOn: "2026-10-10", closedOn: "2026-10-10" },
				// Before the range: counted nowhere.
				{ ...base, createdOn: "2026-10-03" },
			],
			options,
		);
		expect(weeks.map(({ week, created, completed }) => ({ week, created, completed }))).toEqual([
			{ week: "2026-10-04", created: 1, completed: 1 },
			{ week: "2026-10-11", created: 1, completed: 0 },
		]);
	});

	it("counts overdue at each week's close, today for the week in progress", () => {
		const overdue = (task: WeeklyTask) => weeklySeries([task], options).map((week) => week.overdue);
		// Due in the first week and still open: overdue at both closes (the 10th and today, the 14th).
		expect(overdue({ ...base, dueOn: "2026-10-06" })).toEqual([1, 1]);
		// Due today isn't overdue yet; nor is one due on the first week's last day at that close.
		expect(overdue({ ...base, dueOn: "2026-10-14" })).toEqual([0, 0]);
		expect(overdue({ ...base, dueOn: "2026-10-10" })).toEqual([0, 1]);
		// Closed in the second week: overdue at the first close only.
		expect(overdue({ ...base, dueOn: "2026-10-06", closedOn: "2026-10-12" })).toEqual([1, 0]);
		// Created after the first close: not overdue before it existed.
		expect(overdue({ ...base, createdOn: "2026-10-12", dueOn: "2026-10-06" })).toEqual([0, 1]);
	});

	it("starts its range on the workspace's week start", () => {
		// 14 October 2026 is a Wednesday.
		expect(firstWeekOf("2026-10-14", 2, 0)).toBe("2026-10-04");
		expect(firstWeekOf("2026-10-14", 1, 1)).toBe("2026-10-12");
	});
});

describe("workloadRows", () => {
	it("adds up each assignee's open tasks, the most loaded first and nobody's last", () => {
		const rows = workloadRows(
			[
				{ assigneeId: null, dueOn: null, estimateMinutes: null, points: null },
				{ assigneeId: null, dueOn: null, estimateMinutes: null, points: 1 },
				{ assigneeId: null, dueOn: null, estimateMinutes: null, points: 1 },
				{ assigneeId: "a", dueOn: "2026-10-01", estimateMinutes: 60, points: 2 },
				{ assigneeId: "b", dueOn: "2026-10-20", estimateMinutes: 30, points: null },
				{ assigneeId: "b", dueOn: null, estimateMinutes: 30, points: 3 },
			],
			(id) => id.toUpperCase(),
			"2026-10-14",
		);
		expect(rows).toEqual([
			{ memberId: "b", name: "B", open: 2, overdue: 0, estimateMinutes: 60, points: 3 },
			{ memberId: "a", name: "A", open: 1, overdue: 1, estimateMinutes: 60, points: 2 },
			{ memberId: null, name: null, open: 3, overdue: 0, estimateMinutes: 0, points: 2 },
		]);
	});
});

describe("milestoneAtRisk", () => {
	const today = "2026-10-14";
	it("is past its day, or close with tasks open", () => {
		expect(milestoneAtRisk({ dueOn: "2026-10-13", open: 0 }, today)).toBe(true);
		expect(milestoneAtRisk({ dueOn: "2026-10-21", open: 1 }, today)).toBe(true);
		expect(milestoneAtRisk({ dueOn: "2026-10-21", open: 0 }, today)).toBe(false);
		expect(milestoneAtRisk({ dueOn: "2026-10-22", open: 5 }, today)).toBe(false);
		expect(milestoneAtRisk({ dueOn: null, open: 5 }, today)).toBe(false);
	});
});
