import { createServerFn } from "@tanstack/react-start";
import type { Dashboard } from "@/features/admin/dashboard";
import { requireAdminAccessMiddleware } from "@/middleware/auth";
import { getDashboard as buildDashboard } from "@/server/admin/dashboard";
import { db } from "@/server/db/client";

/**
 * The admin dashboard. Any admin-area user may open it (the area's own gate);
 * each part is filled only for the sections whose read permission they hold.
 */
export const getDashboard = createServerFn({ method: "GET" })
	.middleware([requireAdminAccessMiddleware])
	.handler(({ context }): Promise<Dashboard> => buildDashboard(db, context.permissions));
