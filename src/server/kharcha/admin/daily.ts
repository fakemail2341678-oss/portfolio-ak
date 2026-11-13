import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { KharchaDay } from "@/features/kharcha/admin/schema";
import {
	attachment,
	khActivity,
	khDailyStat,
	khExpense,
	khGroup,
	khInvite,
	khPayment,
	khPerson,
	khProfile,
	user,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { DRAFT_RECEIPTS, EXPENSE_RECEIPTS } from "../receipts/service";

/**
 * The overview's rollup (PLAN Task 96, decision 0290): each UTC day's counts into
 * `kh_daily_stat`, from the rows as they stand. The trash, expired guests and old invites
 * go later; the day's counts stay. The daily job runs it first, before its purges.
 */

const DAY_MS = 86_400_000;
/** How far back the first run reaches. */
export const BACKFILL_DAYS = 90;

export const KHARCHA_DAY_COUNTS = [
	"people",
	"guests",
	"active",
	"expenses",
	"groups",
	"payments",
	"receipts",
	"invitesSent",
	"invitesAccepted",
] as const satisfies ReadonlyArray<keyof KharchaDay>;

export const emptyDay = (day: string): KharchaDay => ({
	day,
	...(Object.fromEntries(KHARCHA_DAY_COUNTS.map((key) => [key, 0])) as Omit<KharchaDay, "day">),
});

const dayOf = (column: AnyPgColumn) => sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;

/** Rows of `table` per day of `column` in [since, until), with `where`, inner-joined to `joins`. */
async function perDay(
	db: Db,
	{
		table,
		column,
		where,
		distinct,
		joins = [],
	}: {
		table: PgTable;
		column: AnyPgColumn;
		where?: SQL | undefined;
		distinct?: AnyPgColumn;
		joins?: ReadonlyArray<readonly [PgTable, SQL]>;
	},
	since: Date,
	until: Date,
): Promise<Map<string, number>> {
	const counted = distinct ? sql<number>`(count(distinct ${distinct}))::int` : sql<number>`(count(*))::int`;
	let query = db
		.select({ day: dayOf(column), count: counted })
		.from(table)
		.$dynamic();
	for (const [joined, on] of joins) query = query.innerJoin(joined, on);
	const rows = await query
		.where(and(gte(column, since), lt(column, until), where))
		// By position: every value in a `sql` template is its own parameter, so the expression would not match (apps.md).
		.groupBy(sql`1`);
	return new Map(rows.map((row) => [row.day, row.count]));
}

const isGuest = sql`coalesce(${user.isAnonymous}, false)`;

/** Each day's counts from `since` up to `until`, oldest first; days with nothing are left out. */
export async function countsPerDay(db: Db, since: Date, until: Date): Promise<KharchaDay[]> {
	const profiles = (guests: boolean) =>
		perDay(
			db,
			{
				table: khProfile,
				column: khProfile.createdAt,
				where: guests ? sql`${isGuest}` : sql`not ${isGuest}`,
				joins: [[user, eq(user.id, khProfile.userId)]],
			},
			since,
			until,
		);
	const [people, guests, active, expenses, groups, payments, receipts, invitesSent, invitesAccepted] =
		await Promise.all([
			profiles(false),
			profiles(true),
			perDay(
				db,
				{
					table: khActivity,
					column: khActivity.at,
					distinct: khActivity.actorId,
					where: sql`not ${isGuest}`,
					joins: [
						[khPerson, eq(khPerson.id, khActivity.actorId)],
						[user, eq(user.id, khPerson.userId)],
					],
				},
				since,
				until,
			),
			perDay(db, { table: khExpense, column: khExpense.createdAt }, since, until),
			perDay(db, { table: khGroup, column: khGroup.createdAt }, since, until),
			perDay(db, { table: khPayment, column: khPayment.createdAt }, since, until),
			perDay(
				db,
				{
					table: attachment,
					column: attachment.createdAt,
					where: inArray(attachment.entityType, [EXPENSE_RECEIPTS, DRAFT_RECEIPTS]),
				},
				since,
				until,
			),
			perDay(db, { table: khInvite, column: khInvite.createdAt }, since, until),
			perDay(db, { table: khInvite, column: khInvite.acceptedAt, where: isNotNull(khInvite.acceptedAt) }, since, until),
		]);
	const counts = { people, guests, active, expenses, groups, payments, receipts, invitesSent, invitesAccepted };
	const days = new Set(Object.values(counts).flatMap((map) => [...map.keys()]));
	return [...days].sort().map((day) => {
		const row = emptyDay(day);
		for (const key of KHARCHA_DAY_COUNTS) row[key] = counts[key].get(day) ?? 0;
		return row;
	});
}

/**
 * Rolls up every day since the last one stored (that day again, as it may have been
 * partial), so a missed run fills in, through to now. Running it twice in a day replaces
 * today's row. Returns how many days were written.
 */
export async function rollupDaily(db: Db, now: Date = new Date()): Promise<number> {
	const cutoff = new Date(now.getTime() - BACKFILL_DAYS * DAY_MS);
	const [latest] = await db.select({ day: khDailyStat.day }).from(khDailyStat).orderBy(desc(khDailyStat.day)).limit(1);
	const from = latest ? new Date(`${latest.day}T00:00:00Z`) : cutoff;
	const rows = await countsPerDay(db, from < cutoff ? cutoff : from, now);
	for (const row of rows) {
		const { day: _day, ...figures } = row;
		await db
			.insert(khDailyStat)
			.values({ ...row, updatedAt: now })
			.onConflictDoUpdate({ target: khDailyStat.day, set: { ...figures, updatedAt: now } });
	}
	return rows.length;
}

/** The stored days from `day` up to (not including) `before`, oldest first. */
export async function storedDays(db: Db, day: string, before: string): Promise<KharchaDay[]> {
	const rows = await db
		.select()
		.from(khDailyStat)
		.where(and(gte(khDailyStat.day, day), lt(khDailyStat.day, before)))
		.orderBy(asc(khDailyStat.day));
	return rows.map(({ updatedAt: _updatedAt, ...row }) => row);
}
