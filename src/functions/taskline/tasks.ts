import { createServerFn } from "@tanstack/react-start";
import {
	bulkTasksInput,
	createTaskInput,
	moveTaskInput,
	patchTaskInput,
	projectInput,
	setChecklistInput,
	taskInput,
	taskListInput,
	updateTaskInput,
} from "@/features/taskline/schema";
import type {
	BulkResult,
	ProjectActivity,
	ProjectRev,
	ProjectTasks,
	TaskDetail,
	TaskSummary,
	TrashedTask,
} from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import type { Paged } from "@/lib/list/paging";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as tasks from "@/server/taskline/tasks/service";

/** Taskline's tasks: a project's tasks, one task, and every change to one. */

export const listTasklineTasks = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<ProjectTasks> => tasks.listTasks(context, data.ws, data.key));

export const getTasklineTask = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.getTask(context, data.ws, data.ref));

export const createTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createTaskInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.createTask(context, data));

export const updateTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateTaskInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.updateTask(context, data));

export const patchTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(patchTaskInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.patchTask(context, data));

export const moveTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(moveTaskInput))
	.handler(({ data, context }): Promise<TaskSummary> => tasks.moveTask(context, data));

export const setTasklineChecklist = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(setChecklistInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.setChecklist(context, data));

export const trashTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskInput))
	.handler(({ data, context }): Promise<void> => tasks.trashTask(context, data.ws, data.ref));

export const restoreTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskInput))
	.handler(({ data, context }): Promise<TaskDetail> => tasks.restoreTask(context, data.ws, data.ref));

export const listTasklineTrash = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<TrashedTask[]> => tasks.listTrash(context, data.ws, data.key));

export const listTasklineTaskPage = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskListInput))
	.handler(({ data, context }): Promise<Paged<TaskSummary>> => tasks.listTaskPage(context, data));

export const bulkUpdateTasklineTasks = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(bulkTasksInput))
	.handler(({ data, context }): Promise<BulkResult> => tasks.bulkUpdate(context, data));

export const purgeTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskInput))
	.handler(({ data, context }): Promise<void> => tasks.purgeTask(context, data.ws, data.ref));

export const listTasklineProjectActivity = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<ProjectActivity[]> => tasks.listProjectActivity(context, data.ws, data.key));

/** Polled by open pages every 10 s (decision 0209): a changed rev refetches the page's data. */
export const getTasklineProjectRev = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<ProjectRev> => tasks.getProjectRev(context, data.ws, data.key));
