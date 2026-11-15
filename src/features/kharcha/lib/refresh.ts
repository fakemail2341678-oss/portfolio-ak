import type { QueryClient } from "@tanstack/react-query";
import { kharchaKeys } from "../keys";

/** Everything the caller's pages read: after one of their own changes, or a moved `rev`. */
export const refreshKharcha = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: kharchaKeys.user(userId) });
