import { fn } from "storybook/test";
import type {
	BulkResult,
	ProjectActivity,
	ProjectRev,
	ProjectTasks,
	TaskDetail,
	TaskSummary,
	TrashedTask,
} from "../../../../src/features/taskline/types";
import type { Paged } from "../../../../src/lib/list/paging";
import { sampleProjectTasks, sampleTaskDetail, sampleTasks } from "../../taskline";

// Stand-ins for src/functions/taskline/tasks.ts.
export const listTasklineTasks = fn(async (): Promise<ProjectTasks> => sampleProjectTasks).mockName(
	"listTasklineTasks",
);
export const getTasklineTask = fn(async (): Promise<TaskDetail> => sampleTaskDetail).mockName("getTasklineTask");
export const createTasklineTask = fn(
	async (_options: { data: unknown }): Promise<TaskDetail> => sampleTaskDetail,
).mockName("createTasklineTask");
export const updateTasklineTask = fn(
	async (_options: { data: unknown }): Promise<TaskDetail> => sampleTaskDetail,
).mockName("updateTasklineTask");
export const patchTasklineTask = fn(
	async (_options: { data: unknown }): Promise<TaskDetail> => sampleTaskDetail,
).mockName("patchTasklineTask");
export const moveTasklineTask = fn(
	async (_options: { data: unknown }): Promise<TaskSummary> => sampleTasks[0] as TaskSummary,
).mockName("moveTasklineTask");
export const setTasklineChecklist = fn(
	async (_options: { data: unknown }): Promise<TaskDetail> => sampleTaskDetail,
).mockName("setTasklineChecklist");
export const trashTasklineTask = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"trashTasklineTask",
);
export const restoreTasklineTask = fn(
	async (_options: { data: unknown }): Promise<TaskDetail> => sampleTaskDetail,
).mockName("restoreTasklineTask");
export const listTasklineTrash = fn(async (): Promise<TrashedTask[]> => []).mockName("listTasklineTrash");
export const listTasklineTaskPage = fn(
	async (): Promise<Paged<TaskSummary>> => ({ items: sampleTasks, total: sampleTasks.length, page: 1, pageCount: 1 }),
).mockName("listTasklineTaskPage");
export const bulkUpdateTasklineTasks = fn(
	async (_options: { data: unknown }): Promise<BulkResult> => ({ count: 1 }),
).mockName("bulkUpdateTasklineTasks");
export const purgeTasklineTask = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"purgeTasklineTask",
);
export const listTasklineProjectActivity = fn(async (): Promise<ProjectActivity[]> => []).mockName(
	"listTasklineProjectActivity",
);
export const getTasklineProjectRev = fn(
	async (): Promise<ProjectRev> => ({ rev: sampleProjectTasks.project.rev }),
).mockName("getTasklineProjectRev");
