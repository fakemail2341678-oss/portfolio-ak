import "@tanstack/react-start/server-only";
import { isAPIError } from "better-auth/api";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";

/** The part of Better Auth's API this needs (`auth.api`), injected so it can be tested. */
export type PasswordApi = {
	setPassword: (input: { body: { newPassword: string }; headers: Headers }) => Promise<unknown>;
};

/**
 * Adds a password to an account that has none (a Google sign-up), so it has a second
 * way in before Google is unlinked. Better Auth's set-password is server-only and has
 * no path, so its breached-password plugin doesn't see it: `isBreached` (null when
 * the check is off) runs here instead.
 */
export async function setOwnPassword(
	api: PasswordApi,
	headers: Headers,
	newPassword: string,
	isBreached: ((password: string) => Promise<boolean>) | null,
): Promise<void> {
	if (isBreached && (await isBreached(newPassword))) {
		throw ruleError("BAD_REQUEST", "Breached password", m.auth_error_password_breached());
	}
	try {
		await api.setPassword({ body: { newPassword }, headers });
	} catch (error) {
		if (isAPIError(error) && error.body?.code === "PASSWORD_ALREADY_SET") {
			throw ruleError("CONFLICT", "Password already set", m.account_password_already_set());
		}
		throw error;
	}
}
