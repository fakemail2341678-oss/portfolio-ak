import { createServerFn } from "@tanstack/react-start";
import {
	type AdminWorkflows,
	type AdminWorkspace,
	deleteWorkspaceLabelInputSchema,
	updateWorkflowsInputSchema,
	updateWorkspaceInputSchema,
	updateWorkspaceLabelInputSchema,
	workspaceLabelInputSchema,
} from "@/features/taskline/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as settings from "@/server/taskline/admin/settings";

/** /admin/taskline/settings and /workflows: the team workspace's configuration (`taskline:configure`, audited). */

export const getTasklineWorkspace = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.handler(({ context }): Promise<AdminWorkspace> => settings.getWorkspace(context));

export const updateTasklineWorkspace = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(updateWorkspaceInputSchema))
	.handler(({ data, context }): Promise<AdminWorkspace> => settings.updateWorkspace(context, data));

export const getTasklineWorkflows = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.handler(({ context }): Promise<AdminWorkflows> => settings.getWorkflows(context));

export const updateTasklineWorkflows = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(updateWorkflowsInputSchema))
	.handler(({ data, context }): Promise<AdminWorkflows> => settings.updateWorkflows(context, data));

export const createTasklineWorkspaceLabel = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(workspaceLabelInputSchema))
	.handler(({ data, context }): Promise<AdminWorkflows["labels"]> => settings.createLabel(context, data));

export const updateTasklineWorkspaceLabel = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(updateWorkspaceLabelInputSchema))
	.handler(({ data, context }): Promise<AdminWorkflows["labels"]> => settings.updateLabel(context, data));

export const deleteTasklineWorkspaceLabel = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(deleteWorkspaceLabelInputSchema))
	.handler(({ data, context }): Promise<AdminWorkflows["labels"]> => settings.deleteLabel(context, data));
