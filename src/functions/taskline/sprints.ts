import { createServerFn } from "@tanstack/react-start";
import {
	completeSprintInputSchema,
	createSprintInputSchema,
	rankTaskInputSchema,
	sprintInputSchema,
	updateSprintInputSchema,
} from "@/features/taskline/schema";
import type { SprintReport, SprintSummary, TaskSummary } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as sprints from "@/server/taskline/sprints/service";

/** Taskline's sprints (Task 52): planning, starting and completing them, the backlog's order, a sprint's report. */

export const createTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createSprintInputSchema))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.createSprint(context, data));

export const updateTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateSprintInputSchema))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.updateSprint(context, data));

export const deleteTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInputSchema))
	.handler(({ data, context }): Promise<void> => sprints.deleteSprint(context, data.ws, data.key, data.id));

export const startTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInputSchema))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.startSprint(context, data.ws, data.key, data.id));

export const completeTasklineSprint = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(completeSprintInputSchema))
	.handler(({ data, context }): Promise<SprintSummary> => sprints.completeSprint(context, data));

export const reorderTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(rankTaskInputSchema))
	.handler(({ data, context }): Promise<TaskSummary> => sprints.rankTask(context, data));

export const getTasklineSprintReport = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(sprintInputSchema))
	.handler(({ data, context }): Promise<SprintReport> => sprints.getSprintReport(context, data.ws, data.key, data.id));
