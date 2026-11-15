import { createServerFn } from "@tanstack/react-start";
import {
	createLabelInputSchema,
	createStatusInputSchema,
	deleteLabelInputSchema,
	deleteStatusInputSchema,
	updateLabelInputSchema,
	updateStatusInputSchema,
} from "@/features/taskline/schema";
import type { TasklineLabel, TasklineStatus } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as workflow from "@/server/taskline/workflow/service";

/** A Taskline project's workflow (its lead's): statuses and labels. */

export const createTasklineStatus = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createStatusInputSchema))
	.handler(({ data, context }): Promise<TasklineStatus> => workflow.createStatus(context, data));

export const updateTasklineStatus = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateStatusInputSchema))
	.handler(({ data, context }): Promise<TasklineStatus> => workflow.updateStatus(context, data));

export const deleteTasklineStatus = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteStatusInputSchema))
	.handler(({ data, context }): Promise<void> => workflow.deleteStatus(context, data));

export const createTasklineLabel = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createLabelInputSchema))
	.handler(({ data, context }): Promise<TasklineLabel> => workflow.createLabel(context, data));

export const updateTasklineLabel = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateLabelInputSchema))
	.handler(({ data, context }): Promise<TasklineLabel> => workflow.updateLabel(context, data));

export const deleteTasklineLabel = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteLabelInputSchema))
	.handler(({ data, context }): Promise<void> => workflow.deleteLabel(context, data));
