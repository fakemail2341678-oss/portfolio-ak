import { createServerFn } from "@tanstack/react-start";
import { type AdminReports, adminReportsInput } from "@/features/taskline/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as reports from "@/server/taskline/admin/reports";

/** /admin/taskline/reports: health, workload and time across the team (Task 57; `taskline:read`). */

export const getTasklineAdminReports = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminReportsInput))
	.handler(({ data, context }): Promise<AdminReports> => reports.getReports(context, data));
