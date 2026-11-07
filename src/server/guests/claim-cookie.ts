import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { serverEnv } from "@/server/env";

/**
 * The `guest_claim` cookie (decision 0186): set when a guest session starts, it names
 * that guest, signed with BETTER_AUTH_SECRET (HMAC-SHA256), httpOnly, for as long as a
 * guest lives. Signing up or in normally moves the guest's data at once (the
 * anonymous plugin's `onLinkAccount`), but two paths lose the guest's session cookie
 * first: a sign-in that stops for two-factor, and a verification link opened later.
 * `claimGuestData` (src/functions/guests.ts) reads this cookie after them instead.
 */
export const GUEST_CLAIM_COOKIE = "guest_claim";

/** How long a guest lives before the daily cleanup deletes it (and the cookie expires). */
export const GUEST_LIFETIME_MS = GUEST_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

const signature = (guestId: string) =>
	createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(`guest-claim:${guestId}`).digest("base64url");

/** The cookie's value for a guest: its id and the signature. */
export const guestClaimValue = (guestId: string) => `${guestId}.${signature(guestId)}`;

/** The guest a cookie value names, or null when it's missing, malformed or not signed by us. */
export function readGuestClaim(value: string | undefined | null): string | null {
	if (!value) return null;
	const dot = value.lastIndexOf(".");
	if (dot <= 0) return null;
	const guestId = value.slice(0, dot);
	const given = Buffer.from(value.slice(dot + 1));
	const expected = Buffer.from(signature(guestId));
	return given.length === expected.length && timingSafeEqual(given, expected) ? guestId : null;
}

export type GuestClaimCookieOptions = { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; maxAge: number };

export const guestClaimCookieOptions: GuestClaimCookieOptions = {
	httpOnly: true,
	secure: serverEnv.BETTER_AUTH_URL.startsWith("https:"),
	sameSite: "lax",
	path: "/",
	maxAge: GUEST_LIFETIME_MS / 1000,
};
