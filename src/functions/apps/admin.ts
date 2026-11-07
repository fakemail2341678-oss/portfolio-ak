import { createServerFn } from "@tanstack/react-start";
import type { AppsUsage } from "@/features/apps/types";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { getAppsUsage as readUsage } from "@/server/apps/usage";

/** /admin/apps (decision 0187): the apps' usage, counts only. */
export const getAppsUsage = createServerFn({ method: "GET" })
	.middleware([requirePermission("apps:read"), withServices])
	.handler(({ context }): Promise<AppsUsage> => readUsage(context));
