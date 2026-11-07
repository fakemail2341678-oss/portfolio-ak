import "@tanstack/react-start/server-only";
import { and, count, desc, eq, gte, inArray, isNull, max } from "drizzle-orm";
import { pdListItem, pdNotification, pdProgress } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** A profile's alerts and the series it follows (PLAN Task 68, decision 0241). */

export type NotificationRow = typeof pdNotification.$inferSelect;

export async function latestNotifications(db: Db, profileId: string, limit: number, since?: Date) {
	return db
		.select()
		.from(pdNotification)
		.where(
			since
				? and(eq(pdNotification.profileId, profileId), gte(pdNotification.createdAt, since))
				: eq(pdNotification.profileId, profileId),
		)
		.orderBy(desc(pdNotification.createdAt), desc(pdNotification.id))
		.limit(limit);
}

export async function unreadCount(db: Db, profileId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(pdNotification)
		.where(and(eq(pdNotification.profileId, profileId), isNull(pdNotification.readAt)));
	return row?.value ?? 0;
}

/** Marks the profile's alerts read: `ids`, or every unread one. */
export async function markRead(db: Db, profileId: string, ids: ReadonlyArray<string> | null, now: Date) {
	await db
		.update(pdNotification)
		.set({ readAt: now })
		.where(
			and(
				eq(pdNotification.profileId, profileId),
				isNull(pdNotification.readAt),
				ids ? inArray(pdNotification.id, [...ids]) : undefined,
			),
		);
}

/**
 * The series the profile follows, latest activity first: in My List or ♥, or played or
 * marked since `since`.
 */
export async function followedBy(db: Db, profileId: string, since: Date, limit: number): Promise<number[]> {
	const [listed, played] = await Promise.all([
		db
			.select({ id: pdListItem.tmdbId, at: max(pdListItem.addedAt) })
			.from(pdListItem)
			.where(and(eq(pdListItem.profileId, profileId), eq(pdListItem.media, "tv")))
			.groupBy(pdListItem.tmdbId),
		db
			.select({ id: pdProgress.tmdbId, at: max(pdProgress.updatedAt) })
			.from(pdProgress)
			.where(and(eq(pdProgress.profileId, profileId), eq(pdProgress.media, "tv"), gte(pdProgress.updatedAt, since)))
			.groupBy(pdProgress.tmdbId),
	]);
	const latest = new Map<number, number>();
	for (const row of [...listed, ...played]) {
		const at = row.at?.getTime() ?? 0;
		latest.set(row.id, Math.max(latest.get(row.id) ?? 0, at));
	}
	return [...latest]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id);
}

/** The episodes of `ids` the profile finished, as `id:season:episode`. */
export async function finishedEpisodes(db: Db, profileId: string, ids: ReadonlyArray<number>): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await db
		.select({ id: pdProgress.tmdbId, season: pdProgress.season, episode: pdProgress.episode })
		.from(pdProgress)
		.where(
			and(
				eq(pdProgress.profileId, profileId),
				eq(pdProgress.media, "tv"),
				inArray(pdProgress.tmdbId, [...ids]),
				eq(pdProgress.finished, true),
			),
		);
	return new Set(rows.map((row) => `${row.id}:${row.season}:${row.episode}`));
}
