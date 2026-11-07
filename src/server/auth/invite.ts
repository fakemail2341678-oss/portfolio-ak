import "@tanstack/react-start/server-only";
import { generateRandomString } from "better-auth/crypto";
import type { Locale } from "@/paraglide/runtime";
import { sendEmail } from "../email/send";
import { auth, deliver, localizedUrl } from "./auth";

/** How long an invitation link works. Expired: the invitee uses "Forgot password" with the same address. */
export const INVITE_LIFETIME_DAYS = 3;

/**
 * Emails an invited user a link to choose their password (decisions.md 0133).
 * The token is a Better Auth password-reset token with a longer lifetime, so
 * /reset-password and Better Auth's reset endpoint handle it unchanged: the
 * reset creates the account's password, and `onPasswordReset` (auth.ts) marks
 * the address verified, since only its owner could open the link.
 */
export async function sendInvitation(
	invited: { id: string; name: string; email: string },
	options: { locale: Locale; inviter: string },
) {
	const context = await auth.$context;
	const token = generateRandomString(32, "a-z", "A-Z", "0-9");
	await context.internalAdapter.createVerificationValue({
		identifier: `reset-password:${token}`,
		value: invited.id,
		expiresAt: new Date(Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000),
	});
	const url = `${localizedUrl(options.locale, "/reset-password")}?token=${encodeURIComponent(token)}&invite=1`;
	deliver(
		sendEmail({
			to: invited.email,
			template: "invite",
			locale: options.locale,
			data: { name: invited.name, inviter: options.inviter, url, expiresInDays: INVITE_LIFETIME_DAYS },
		}),
	);
}
