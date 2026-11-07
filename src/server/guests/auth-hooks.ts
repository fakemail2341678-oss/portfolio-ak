import "@tanstack/react-start/server-only";
import { GUEST_SCOPE_COOKIE, parseGuestScope } from "@/lib/guests";
import { type AfterHookContext, isGuestUser } from "@/server/auth/hooks";
import { resolveEmailLocale } from "@/server/auth/locale";
import { GUEST_SIGN_IN_PATH } from "@/server/auth/policy";
import { db } from "@/server/db/client";
import { errorFields, log } from "@/server/log";
import {
	GUEST_CLAIM_COOKIE,
	type GuestClaimCookieOptions,
	guestClaimCookieOptions,
	guestClaimValue,
} from "./claim-cookie";
import { guestOwnersFor } from "./data";
import { claimGuest, seedGuest } from "./service";

/**
 * Better Auth's side of guest sessions (decisions 0185, 0186), wired in
 * src/server/auth/auth.ts.
 */

/**
 * After `/sign-in/anonymous` created a guest: the `guest_claim` cookie, then the sample
 * rows in the language the guest started in. A failed seed is logged, not fatal: the
 * apps start empty instead.
 */
export async function startGuest(ctx: AfterHookContext): Promise<void> {
	if (ctx.path !== GUEST_SIGN_IN_PATH) return;
	const created = ctx.context.newSession;
	if (!created || !isGuestUser(created.user)) return;
	ctx.setCookie(GUEST_CLAIM_COOKIE, guestClaimValue(created.user.id), guestClaimCookieOptions);
	// A section that starts its own guests (Parda) names itself, and gets only its own samples.
	const scope = parseGuestScope(ctx.getCookie(GUEST_SCOPE_COOKIE));
	if (scope) ctx.setCookie(GUEST_SCOPE_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
	try {
		await seedGuest(db, created.user.id, resolveEmailLocale(ctx.request), guestOwnersFor(scope));
	} catch (error) {
		log("error", "guest seed failed", { userId: created.user.id, ...errorFields(error) });
	}
}

/**
 * The anonymous plugin's `onLinkAccount`: a guest signed up (and verified) or signed in
 * on the same browser, so their rows move to that account and the guest is deleted, in
 * one transaction. A failure is logged and leaves the guest as it was: the claim
 * cookie lets `claimGuestData` try again after the sign-in, and nothing is lost.
 */
export async function linkGuest(input: {
	anonymousUser: { user: { id: string } };
	newUser: { user: { id: string } };
	ctx: { setCookie: (name: string, value: string, options: GuestClaimCookieOptions) => unknown };
}): Promise<void> {
	const from = input.anonymousUser.user.id;
	const to = input.newUser.user.id;
	try {
		if (await claimGuest(db, from, to)) {
			log("info", "guest claimed", { guestId: from, userId: to });
			input.ctx.setCookie(GUEST_CLAIM_COOKIE, "", { ...guestClaimCookieOptions, maxAge: 0 });
		}
	} catch (error) {
		log("error", "guest claim failed", { guestId: from, userId: to, ...errorFields(error) });
	}
}
