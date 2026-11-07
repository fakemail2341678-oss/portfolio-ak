import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { requireUserMiddleware } from "@/middleware/auth";
import { db } from "@/server/db/client";
import { GUEST_CLAIM_COOKIE, readGuestClaim } from "@/server/guests/claim-cookie";
import { claimGuest } from "@/server/guests/service";
import { log } from "@/server/log";

/**
 * Moves this browser's guest data to the signed-in account (decision 0186): the
 * `guest_claim` cookie names the guest that started here. Called after every sign-in
 * (two-factor's included) and on the verify-email landing, because those paths can lose
 * the guest's session cookie before the anonymous plugin's own claim runs. Idempotent:
 * a guest already claimed or cleaned up claims nothing, and the cookie goes either way.
 * Accounts only (`requireUserMiddleware` refuses guests and visitors).
 */
export const claimGuestData = createServerFn({ method: "POST" })
	.middleware([requireUserMiddleware])
	.handler(async ({ context }): Promise<{ claimed: boolean }> => {
		const guestId = readGuestClaim(getCookie(GUEST_CLAIM_COOKIE));
		if (!guestId) return { claimed: false };
		const claimed = await claimGuest(db, guestId, context.user.id);
		if (claimed) log("info", "guest claimed", { guestId, userId: context.user.id });
		deleteCookie(GUEST_CLAIM_COOKIE, { path: "/" });
		return { claimed };
	});
