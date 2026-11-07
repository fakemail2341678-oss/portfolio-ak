import "@tanstack/react-start/server-only";
import { canEnterAdmin } from "@/features/rbac/permissions";

/**
 * Auth rules that don't depend on Better Auth itself, kept apart so tests can
 * check them without building an auth instance (decisions.md 0126–0128).
 */

/** Endpoints where a new password is chosen; each one is checked against Have I Been Pwned. */
export const BREACHED_PASSWORD_PATHS = ["/sign-up/email", "/change-password", "/reset-password"] as const;

/**
 * Endpoints that need a Turnstile token when it's configured: the ones that create an
 * account or send an email to an address anyone can type in. Password sign-in is
 * rate limited instead (a captcha there costs every user, every time).
 */
export const CAPTCHA_PATHS = ["/sign-up/email", "/request-password-reset", "/email-otp/send-verification-otp"] as const;

/**
 * Better Auth endpoints that change how an account signs in, or delete it. An
 * impersonated session can't call them (decisions.md 0134): an admin viewing the
 * app as someone must not take over or delete their account. Entries ending in
 * "/" are prefixes.
 */
export const OWNER_ONLY_PATHS = [
	"/change-password",
	"/change-email",
	"/update-user",
	"/delete-user",
	"/link-social",
	"/unlink-account",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
	"/two-factor/",
] as const;

const matches = (entries: ReadonlyArray<string>, path: string) =>
	entries.some((entry) =>
		entry.endsWith("/") ? path.startsWith(entry) : path === entry || path.startsWith(`${entry}/`),
	);

export const isOwnerOnlyPath = (path: string) => matches(OWNER_ONLY_PATHS, path);

/**
 * Better Auth endpoints a guest session can't call (decision 0185): changing the
 * email, name or password, two-factor, linked accounts, other sessions, deletion.
 * A guest has no real address and nothing to secure; they sign up to get an account.
 * Two-factor's sign-in steps (`/two-factor/verify-*`, `/two-factor/send-otp`) stay
 * open: they run on the two-factor cookie of someone signing in, never on a guest's
 * session, and a guest upgrading by signing in to an account with two-factor needs them.
 */
export const GUEST_REFUSED_PATHS = [
	...OWNER_ONLY_PATHS.filter((entry) => entry !== "/two-factor/"),
	"/two-factor/enable",
	"/two-factor/disable",
	"/two-factor/get-totp-uri",
	"/two-factor/generate-backup-codes",
	"/send-verification-email",
] as const;

export const isGuestRefusedPath = (path: string) => matches(GUEST_REFUSED_PATHS, path);

/** Guests are created only here: Better Auth's anonymous plugin (decision 0185). */
export const GUEST_SIGN_IN_PATH = "/sign-in/anonymous";

/**
 * Guest sessions started per address per hour. Each is a user row (deleted after 7 days),
 * so there is a limit, but mobile carriers put many visitors behind one address (carrier-
 * grade NAT), and 5 locked whole networks out. Dev builds don't limit it: every attempt
 * there comes from 127.0.0.1, and the count is kept in the database across restarts.
 */
export const GUEST_SIGN_INS_PER_HOUR = 30;

/**
 * Whether this user must turn on two-factor authentication before using what their
 * permissions allow: the setting is on, they hold an admin permission, and it's off.
 */
export const mustSetUpTwoFactor = (input: {
	required: boolean;
	permissions: ReadonlyArray<string>;
	twoFactorEnabled: boolean;
}): boolean => input.required && !input.twoFactorEnabled && canEnterAdmin(input.permissions);
