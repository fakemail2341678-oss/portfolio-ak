import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { sampleSprintProject } from "../../../../.storybook/mocks/taskline";
import { isClosedCategory, type TaskSummary } from "../types";
import { Backlog } from "./backlog";
import { backlogLayout } from "./moves";

const { statuses, members, sprints, velocity } = sampleSprintProject;
const closed = new Set(statuses.filter((status) => isClosedCategory(status.category)).map((status) => status.id));

/** The backlog with its moves and points applied to local state, as the page applies them to its collection. */
function LiveBacklog({ canEdit = true }: { canEdit?: boolean }) {
	const [tasks, setTasks] = useState<TaskSummary[]>(sampleSprintProject.tasks);
	const patch = (id: string, change: Partial<TaskSummary>) =>
		setTasks((all) => all.map((each) => (each.id === id ? { ...each, ...change } : each)));
	return (
		<Backlog
			sections={backlogLayout(sprints, tasks, (task) => closed.has(task.statusId))}
			statuses={statuses}
			members={members}
			measure="points"
			velocity={velocity.points}
			canEdit={canEdit}
			onMove={(task, move) => patch(task.id, move)}
			onPoints={(task, points) => patch(task.id, { points })}
			onAdd={() => undefined}
			renderOpen={(_task, children) => (
				<button type="button" className="min-w-0 text-start hover:underline">
					{children}
				</button>
			)}
			renderActions={(section) =>
				section.sprint && canEdit ? (
					<Button size="sm" variant="outline">
						{section.sprint.state === "active" ? m.taskline_sprint_complete() : m.taskline_sprint_start_action()}
					</Button>
				) : null
			}
		/>
	);
}

const meta = {
	title: "Taskline/Backlog",
	component: LiveBacklog,
} satisfies Meta<typeof LiveBacklog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The active sprint (over the recent velocity), the planned one, then the backlog. */
export const Sections: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("backlog-sprint")).toHaveLength(2);
		await expect(canvas.getByTestId("backlog-over")).toBeVisible();
	},
};

/** Alt + ↓ on the active sprint's last task moves it into the planned sprint, and says so. */
export const KeyboardMove: Story = {
	play: async ({ canvas, userEvent }) => {
		const [active] = canvas.getAllByTestId("backlog-sprint");
		const handles = active?.querySelectorAll<HTMLButtonElement>("[data-testid='backlog-handle']") ?? [];
		const last = handles[handles.length - 1];
		if (!last) throw new Error("no handle");
		last.focus();
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(canvas.getByTestId("taskline-announcement")).toHaveTextContent(/Sprint 3|स्प्रिन्ट/);
	},
};

/** A reader: no handles, no points fields, no "Add task". */
export const ReadOnly: Story = {
	args: { canEdit: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryAllByTestId("backlog-handle")).toHaveLength(0);
		await expect(canvas.queryAllByTestId("backlog-points")).toHaveLength(0);
	},
};
