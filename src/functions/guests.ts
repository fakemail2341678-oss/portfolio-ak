import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/middleware/auth";
import { db } from "@/server/db/client";
import { claimFromCookie } from "@/server/guests/service";

/**
 * Moves this browser's guest data to the signed-in account (decision 0186): the
 * `guest_claim` cookie names the guest that started here. Called after every sign-in
 * (two-factor's included) and on the verify-email landing, because those paths can lose
 * the guest's session cookie before the anonymous plugin's own claim runs. Idempotent:
 * a guest already claimed or cleaned up claims nothing, and the cookie goes either way.
 * Accounts only (`requireUser` refuses guests and visitors).
 */
export const claimGuestData = createServerFn({ method: "POST" })
	.middleware([requireUser])
	.handler(({ context }): Promise<{ claimed: boolean }> => claimFromCookie(db, context.user.id));
