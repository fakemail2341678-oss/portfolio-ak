import "@tanstack/react-start/server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { NOTIFY_KINDS, type NotifyEmail, type NotifyKind, notifyMode } from "@/features/kharcha/notifications";
import type { NotifySettingsInput } from "@/features/kharcha/schema";
import type { NotificationView } from "@/features/kharcha/types";
import { khNotification, khProfile } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, resolveMe } from "../access";
import { bumpRevs } from "../rev";

/**
 * Kharcha's notifications as the caller reads them (Task 92): Home's Updates, the bell's
 * count, marking them read, and the settings of how each kind is emailed. A notification is
 * its recipient's alone: every read is by `user_id`.
 */

/** Updates on Home: the newest. */
export const UPDATES_LIMIT = 20;
/** Read notifications older than this are pruned by the daily job. */
export const NOTIFICATION_DAYS = 90;

const viewOf = (row: typeof khNotification.$inferSelect): NotificationView => ({
	id: row.id,
	kind: row.kind,
	thread: row.thread as NotificationView["thread"],
	data: row.data,
	at: row.createdAt.toISOString(),
	read: row.readAt !== null,
});

export async function updatesOf(db: Db | Tx, userId: string, limit = UPDATES_LIMIT): Promise<NotificationView[]> {
	const rows = await db
		.select()
		.from(khNotification)
		.where(eq(khNotification.userId, userId))
		.orderBy(desc(khNotification.createdAt), desc(khNotification.id))
		.limit(limit);
	return rows.map(viewOf);
}

/** How many of the caller's notifications are unread: the bell. One indexed count. */
export async function unreadCount(db: Db | Tx, userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(khNotification)
		.where(and(eq(khNotification.userId, userId), isNull(khNotification.readAt)));
	return row?.n ?? 0;
}

/** Marks these of the caller's notifications read, or all of them; their pages refresh. */
export async function markRead({ db, user }: KharchaServices, ids?: ReadonlyArray<string>, now = new Date()) {
	const me = await resolveMe(db, user);
	await db.transaction(async (tx) => {
		await tx
			.update(khNotification)
			.set({ readAt: now })
			.where(
				and(
					eq(khNotification.userId, user.id),
					isNull(khNotification.readAt),
					ids ? inArray(khNotification.id, [...ids]) : undefined,
				),
			);
		await bumpRevs(tx, [me.personId]);
	});
}

/** Every kind with how it is emailed: the caller's choice, else the default. */
export const notifySettingsOf = (stored: Readonly<Record<string, string>>): Record<NotifyKind, NotifyEmail> =>
	Object.fromEntries(NOTIFY_KINDS.map((kind) => [kind, notifyMode(stored, kind)])) as Record<NotifyKind, NotifyEmail>;

/** Settings → Notifications: how each kind is emailed. Only what differs from the defaults is kept. */
export async function updateNotifySettings({ db, user }: KharchaServices, input: NotifySettingsInput): Promise<void> {
	const me = await resolveMe(db, user);
	const [profile] = await db.select({ notify: khProfile.notify }).from(khProfile).where(eq(khProfile.userId, user.id));
	const merged = notifySettingsOf({ ...(profile?.notify ?? {}), ...input.notify } as Record<string, string>);
	const kept = Object.fromEntries(
		NOTIFY_KINDS.filter((kind) => merged[kind] !== notifyMode({}, kind)).map((kind) => [kind, merged[kind]]),
	);
	await db.transaction(async (tx) => {
		await tx.update(khProfile).set({ notify: kept }).where(eq(khProfile.userId, user.id));
		await bumpRevs(tx, [me.personId]);
	});
}

/** Focus mode on or off (People shows only unread and unsettled conversations). */
export async function setFocus({ db, user }: KharchaServices, focus: boolean): Promise<void> {
	const me = await resolveMe(db, user);
	await db.transaction(async (tx) => {
		await tx.update(khProfile).set({ focus }).where(eq(khProfile.userId, user.id));
		await bumpRevs(tx, [me.personId]);
	});
}

/** The daily job's pruning: read notifications older than 90 days. */
export async function pruneRead(db: Db, now = new Date()): Promise<number> {
	const rows = await db
		.delete(khNotification)
		.where(
			and(
				isNotNull(khNotification.readAt),
				lt(khNotification.createdAt, new Date(now.getTime() - NOTIFICATION_DAYS * 86_400_000)),
			),
		)
		.returning({ id: khNotification.id });
	return rows.length;
}
