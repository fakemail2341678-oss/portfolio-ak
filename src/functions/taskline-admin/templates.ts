import { createServerFn } from "@tanstack/react-start";
import {
	type AdminTemplates,
	adminCreateTemplateInput,
	adminDeleteTemplateInput,
	adminUpdateTemplateInput,
	type SavedProjectTemplate,
	saveProjectAsTemplateInput,
} from "@/features/taskline/admin/schema";
import type { TemplateChoice } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as templates from "@/server/taskline/admin/templates";

/** /admin/taskline/templates: the team's templates beside the built-ins (Task 57; `taskline:configure`, audited). */

export const listTasklineAdminTemplates = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.handler(({ context }): Promise<AdminTemplates> => templates.listTemplates(context));

export const createTasklineAdminTemplate = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminCreateTemplateInput))
	.handler(({ data, context }): Promise<AdminTemplates> => templates.createTemplate(context, data));

export const updateTasklineAdminTemplate = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminUpdateTemplateInput))
	.handler(({ data, context }): Promise<AdminTemplates> => templates.updateTemplate(context, data));

export const deleteTasklineAdminTemplate = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminDeleteTemplateInput))
	.handler(({ data, context }): Promise<AdminTemplates> => templates.deleteTemplate(context, data));

/** "Save project as template", from the admin's project page. */
export const saveTasklineProjectAsTemplate = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(saveProjectAsTemplateInput))
	.handler(({ data, context }): Promise<SavedProjectTemplate> => templates.saveProjectAsTemplate(context, data));

/** What the admin's "New project" offers: whoever creates projects there (`taskline:manage`). */
export const listTasklineAdminTemplateChoices = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.handler(({ context }): Promise<TemplateChoice[]> => templates.listTemplateChoices(context));
