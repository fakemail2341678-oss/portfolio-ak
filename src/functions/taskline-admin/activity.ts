import { createServerFn } from "@tanstack/react-start";
import type { AdminActivityOptions, AdminActivityPage } from "@/features/taskline/admin/schema";
import { adminActivityList } from "@/features/taskline/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as activity from "@/server/taskline/admin/activity";

/** /admin/taskline/activity: the team's history (`tl_activity`), filtered (`taskline:read`). */

export const listTasklineActivity = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminActivityList.input))
	.handler(({ data, context }): Promise<AdminActivityPage> => activity.list(context, data));

export const getTasklineActivityOptions = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.handler(({ context }): Promise<AdminActivityOptions> => activity.options(context));
