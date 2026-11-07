import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { sampleProjectTasks } from "../../../../.storybook/mocks/taskline";
import { PRIORITY_LABELS } from "../labels";
import { TASK_PRIORITIES, type TasklineStatus, type TaskSummary } from "../types";
import { Board, type BoardLane } from "./board";

const { statuses, members, labels, today } = sampleProjectTasks;

/** The board with its moves applied to local state, as the page applies them to its collection. */
function LiveBoard({
	onAdd,
	swimlanes = false,
	canEdit = true,
}: {
	onAdd: (status: TasklineStatus, lane: BoardLane, title: string) => void;
	swimlanes?: boolean;
	canEdit?: boolean;
}) {
	const [tasks, setTasks] = useState<TaskSummary[]>(sampleProjectTasks.tasks);
	const lanes: BoardLane[] = swimlanes
		? [...TASK_PRIORITIES]
				.reverse()
				.map((priority) => ({
					id: `p${priority}`,
					label: PRIORITY_LABELS[priority](),
					tasks: tasks.filter((task) => task.priority === priority),
				}))
				.filter((lane) => lane.tasks.length > 0)
		: [{ id: "all", label: null, tasks }];
	return (
		<Board
			statuses={statuses}
			lanes={lanes}
			allTasks={tasks}
			members={members}
			labels={labels}
			today={today}
			hiddenClosed={new Map([["st-done", 4]])}
			doneColumnDays={14}
			canEdit={canEdit}
			onMove={(moved, move) =>
				setTasks((all) => all.map((each) => (each.id === moved.id ? { ...each, ...move } : each)))
			}
			onAdd={onAdd}
			renderOpen={(_task, children) => (
				<button type="button" className="text-start hover:underline">
					{children}
				</button>
			)}
		/>
	);
}

const meta = {
	title: "Taskline/Board",
	component: LiveBoard,
	args: { onAdd: fn() },
} satisfies Meta<typeof LiveBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Types, priorities, assignees, labels, an overdue date, subtask and checklist progress, a column over its WIP limit. */
export const BoardView: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("taskline-column")).toHaveLength(3);
		await expect(
			canvas.getByText(m.taskline_subtasks_progress({ done: formatNumber(0), total: formatNumber(2) })),
		).toBeVisible();
		await expect(canvas.getByTestId("taskline-wip")).toBeVisible();
		await expect(canvas.getByTestId("taskline-hidden-closed")).toBeVisible();
	},
};

/** Alt + → on a task's handle moves it into the next column, and says so. */
export const KeyboardMove: Story = {
	play: async ({ canvas, userEvent }) => {
		canvas.getByRole("button", { name: m.taskline_move_task({ task: "Write the homepage copy" }) }).focus();
		await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
		const doing = canvas.getAllByTestId("taskline-column")[1];
		if (!doing) throw new Error("no column");
		await expect(within(doing).getByText("Write the homepage copy")).toBeVisible();
		await expect(canvas.getByTestId("taskline-announcement")).toHaveTextContent("Write the homepage copy");
	},
};

/** The form at a column's foot adds a task. */
export const AddTask: Story = {
	play: async ({ canvas, userEvent, args }) => {
		const [todo] = canvas.getAllByTestId("taskline-column");
		if (!todo) throw new Error("no column");
		await userEvent.click(within(todo).getByTestId("taskline-add-task-open"));
		await userEvent.type(within(todo).getByRole("textbox"), "Another task{Enter}");
		await expect(args.onAdd).toHaveBeenCalledWith(
			expect.objectContaining({ id: "st-todo" }),
			expect.objectContaining({ id: "all" }),
			"Another task",
		);
	},
};

/** Swimlanes by priority: a row per priority that has tasks, urgent first. */
export const Swimlanes: Story = {
	args: { swimlanes: true },
	play: async ({ canvas }) => {
		const lanes = canvas.getAllByTestId("taskline-lane");
		await expect(within(lanes[0] as HTMLElement).getByRole("heading", { level: 3 })).toHaveTextContent(
			m.taskline_priority_urgent(),
		);
	},
};

/** A reader: no handles and no way to add. */
export const ReadOnly: Story = {
	args: { canEdit: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryAllByTestId("taskline-card-handle")).toHaveLength(0);
		await expect(canvas.queryByTestId("taskline-add-task-open")).toBeNull();
	},
};
