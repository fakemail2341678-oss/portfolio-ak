import { describe, expect, it } from "vitest";
import {
	boardLayout,
	cardDrop,
	cardPlace,
	cardStep,
	endPosition,
	type TaskMove,
} from "@/features/taskline/board/moves";
import type { TasklineStatus, TaskSummary } from "@/features/taskline/types";

/** The board's moves (Kanban's, decision 0188, on statuses): each one is a single new position, the same for pointer and keys. */
const status = (id: string, position: string): TasklineStatus => ({
	id,
	name: id.toUpperCase(),
	category: "started",
	color: "gray",
	position,
	wipLimit: null,
});
const task = (id: string, statusId: string, position: string): TaskSummary => ({
	id,
	ref: `WEB-${id}`,
	number: 1,
	type: "task",
	title: id,
	statusId,
	priority: 0,
	assigneeId: null,
	parentId: null,
	labelIds: [],
	position,
	startOn: null,
	dueOn: null,
	completedAt: null,
	checklist: { done: 0, total: 0 },
	updatedAt: "2026-10-31T00:00:00.000Z",
	sprintId: null,
	points: null,
	rank: "c000",
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
});

// Given out of order on purpose: the layout sorts.
const statuses = [status("doing", "a1"), status("todo", "a0"), status("done", "a2")];
const tasks = [task("b", "todo", "a1"), task("a", "todo", "a0"), task("c", "todo", "a2"), task("x", "doing", "a0")];
const layout = boardLayout(statuses, tasks);
const titles = (statusId: string, list: ReadonlyArray<TaskSummary>) =>
	boardLayout(statuses, list)
		.cards.get(statusId)
		?.map((each) => each.id);

/** The board's tasks after applying a move to one of them. */
const apply = (id: string, move: TaskMove | null) =>
	tasks.map((each) => (each.id === id && move ? { ...each, ...move } : each));

describe("boardLayout", () => {
	it("orders statuses and each status's tasks by position", () => {
		expect(layout.columns.map((each) => each.id)).toEqual(["todo", "doing", "done"]);
		expect(layout.cards.get("todo")?.map((each) => each.id)).toEqual(["a", "b", "c"]);
		expect(layout.cards.get("done")).toEqual([]);
	});

	it("leaves out tasks of a status it doesn't have", () => {
		const stray = boardLayout(statuses, [...tasks, task("lost", "gone", "a0")]);
		expect([...stray.cards.values()].flat().map((each) => each.id)).not.toContain("lost");
	});
});

describe("task moves", () => {
	it("moves a task up and down its column", () => {
		const down = cardStep(layout, "a", "down");
		expect(titles("todo", apply("a", down))).toEqual(["b", "a", "c"]);
		const up = cardStep(layout, "c", "up");
		expect(titles("todo", apply("c", up))).toEqual(["a", "c", "b"]);
		expect(cardStep(layout, "a", "up")).toBeNull();
		expect(cardStep(layout, "c", "down")).toBeNull();
	});

	it("moves a task into the next column at the same height, or its end", () => {
		const right = cardStep(layout, "b", "right");
		expect(right?.statusId).toBe("doing");
		expect(titles("doing", apply("b", right))).toEqual(["x", "b"]);
		const intoEmpty = cardStep(boardLayout(statuses, apply("x", { statusId: "doing", position: "a0" })), "x", "right");
		expect(intoEmpty?.statusId).toBe("done");
		expect(cardStep(layout, "a", "left")).toBeNull();
	});

	it("drops a task at an index of any column, or past its end", () => {
		const drop = cardDrop(layout, "c", "todo", 0);
		expect(titles("todo", apply("c", drop))).toEqual(["c", "a", "b"]);
		const across = cardDrop(layout, "a", "doing", 1);
		expect(titles("doing", apply("a", across))).toEqual(["x", "a"]);
		// A drop on a column itself: its end.
		const end = cardDrop(layout, "a", "doing", Number.POSITIVE_INFINITY);
		expect(titles("doing", apply("a", end))).toEqual(["x", "a"]);
		// Its own place: nothing to do.
		expect(cardDrop(layout, "b", "todo", 1)).toBeNull();
	});

	it("keeps a lane's move between the same neighbours in the whole column", () => {
		// A lane with only a and c: moving c above a lands before a in the full column too.
		const lane = boardLayout(
			statuses,
			[tasks[1], tasks[2]].filter((each) => each !== undefined),
		);
		const move = cardDrop(lane, "c", "todo", 0);
		expect(titles("todo", apply("c", move))).toEqual(["c", "a", "b"]);
	});

	it("says where a moved task lands, for the announcement", () => {
		const move = cardStep(layout, "b", "right");
		if (!move) throw new Error("no move");
		const place = cardPlace(layout, "b", move);
		expect(place.column?.id).toBe("doing");
		expect(place.index).toBe(1);
		expect(place.total).toBe(2);
	});

	it("puts a new task after the last one, in any order given", () => {
		expect(endPosition(layout.cards.get("todo") ?? [])).toBe("a3");
		expect(endPosition([task("q", "todo", "a2"), task("p", "todo", "a0")])).toBe("a3");
		expect(endPosition([])).toBe("a0");
	});
});
