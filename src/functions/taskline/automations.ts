import { createServerFn } from "@tanstack/react-start";
import {
	automationInput,
	createAutomationInput,
	previewAutomationInput,
	projectInput,
	toggleAutomationInput,
	updateAutomationInput,
} from "@/features/taskline/schema";
import type { Automation, AutomationPreview, ProjectAutomations } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as automations from "@/server/taskline/automations/service";

/** A project's own automations (Task 56), its lead's; a task's repeat is set through `patchTasklineTask`. */

export const listTasklineAutomations = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<ProjectAutomations> => automations.listAutomations(context, data.ws, data.key));

export const createTasklineAutomation = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createAutomationInput))
	.handler(({ data, context }): Promise<Automation> => automations.createAutomation(context, data));

export const updateTasklineAutomation = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateAutomationInput))
	.handler(({ data, context }): Promise<Automation> => automations.updateAutomation(context, data));

export const toggleTasklineAutomation = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(toggleAutomationInput))
	.handler(({ data, context }): Promise<Automation> => automations.toggleAutomation(context, data));

export const deleteTasklineAutomation = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(automationInput))
	.handler(({ data, context }): Promise<void> => automations.deleteAutomation(context, data));

export const previewTasklineAutomation = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(previewAutomationInput))
	.handler(({ data, context }): Promise<AutomationPreview> => automations.previewAutomation(context, data));
