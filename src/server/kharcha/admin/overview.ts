import "@tanstack/react-start/server-only";
import { and, countDistinct, eq, exists, gte, or, sql } from "drizzle-orm";
import type { KharchaDay, KharchaOverview } from "@/features/kharcha/admin/schema";
import { addDays } from "@/lib/i18n/date-only";
import { khActivity, khExpenseShare, khPayment, khPerson, khProfile, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { countsPerDay, emptyDay, KHARCHA_DAY_COUNTS, storedDays } from "./daily";

/**
 * /admin/kharcha (PLAN Task 96, decision 0290): the finished days from `kh_daily_stat`,
 * today from the rows as they stand, and people over 7 and 30 days from `kh_activity`
 * itself (a person is counted once however many days they came). Days are UTC. Counts
 * only: nothing here reads an amount, a title or a name (0186).
 */

export const TREND_DAYS = 30;

const utcDay = (at: Date) => at.toISOString().slice(0, 10);
const notGuest = sql`not coalesce(${user.isAnonymous}, false)`;

/** The last `days` days through `today`, oldest first, with the quiet ones. */
export function fillDays(rows: ReadonlyArray<KharchaDay>, today: string, days: number): KharchaDay[] {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return Array.from({ length: days }, (_, index) => {
		const day = addDays(today, index - days + 1);
		return byDay.get(day) ?? emptyDay(day);
	});
}

async function activeSince(db: Db, since: Date): Promise<number> {
	const [row] = await db
		.select({ people: countDistinct(khActivity.actorId) })
		.from(khActivity)
		.innerJoin(khPerson, eq(khPerson.id, khActivity.actorId))
		.innerJoin(user, eq(user.id, khPerson.userId))
		.where(and(gte(khActivity.at, since), notGuest));
	return row?.people ?? 0;
}

/** Accounts (guests apart) whose person shares in an expense or is in a payment. */
async function peopleWithData(db: Db): Promise<number> {
	const [row] = await db
		.select({ people: countDistinct(khProfile.personId) })
		.from(khProfile)
		.innerJoin(user, eq(user.id, khProfile.userId))
		.where(
			and(
				notGuest,
				or(
					exists(
						db.select({ one: sql`1` }).from(khExpenseShare).where(eq(khExpenseShare.personId, khProfile.personId)),
					),
					exists(
						db
							.select({ one: sql`1` })
							.from(khPayment)
							.where(or(eq(khPayment.fromPerson, khProfile.personId), eq(khPayment.toPerson, khProfile.personId))),
					),
				),
			),
		);
	return row?.people ?? 0;
}

export async function getOverview(db: Db, now: Date = new Date()): Promise<KharchaOverview> {
	const today = utcDay(now);
	const startOfToday = new Date(`${today}T00:00:00Z`);
	const [stored, live, week, month, people] = await Promise.all([
		storedDays(db, addDays(today, 1 - TREND_DAYS), today),
		countsPerDay(db, startOfToday, now),
		activeSince(db, new Date(`${addDays(today, -6)}T00:00:00Z`)),
		activeSince(db, new Date(`${addDays(today, 1 - TREND_DAYS)}T00:00:00Z`)),
		peopleWithData(db),
	]);
	// Today as it stands, not as the morning's rollup left it.
	const days = fillDays([...stored, ...live], today, TREND_DAYS);
	const totals = Object.fromEntries(
		KHARCHA_DAY_COUNTS.filter((key) => key !== "active").map((key) => [
			key,
			days.reduce((total, row) => total + row[key], 0),
		]),
	) as KharchaOverview["totals"];
	return { today, people, active: { week, month }, totals, days };
}
