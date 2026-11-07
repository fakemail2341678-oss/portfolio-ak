import { describe, expect, it } from "vitest";
import {
	arrowsOf,
	barOf,
	conflicts,
	DAY_WIDTH,
	daysBetween,
	dragDays,
	milestoneProgress,
	ROW_HEIGHT,
	rangeWidth,
	restDays,
	shiftDates,
	stepTimeline,
	ticksOf,
	timelineGroups,
	timelineRange,
} from "@/features/taskline/timeline/layout";
import type { Milestone, TasklineMember, TasklineStatus, TaskSummary } from "@/features/taskline/types";

/**
 * The timeline's geometry (Task 54): the days each zoom shows, bars cut at the range's
 * edges, the header, days off, the rows and their groups, the arrows and conflicts,
 * and what a keyboard step or a drag does to a task's dates.
 */

const task = (id: string, values: Partial<TaskSummary> = {}): TaskSummary => ({
	id,
	ref: `WEB-${id}`,
	number: Number(id),
	type: "task",
	title: `Task ${id}`,
	statusId: "todo",
	priority: 0,
	assigneeId: null,
	parentId: null,
	labelIds: [],
	position: "a0",
	startOn: null,
	dueOn: null,
	completedAt: null,
	checklist: { done: 0, total: 0 },
	updatedAt: "2026-11-01T00:00:00.000Z",
	sprintId: null,
	points: null,
	rank: "a0",
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
	...values,
});

// 2026-11-04 is a Wednesday.
const ANCHOR = "2026-11-04";

