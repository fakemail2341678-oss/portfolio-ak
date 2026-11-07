import { fn } from "storybook/test";
import type { SprintReport, SprintSummary, TaskSummary } from "../../../../src/features/taskline/types";
import { sampleSprintProject, sampleSprintReport, sampleTasks } from "../../taskline";

// Stand-ins for src/functions/taskline/sprints.ts.
const sprint = () => sampleSprintProject.sprints[0] as SprintSummary;
export const createTasklineSprint = fn(async (): Promise<SprintSummary> => sprint()).mockName("createTasklineSprint");
export const updateTasklineSprint = fn(async (): Promise<SprintSummary> => sprint()).mockName("updateTasklineSprint");
export const deleteTasklineSprint = fn(async (): Promise<void> => undefined).mockName("deleteTasklineSprint");
export const startTasklineSprint = fn(async (): Promise<SprintSummary> => sprint()).mockName("startTasklineSprint");
export const completeTasklineSprint = fn(async (): Promise<SprintSummary> => sprint()).mockName(
	"completeTasklineSprint",
);
export const rankTasklineTask = fn(async (): Promise<TaskSummary> => sampleTasks[0] as TaskSummary).mockName(
	"rankTasklineTask",
);
export const getTasklineSprintReport = fn(async (): Promise<SprintReport> => sampleSprintReport).mockName(
	"getTasklineSprintReport",
);
