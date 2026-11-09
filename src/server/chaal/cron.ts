import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import { pruneActivity } from "./activity";

/**
 * Chaal's daily job (GET /api/cron/chaal, decision 0266): deletes activity older than 90
 * days. Task 79 adds flushing the call counters, Task 84 the daily rollups.
 */
export async function runChaalCron(db: Db, now: number = Date.now()): Promise<{ activityPruned: number }> {
	return { activityPruned: await pruneActivity(db, now) };
}
