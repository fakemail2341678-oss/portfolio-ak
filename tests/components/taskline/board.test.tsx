// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Board, type BoardLane } from "@/features/taskline/board/board";
import type { TasklineStatus, TaskSummary } from "@/features/taskline/types";

/**
 * Taskline's board from the keyboard (Kanban's, decision 0188): Alt + arrows on a
 * task's handle move it within its column and across columns, within its lane; every
 * move is announced. The board reports moves; this harness applies them, as the page
 * does through its collection. A reader gets no handles and no "Add task".
 */
const status = (id: string, name: string, position: string, wipLimit: number | null = null): TasklineStatus => ({
	id,
	name,
	category: "started",
	color: "blue",
	position,
	wipLimit,
});
const task = (id: string, title: string, statusId: string, position: string, priority = 0): TaskSummary => ({
	id,
	ref: `WEB-${position.slice(1)}`,
	number: 1,
	type: "task",
	title,
	statusId,
	priority: priority as TaskSummary["priority"],
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

const STATUSES = [status("todo", "To do", "a0"), status("doing", "Doing", "a1", 1)];

function Harness({
	onAdd = vi.fn(),
	canEdit = true,
	byPriority = false,
}: {
	onAdd?: (status: TasklineStatus, lane: BoardLane, title: string) => void;
	canEdit?: boolean;
	byPriority?: boolean;
}) {
	const [tasks, setTasks] = useState([
		task("plan", "Plan", "todo", "a0", 3),
		task("build", "Build", "todo", "a1"),
		task("ship", "Ship", "doing", "a0", 3),
	]);
	const lanes: BoardLane[] = byPriority
		? [
				{ id: "p3", label: "High", tasks: tasks.filter((each) => each.priority === 3) },
				{ id: "p0", label: "No priority", tasks: tasks.filter((each) => each.priority === 0) },
			]
		: [{ id: "all", label: null, tasks }];
	return (
		<Board
			statuses={STATUSES}
			lanes={lanes}
			allTasks={tasks}
			members={[]}
			labels={[]}
			today="2026-10-31"
			hiddenClosed={new Map()}
			doneColumnDays={14}
			canEdit={canEdit}
			onMove={(moved, move) =>
				setTasks((all) => all.map((each) => (each.id === moved.id ? { ...each, ...move } : each)))
			}
			onAdd={onAdd}
			renderOpen={(_task, children) => children}
		/>
	);
}

/** Each column's name and its tasks' titles, in the order shown. */
const board = (scope: HTMLElement = document.body) =>
	within(scope)
		.getAllByTestId("taskline-column")
		.map((element) => [
			within(element).getByRole("heading").textContent,
			within(element)
				.queryAllByTestId("taskline-card-title")
				.map((title) => title.textContent),
		]);

describe("Taskline board, from the keyboard", () => {
	it("moves a task down its column and into the next one, announcing each move", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(board()).toEqual([
			["To do", ["Build", "Plan"]],
			["Doing", ["Ship"]],
		]);
		expect(screen.getByTestId("taskline-announcement")).toHaveTextContent("Plan moved to To do, position 2 of 2.");

		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(board()).toEqual([
			["To do", ["Build"]],
			["Doing", ["Ship", "Plan"]],
		]);
		expect(screen.getByTestId("taskline-announcement")).toHaveTextContent("Plan moved to Doing, position 2 of 2.");
	});

	it("does nothing at an edge", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
		expect(board()).toEqual([
			["To do", ["Plan", "Build"]],
			["Doing", ["Ship"]],
		]);
	});

	it("warns when a column is over its WIP limit", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		expect(screen.queryByTestId("taskline-wip")).toBeNull();
		screen.getByRole("button", { name: "Move task Build" }).focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(screen.getByTestId("taskline-wip")).toHaveTextContent("Over its limit of 1");
	});

	it("keeps a task in its lane with swimlanes", async () => {
		const user = userEvent.setup();
		render(<Harness byPriority />);
		const [high, none] = screen.getAllByTestId("taskline-lane");
		if (!high || !none) throw new Error("no lanes");
		expect(board(high)).toEqual([
			["To do", ["Plan"]],
			["Doing", ["Ship"]],
		]);
		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		// Plan is alone in its lane's column: down is an edge there.
		expect(board(high)[0]).toEqual(["To do", ["Plan"]]);
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(board(high)).toEqual([
			["To do", []],
			// At the same height: first, before Ship.
			["Doing", ["Plan", "Ship"]],
		]);
		expect(board(none)).toEqual([
			["To do", ["Build"]],
			["Doing", []],
		]);
	});

	it("adds a task from a column's foot", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		render(<Harness onAdd={onAdd} />);
		const [todo] = screen.getAllByTestId("taskline-column");
		if (!todo) throw new Error("no column");
		await user.click(within(todo).getByRole("button", { name: "Add task" }));
		await user.type(within(todo).getByRole("textbox", { name: "New task in To do" }), "Test{Enter}");
		expect(onAdd).toHaveBeenCalledWith(
			expect.objectContaining({ id: "todo" }),
			expect.objectContaining({ id: "all" }),
			"Test",
		);
	});

	it("gives a reader no handles and no way to add", () => {
		render(<Harness canEdit={false} />);
		expect(screen.queryAllByTestId("taskline-card-handle")).toEqual([]);
		expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
		expect(board()).toEqual([
			["To do", ["Plan", "Build"]],
			["Doing", ["Ship"]],
		]);
	});
});
