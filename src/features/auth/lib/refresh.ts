import type { QueryClient } from "@tanstack/react-query";
import { authKeys } from "../keys";

/** Drop cached auth state after sign-in, sign-out or account changes. */
export const refreshAuth = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: authKeys.all, refetchType: "all" });
