import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { sampleProjectTasks } from "../../../../.storybook/mocks/taskline";
import type { TimelineGroupBy, TimelineZoom } from "../search";
import type { TaskSummary } from "../types";
import { labelGroups } from "./labels";
import { timelineGroups, timelineRange } from "./layout";
import { Timeline } from "./timeline";

/** The timeline with its changes applied to local state, as the page applies them to its collection. */
function LiveTimeline({
	canEdit = true,
	group = "none",
	zoom = "day",
}: {
	canEdit?: boolean;
	group?: TimelineGroupBy;
	zoom?: TimelineZoom;
}) {
	const [tasks, setTasks] = useState<TaskSummary[]>(sampleProjectTasks.tasks);
	const project = { ...sampleProjectTasks, tasks };
	return (
		<Timeline
			range={timelineRange(project.today, zoom, 0)}
			today={project.today}
			anchor={project.today}
			weekStart={0}
			workingDays={[0, 1, 2, 3, 4, 5]}
			groups={labelGroups(
				timelineGroups(tasks, group, { milestones: project.milestones, members: project.members }),
				project,
			)}
			milestones={project.milestones}
			dependencies={project.dependencies}
			allTasks={tasks}
			canEdit={canEdit}
			onChange={(task, dates) =>
				setTasks((all) => all.map((each) => (each.id === task.id ? { ...each, ...dates } : each)))
			}
			onOpen={() => undefined}
			renderOpen={(_task, children) => (
				<button type="button" className="min-w-0 text-start hover:underline">
					{children}
				</button>
			)}
		/>
	);
}

const meta = {
	title: "Taskline/Timeline",
	component: LiveTimeline,
} satisfies Meta<typeof LiveTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Days: bars, the milestones, today's line, days off, the arrows (one starts before its blocker ends). */
export const Days: Story = {
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getAllByTestId("timeline-milestone").length).toBeGreaterThan(0);
		await expect(canvas.getAllByTestId("timeline-clash")).toHaveLength(1);
		const bar = canvas.getAllByTestId("timeline-bar").find((each) => each.dataset.start === "2026-10-30");
		if (!bar) throw new Error("no bar for WEB-4");
		bar.focus();
		await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
		await expect(bar.dataset.start).toBe("2026-10-31");
		await expect(canvas.getByTestId("taskline-announcement")).toHaveTextContent("WEB-4");
	},
};

/** Rows by milestone, each heading with its diamond, weeks wide. */
export const ByMilestone: Story = {
	args: { group: "milestone", zoom: "week" },
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("timeline-group")).toHaveLength(3);
	},
};

/** Someone who can only read: the bars don't move. */
export const Reader: Story = {
	args: { canEdit: false },
	play: async ({ canvas }) => {
		await expect(canvas.queryAllByRole("button", { name: /WEB-1/ })).toHaveLength(1);
	},
};
