import { createServerFn } from "@tanstack/react-start";
import { type AccountSecurity, sessionIdSchema, setPasswordSchema } from "@/features/auth/schema";
import { zodInput } from "@/functions/_lib/validator";
import type { Session } from "@/lib/session";
import {
	requireAccountOwnerMiddleware,
	requireAdminAccessMiddleware,
	requireUserMiddleware,
	sessionMiddleware,
} from "@/middleware/auth";
import { withServices } from "@/middleware/services";

/** Current session or null. Used by the root route to fill the router context. */
export const getSession = createServerFn({ method: "GET" })
	.middleware([sessionMiddleware])
	.handler(({ context }): Session | null => context.session);

/** Which optional sign-in methods are configured (the Google button depends on this). */
export const getAuthFeatures = createServerFn({ method: "GET" }).handler(async () => {
	const { authFeatures } = await import("@/server/auth/auth");
	return authFeatures;
});

/**
 * Server-side gate for the _admin layout: the user must hold at least one
 * permission. Throws UNAUTHORIZED/FORBIDDEN; permissions come from the database
 * for this request, never from client state.
 */
export const ensureAdminAccess = createServerFn({ method: "GET" })
	.middleware([requireAdminAccessMiddleware])
	.handler(({ context }): Session => ({ user: context.user, permissions: context.permissions }));

/** A session as the account page sees it. No token: tokens never leave the server. */
export type AccountSession = {
	id: string;
	current: boolean;
	createdAt: string;
	userAgent: string | null;
};

/** The signed-in user's sessions, newest first, for the account page. */
export const listMySessions = createServerFn({ method: "GET" })
	.middleware([requireUserMiddleware])
	.handler(async (): Promise<{ sessions: AccountSession[]; now: string }> => {
		const [{ auth }, { getRequestHeaders }] = await Promise.all([
			import("@/server/auth/auth"),
			import("@tanstack/react-start/server"),
		]);
		const headers = getRequestHeaders();
		const [sessions, current] = await Promise.all([
			auth.api.listSessions({ headers }),
			auth.api.getSession({ headers }),
		]);
		return {
			// Sent with the data so relative times render identically on server and client.
			now: new Date().toISOString(),
			sessions: sessions
				.map((session) => ({
					id: session.id,
					current: session.id === current?.session.id,
					createdAt: new Date(session.createdAt).toISOString(),
					userAgent: session.userAgent ?? null,
				}))
				.sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt)),
		};
	});

/** Signs out one of the user's other sessions by id (the token is looked up on the server). */
export const revokeMySession = createServerFn({ method: "POST" })
	.middleware([requireAccountOwnerMiddleware])
	.validator(zodInput(sessionIdSchema))
	.handler(async ({ data }): Promise<void> => {
		const [{ auth }, { revokeOwnSession }, { getRequestHeaders }] = await Promise.all([
			import("@/server/auth/auth"),
			import("@/server/auth/sessions"),
			import("@tanstack/react-start/server"),
		]);
		await revokeOwnSession(auth.api, getRequestHeaders(), data.id);
	});

/** How the signed-in user signs in (password, Google, two-factor), for the account page. */
export const getAccountSecurity = createServerFn({ method: "GET" })
	.middleware([requireUserMiddleware])
	.handler(async ({ context }): Promise<AccountSecurity> => {
		const [{ auth, authFeatures }, { getRequestHeaders }] = await Promise.all([
			import("@/server/auth/auth"),
			import("@tanstack/react-start/server"),
		]);
		const accounts = await auth.api.listUserAccounts({ headers: getRequestHeaders() });
		const google = accounts.find((account) => account.providerId === "google");
		return {
			hasPassword: accounts.some((account) => account.providerId === "credential"),
			google: { available: authFeatures.google, accountId: google?.id ?? null },
			twoFactorEnabled: context.user.twoFactorEnabled,
			twoFactorRequired: context.twoFactorRequired,
		};
	});

/** Adds a password to an account that has none (signed up with Google). */
export const setMyPassword = createServerFn({ method: "POST" })
	.middleware([requireAccountOwnerMiddleware])
	.validator(zodInput(setPasswordSchema))
	.handler(async ({ data }): Promise<void> => {
		const [{ auth }, { setOwnPassword }, { serverEnv }, { isPasswordCompromised }, { getRequestHeaders }] =
			await Promise.all([
				import("@/server/auth/auth"),
				import("@/server/auth/password"),
				import("@/server/env"),
				import("better-auth/plugins/haveibeenpwned"),
				import("@tanstack/react-start/server"),
			]);
		await setOwnPassword(
			auth.api,
			getRequestHeaders(),
			data.newPassword,
			serverEnv.AUTH_BREACHED_PASSWORD_CHECK ? isPasswordCompromised : null,
		);
	});

/**
 * Ends an impersonated session and restores the admin's own (decisions.md 0134).
 * Any signed-in user may call it; it refuses sessions that aren't impersonated.
 */
export const stopImpersonating = createServerFn({ method: "POST" })
	.middleware([requireUserMiddleware, withServices])
	.handler(async ({ context }): Promise<void> => {
		const [{ auth }, rbac, { getRequestHeaders }, { forgetSession }] = await Promise.all([
			import("@/server/auth/auth"),
			import("@/server/rbac/service"),
			import("@tanstack/react-start/server"),
			import("@/server/auth/session"),
		]);
		const headers = getRequestHeaders();
		await rbac.stopImpersonating(context, async () => {
			await auth.api.stopImpersonating({ headers });
		});
		// The rest of this request must not see the impersonated session.
		forgetSession();
	});
