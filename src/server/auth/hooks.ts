import "@tanstack/react-start/server-only";
import { APIError, type createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { GUEST_SIGN_IN_PATH, isGuestRefusedPath, isOwnerOnlyPath } from "./policy";

/** The context Better Auth passes to an `after` hook. */
export type AfterHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** The context Better Auth passes to a `before` hook (the same shape). */
export type BeforeHookContext = AfterHookContext;

/** True for a user row with two-factor turned on (the plugin adds the field). */
export const hasTwoFactor = (user: object) => "twoFactorEnabled" in user && user.twoFactorEnabled === true;

/**
 * Better Auth's second factor only guards password sign-in. An emailed code would
 * get around it, so an email-code sign-in to an account with two-factor on is
 * undone and refused: the session is deleted and the cookie cleared (decisions.md
 * 0126). It runs after the code was checked, so only someone holding a valid code
 * learns that the account uses two-factor.
 */
export async function refuseEmailCodeWithTwoFactor(ctx: AfterHookContext): Promise<void> {
	if (ctx.path !== "/sign-in/email-otp") return;
	const created = ctx.context.newSession;
	if (!created || !hasTwoFactor(created.user)) return;
	await ctx.context.internalAdapter.deleteSession(created.session.token);
	ctx.context.setNewSession(null);
	deleteSessionCookie(ctx);
	throw new APIError("FORBIDDEN", {
		code: "TWO_FACTOR_USE_PASSWORD",
		message: "This account uses two-factor authentication: sign in with the password",
	});
}

/**
 * Refuses account changes (password, email, two-factor, linked accounts, other
 * sessions, deletion) from an impersonated session (decisions.md 0134). Only
 * those paths look the session up, so other requests pay nothing.
 */
export async function refuseOwnerOnlyWhileImpersonating(ctx: BeforeHookContext): Promise<void> {
	if (!isOwnerOnlyPath(ctx.path)) return;
	const current = await getSessionFromCtx(ctx);
	if (!current?.session.impersonatedBy) return;
	throw new APIError("FORBIDDEN", {
		code: "IMPERSONATING",
		message: "Account changes aren't allowed while impersonating",
	});
}

/** True for a guest's user row (the anonymous plugin adds the field, decision 0185). */
export const isGuestUser = (user: object) => "isAnonymous" in user && user.isAnonymous === true;

/**
 * Guest sessions (decision 0185) can't change an account (email, password, two-factor,
 * linked accounts, sessions, deletion): they have none to change, and they sign up
 * instead. A guest session also starts only from no session at all: the plugin refuses
 * a guest starting another one, this refuses someone signed in (it would replace
 * their session with a guest's). Only those paths look the session up.
 */
export async function refuseGuestPaths(ctx: BeforeHookContext): Promise<void> {
	const guestStart = ctx.path === GUEST_SIGN_IN_PATH;
	if (!guestStart && !isGuestRefusedPath(ctx.path)) return;
	const current = await getSessionFromCtx(ctx, { disableRefresh: true });
	if (guestStart && current && !isGuestUser(current.user)) {
		throw new APIError("BAD_REQUEST", { code: "ALREADY_SIGNED_IN", message: "Already signed in" });
	}
	if (!guestStart && current && isGuestUser(current.user)) {
		throw new APIError("FORBIDDEN", {
			code: "GUEST_ACCOUNT",
			message: "Guests can't change an account: sign up first",
		});
	}
}
