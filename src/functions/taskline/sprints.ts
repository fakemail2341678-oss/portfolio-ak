import { createServerFn } from "@tanstack/react-start";
import {
	completeSprintInput,
	createSprintInput,
	rankTaskInput,
	sprintInput,
	updateSprintInput,
} from "@/features/taskline/schema";
import type { SprintReport, SprintSummary, TaskSummary } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as sprints from "@/server/taskline/sprints/service";

/** Taskline's sprints (Task 52): planning, starting and completing them, the backlog's order, a sprint's report. */

export const createTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createSprintInput))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.createSprint(context, data));

export const updateTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateSprintInput))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.updateSprint(context, data));

export const deleteTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInput))
	.handler(({ data, context }): Promise<void> => sprints.deleteSprint(context, data.ws, data.key, data.id));

export const startTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInput))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.startSprint(context, data.ws, data.key, data.id));

export const completeTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(completeSprintInput))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.completeSprint(context, data));

export const rankTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(rankTaskInput))
	.handler(({ data, context }): Promise<TaskSummary> => sprints.rankTask(context, data));

export const getTasklineSprintReport = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInput))
	.handler(({ data, context }): Promise<SprintReport> => sprints.getSprintReport(context, data.ws, data.key, data.id));
