import { queryOptions } from "@tanstack/react-query";
import { getHomeFlags } from "@/functions/feature-flags";

export const homeFlagsQueryOptions = () =>
	queryOptions({
		queryKey: ["flags", "home"] as const,
		queryFn: () => getHomeFlags(),
		// Flags rarely change mid-visit; re-evaluated on reload.
		staleTime: 5 * 60_000,
	});
