import "@tanstack/react-start/server-only";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import type { AccountSecurity, AccountSession } from "@/features/auth/schema";
import { db } from "../db/client";
import { serverEnv } from "../env";
import * as rbac from "../rbac/service";
import type { Services } from "../services";
import { auth, authFeatures } from "./auth";
import { setOwnPassword } from "./password";
import { forgetSession } from "./session";
import { liveSessions, revokeOwnSession } from "./sessions";

/**
 * What the account's server functions do (src/functions/auth.ts, decision 0300): each
 * is Better Auth's API called with this request's headers, so the session cookie decides
 * whose account it is. The rules that can be tested without a request are in
 * ./sessions.ts and ./password.ts.
 */

/** Which optional sign-in methods are configured. */
export const features = () => authFeatures;

/** The caller's sessions, the current one first, then the newest. */
export async function listSessions(userId: string): Promise<{ sessions: AccountSession[]; now: string }> {
	const [sessions, current] = await Promise.all([
		liveSessions(db, userId),
		auth.api.getSession({ headers: getRequestHeaders() }),
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
}

/** Signs out one of the caller's other sessions by id. */
export const revokeSession = (userId: string, id: string): Promise<void> =>
	revokeOwnSession(
		{
			listSessions: () => liveSessions(db, userId),
			getSession: (input) => auth.api.getSession(input),
			revokeSession: (input) => auth.api.revokeSession(input),
		},
		getRequestHeaders(),
		id,
	);

/** How the caller signs in (password, Google, two-factor). */
export async function security(
	user: { twoFactorEnabled: boolean },
	twoFactorRequired: boolean,
): Promise<AccountSecurity> {
	const accounts = await auth.api.listUserAccounts({ headers: getRequestHeaders() });
	const google = accounts.find((account) => account.providerId === "google");
	return {
		hasPassword: accounts.some((account) => account.providerId === "credential"),
		google: { available: authFeatures.google, accountId: google?.id ?? null },
		twoFactorEnabled: user.twoFactorEnabled,
		twoFactorRequired,
	};
}

/** Adds a password to an account that has none, refusing a breached one when the check is on. */
export const setPassword = (newPassword: string): Promise<void> =>
	setOwnPassword(
		auth.api,
		getRequestHeaders(),
		newPassword,
		serverEnv.AUTH_BREACHED_PASSWORD_CHECK ? isPasswordCompromised : null,
	);

/** Opens a session as `userId` for the caller, an admin (the rule and the audit row are the rbac service's). */
export const impersonate = (services: Services, userId: string): Promise<void> => {
	const headers = getRequestHeaders();
	return rbac.impersonateUser(services, userId, async () => {
		await auth.api.impersonateUser({ body: { userId }, headers });
	});
};

/** Ends an impersonated session and restores the admin's own. */
export async function stopImpersonating(services: Services): Promise<void> {
	const headers = getRequestHeaders();
	await rbac.stopImpersonating(services, async () => {
		await auth.api.stopImpersonating({ headers });
	});
	// The rest of this request must not see the impersonated session.
	forgetSession();
}
