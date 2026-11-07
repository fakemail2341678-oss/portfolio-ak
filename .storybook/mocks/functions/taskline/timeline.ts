import { fn } from "storybook/test";
import type { Milestone, TaskDetail } from "../../../../src/features/taskline/types";
import { sampleProjectTasks, sampleTaskDetail } from "../../taskline";

// Stand-ins for src/functions/taskline/timeline.ts.
const milestone = () => sampleProjectTasks.milestones[1] as Milestone;
export const createTasklineMilestone = fn(async (): Promise<Milestone> => milestone()).mockName(
	"createTasklineMilestone",
);
export const updateTasklineMilestone = fn(async (): Promise<Milestone> => milestone()).mockName(
	"updateTasklineMilestone",
);
export const deleteTasklineMilestone = fn(async (): Promise<void> => undefined).mockName("deleteTasklineMilestone");
export const addTasklineDependency = fn(async (): Promise<TaskDetail> => sampleTaskDetail).mockName(
	"addTasklineDependency",
);
export const removeTasklineDependency = fn(async (): Promise<TaskDetail> => sampleTaskDetail).mockName(
	"removeTasklineDependency",
);
