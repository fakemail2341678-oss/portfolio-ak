import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { and, asc, eq, gt, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { KHARCHA_NAME } from "@/features/kharcha/brand";
import { notificationSentence, parseThread, type ThreadKey, threadPath } from "@/features/kharcha/notifications";
import { localizedUrl } from "@/lib/seo";
import { baseLocale, isLocale, type Locale } from "@/paraglide/runtime";
import { khGroupMember, khNotification, khPerson, khProfile, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";

/**
 * Kharcha's email of notifications (decision 0286, Taskline's pattern: 0214). Rows are
 * written in the change's transaction; this sends them afterwards:
 *
 * - **instant** (`deliverInstant`, with `waitUntil` after the commit): one
 *   `kharcha-notification` per recipient and thread, holding everything that change told
 *   them. Coalesced: when the same person got an email about the same thread less than five
 *   minutes ago, the new rows wait for the digest (they are on Home at once either way).
 * - **digest** (`sendDigests`, the daily job): per recipient, the unread rows not yet
 *   emailed, in one `kharcha-digest`.
 *
 * A row is claimed (`emailed_at`) before its email is sent, so two senders never send it
 * twice; a failed send hands it back to the digest. Someone who left a group since gets no
 * email about it. Everything is in the recipient's language (`kh_profile.locale`).
 */

export const COALESCE_MS = 5 * 60 * 1000;
/** Instant rows still unsent after this go in the digest (their `waitUntil` died, or nobody delivered them). */
const INSTANT_GRACE_MS = 10 * 60 * 1000;
const DIGEST_MAX_ITEMS = 50;

const columns = {
	id: khNotification.id,
	userId: khNotification.userId,
	kind: khNotification.kind,
	thread: khNotification.thread,
	data: khNotification.data,
	readAt: khNotification.readAt,
	email: user.email,
	name: user.name,
	guest: user.isAnonymous,
	locale: khProfile.locale,
	reachable: sql<boolean>`(${khNotification.groupId} is null or exists (select 1 from ${khGroupMember}
		inner join ${khPerson} on ${khPerson.id} = ${khGroupMember.personId}
		where ${khGroupMember.groupId} = ${khNotification.groupId} and ${khPerson.userId} = ${khNotification.userId}
			and ${khGroupMember.leftAt} is null))`,
};

const withRecipient = (db: Db) =>
	db
		.select(columns)
		.from(khNotification)
		.innerJoin(user, eq(user.id, khNotification.userId))
		.leftJoin(khProfile, eq(khProfile.userId, khNotification.userId));

type Row = Awaited<ReturnType<ReturnType<typeof withRecipient>["where"]>>[number];

const localeOf = (row: Pick<Row, "locale">): Locale => (row.locale && isLocale(row.locale) ? row.locale : baseLocale);

const linkOf = (thread: string, locale: Locale) => localizedUrl(threadPath(thread as ThreadKey), locale);

/** The rows whose recipient may still read them; the others will never be emailed. */
async function reachableRows(db: Db, rows: Row[]): Promise<Row[]> {
	const gone = rows.filter((row) => !row.reachable).map((row) => row.id);
	if (gone.length > 0) await db.update(khNotification).set({ email: "none" }).where(inArray(khNotification.id, gone));
	return rows.filter((row) => row.reachable);
}

async function claim(db: Db, ids: ReadonlyArray<string>, now: Date): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await db
		.update(khNotification)
		.set({ emailedAt: now })
		.where(and(inArray(khNotification.id, [...ids]), isNull(khNotification.emailedAt)))
		.returning({ id: khNotification.id });
	return new Set(rows.map((row) => row.id));
}

async function release(db: Db, ids: ReadonlyArray<string>) {
	if (ids.length === 0) return;
	await db
		.update(khNotification)
		.set({ emailedAt: null, email: "digest" })
		.where(inArray(khNotification.id, [...ids]));
}

async function recentlyEmailed(db: Db, row: Row, except: ReadonlyArray<string>, now: Date) {
	const [hit] = await db
		.select({ id: khNotification.id })
		.from(khNotification)
		.where(
			and(
				eq(khNotification.userId, row.userId),
				eq(khNotification.thread, row.thread),
				eq(khNotification.email, "instant"),
				gt(khNotification.emailedAt, new Date(now.getTime() - COALESCE_MS)),
				notInArray(khNotification.id, [...except]),
			),
		)
		.limit(1);
	return Boolean(hit);
}

/** The email's heading: the group's name, the expense's title, or who wrote to them. */
const headingOf = (row: Row, locale: Locale) => {
	const { kind } = parseThread(row.thread as ThreadKey);
	const data = row.data;
	if (kind === "g") return data.group ?? data.title ?? KHARCHA_NAME;
	if (kind === "e") return data.title ?? KHARCHA_NAME;
	return data.actor ?? notificationSentence(row.kind, data, locale);
};

export type DeliveryResult = { sent: number; deferred: number; failed: number };

/** Emails the instant notifications `ids` (those still unsent), one email per recipient and thread. */
export async function deliverInstant(
	db: Db,
	ids: ReadonlyArray<string>,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<DeliveryResult> {
	const result: DeliveryResult = { sent: 0, deferred: 0, failed: 0 };
	if (ids.length === 0) return result;
	const rows = await withRecipient(db)
		.where(
			and(inArray(khNotification.id, [...ids]), eq(khNotification.email, "instant"), isNull(khNotification.emailedAt)),
		)
		.orderBy(asc(khNotification.createdAt));
	const groups = new Map<string, Row[]>();
	for (const row of await reachableRows(db, rows)) {
		const key = `${row.userId}:${row.thread}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	for (const group of groups.values()) {
		const first = group[0];
		if (!first) continue;
		const groupIds = group.map((row) => row.id);
		if (first.guest) {
			await db.update(khNotification).set({ email: "none" }).where(inArray(khNotification.id, groupIds));
			continue;
		}
		if (await recentlyEmailed(db, first, groupIds, now)) {
			await db.update(khNotification).set({ email: "digest" }).where(inArray(khNotification.id, groupIds));
			result.deferred += group.length;
			continue;
		}
		const mine = await claim(db, groupIds, now);
		const claimed = group.filter((row) => mine.has(row.id));
		if (claimed.length === 0) continue;
		const locale = localeOf(first);
		try {
			await sendEmail(
				{
					to: first.email,
					template: "kharcha-notification",
					locale,
					siteName: KHARCHA_NAME,
					data: {
						heading: headingOf(first, locale),
						items: claimed.map((row) => notificationSentence(row.kind, row.data, locale)),
						excerpt: claimed.find((row) => row.data.excerpt)?.data.excerpt,
						url: linkOf(first.thread, locale),
						settingsUrl: localizedUrl("/app/kharcha/settings/notifications", locale),
					},
				},
				provider,
			);
			result.sent++;
		} catch (error) {
			result.failed++;
			await release(db, [...mine]);
			log("error", "kharcha notification email failed", { userId: first.userId, ...errorFields(error) });
		}
	}
	return result;
}

/**
 * The daily digest: per recipient, the notifications not yet emailed (digest ones, and
 * instant ones whose email never went). Rows they already read are claimed without an email.
 * Safe to run twice: a claimed row is never sent again.
 */
export async function sendDigests(
	db: Db,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<DeliveryResult> {
	const result: DeliveryResult = { sent: 0, deferred: 0, failed: 0 };
	const rows = await withRecipient(db)
		.where(
			and(
				isNull(khNotification.emailedAt),
				or(
					eq(khNotification.email, "digest"),
					and(
						eq(khNotification.email, "instant"),
						lt(khNotification.createdAt, new Date(now.getTime() - INSTANT_GRACE_MS)),
					),
				),
			),
		)
		.orderBy(asc(khNotification.userId), asc(khNotification.createdAt));
	const byUser = new Map<string, Row[]>();
	for (const row of await reachableRows(db, rows)) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
	for (const group of byUser.values()) {
		const first = group[0];
		if (!first) continue;
		const ids = group.map((row) => row.id);
		if (first.guest) {
			await db.update(khNotification).set({ email: "none" }).where(inArray(khNotification.id, ids));
			continue;
		}
		const mine = await claim(db, ids, now);
		const unread = group.filter((row) => mine.has(row.id) && row.readAt === null);
		if (unread.length === 0) continue;
		const locale = localeOf(first);
		try {
			await sendEmail(
				{
					to: first.email,
					template: "kharcha-digest",
					locale,
					siteName: KHARCHA_NAME,
					data: {
						name: first.name,
						items: unread.slice(0, DIGEST_MAX_ITEMS).map((row) => ({
							id: row.id,
							text: notificationSentence(row.kind, row.data, locale),
							url: linkOf(row.thread, locale),
						})),
						more: Math.max(0, unread.length - DIGEST_MAX_ITEMS),
						url: localizedUrl("/app/kharcha/home", locale),
						settingsUrl: localizedUrl("/app/kharcha/settings/notifications", locale),
					},
				},
				provider,
			);
			result.sent++;
		} catch (error) {
			result.failed++;
			await release(db, [...mine]);
			log("error", "kharcha digest email failed", { userId: first.userId, ...errorFields(error) });
		}
	}
	return result;
}

/** The deliverer the middleware gives services: instant emails in the background, after the response. */
export const backgroundDelivery =
	(db: Db) =>
	(ids: string[]): void => {
		if (ids.length === 0) return;
		waitUntil(
			deliverInstant(db, ids).catch((error: unknown) => {
				log("error", "kharcha instant delivery failed", errorFields(error));
			}),
		);
	};
