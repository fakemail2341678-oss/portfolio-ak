import { createServerFn } from "@tanstack/react-start";
import type { AdminOverview } from "@/features/taskline/admin/schema";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as overview from "@/server/taskline/admin/overview";

/** /admin/taskline: the team's numbers (PLAN 11.5). Sandboxes show as counts only. */

export const getTasklineOverview = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.handler(({ context }): Promise<AdminOverview> => overview.getOverview(context));
