import { z } from "zod";

/** One of the signed-in user's sessions, by id (the account page's "Sign out" on a device). */
export const sessionIdSchema = z.object({ id: z.string().min(1).max(100) });

/** A password for an account that has none yet (signed up with Google). Better Auth checks the length again. */
export const setPasswordSchema = z.object({ newPassword: z.string().min(8).max(128) });

/** How the signed-in user can sign in, for the account page's security sections. */
export type AccountSecurity = {
	hasPassword: boolean;
	/** `accountId`: the linked Google account's row id (what unlinking takes), or null. */
	google: { available: boolean; accountId: string | null };
	twoFactorEnabled: boolean;
	/** AUTH_REQUIRE_ADMIN_2FA applies to this user and two-factor is still off. */
	twoFactorRequired: boolean;
};
