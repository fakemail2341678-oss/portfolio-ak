import { createServerFn } from "@tanstack/react-start";
import {
	type AdminTimeOptions,
	type AdminTimePage,
	type AdminUtilization,
	adminTimeEntryInputSchema,
	adminUpdateTimeEntryInputSchema,
	type ProjectExport,
	timesheetLockInputSchema,
	utilizationInputSchema,
} from "@/features/taskline/admin/schema";
import { adminTimeList } from "@/features/taskline/admin/search";
import type { TimeEntry } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as time from "@/server/taskline/admin/time";

/** /admin/taskline/timesheets (Task 53): the team's time, its lock date, utilization and CSV (`taskline:time`). */

export const listTasklineTimeEntries = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(adminTimeList.input))
	.handler(({ data, context }): Promise<AdminTimePage> => time.list(context, data));

export const getTasklineTimeOptions = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:time"), withServices])
	.handler(({ context }): Promise<AdminTimeOptions> => time.options(context));

export const updateTasklineAdminTimeEntry = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(adminUpdateTimeEntryInputSchema))
	.handler(({ data, context }): Promise<TimeEntry> => time.update(context, data));

export const deleteTasklineAdminTimeEntry = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(adminTimeEntryInputSchema))
	.handler(({ data, context }): Promise<void> => time.remove(context, data.id));

export const setTasklineTimesheetLock = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(timesheetLockInputSchema))
	.handler(({ data, context }): Promise<{ lockOn: string | null }> => time.setLock(context, data.lockOn));

export const getTasklineUtilization = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(utilizationInputSchema))
	.handler(({ data, context }): Promise<AdminUtilization> => time.utilization(context, data));

export const exportTasklineTimeEntries = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:time"), withServices])
	.validator(zodInput(adminTimeList.input))
	.handler(({ data, context }): Promise<ProjectExport> => time.exportCsv(context, data));
