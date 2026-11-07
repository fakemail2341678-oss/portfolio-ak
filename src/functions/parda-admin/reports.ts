import { createServerFn } from "@tanstack/react-start";
import { type AdminReportPage, reportStatusInput } from "@/features/parda/admin/schema";
import { pardaReportList } from "@/features/parda/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as reports from "@/server/parda/admin/reports";

/** /admin/parda/reports: viewers' reports, read with `parda:read`, resolved with `parda:moderate`, audited. */

export const listPardaReports = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(pardaReportList.input))
	.handler(({ data, context }): Promise<AdminReportPage> => reports.listReports(context, data));

export const setPardaReportStatus = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:moderate"), withServices])
	.validator(zodInput(reportStatusInput))
	.handler(({ data, context }): Promise<{ changed: number }> => reports.setReportStatus(context, data));
