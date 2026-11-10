import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import { pruneActivity } from "./activity";
import { rollupDaily } from "./daily";
import { pruneCallStats } from "./stats";

/**
 * Chaal's daily job (GET /api/cron/chaal, decision 0266): rolls the activity up into
 * `ch_daily_stat` (Task 84, decision 0274), then deletes activity older than 90 days and
 * hourly call counts older than 30 (Task 79; the counters are flushed after each call,
 * decision 0268). The rollup runs first, so no day is pruned before it's counted.
 */
export async function runChaalCron(
	db: Db,
	now: number = Date.now(),
): Promise<{ daysRolledUp: number; activityPruned: number; callStatsPruned: number }> {
	const daysRolledUp = await rollupDaily(db, now);
	return { daysRolledUp, activityPruned: await pruneActivity(db, now), callStatsPruned: await pruneCallStats(db, now) };
}
