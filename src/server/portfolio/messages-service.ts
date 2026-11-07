import "@tanstack/react-start/server-only";
import type { ContactInput, ContactMessagePage, MessageStateInput } from "@/features/portfolio/schema";
import type { MessageListInput } from "@/features/portfolio/search";
import { ruleError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { baseLocale } from "@/paraglide/runtime";
import { withAudit } from "@/server/db/crud";
import type { SendEmailOptions } from "@/server/email/send";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { log } from "@/server/log";
import type { PublicServices, Services } from "@/server/services";
import * as repo from "./messages-repository";
import { findProfileRow } from "./profile-repository";

/**
 * The contact form and the admin inbox (decision 0176). The form saves every
 * message, then emails it to the profile's address; the inbox lists, marks and
 * archives them. Archiving and deleting are audited; reading isn't (it changes
 * nothing anyone else depends on).
 */

/** Three messages per ten minutes per sender (keyed by a hash of their IP). */
export const CONTACT_LIMIT = { max: 3, windowSeconds: 600 };

const target = (message: { id: string; email: string }) => ({
	type: "message" as const,
	id: message.id,
	label: message.email,
});

export type ContactClient = {
	/** A keyed hash of the client IP (never the IP itself), or null when unknown. */
	ipHash: string | null;
	/** Turnstile's check, when it is configured. */
	verifyCaptcha: ((token: string | undefined) => Promise<boolean>) | null;
	/** Sends the notification (sendEmail; tests pass a fake). */
	send: (options: SendEmailOptions<"contact-message">) => Promise<unknown>;
};

/**
 * Honeypot, Turnstile when configured, a database-backed rate limit, then the
 * message: saved, and emailed to the owner. A filled honeypot gets the same
 * "sent" answer as a real message, so bots learn nothing. A failed email is
 * logged, not shown: the message is safe in the inbox.
 */
export async function submitContact(
	{ db }: PublicServices,
	{ website, captcha, ...input }: ContactInput,
	client: ContactClient,
): Promise<{ sent: true }> {
	if (website) return { sent: true };
	if (client.verifyCaptcha && !(await client.verifyCaptcha(captcha))) {
		throw ruleError("BAD_REQUEST", "Captcha failed", m.auth_error_captcha());
	}
	await enforceRateLimit(db, `portfolio-contact:${client.ipHash ?? "unknown"}`, CONTACT_LIMIT);
	const saved = await repo.insertMessage(db, { ...input, ipHash: client.ipHash });
	const profile = await findProfileRow(db);
	if (profile) {
		try {
			await client.send({
				to: profile.email,
				template: "contact-message",
				locale: baseLocale,
				data: {
					name: input.name,
					email: input.email,
					message: input.message,
					url: absoluteUrl("/admin/portfolio/messages"),
				},
			});
		} catch (error) {
			log("error", "contact message email failed", {
				messageId: saved.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return { sent: true };
}

export const list = ({ db }: Pick<Services, "db">, input: MessageListInput): Promise<ContactMessagePage> =>
	repo.listMessages(db, input);

/** Read/unread for anyone who may read the inbox; archiving is audited. */
export function setState({ db, actor }: Services, input: MessageStateInput): Promise<{ changed: number }> {
	return withAudit(db, actor, async (tx, audit) => {
		const changed = await repo.setMessageState(tx, input);
		if (input.set === "archived" || input.set === "inbox") {
			const action = input.set === "archived" ? "message.archive" : "message.unarchive";
			audit(...changed.map((message) => ({ action, target: target(message) }) as const));
		}
		return { changed: changed.length };
	});
}

export async function remove({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await repo.deleteMessages(tx, ids);
		audit(
			...rows.map((message) => ({
				action: "message.delete" as const,
				target: target(message),
				before: { name: message.name },
			})),
		);
		return rows;
	});
	return { deleted: deleted.length };
}
