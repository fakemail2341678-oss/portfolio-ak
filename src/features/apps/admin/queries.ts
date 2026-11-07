import { queryOptions } from "@tanstack/react-query";
import { getAppsUsage } from "@/functions/apps/admin";

export const appsUsageQueryOptions = () =>
	queryOptions({ queryKey: ["apps", "usage"] as const, queryFn: () => getAppsUsage() });
