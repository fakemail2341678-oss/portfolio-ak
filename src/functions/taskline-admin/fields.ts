import { createServerFn } from "@tanstack/react-start";
import {
	type AdminFields,
	adminCreateFieldInputSchema,
	adminDeleteFieldInputSchema,
	adminUpdateFieldInputSchema,
} from "@/features/taskline/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as fields from "@/server/taskline/admin/fields";

/** /admin/taskline/fields: the team workspace's custom fields (Task 55; `taskline:configure`, audited). */

export const listTasklineWorkspaceFields = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.handler(({ context }): Promise<AdminFields> => fields.listFields(context));

export const createTasklineWorkspaceField = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminCreateFieldInputSchema))
	.handler(({ data, context }): Promise<AdminFields> => fields.createField(context, data));

export const updateTasklineWorkspaceField = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminUpdateFieldInputSchema))
	.handler(({ data, context }): Promise<AdminFields> => fields.updateField(context, data));

export const deleteTasklineWorkspaceField = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:configure"), withServices])
	.validator(zodInput(adminDeleteFieldInputSchema))
	.handler(({ data, context }): Promise<AdminFields> => fields.deleteField(context, data));
