import { describe, expect, it } from "vitest";
import { burnSeries } from "@/features/taskline/sprints/burndown";
import { BACKLOG_SECTION, backlogLayout, rowDrop, rowStep, sectionPoints } from "@/features/taskline/sprints/moves";
import type { SprintReport, SprintSummary, TaskSummary } from "@/features/taskline/types";
import { isOrderKey } from "@/lib/fractional-index";

/**
 * Sprints' pure parts (Task 52): the burndown and burnup from daily snapshots (0216),
 * and the backlog's layout and moves.
 */

const sprint = (values: Partial<SprintSummary> = {}): SprintSummary => ({
	id: "s1",
	name: "Sprint 1",
	goal: "",
	state: "active",
	startOn: "2026-11-01",
	endOn: "2026-11-07",
	startedAt: "2026-11-01T03:00:00.000Z",
	completedAt: null,
	committed: { points: 10, tasks: 4, minutes: 0 },
	completed: null,
	...values,
});

const totals = (scopePoints: number, donePoints: number, scopeTasks = 4, doneTasks = 0) => ({
	scopePoints,
	donePoints,
	scopeTasks,
	doneTasks,
	// Task 53: every point is an hour of estimate here.
	scopeMinutes: scopePoints * 60,
	doneMinutes: donePoints * 60,
});

// 2026-11-01 is a Sunday; the week Sunday–Friday works, Saturday (11-07) is off.
const SUN_TO_FRI = [0, 1, 2, 3, 4, 5];

const report = (
	values: Partial<SprintReport> = {},
): Pick<SprintReport, "sprint" | "days" | "live" | "today" | "workingDays"> => ({
	sprint: sprint(),
	days: [{ day: "2026-10-31", ...totals(10, 0) }],
	live: null,
	today: "2026-11-04",
	workingDays: SUN_TO_FRI,
	...values,
});

describe("the burndown", () => {
	it("starts from the day before, carries a missed day, ends today with the live totals", () => {
		const points = burnSeries(
			report({
				days: [
					{ day: "2026-10-31", ...totals(10, 0) },
					{ day: "2026-11-01", ...totals(10, 2) },
					// 11-02 missed by the job.
					{ day: "2026-11-03", ...totals(12, 5) },
				],
				live: totals(12, 7),
			}),
			"points",
		);
		expect(points.map((point) => [point.day, point.remaining])).toEqual([
			[null, 10],
			["2026-11-01", 8],
			["2026-11-02", 8],
			["2026-11-03", 7],
			["2026-11-04", 5],
			["2026-11-05", null],
			["2026-11-06", null],
			["2026-11-07", null],
		]);
		expect(points[3]).toMatchObject({ scope: 12, done: 5 });
	});

	it("falls ideally on working days only, to zero on the last working day", () => {
		const ideal = burnSeries(report(), "points").map((point) => point.ideal);
		// Six working days (Sunday–Friday), Saturday off: flat over it.
		expect(ideal).toEqual([10, 8.3, 6.7, 5, 3.3, 1.7, 0, 0]);
		const everyDay = burnSeries(report({ workingDays: [] }), "points").map((point) => point.ideal);
		expect(everyDay.at(-1)).toBe(0);
		expect(everyDay[1]).toBe(8.6);
	});

	it("counts tasks, falls back to the commitment, and draws nothing for a planned sprint", () => {
		const tasks = burnSeries(report({ days: [], live: totals(10, 3, 5, 2), today: "2026-11-01" }), "tasks");
		expect(tasks[0]).toMatchObject({ remaining: 4, scope: 4 });
		expect(tasks[1]).toMatchObject({ day: "2026-11-01", remaining: 3, scope: 5, done: 2 });
		const planned = burnSeries(report({ sprint: sprint({ state: "planned", committed: null }), days: [] }), "points");
		expect(planned.slice(1).every((point) => point.remaining === null)).toBe(true);
	});

	it("runs past the last day for a sprint completed late, and stops on that day", () => {
		const points = burnSeries(
			report({
				sprint: sprint({ state: "completed", completedAt: "2026-11-09T10:00:00.000Z" }),
				days: [
					{ day: "2026-10-31", ...totals(10, 0) },
					{ day: "2026-11-09", ...totals(10, 9) },
				],
				today: "2026-11-12",
			}),
			"points",
		);
		expect(points.at(-1)).toMatchObject({ day: "2026-11-09", remaining: 1, ideal: 0 });
		expect(points).toHaveLength(10);
	});
});

const task = (id: string, rank: string, values: Partial<TaskSummary> = {}): TaskSummary => ({
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
	rank,
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
	...values,
});

describe("the backlog", () => {
	const active = sprint();
	const planned = sprint({ id: "s2", name: "Sprint 2", state: "planned" });
	const tasks = [
		task("1", "a1", { sprintId: "s1", points: 3 }),
		task("2", "a3", { sprintId: "s1" }),
		task("3", "a2", { sprintId: "s1", statusId: "done", points: 5 }),
		task("4", "a0"),
		task("5", "a4"),
		task("6", "a5", { statusId: "done" }),
		task("7", "a6", { sprintId: "old" }),
	];
	const layout = backlogLayout([active, planned], tasks, (each) => each.statusId === "done");

	it("lays out the open sprints in rank order, then the backlog's open tasks", () => {
		expect(layout.map((section) => [section.id, section.tasks.map((each) => each.id)])).toEqual([
			["s1", ["1", "3", "2"]],
			["s2", []],
			[BACKLOG_SECTION, ["4", "5"]],
		]);
		expect(sectionPoints(layout[0]?.tasks ?? [])).toEqual({ points: 8, unestimated: 1 });
	});

	it("drops a task between neighbours, at a section's end, and does nothing in place", () => {
		const into = rowDrop(layout, "5", "s1", 1);
		expect(into?.sprintId).toBe("s1");
		expect((into?.rank ?? "") > "a1" && (into?.rank ?? "") < "a2").toBe(true);
		expect(rowDrop(layout, "1", BACKLOG_SECTION, Number.POSITIVE_INFINITY)).toMatchObject({ sprintId: null });
		expect(rowDrop(layout, "4", "s2", 0)).toMatchObject({ sprintId: "s2" });
		expect(rowDrop(layout, "1", "s1", 0)).toBeNull();
	});

	it("steps past a section's edge into the next one, and stops at the page's edges", () => {
		const down = rowStep(layout, "2", "down");
		expect(down?.sprintId).toBe("s2");
		const up = rowStep(layout, "4", "up");
		expect(up?.sprintId).toBe("s2");
		expect(rowStep(layout, "1", "up")).toBeNull();
		expect(rowStep(layout, "5", "down")).toBeNull();
		const within = rowStep(layout, "2", "up");
		expect(within?.sprintId).toBe("s1");
		expect((within?.rank ?? "") > "a1" && (within?.rank ?? "") < "a2").toBe(true);
	});

	it("ignores a new task's placeholder rank", () => {
		const drafts = backlogLayout([], [task("1", "a1"), task("0", "~", { number: 0 })], () => false);
		const rank = rowDrop(drafts, "1", BACKLOG_SECTION, 2)?.rank ?? "";
		expect(isOrderKey(rank) && rank < "~").toBe(true);
	});
});
