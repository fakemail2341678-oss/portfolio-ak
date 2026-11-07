import "@tanstack/react-start/server-only";
import type { ExampleContactInput } from "@/features/dev/examples/schema";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import type { Db } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { log } from "@/server/log";

/** Three messages per ten minutes per client IP. */
export const CONTACT_LIMIT = { max: 3, windowSeconds: 600 };

/**
 * The contact form recipe (docs/guides/recipes.md): honeypot, Turnstile when
 * configured, a database-backed rate limit per client IP, then the message.
 * This example logs it; a real form sends it with `sendEmail` (src/server/email)
 * and a template of its own, to an address from env.
 *
 * A filled honeypot gets the same "sent" answer as a real message, so bots learn nothing.
 */
export async function submitContact(
	db: Db,
	input: ExampleContactInput,
	client: { ip: string | undefined; verifyCaptcha: ((token: string | undefined) => Promise<boolean>) | null },
): Promise<{ sent: true }> {
	if (input.website) return { sent: true };
	if (client.verifyCaptcha && !(await client.verifyCaptcha(input.captcha))) {
		throw ruleError("BAD_REQUEST", "Captcha failed", m.auth_error_captcha());
	}
	await enforceRateLimit(db, `contact:${client.ip ?? "unknown"}`, CONTACT_LIMIT);
	log("info", "contact message", { from: input.email, length: input.message.length });
	return { sent: true };
}
