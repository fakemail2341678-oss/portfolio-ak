import { createServerFn } from "@tanstack/react-start";
import {
	type AdminAutomations,
	adminCreateAutomationInputSchema,
	adminDeleteAutomationInputSchema,
	adminPreviewAutomationInputSchema,
	adminToggleAutomationInputSchema,
	adminUpdateAutomationInputSchema,
} from "@/features/taskline/admin/schema";
import type { AutomationPreview } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as automations from "@/server/taskline/admin/automations";

/** /admin/taskline/automations: the team workspace's rules and every team rule's runs (Task 56; `taskline:configure`, audited). */

export const listTasklineWorkspaceAutomations = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.handler(({ context }): Promise<AdminAutomations> => automations.listAutomations(context));

export const createTasklineWorkspaceAutomation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminCreateAutomationInputSchema))
	.handler(({ data, context }): Promise<AdminAutomations> => automations.createAutomation(context, data));

export const updateTasklineWorkspaceAutomation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminUpdateAutomationInputSchema))
	.handler(({ data, context }): Promise<AdminAutomations> => automations.updateAutomation(context, data));

export const setTasklineWorkspaceAutomationEnabled = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminToggleAutomationInputSchema))
	.handler(({ data, context }): Promise<AdminAutomations> => automations.toggleAutomation(context, data));

export const deleteTasklineWorkspaceAutomation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminDeleteAutomationInputSchema))
	.handler(({ data, context }): Promise<AdminAutomations> => automations.deleteAutomation(context, data));

export const previewTasklineWorkspaceAutomation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminPreviewAutomationInputSchema))
	.handler(({ data, context }): Promise<AutomationPreview> => automations.previewAutomation(context, data));
