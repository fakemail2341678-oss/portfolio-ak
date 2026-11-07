import { createServerFn } from "@tanstack/react-start";
import {
	createMilestoneInput,
	dependencyInput,
	milestoneInput,
	updateMilestoneInput,
} from "@/features/taskline/schema";
import type { Milestone, TaskDetail } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as timeline from "@/server/taskline/timeline/service";

/** Taskline's milestones and dependencies (Task 54); the timeline reads the project's tasks. */

export const createTasklineMilestone = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createMilestoneInput))
	.handler(({ data, context }): Promise<Milestone> => timeline.createMilestone(context, data));

export const updateTasklineMilestone = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateMilestoneInput))
	.handler(({ data, context }): Promise<Milestone> => timeline.updateMilestone(context, data));

export const deleteTasklineMilestone = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(milestoneInput))
	.handler(({ data, context }): Promise<void> => timeline.deleteMilestone(context, data.ws, data.key, data.id));

export const addTasklineDependency = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(dependencyInput))
	.handler(({ data, context }): Promise<TaskDetail> => timeline.addDependency(context, data));

export const removeTasklineDependency = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(dependencyInput))
	.handler(({ data, context }): Promise<TaskDetail> => timeline.removeDependency(context, data));
