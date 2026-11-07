import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { getAccountSecurity, getAuthFeatures, getSession, listMySessions } from "@/functions/auth";
import { authKeys } from "./keys";

export { authKeys };

/**
 * The current session. Loaded once per SSR request and cached on the client for
 * a minute; sign-in/out/account changes call refreshAuth() to update it at once.
 * Client-side route guards read this for UX only; server functions always
 * re-check the session themselves (src/middleware/auth.ts).
 */
export const sessionQueryOptions = () =>
	queryOptions({ queryKey: authKeys.session, queryFn: () => getSession(), staleTime: 60_000 });

export const authFeaturesQueryOptions = () =>
	queryOptions({ queryKey: authKeys.features, queryFn: () => getAuthFeatures(), staleTime: Number.POSITIVE_INFINITY });

export const accountSessionsQueryOptions = () =>
	queryOptions({ queryKey: authKeys.sessions, queryFn: () => listMySessions(), staleTime: 0 });

/** Password, Google and two-factor state for the account page's security sections. */
export const accountSecurityQueryOptions = () =>
	queryOptions({ queryKey: authKeys.security, queryFn: () => getAccountSecurity(), staleTime: 0 });

/** Drop cached auth state after sign-in, sign-out or account changes. */
export const refreshAuth = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: authKeys.all, refetchType: "all" });
