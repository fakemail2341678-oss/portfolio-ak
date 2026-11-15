import { queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/functions/admin";
import { adminKeys } from "./keys";

export const dashboardQueryOptions = () =>
	queryOptions({
		queryKey: adminKeys.dashboard(),
		queryFn: () => getDashboard(),
	});
