import { createServerFn } from "@tanstack/react-start";
import { createFieldInput, deleteFieldInput, updateFieldInput } from "@/features/taskline/schema";
import type { TaskField } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as fields from "@/server/taskline/fields/service";

/** A project's own custom fields (Task 55), its lead's; values are set through `patchTasklineTask`. */

export const createTasklineField = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(createFieldInput))
	.handler(({ data, context }): Promise<TaskField> => fields.createField(context, data));

export const updateTasklineField = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateFieldInput))
	.handler(({ data, context }): Promise<TaskField> => fields.updateField(context, data));

export const deleteTasklineField = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteFieldInput))
	.handler(({ data, context }): Promise<void> => fields.deleteField(context, data));