describe("the range", () => {
	it("shows six weeks from the week before (day), half a year (week), or a year from two months before (month)", () => {
		const day = timelineRange(ANCHOR, "day", 0);
		expect(day).toMatchObject({ from: "2026-10-25", to: "2026-12-05", days: 42 });
		expect(rangeWidth(day)).toBe(42 * DAY_WIDTH.day);
		// A Monday week start moves the first day.
		expect(timelineRange(ANCHOR, "day", 1).from).toBe("2026-10-26");
		expect(timelineRange(ANCHOR, "week", 0)).toMatchObject({ from: "2026-10-04", days: 182 });
		const month = timelineRange(ANCHOR, "month", 0);
		expect(month).toMatchObject({ from: "2026-09-01", to: "2027-08-31", days: 365 });
	});

	it("pages by four weeks, thirteen weeks or six months", () => {
		expect(stepTimeline(ANCHOR, "day", 1)).toBe("2026-12-02");
		expect(stepTimeline(ANCHOR, "week", -1)).toBe("2026-08-05");
		expect(stepTimeline(ANCHOR, "month", 1)).toBe("2027-05-01");
		expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
	});

	it("labels the months and the days or weeks, and shades the days off", () => {
		const range = timelineRange(ANCHOR, "day", 0);
		const { months, ticks } = ticksOf(range, 0);
		expect(months.map((month) => month.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
		expect(months[0]).toMatchObject({ x: 0, width: 7 * DAY_WIDTH.day });
		expect(ticks).toHaveLength(42);
		// Weeks: a tick on each week start (Sundays here).
		const weekly = ticksOf(timelineRange(ANCHOR, "week", 0), 0).ticks;
		expect(weekly).toHaveLength(26);
		expect(ticksOf(timelineRange(ANCHOR, "month", 0), 0).ticks).toEqual([]);
		// Nepal's week: Saturday off.
		const off = restDays(range, [0, 1, 2, 3, 4, 5]);
		expect(off.map((day) => day.day).slice(0, 2)).toEqual(["2026-10-31", "2026-11-07"]);
		expect(off).toHaveLength(6);
		expect(restDays(timelineRange(ANCHOR, "month", 0), [1, 2, 3, 4, 5])).toEqual([]);
	});
});

describe("bars", () => {
	const range = timelineRange(ANCHOR, "day", 0);
	const width = DAY_WIDTH.day;

	it("runs from the start to the due date, either standing for both", () => {
		expect(barOf(task("1", { startOn: "2026-11-02", dueOn: "2026-11-05" }), range)).toMatchObject({
			x: 8 * width,
			width: 4 * width,
			place: "in",
			cutStart: false,
			cutEnd: false,
		});
		expect(barOf(task("2", { dueOn: "2026-11-02" }), range)).toMatchObject({ x: 8 * width, width });
		expect(barOf(task("3", { startOn: "2026-11-02" }), range)).toMatchObject({
			start: "2026-11-02",
			end: "2026-11-02",
		});
		// A due date before the start still draws a bar, the right way round.
		expect(barOf(task("4", { startOn: "2026-11-05", dueOn: "2026-11-02" }), range)).toMatchObject({
			start: "2026-11-02",
			end: "2026-11-05",
		});
		expect(barOf(task("5"), range)).toBeNull();
	});

	it("is cut at the range's edges, or lies wholly before or after it", () => {
		expect(barOf(task("1", { startOn: "2026-10-20", dueOn: "2026-10-27" }), range)).toMatchObject({
			x: 0,
			width: 3 * width,
			cutStart: true,
			place: "in",
		});
		expect(barOf(task("2", { startOn: "2026-12-01", dueOn: "2026-12-20" }), range)).toMatchObject({
			cutEnd: true,
			width: 5 * width,
		});
		expect(barOf(task("3", { dueOn: "2026-10-01" }), range)?.place).toBe("before");
		expect(barOf(task("4", { startOn: "2027-01-01" }), range)?.place).toBe("after");
	});
});

describe("rows", () => {
	const members: TasklineMember[] = [
		{ id: "m-a", userId: "a", name: "Asha", role: "member", title: "", placeholder: false, deactivated: false },
		{ id: "m-b", userId: "b", name: "Bikash", role: "member", title: "", placeholder: false, deactivated: false },
	];
	const milestones: Milestone[] = [
		{ id: "ms-1", name: "Beta", description: "", dueOn: "2026-11-10", completedAt: null, position: "a0" },
		{ id: "ms-2", name: "Launch", description: "", dueOn: "2026-12-01", completedAt: null, position: "a1" },
	];
	const tasks = [
		task("1", { type: "epic", startOn: "2026-11-01", dueOn: "2026-11-20" }),
		task("2", { parentId: "1", startOn: "2026-11-05", assigneeId: "m-b", milestoneId: "ms-2" }),
		task("3", { parentId: "2", startOn: "2026-11-02", assigneeId: "m-a", milestoneId: "ms-1" }),
		task("4", { dueOn: "2026-11-03" }),
		task("5"),
	];

	it("reads earliest first, undated last", () => {
		const [all] = timelineGroups(tasks, "none", { milestones, members });
		expect(all?.tasks.map((each) => each.id)).toEqual(["1", "3", "4", "2", "5"]);
		expect(timelineGroups([], "none", { milestones, members })).toEqual([]);
	});

	it("groups by epic (the epic first in its own), milestone or assignee, with the rest last", () => {
		const byEpic = timelineGroups(tasks, "epic", { milestones, members });
		expect(byEpic.map((group) => [group.id, group.tasks.map((each) => each.id)])).toEqual([
			["1", ["1", "3", "2"]],
			[null, ["4", "5"]],
		]);
		const byMilestone = timelineGroups(tasks, "milestone", { milestones, members });
		expect(byMilestone.map((group) => [group.id, group.tasks.map((each) => each.id)])).toEqual([
			["ms-1", ["3"]],
			["ms-2", ["2"]],
			[null, ["1", "4", "5"]],
		]);
		const byAssignee = timelineGroups(tasks, "assignee", { milestones, members });
		expect(byAssignee.map((group) => group.id)).toEqual(["m-a", "m-b", null]);
		// A subtask of an epic that's filtered out still goes under it.
		const filtered = timelineGroups([tasks[2] as TaskSummary], "epic", { milestones, members, all: tasks });
		expect(filtered.map((group) => group.id)).toEqual(["1"]);
	});
});

describe("dependencies on the timeline", () => {
	const range = timelineRange(ANCHOR, "day", 0);
	const tasks = [
		task("1", { startOn: "2026-11-01", dueOn: "2026-11-03" }),
		task("2", { startOn: "2026-11-06", dueOn: "2026-11-08" }),
		task("3", { startOn: "2026-11-02", dueOn: "2026-11-04" }),
		task("4", { startOn: "2026-11-02", dueOn: "2026-11-03", completedAt: "2026-11-03T00:00:00.000Z" }),
		task("5", { dueOn: "2026-09-01" }),
	];
	const deps = [
		{ blockerId: "1", blockedId: "2" },
		{ blockerId: "1", blockedId: "3" },
		{ blockerId: "4", blockedId: "3" },
		{ blockerId: "5", blockedId: "2" },
	];

	it("warns when an open blocker ends on or after the day the blocked task starts", () => {
		expect(conflicts(deps, tasks)).toEqual([
			{ blockerId: "1", blockedId: "3", blockerEnd: "2026-11-03", blockedStart: "2026-11-02" },
		]);
		// No dates, no warning.
		expect(conflicts([{ blockerId: "1", blockedId: "6" }], [...tasks, task("6")])).toEqual([]);
	});

	it("draws an arrow between bars in the range, around the row when the blocked task starts first", () => {
		const rows = new Map(
			tasks.flatMap((each, index) => {
				const bar = barOf(each, range);
				return bar ? [[each.id, { y: index * ROW_HEIGHT + ROW_HEIGHT / 2, bar }] as const] : [];
			}),
		);
		const arrows = arrowsOf(deps, rows, new Set(["1>3"]));
		// The one from WEB-5 (wholly before the range) isn't drawn.
		expect(arrows.map((arrow) => `${arrow.blockerId}>${arrow.blockedId}`)).toEqual(["1>2", "1>3", "4>3"]);
		const width = DAY_WIDTH.day;
		expect(arrows[0]?.path).toBe(`M ${10 * width} 18 H ${10 * width + 8} V 54 H ${12 * width}`);
		expect(arrows[1]).toMatchObject({ conflict: true });
		expect(arrows[1]?.path).toContain(`V ${2 * ROW_HEIGHT} H`);
		expect(arrows[2]?.conflict).toBe(false);
	});
});

describe("rescheduling", () => {
	it("moves both dates, or only the last day (never before the first)", () => {
		const both = { startOn: "2026-11-02", dueOn: "2026-11-05" };
		expect(shiftDates(both, 1, "move", ANCHOR)).toEqual({ startOn: "2026-11-03", dueOn: "2026-11-06" });
		expect(shiftDates(both, -2, "resize", ANCHOR)).toEqual({ startOn: "2026-11-02", dueOn: "2026-11-03" });
		expect(shiftDates(both, -9, "resize", ANCHOR)).toEqual({ startOn: "2026-11-02", dueOn: "2026-11-02" });
		// One date: moving keeps the other empty; resizing gives it both.
		expect(shiftDates({ startOn: null, dueOn: "2026-11-05" }, 1, "move", ANCHOR)).toEqual({
			startOn: null,
			dueOn: "2026-11-06",
		});
		expect(shiftDates({ startOn: "2026-11-05", dueOn: null }, 2, "resize", ANCHOR)).toEqual({
			startOn: "2026-11-05",
			dueOn: "2026-11-07",
		});
		// No dates: scheduled on the day shown.
		expect(shiftDates({ startOn: null, dueOn: null }, 1, "move", ANCHOR)).toEqual({
			startOn: ANCHOR,
			dueOn: ANCHOR,
		});
	});

	it("turns a drag's pixels into whole days at the zoom", () => {
		const range = timelineRange(ANCHOR, "week", 0);
		expect(dragDays(range, 24)).toBe(2);
		expect(dragDays(range, -16)).toBe(-2);
		expect(dragDays(range, 4)).toBe(0);
	});
});

describe("a milestone's progress", () => {
	const statuses: Array<Pick<TasklineStatus, "id" | "category">> = [
		{ id: "todo", category: "unstarted" },
		{ id: "done", category: "completed" },
		{ id: "dropped", category: "canceled" },
	];
	it("counts its tasks done, canceled ones aside, and says when it's late", () => {
		const tasks = [
			task("1", { milestoneId: "ms", statusId: "done", completedAt: "2026-11-01T00:00:00.000Z" }),
			task("2", { milestoneId: "ms", dueOn: "2026-11-01" }),
			task("3", { milestoneId: "ms", statusId: "dropped", completedAt: "2026-11-01T00:00:00.000Z" }),
			task("4", { milestoneId: "other" }),
		];
		expect(milestoneProgress({ id: "ms", dueOn: "2026-11-02", completedAt: null }, tasks, statuses, ANCHOR)).toEqual({
			total: 2,
			done: 1,
			open: 1,
			overdue: 1,
			late: true,
		});
		expect(
			milestoneProgress(
				{ id: "ms", dueOn: "2026-11-02", completedAt: "2026-11-02T00:00:00.000Z" },
				tasks,
				statuses,
				ANCHOR,
			).late,
		).toBe(false);
	});
});
