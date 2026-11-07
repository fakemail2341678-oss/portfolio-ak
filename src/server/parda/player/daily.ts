import "@tanstack/react-start/server-only";
import { asc, desc, gte, lt, sql } from "drizzle-orm";
import { pdDailyStat, pdPlay, pdSearchStat } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { utcDay } from "./stats";

/**
 * The overview's rollup (PLAN Task 69, decision 0242): `pd_play` per UTC day into
 * `pd_daily_stat`, which outlives the plays, and the 90-day prune of `pd_play` and
 * `pd_search_stat`.
 */

const DAY_MS = 86_400_000;
/** Plays and search counts older than this are deleted by the daily job. */
export const KEEP_DAYS = 90;

export type DailyRow = Omit<typeof pdDailyStat.$inferInsert, "updatedAt"> & {
	day: string;
	accountPlays: number;
	guestPlays: number;
	anonymousPlays: number;
	failed: number;
	viewers: number;
	watchedS: number;
};

const count = (filter: ReturnType<typeof sql>) => sql<number>`(count(*) filter (where ${filter}))::int`;

/** Each day's plays from `since`, up to `until`. A party's plays count: they were watched. */
export function playsPerDay(db: Db, since: Date, until: Date): Promise<DailyRow[]> {
	return (
		db
			.select({
				day: sql<string>`to_char(${pdPlay.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
				accountPlays: count(sql`${pdPlay.viewerKind} = 'account'`),
				guestPlays: count(sql`${pdPlay.viewerKind} = 'guest'`),
				anonymousPlays: count(sql`${pdPlay.viewerKind} = 'anonymous'`),
				failed: count(sql`${pdPlay.failed}`),
				viewers: sql<number>`(count(distinct ${pdPlay.viewerKey}))::int`,
				watchedS: sql<number>`(coalesce(sum(${pdPlay.watchedS}), 0))::int`,
			})
			.from(pdPlay)
			.where(sql`${pdPlay.createdAt} >= ${since} and ${pdPlay.createdAt} < ${until}`)
			// By position: every value in a `sql` template is its own parameter, so the expression would not match (apps.md).
			.groupBy(sql`1`)
			.orderBy(sql`1`)
	);
}

export type DailyResult = { days: number; prunedPlays: number; prunedSearches: number };

/**
 * Rolls up every day since the last one stored (that day again, as it may have been
 * partial), so a missed run fills in, through to now. Then prunes. Running it twice in a
 * day replaces today's row and deletes nothing more.
 */
export async function rollupDaily(db: Db, now: Date = new Date()): Promise<DailyResult> {
	const cutoff = new Date(now.getTime() - KEEP_DAYS * DAY_MS);
	const [latest] = await db.select({ day: pdDailyStat.day }).from(pdDailyStat).orderBy(desc(pdDailyStat.day)).limit(1);
	const from = latest ? new Date(`${latest.day}T00:00:00Z`) : cutoff;
	const rows = await playsPerDay(db, from < cutoff ? cutoff : from, now);
	for (const row of rows) {
		await db
			.insert(pdDailyStat)
			.values({ ...row, updatedAt: now })
			.onConflictDoUpdate({
				target: pdDailyStat.day,
				set: {
					accountPlays: row.accountPlays,
					guestPlays: row.guestPlays,
					anonymousPlays: row.anonymousPlays,
					failed: row.failed,
					viewers: row.viewers,
					watchedS: row.watchedS,
					updatedAt: now,
				},
			});
	}
	const prunedPlays = await db.delete(pdPlay).where(lt(pdPlay.createdAt, cutoff)).returning({ id: pdPlay.id });
	const prunedSearches = await db
		.delete(pdSearchStat)
		.where(lt(pdSearchStat.day, utcDay(cutoff)))
		.returning({ day: pdSearchStat.day });
	return { days: rows.length, prunedPlays: prunedPlays.length, prunedSearches: prunedSearches.length };
}

/** The stored days from `day`, oldest first. */
export const storedDays = (db: Db, day: string): Promise<DailyRow[]> =>
	db
		.select({
			day: pdDailyStat.day,
			accountPlays: pdDailyStat.accountPlays,
			guestPlays: pdDailyStat.guestPlays,
			anonymousPlays: pdDailyStat.anonymousPlays,
			failed: pdDailyStat.failed,
			viewers: pdDailyStat.viewers,
			watchedS: pdDailyStat.watchedS,
		})
		.from(pdDailyStat)
		.where(gte(pdDailyStat.day, day))
		.orderBy(asc(pdDailyStat.day));
