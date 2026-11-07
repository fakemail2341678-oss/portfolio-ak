import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { m } from "@/paraglide/messages";
import { sampleProjectTasks } from "../../../../.storybook/mocks/taskline";
import type { TaskSummary } from "../types";
import { Calendar } from "./calendar";
import { calendarWeeks, monthOf } from "./grid";

const { statuses, today } = sampleProjectTasks;

/** The calendar with its moves applied to local state, as the page applies them to its collection. */
function LiveCalendar({ mode = "month", canEdit = true }: { mode?: "month" | "week"; canEdit?: boolean }) {
	const [tasks, setTasks] = useState<TaskSummary[]>(sampleProjectTasks.tasks);
	return (
		<Calendar
			weeks={calendarWeeks(today, mode, 0)}
			month={mode === "month" ? monthOf(today) : null}
			today={today}
			anchor={today}
			workingDays={[0, 1, 2, 3, 4, 5]}
			tasks={tasks.filter((task) => task.dueOn !== null || task.completedAt === null)}
			dayOf={(task) => task.dueOn}
			statuses={statuses}
			canEdit={canEdit}
			onMove={(moved, day) =>
				setTasks((all) => all.map((each) => (each.id === moved.id ? { ...each, dueOn: day } : each)))
			}
			renderOpen={(_task, children) => (
				<button type="button" className="min-w-0 text-start hover:underline">
					{children}
				</button>
			)}
		/>
	);
}

const meta = {
	title: "Taskline/Calendar",
	component: LiveCalendar,
} satisfies Meta<typeof LiveCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A month, Sunday first, today marked, Saturdays shaded, the undated tasks beside it. */
export const Month: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("calendar-day").length % 7).toBe(0);
		await expect(canvas.getByTestId("calendar-undated")).toBeVisible();
	},
};

/** One week, with taller days. */
export const Week: Story = {
	args: { mode: "week" },
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("calendar-day")).toHaveLength(7);
	},
};

/** Alt + → on a dated task's handle moves it a day later, and says so. */
export const KeyboardMove: Story = {
	play: async ({ canvas, userEvent }) => {
		const handle = canvas.getAllByTestId("calendar-task-handle").find((each) => each.closest("[data-day]"));
		if (!handle) throw new Error("no dated task");
		handle.focus();
		await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
		await expect(canvas.getByTestId("taskline-announcement")).not.toBeEmptyDOMElement();
	},
};

/** A reader: no handles. */
export const ReadOnly: Story = {
	args: { canEdit: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryAllByTestId("calendar-task-handle")).toHaveLength(0);
		await expect(canvas.getByRole("heading", { name: new RegExp(m.taskline_calendar_undated()) })).toBeVisible();
	},
};
