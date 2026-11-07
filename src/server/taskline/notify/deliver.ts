import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { notificationSentence } from "@/features/taskline/notifications";
import { SANDBOX_SEGMENT } from "@/features/taskline/types";
import { localizedUrl } from "@/lib/seo";
import { baseLocale, isLocale, type Locale } from "@/paraglide/runtime";
import { tlMember, tlNotification, tlProject, tlProjectMember, tlWorkspace, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";

/**
 * Taskline's email (PLAN 11.5; decision 0214). Notifications are written in the
 * change's transaction; this sends them afterwards:
 *
 * - **instant** (`deliverInstant`, run with `waitUntil` after the commit): one email per
 *   recipient and task, holding everything that change told them. Coalesced: when the
 *   same person got an email about the same task less than five minutes ago, the new
 *   rows wait for the digest instead (they're in the inbox at once either way).
 * - **digest** (`sendDigests`, the daily cron): per recipient, the unread rows not yet
 *   emailed (digest ones, and instant ones whose email never went), in one email.
 *
 * A row is claimed (`emailed_at` set) before its email is sent, so two senders never
 * send it twice; a failed send hands it back to the digest. A recipient deactivated, or
 * taken off a private project, since the row was made gets no email about it: titles and
 * excerpts are what they lost access to.
 */

export const COALESCE_MS = 5 * 60 * 1000;
/** Instant rows still unsent after this go in the digest (their `waitUntil` died). */
const INSTANT_GRACE_MS = 10 * 60 * 1000;
const DIGEST_MAX_ITEMS = 50;

type Row = {
	id: string;
	userId: string;
	taskId: string | null;
	projectId: string;
	kind: typeof tlNotification.$inferSelect.kind;
	data: typeof tlNotification.$inferSelect.data;
	readAt: Date | null;
	email: string;
	name: string;
	guest: boolean | null;
	locale: string | null;
	ws: string;
	key: string;
	reachable: boolean;
};

const columns = {
	id: tlNotification.id,
	userId: tlNotification.userId,
	taskId: tlNotification.taskId,
	projectId: tlNotification.projectId,
	kind: tlNotification.kind,
	data: tlNotification.data,
	readAt: tlNotification.readAt,
	email: user.email,
	name: user.name,
	guest: user.isAnonymous,
	locale: tlMember.locale,
	ws: sql<string>`case when ${tlWorkspace.kind} = 'sandbox' then ${SANDBOX_SEGMENT} else ${tlWorkspace.slug} end`,
	key: tlProject.key,
	reachable: sql<boolean>`${tlMember.id} is not null and ${tlMember.deactivatedAt} is null and (${tlProject.visibility} <> 'private' or exists (select 1 from ${tlProjectMember} where ${tlProjectMember.projectId} = ${tlNotification.projectId} and ${tlProjectMember.memberId} = ${tlMember.id}))`,
};

/** Notifications with their recipient (account and member row) and where they point. */
const withRecipient = (db: Db) =>
	db
		.select(columns)
		.from(tlNotification)
		.innerJoin(user, eq(user.id, tlNotification.userId))
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlNotification.workspaceId))
		.innerJoin(tlProject, eq(tlProject.id, tlNotification.projectId))
		.leftJoin(
			tlMember,
			and(eq(tlMember.workspaceId, tlNotification.workspaceId), eq(tlMember.userId, tlNotification.userId)),
		);

const localeOf = (row: Pick<Row, "locale">): Locale => (row.locale && isLocale(row.locale) ? row.locale : baseLocale);

const linkOf = (row: Row, locale: Locale) =>
	localizedUrl(
		row.data.ref ? `/app/taskline/${row.ws}/t/${row.data.ref}` : `/app/taskline/${row.ws}/p/${row.key}`,
		locale,
	);

/** The rows whose recipient may still read them; the others will never be emailed. */
async function reachableRows<T extends Pick<Row, "id" | "reachable">>(db: Db, rows: T[]): Promise<T[]> {
	const gone = rows.filter((row) => !row.reachable).map((row) => row.id);
	if (gone.length > 0) await db.update(tlNotification).set({ email: "none" }).where(inArray(tlNotification.id, gone));
	return rows.filter((row) => row.reachable);
}

/** Sets `emailed_at` on the rows still unclaimed; returns the ids this caller got. */
async function claim(db: Db, ids: ReadonlyArray<string>): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await db
		.update(tlNotification)
		.set({ emailedAt: new Date() })
		.where(and(inArray(tlNotification.id, [...ids]), isNull(tlNotification.emailedAt)))
		.returning({ id: tlNotification.id });
	return new Set(rows.map((row) => row.id));
}

/** A send failed: the rows go back to the queue, for the digest. */
async function release(db: Db, ids: ReadonlyArray<string>) {
	if (ids.length === 0) return;
	await db
		.update(tlNotification)
		.set({ emailedAt: null, email: "digest" })
		.where(inArray(tlNotification.id, [...ids]));
}

