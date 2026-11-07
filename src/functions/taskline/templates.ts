import { createServerFn } from "@tanstack/react-start";
import { wsInput } from "@/features/taskline/schema";
import type { TemplateChoice } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as templates from "@/server/taskline/templates/service";

/** What "New project" offers in a workspace: the built-ins and the team's own (Task 57). */
export const listTasklineTemplates = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(wsInput))
	.handler(({ data, context }): Promise<TemplateChoice[]> => templates.listTemplates(context, data));
