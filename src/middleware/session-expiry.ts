import { createMiddleware, getRouterInstance } from "@tanstack/react-start";
import { authKeys } from "@/features/auth/keys";
import { isAppError } from "@/lib/errors";

/**
 * The app's "response interceptor" for server functions (TanStack Start's
 * equivalent of an axios interceptor; registered globally in src/start.ts).
 *
 * When any server function answers UNAUTHORIZED in the browser (the session
 * expired, was revoked, or the user was banned), the cached session is cleared
 * and the user is sent to /login with a return URL. The error is still thrown,
 * so the caller's own handling (toast, error boundary, rollback) runs as usual.
 *
 * FORBIDDEN is not handled here: the user is signed in but lacks a permission,
 * which the caller shows (a toast, or the forbidden page for a route).
 */
let redirecting = false;

async function sendToLogin() {
	if (redirecting) return;
	redirecting = true;
	try {
		const router = await getRouterInstance();
		router.options.context.queryClient.setQueryData(authKeys.session, null);
		// Already on a sign-in page (e.g. a stale tab): nothing to redirect.
		if (router.state.matches.some((match) => match.routeId.startsWith("/_auth"))) return;
		await router.navigate({ to: "/login", search: { redirect: router.latestLocation.href } });
	} finally {
		redirecting = false;
	}
}

export const sessionExpiryMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		// During SSR the layouts redirect anonymous visitors themselves (src/routes/_admin.tsx, _authed.tsx).
		if (typeof window !== "undefined" && isAppError(error) && error.code === "UNAUTHORIZED") void sendToLogin();
		throw error;
	}
});
