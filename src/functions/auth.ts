import { createServerFn } from "@tanstack/react-start";
import { type AccountSecurity, type AccountSession, sessionIdSchema, setPasswordSchema } from "@/features/auth/schema";
import { zodInput } from "@/functions/_lib/validator";
import type { Session } from "@/lib/session";
import { requireAccountOwner, requireAdminAccess, requireUser, withSession } from "@/middleware/auth";
import { withPublic, withServices } from "@/middleware/services";
import * as account from "@/server/auth/account";

/** Current session or null. Used by the root route to fill the router context. */
export const getSession = createServerFn({ method: "GET" })
	.middleware([withSession])
	.handler(({ context }): Session | null => context.session);

/** Which optional sign-in methods are configured (the Google button depends on this). */
export const getAuthFeatures = createServerFn({ method: "GET" })
	.middleware([withPublic])
	.handler(() => account.features());

/**
 * Server-side gate for the _admin layout: the user must hold at least one
 * permission. Throws UNAUTHORIZED/FORBIDDEN; permissions come from the database
 * for this request, never from client state.
 */
export const getAdminAccess = createServerFn({ method: "GET" })
	.middleware([requireAdminAccess])
	.handler(({ context }): Session => ({ user: context.user, permissions: context.permissions }));

/** The signed-in user's sessions, newest first, for the account page. */
export const listMySessions = createServerFn({ method: "GET" })
	.middleware([requireUser])
	.handler((): Promise<{ sessions: AccountSession[]; now: string }> => account.listSessions());

/** Signs out one of the user's other sessions by id (the token is looked up on the server). */
export const revokeMySession = createServerFn({ method: "POST" })
	.middleware([requireAccountOwner])
	.validator(zodInput(sessionIdSchema))
	.handler(({ data }): Promise<void> => account.revokeSession(data.id));

/** How the signed-in user signs in (password, Google, two-factor), for the account page. */
export const getAccountSecurity = createServerFn({ method: "GET" })
	.middleware([requireUser])
	.handler(({ context }): Promise<AccountSecurity> => account.security(context.user, context.twoFactorRequired));

/** Adds a password to an account that has none (signed up with Google). */
export const setMyPassword = createServerFn({ method: "POST" })
	.middleware([requireAccountOwner])
	.validator(zodInput(setPasswordSchema))
	.handler(({ data }): Promise<void> => account.setPassword(data.newPassword));

/**
 * Ends an impersonated session and restores the admin's own (decisions.md 0134).
 * Any signed-in user may call it; it refuses sessions that aren't impersonated.
 */
export const stopImpersonating = createServerFn({ method: "POST" })
	.middleware([requireUser, withServices])
	.handler(({ context }): Promise<void> => account.stopImpersonating(context));
