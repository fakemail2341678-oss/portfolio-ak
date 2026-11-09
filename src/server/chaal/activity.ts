import "@tanstack/react-start/server-only";
import { lt } from "drizzle-orm";
import { type ChaalActivityKind, type ChaalActivityMode, chActivity } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";

/**
 * Chaal's activity (PLAN 13.5, `ch_activity`; decision 0266): what players did, counted for
 * the admin's overview (Task 84). Writing it never fails what the player did: a write that
 * fails is logged and dropped. A row with a `ref` (a game's or an analysis's id) is written
 * once per player, however often it's recorded.
 */

/** How long rows are kept: the daily job deletes older ones. */
export const ACTIVITY_DAYS = 90;

export type ActivityEntry = {
	userId: string | null;
	kind: ChaalActivityKind;
	mode?: ChaalActivityMode;
	ref?: string;
};

export async function recordActivity(db: Db | Tx, entry: ActivityEntry): Promise<void> {
	try {
		await db
			.insert(chActivity)
			.values({ userId: entry.userId, kind: entry.kind, mode: entry.mode ?? null, ref: entry.ref ?? null })
			.onConflictDoNothing();
	} catch (error) {
		log("warn", "chaal activity not recorded", { kind: entry.kind, ...errorFields(error) });
	}
}

/** Lichess's `source` of a game, as the mode it counts under. */
export function modeOfSource(source: string): ChaalActivityMode {
	if (source === "ai") return "ai";
	if (source === "friend") return "challenge";
	if (source === "lobby" || source === "pool") return "seek";
	return "lichess";
}

/** Deletes rows older than ACTIVITY_DAYS; returns how many went. */
export async function pruneActivity(db: Db, now: number = Date.now()): Promise<number> {
	const cutoff = new Date(now - ACTIVITY_DAYS * 24 * 60 * 60_000);
	const gone = await db.delete(chActivity).where(lt(chActivity.at, cutoff)).returning({ id: chActivity.id });
	return gone.length;
}
