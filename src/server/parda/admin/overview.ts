import "@tanstack/react-start/server-only";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { AdminOverview, AdminOverviewDay } from "@/features/parda/admin/schema";
import type { PardaOverviewRange } from "@/features/parda/admin/search";
import { addDays } from "@/lib/i18n/date-only";
import { pdPlay, pdReport, pdSearchStat, pdSource } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { type DailyRow, playsPerDay, storedDays } from "../player/daily";
import { utcDay } from "../player/stats";
import { titleNames } from "./takedowns";

/**
 * /admin/parda (PLAN Task 69, decision 0242): the finished days from `pd_daily_stat`,
 * today from `pd_play` as it stands, and the top lists read from the window's rows. Days
 * are UTC, as `pd_search_stat`'s are.
 */

/** The chart's days. */
const TREND_DAYS = 30;
const TOP_TITLES = 10;
const TOP_SEARCHES = 10;

const RANGE_DAYS: Readonly<Record<PardaOverviewRange, number>> = { today: 1, "7d": 7, "30d": 30 };

const playsOf = (row: DailyRow) => row.accountPlays + row.guestPlays + row.anonymousPlays;

/** The last `days` days through `today`, oldest first, with the days nobody played in. */
export function fillDays(rows: ReadonlyArray<DailyRow>, today: string, days: number): DailyRow[] {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return Array.from({ length: days }, (_, index) => {
		const day = addDays(today, index - days + 1);
		return (
			byDay.get(day) ?? { day, accountPlays: 0, guestPlays: 0, anonymousPlays: 0, failed: 0, viewers: 0, watchedS: 0 }
		);
	});
}

const sum = (rows: ReadonlyArray<DailyRow>, of: (row: DailyRow) => number) =>
	rows.reduce((total, row) => total + of(row), 0);

const toDay = (row: DailyRow): AdminOverviewDay => ({
	day: row.day,
	account: row.accountPlays,
	guest: row.guestPlays,
	anonymous: row.anonymousPlays,
	viewers: row.viewers,
	watchedS: row.watchedS,
});

async function topTitles(db: Db, since: Date) {
	const rows = await db
		.select({
			media: pdPlay.media,
			tmdbId: pdPlay.tmdbId,
			plays: count(),
			watchedS: sql<number>`(coalesce(sum(${pdPlay.watchedS}), 0))::int`,
		})
		.from(pdPlay)
		.where(gte(pdPlay.createdAt, since))
		.groupBy(pdPlay.media, pdPlay.tmdbId)
		.orderBy(desc(count()), desc(sql`4`))
		.limit(TOP_TITLES);
	const names = await titleNames(db, rows);
	return rows.map((row) => ({ ...row, title: names.get(`${row.media}:${row.tmdbId}`) ?? null }));
}

/** The window's searches, most searched first; `zero`: only those that never found anything. */
async function searches(db: Db, sinceDay: string, zero: boolean) {
	const total = sql<number>`(sum(${pdSearchStat.count}))::int`;
	return db
		.select({ query: pdSearchStat.query, count: total })
		.from(pdSearchStat)
		.where(gte(pdSearchStat.day, sinceDay))
		.groupBy(pdSearchStat.query)
		.having(zero ? sql`bool_and(${pdSearchStat.zeroResults})` : undefined)
		.orderBy(desc(total), pdSearchStat.query)
		.limit(TOP_SEARCHES);
}

/** Each server's plays in the window that it could have failed: the kinds of failure the ranking reads. */
async function servers(db: Db, since: Date) {
	const rows = await db
		.select({
			id: pdSource.id,
			name: pdSource.name,
			plays: count(),
			failed: sql<number>`(count(*) filter (where ${pdPlay.failed}))::int`,
		})
		.from(pdPlay)
		.innerJoin(pdSource, eq(pdPlay.sourceId, pdSource.id))
		.where(and(gte(pdPlay.createdAt, since), isNotNull(pdPlay.sourceId)))
		.groupBy(pdSource.id, pdSource.name, pdSource.position)
		.orderBy(pdSource.position);
	return rows.map((row) => ({ ...row, failureRate: row.plays === 0 ? 0 : row.failed / row.plays }));
}

export async function getOverview(
	{ db }: { db: Db },
	range: PardaOverviewRange,
	now: Date = new Date(),
): Promise<AdminOverview> {
	const today = utcDay(now);
	const startOfToday = new Date(`${today}T00:00:00Z`);
	const sinceDay = addDays(today, 1 - RANGE_DAYS[range]);
	const since = new Date(`${sinceDay}T00:00:00Z`);
	const [stored, live, titles, topSearches, zeroSearches, serverRows, [open]] = await Promise.all([
		storedDays(db, addDays(today, 1 - TREND_DAYS)),
		playsPerDay(db, startOfToday, now),
		topTitles(db, since),
		searches(db, sinceDay, false),
		searches(db, sinceDay, true),
		servers(db, since),
		db.select({ total: count() }).from(pdReport).where(eq(pdReport.status, "open")),
	]);
	// Today as it stands, not as the morning's rollup left it.
	const days = fillDays([...stored.filter((row) => row.day !== today), ...live], today, TREND_DAYS);
	const inRange = days.slice(-RANGE_DAYS[range]);
	const plays = sum(inRange, playsOf);
	const failed = sum(inRange, (row) => row.failed);
	return {
		range,
		today,
		plays: {
			today: sum(days.slice(-1), playsOf),
			week: sum(days.slice(-7), playsOf),
			month: sum(days, playsOf),
		},
		openReports: open?.total ?? 0,
		viewersPerDay: sum(inRange, (row) => row.viewers) / inRange.length,
		watchedS: sum(inRange, (row) => row.watchedS),
		failureRate: plays === 0 ? null : failed / plays,
		byKind: {
			account: sum(inRange, (row) => row.accountPlays),
			guest: sum(inRange, (row) => row.guestPlays),
			anonymous: sum(inRange, (row) => row.anonymousPlays),
		},
		days: days.map(toDay),
		topTitles: titles,
		topSearches,
		zeroSearches,
		servers: serverRows,
	};
}
