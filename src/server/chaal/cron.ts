import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import { pruneActivity } from "./activity";
import { pruneCallStats } from "./stats";

/**
 * Chaal's daily job (GET /api/cron/chaal, decision 0266): deletes activity older than 90
 * days and hourly call counts older than 30 (Task 79; the counters are flushed after each
 * call, decision 0268). Task 84 adds the daily rollups.
 */
export async function runChaalCron(
	db: Db,
	now: number = Date.now(),
): Promise<{ activityPruned: number; callStatsPruned: number }> {
	return { activityPruned: await pruneActivity(db, now), callStatsPruned: await pruneCallStats(db, now) };
}
