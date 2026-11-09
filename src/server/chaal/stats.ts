import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { desc, inArray, lt, sql } from "drizzle-orm";
import { chApiError, chApiStat } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import type { Counters, PendingCalls } from "./lichess/counters";

/**
 * Chaal's Lichess calls for /admin/chaal/health (PLAN 13.5, Task 79; decision 0268). Each
 * instance counts in memory (./lichess/counters.ts); after a call, the batch is added to
 * `ch_api_stat` (by hour and endpoint class) and its failures to `ch_api_error`, under
 * `waitUntil` so the answer never waits for it. One flush runs at a time per instance:
 * calls made meanwhile go in the next, so a burst costs a few writes, not one per call.
 */

/** The failed calls kept. */
export const API_ERRORS_KEPT = 500;
/** How long the hourly counts are kept (the daily job prunes). */
export const API_STAT_DAYS = 30;

/** Adds a batch of calls to the tables. */
export async function writeCalls(db: Db, { hours, errors }: PendingCalls): Promise<void> {
	if (hours.size > 0) {
		await db
			.insert(chApiStat)
			.values(
				[...hours.values()].map((entry) => ({
					hour: new Date(entry.hour),
					endpoint: entry.endpoint,
					calls: entry.calls,
					errors: entry.errors,
					rateLimited: entry.rateLimited,
					totalMs: Math.round(entry.totalMs),
				})),
			)
			.onConflictDoUpdate({
				target: [chApiStat.hour, chApiStat.endpoint],
				set: {
					calls: sql`${chApiStat.calls} + excluded.calls`,
					errors: sql`${chApiStat.errors} + excluded.errors`,
					rateLimited: sql`${chApiStat.rateLimited} + excluded.rate_limited`,
					totalMs: sql`${chApiStat.totalMs} + excluded.total_ms`,
				},
			});
	}
	if (errors.length > 0) {
		await db.insert(chApiError).values(
			errors.map((error) => ({
				at: new Date(error.at),
				endpoint: error.endpoint,
				status: error.status,
				ms: Math.round(error.ms),
				lane: error.lane,
			})),
		);
		// Only the last 500 stay.
		const older = db
			.select({ id: chApiError.id })
			.from(chApiError)
			.orderBy(desc(chApiError.at))
			.offset(API_ERRORS_KEPT);
		await db.delete(chApiError).where(inArray(chApiError.id, older));
	}
}

/**
 * The flush an instance's counters start after each call: one at a time, the calls made
 * meanwhile in the next. A failed write is logged and its batch dropped (the counts are
 * a health view, not a ledger). `keepAlive` is `waitUntil` on Vercel.
 */
export function createCallsFlush(
	db: Db,
	counters: () => Counters,
	keepAlive: (promise: Promise<unknown>) => void = waitUntil,
) {
	let running: Promise<void> | null = null;
	let again = false;
	const run = async () => {
		do {
			again = false;
			const batch = counters().drain();
			try {
				await writeCalls(db, batch);
			} catch (error) {
				log("warn", "chaal call stats flush failed", errorFields(error));
			}
		} while (again);
	};
	return {
		schedule: () => {
			if (running) {
				again = true;
				return;
			}
			running = run().finally(() => {
				running = null;
			});
			keepAlive(running);
		},
		/** Waits for the flush in progress (tests). */
		settled: () => running ?? Promise.resolve(),
	};
}

/** The daily job's part: hourly counts older than 30 days go. */
export async function pruneCallStats(db: Db, now: number = Date.now()): Promise<number> {
	const rows = await db
		.delete(chApiStat)
		.where(lt(chApiStat.hour, new Date(now - API_STAT_DAYS * 86_400_000)))
		.returning({ hour: chApiStat.hour });
	return rows.length;
}
