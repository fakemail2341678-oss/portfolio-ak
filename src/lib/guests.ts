/**
 * Guest sessions (decision 0185): a visitor trying the apps without an account is a
 * guest, deleted with everything they made this many days after starting, unless they
 * sign up or in first (0186).
 */
export const GUEST_LIFETIME_DAYS = 7;

/**
 * `guest_scope` (PLAN 12.5, decision 0236): a section that starts guests of its own sets it
 * just before `signIn.anonymous()`, and the new guest gets only that section's samples.
 * Without it, a guest gets every other owner's, as before.
 */
export const GUEST_SCOPE_COOKIE = "guest_scope";

/** Read by the server only as a section id; anything else counts as no scope. */
export const parseGuestScope = (value: string | null | undefined) =>
	value && /^[a-z]{1,20}$/.test(value) ? value : null;

/**
 * Sets the scope for the guest about to start (a minute is plenty for one sign-in).
 * Only Parda calls it today; a project without that layer keeps it as core (0244).
 *
 * @public
 */
export function setGuestScope(section: string): void {
	// biome-ignore lint/suspicious/noDocumentCookie: one short-lived, non-sensitive cookie; the Cookie Store API isn't in Safari or Firefox.
	document.cookie = `${GUEST_SCOPE_COOKIE}=${section}; path=/; max-age=60; samesite=lax`;
}
