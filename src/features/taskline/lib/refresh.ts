import type { QueryClient } from "@tanstack/react-query";
import { tasklineKeys } from "../keys";

/** After any write: everything of the user's in Taskline is stale (active queries refetch). */
export const refreshTaskline = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: tasklineKeys.user(userId) });
