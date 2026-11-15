import { m } from "@/paraglide/messages";

/** The error shape Better Auth's client returns (errors are values, not throws). */
export type AuthClientError = { code?: string | undefined; status?: number | undefined; message?: string | undefined };

const byCode: Readonly<Record<string, () => string>> = {
	INVALID_EMAIL_OR_PASSWORD: m.auth_error_invalid_credentials,
	INVALID_PASSWORD: m.auth_error_invalid_current_password,
	EMAIL_NOT_VERIFIED: m.auth_error_email_not_verified,
	USER_ALREADY_EXISTS: m.auth_error_user_exists,
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: m.auth_error_user_exists,
	INVALID_EMAIL: m.auth_error_email,
	PASSWORD_TOO_SHORT: m.auth_error_password_length,
	INVALID_OTP: m.auth_error_invalid_code,
	OTP_EXPIRED: m.auth_error_invalid_code,
	TOO_MANY_ATTEMPTS: m.auth_error_too_many_attempts,
	INVALID_TOKEN: m.auth_reset_invalid,
	TOKEN_EXPIRED: m.auth_reset_invalid,
	EMAIL_MISMATCH: m.auth_error_same_email,
	SESSION_NOT_FRESH: m.auth_error_session_not_fresh,
	SESSION_EXPIRED: m.auth_error_session_not_fresh,
	// Breached passwords (haveIBeenPwned) and captcha (Turnstile).
	PASSWORD_COMPROMISED: m.auth_error_password_breached,
	MISSING_RESPONSE: m.auth_error_captcha,
	VERIFICATION_FAILED: m.auth_error_captcha,
	// Two-factor sign-in and setup.
	INVALID_CODE: m.auth_error_invalid_code,
	INVALID_BACKUP_CODE: m.auth_error_invalid_backup_code,
	ACCOUNT_TEMPORARILY_LOCKED: m.auth_error_two_factor_locked,
	INVALID_TWO_FACTOR_COOKIE: m.auth_error_two_factor_expired,
	TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: m.auth_error_two_factor_expired,
	TWO_FACTOR_USE_PASSWORD: m.auth_error_two_factor_use_password,
	// Sign-in methods and deletion.
	FAILED_TO_UNLINK_LAST_ACCOUNT: m.account_methods_unlink_last,
	LAST_ADMIN: m.account_delete_last_admin,
	// An impersonated session (decisions.md 0134).
	IMPERSONATING: m.auth_error_impersonating,
	// Guest sessions (decision 0185).
	GUEST_ACCOUNT: m.auth_error_guest,
	ALREADY_SIGNED_IN: m.auth_error_already_signed_in,
};

/** Turnstile refused the request (no token, or a token that didn't verify). */
export const isCaptchaError = (error: AuthClientError | null | undefined) =>
	error?.code === "MISSING_RESPONSE" || error?.code === "VERIFICATION_FAILED";

/**
 * Localized text for a Better Auth client error. Unknown codes get a generic
 * message; raw server messages are never shown.
 */
export const authErrorMessage = (error: AuthClientError | null | undefined): string => {
	if (!error) return m.auth_error_generic();
	if (error.status === 429) return m.error_rate_limited();
	const message = error.code ? byCode[error.code] : undefined;
	return message ? message() : m.auth_error_generic();
};
