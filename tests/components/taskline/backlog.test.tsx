// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Backlog } from "@/features/taskline/sprints/backlog";
import { backlogLayout } from "@/features/taskline/sprints/moves";
import type { SprintSummary, TasklineStatus, TaskSummary } from "@/features/taskline/types";

/**
 * Taskline's backlog from the keyboard (Task 52): Alt + up and down on a task's handle
 * move it one place, and past a section's edge into the next section; each move is
 * announced. Editors set points in the row. The backlog reports changes; this harness
 * applies them, as the page does through its collection. A reader gets no handles.
 */

const STATUSES: TasklineStatus[] = [
	{ id: "todo", name: "To do", category: "unstarted", color: "gray", position: "a0", wipLimit: null },
];

const SPRINT: SprintSummary = {
	id: "s1",
	name: "Sprint 1",
	goal: "Ship the menu",
	state: "active",
	startOn: "2026-11-01",
	endOn: "2026-11-14",
	startedAt: "2026-11-01T03:00:00.000Z",
	completedAt: null,
	committed: { points: 5, tasks: 2, minutes: 0 },
	completed: null,
};

const task = (
	id: string,
	title: string,
	rank: string,
	sprintId: string | null,
	points: number | null,
): TaskSummary => ({
	id,
	ref: `WEB-${id}`,
	number: Number(id),
	type: "task",
	title,
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
	sprintId,
	points,
	rank,
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
});

function Harness({ canEdit = true, onPoints = vi.fn() }: { canEdit?: boolean; onPoints?: () => void }) {
	const [tasks, setTasks] = useState([
		task("1", "Plan", "a0", "s1", 3),
		task("2", "Build", "a1", "s1", 2),
		task("3", "Ship", "a2", null, null),
	]);
	return (
		<Backlog
			sections={backlogLayout([SPRINT], tasks, () => false)}
			statuses={STATUSES}
			members={[]}
			measure="points"
			velocity={4}
			canEdit={canEdit}
			onMove={(moved, move) =>
				setTasks((all) => all.map((each) => (each.id === moved.id ? { ...each, ...move } : each)))
			}
			onPoints={onPoints}
			onAdd={vi.fn()}
			renderOpen={(_task, children) => children}
			renderActions={() => null}
		/>
	);
}

/** Each section's heading and its tasks' titles, in the order shown. */
const sections = () =>
	[...screen.getAllByTestId("backlog-sprint"), ...screen.getAllByTestId("backlog-section")].map((element) => [
		within(element).getAllByRole("heading")[0]?.textContent,
		within(element)
			.queryAllByTestId("backlog-title")
			.map((title) => title.textContent),
	]);

describe("Taskline backlog, from the keyboard", () => {
	it("moves a task within its sprint, then into the backlog, announcing each move", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(sections()).toEqual([
			["Sprint 1Active", ["Build", "Plan"]],
			["Backlog", ["Ship"]],
		]);
		expect(screen.getByTestId("taskline-announcement")).toHaveTextContent("Plan moved to Sprint 1, position 2 of 2.");

		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(sections()).toEqual([
			["Sprint 1Active", ["Build"]],
			["Backlog", ["Plan", "Ship"]],
		]);
		expect(screen.getByTestId("taskline-announcement")).toHaveTextContent("Plan moved to Backlog, position 1 of 2.");

		// And back up into the sprint's end.
		screen.getByRole("button", { name: "Move task Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
		expect(sections()[0]).toEqual(["Sprint 1Active", ["Build", "Plan"]]);
	});

	it("shows totals against the velocity, and saves points on Enter", async () => {
		const user = userEvent.setup();
		const onPoints = vi.fn();
		render(<Harness onPoints={onPoints} />);
		const [sprintTotal, backlogTotal] = screen.getAllByTestId("backlog-total");
		expect(sprintTotal).toHaveTextContent("Points: 5");
		expect(backlogTotal).toHaveTextContent("Points: 0 · not estimated: 1");
		expect(screen.getByTestId("backlog-over")).toHaveTextContent("More than the recent velocity (4)");
		const field = screen.getByRole("spinbutton", { name: "Points for Ship" });
		await user.type(field, "8{Enter}");
		expect(onPoints).toHaveBeenCalledWith(expect.objectContaining({ id: "3" }), 8);
	});

	it("gives a reader no handles and no points fields", () => {
		render(<Harness canEdit={false} />);
		expect(screen.queryByTestId("backlog-handle")).toBeNull();
		expect(screen.queryByTestId("backlog-points")).toBeNull();
		expect(screen.queryByTestId("backlog-add-open")).toBeNull();
	});
});
