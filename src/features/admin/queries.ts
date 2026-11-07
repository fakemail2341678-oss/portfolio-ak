import { queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/functions/admin";

export const adminKeys = {
	all: ["admin"] as const,
	dashboard: () => [...adminKeys.all, "dashboard"] as const,
};

export const dashboardQueryOptions = () =>
	queryOptions({
		queryKey: adminKeys.dashboard(),
		queryFn: () => getDashboard(),
	});
