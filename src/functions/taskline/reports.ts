import { createServerFn } from "@tanstack/react-start";
import { projectReportsInput } from "@/features/taskline/schema";
import type { ProjectReports } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as reports from "@/server/taskline/reports/service";

/** A project's reports (Task 57): anyone who can see the project. */
export const getTasklineProjectReports = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectReportsInput))
	.handler(({ data, context }): Promise<ProjectReports> => reports.getProjectReports(context, data));
