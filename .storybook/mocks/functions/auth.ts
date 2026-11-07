import { fn } from "storybook/test";
import type { AccountSecurity } from "../../../src/features/auth/schema";
import type { Session } from "../../../src/lib/session";

// Stand-ins for src/functions/auth.ts. Stories seed the session through the
// Query cache (parameters.session), so these only run if a story doesn't.
export const getSession = fn(async (): Promise<Session | null> => null).mockName("getSession");
export const getAuthFeatures = fn(async () => ({ google: false, turnstileSiteKey: null })).mockName("getAuthFeatures");
export const ensureAdminAccess = fn(async (): Promise<Session | null> => null).mockName("ensureAdminAccess");
export const listMySessions = fn(async () => ({ sessions: [], now: "2026-10-01T00:00:00.000Z" })).mockName(
	"listMySessions",
);
export const getAccountSecurity = fn(
	async (): Promise<AccountSecurity> => ({
		hasPassword: true,
		google: { available: false, accountId: null },
		twoFactorEnabled: false,
		twoFactorRequired: false,
	}),
).mockName("getAccountSecurity");
export const setMyPassword = fn(async () => undefined).mockName("setMyPassword");
export const stopImpersonating = fn(async () => undefined).mockName("stopImpersonating");
