import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { absoluteUrl } from "@/lib/seo";
import type { Locale } from "@/paraglide/runtime";
import { khPerson } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { serverEnv } from "@/server/env";

/**
 * Email to people without an account (PLAN 14.5 "Notifications and email", decision 0286):
 * only an invite or a reminder, never more than one a day whatever its kind, and a
 * one-click unsubscribe (`List-Unsubscribe`, RFC 8058) that stops all of it. The address
 * is the person's (one per address), so the day and the stop are on `kh_person`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const unsubscribeToken = (personId: string): string =>
	createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(`kharcha-unsubscribe:${personId}`).digest("base64url");

export const validUnsubscribe = (personId: string, token: string): boolean => {
	const expected = Buffer.from(unsubscribeToken(personId));
	const given = Buffer.from(token);
	return given.length === expected.length && timingSafeEqual(given, expected);
};

/** The link in the email and its header: the page asks, and a POST to it (the mail app's one click) stops. */
export const unsubscribeUrl = (personId: string, locale: Locale): string =>
	absoluteUrl(
		`/api/kharcha/unsubscribe?${new URLSearchParams({ p: personId, t: unsubscribeToken(personId), l: locale })}`,
	);

export const unsubscribeHeaders = (url: string): Record<string, string> => ({
	"List-Unsubscribe": `<${url}>`,
	"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

export type ContactMail = "ok" | "unsubscribed" | "today";

/**
 * Claims today's one email to a person without an account, in the sender's transaction:
 * "unsubscribed" once they stopped them, "today" when one went in the last 24 hours. The
 * row lock makes two senders at once wait for each other.
 */
export async function claimContactMail(tx: Tx, personId: string, now = new Date()): Promise<ContactMail> {
	const [row] = await tx
		.select({ mailedAt: khPerson.mailedAt, unsubscribedAt: khPerson.unsubscribedAt })
		.from(khPerson)
		.where(eq(khPerson.id, personId))
		.for("update");
	if (!row || row.unsubscribedAt) return "unsubscribed";
	if (row.mailedAt && now.getTime() - row.mailedAt.getTime() < DAY_MS) return "today";
	await tx.update(khPerson).set({ mailedAt: now }).where(eq(khPerson.id, personId));
	return "ok";
}

/** Whether a person without an account can still be emailed at all. */
export async function contactMailable(db: Db | Tx, personId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: khPerson.id })
		.from(khPerson)
		.where(and(eq(khPerson.id, personId), isNull(khPerson.unsubscribedAt)));
	return Boolean(row);
}

/** Stops every email to this person (idempotent). False when the person is gone. */
export async function unsubscribe(db: Db, personId: string, now = new Date()): Promise<boolean> {
	const [row] = await db.select({ at: khPerson.unsubscribedAt }).from(khPerson).where(eq(khPerson.id, personId));
	if (!row) return false;
	if (!row.at) await db.update(khPerson).set({ unsubscribedAt: now }).where(eq(khPerson.id, personId));
	return true;
}