/** Whether `userId` was emailed about `taskId` within the coalescing window (rows other than `except`). */
async function recentlyEmailed(db: Db, userId: string, taskId: string, except: ReadonlyArray<string>, now: Date) {
	const [row] = await db
		.select({ id: tlNotification.id })
		.from(tlNotification)
		.where(
			and(
				eq(tlNotification.userId, userId),
				eq(tlNotification.taskId, taskId),
				eq(tlNotification.email, "instant"),
				gt(tlNotification.emailedAt, new Date(now.getTime() - COALESCE_MS)),
				sql`${tlNotification.id} not in (${sql.join(
					except.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			),
		)
		.limit(1);
	return Boolean(row);
}

export type DeliveryResult = { sent: number; deferred: number; failed: number };

/** Emails the instant notifications `ids` (those still unsent), one email per recipient and task. */
export async function deliverInstant(
	db: Db,
	ids: ReadonlyArray<string>,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<DeliveryResult> {
	const result: DeliveryResult = { sent: 0, deferred: 0, failed: 0 };
	if (ids.length === 0) return result;
	const rows = await withRecipient(db)
		.where(
			and(inArray(tlNotification.id, [...ids]), eq(tlNotification.email, "instant"), isNull(tlNotification.emailedAt)),
		)
		.orderBy(asc(tlNotification.createdAt));
	const groups = new Map<string, Row[]>();
	for (const row of await reachableRows(db, rows)) {
		const key = `${row.userId}:${row.taskId ?? row.id}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	for (const group of groups.values()) {
		const first = group[0];
		if (!first) continue;
		const groupIds = group.map((row) => row.id);
		if (first.guest) {
			await db.update(tlNotification).set({ email: "none" }).where(inArray(tlNotification.id, groupIds));
			continue;
		}
		if (first.taskId && (await recentlyEmailed(db, first.userId, first.taskId, groupIds, now))) {
			await db.update(tlNotification).set({ email: "digest" }).where(inArray(tlNotification.id, groupIds));
			result.deferred += group.length;
			continue;
		}
		const mine = await claim(db, groupIds);
		const claimed = group.filter((row) => mine.has(row.id));
		if (claimed.length === 0) continue;
		const locale = localeOf(first);
		try {
			await sendEmail(
				{
					to: first.email,
					template: "taskline-notification",
					locale,
					siteName: TASKLINE_NAME,
					data: {
						heading: first.data.ref ? `${first.data.ref} · ${first.data.title ?? ""}` : (first.data.project ?? ""),
						items: claimed.map((row) => notificationSentence(row.kind, row.data, locale)),
						excerpt: claimed.find((row) => row.data.excerpt)?.data.excerpt,
						url: linkOf(first, locale),
						settingsUrl: localizedUrl("/app/taskline/settings", locale),
					},
				},
				provider,
			);
			result.sent++;
		} catch (error) {
			result.failed++;
			await release(db, [...mine]);
			log("error", "taskline notification email failed", { userId: first.userId, ...errorFields(error) });
		}
	}
	return result;
}

/**
 * The daily digest: per recipient, the unread notifications not yet emailed. Rows
 * they already read are claimed without an email (they saw them). Safe to run twice:
 * a claimed row is never sent again.
 */
export async function sendDigests(
	db: Db,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<DeliveryResult> {
	const result: DeliveryResult = { sent: 0, deferred: 0, failed: 0 };
	const rows = await withRecipient(db)
		.where(
			and(
				isNull(tlNotification.emailedAt),
				or(
					eq(tlNotification.email, "digest"),
					and(
						eq(tlNotification.email, "instant"),
						lt(tlNotification.createdAt, new Date(now.getTime() - INSTANT_GRACE_MS)),
					),
				),
			),
		)
		.orderBy(asc(tlNotification.userId), asc(tlNotification.createdAt));
	const byUser = new Map<string, Row[]>();
	for (const row of await reachableRows(db, rows)) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
	for (const group of byUser.values()) {
		const first = group[0];
		if (!first) continue;
		if (first.guest) {
			await db
				.update(tlNotification)
				.set({ email: "none" })
				.where(
					inArray(
						tlNotification.id,
						group.map((row) => row.id),
					),
				);
			continue;
		}
		const mine = await claim(
			db,
			group.map((row) => row.id),
		);
		const unread = group.filter((row) => mine.has(row.id) && row.readAt === null);
		if (unread.length === 0) continue;
		const locale = localeOf(first);
		try {
			await sendEmail(
				{
					to: first.email,
					template: "taskline-digest",
					locale,
					siteName: TASKLINE_NAME,
					data: {
						name: first.name,
						items: unread.slice(0, DIGEST_MAX_ITEMS).map((row) => ({
							id: row.id,
							text: notificationSentence(row.kind, row.data, locale),
							title: row.data.title ?? row.data.project ?? "",
							url: linkOf(row, locale),
						})),
						more: Math.max(0, unread.length - DIGEST_MAX_ITEMS),
						url: localizedUrl("/app/taskline/inbox", locale),
						settingsUrl: localizedUrl("/app/taskline/settings", locale),
					},
				},
				provider,
			);
			result.sent++;
		} catch (error) {
			result.failed++;
			await release(db, [...mine]);
			log("error", "taskline digest email failed", { userId: first.userId, ...errorFields(error) });
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
				log("error", "taskline instant delivery failed", errorFields(error));
			}),
		);
	};
