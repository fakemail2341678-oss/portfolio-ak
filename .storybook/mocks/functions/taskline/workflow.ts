import { fn } from "storybook/test";
import type { TasklineLabel, TasklineStatus } from "../../../../src/features/taskline/types";
import { sampleProjectTasks } from "../../taskline";

// Stand-ins for src/functions/taskline/workflow.ts.
const status = () => sampleProjectTasks.statuses[0] as TasklineStatus;
const label = () => sampleProjectTasks.labels[0] as TasklineLabel;
export const createTasklineStatus = fn(
	async (_options: { data: unknown }): Promise<TasklineStatus> => status(),
).mockName("createTasklineStatus");
export const updateTasklineStatus = fn(
	async (_options: { data: unknown }): Promise<TasklineStatus> => status(),
).mockName("updateTasklineStatus");
export const deleteTasklineStatus = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"deleteTasklineStatus",
);
export const createTasklineLabel = fn(async (_options: { data: unknown }): Promise<TasklineLabel> => label()).mockName(
	"createTasklineLabel",
);
export const updateTasklineLabel = fn(async (_options: { data: unknown }): Promise<TasklineLabel> => label()).mockName(
	"updateTasklineLabel",
);
export const deleteTasklineLabel = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"deleteTasklineLabel",
);
