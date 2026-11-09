import "@tanstack/react-start/server-only";
import { desc, eq, gt, gte, sql } from "drizzle-orm";
import type { ChaalHealth, ChaalHealthEndpoint, ChaalPing } from "@/features/chaal/admin/schema";
import type { ChaalHealthRange } from "@/features/chaal/admin/search";
import { AppError } from "@/lib/errors";
import { chApiError, chApiStat, chConnection, chSettings } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Lichess } from "../lichess/client";
import { dailyPuzzleAnswer } from "../lichess/schemas";

/**
 * /admin/chaal/health (PLAN Task 79, decision 0268): every server's Lichess calls by hour
 * and endpoint class (`ch_api_stat`, flushed after each call by ../stats.ts), the cooldowns
 * running now, the last failed calls, and "Test Lichess": one call through the public lane.
 */

const HOUR_MS = 3_600_000;
const RANGE_HOURS: Record<ChaalHealthRange, number> = { "24h": 24, "7d": 7 * 24 };
/** The failed calls the page lists (the table keeps 500). */
const ERRORS_SHOWN = 50;

const avg = (totalMs: number, calls: number) => (calls > 0 ? Math.round(totalMs / calls) : 0);

export async function healthState(db: Db, range: ChaalHealthRange, now: number = Date.now()): Promise<ChaalHealth> {
	const count = RANGE_HOURS[range];
	const last = Math.floor(now / HOUR_MS) * HOUR_MS;
	const first = last - (count - 1) * HOUR_MS;
	const since = gte(chApiStat.hour, new Date(first));
	const nowDate = new Date(now);

	const [byHour, byEndpoint, settings, cooling, errors] = await Promise.all([
		db
			.select({
				hour: chApiStat.hour,
				calls: sql<number>`sum(${chApiStat.calls})::int`,
				errors: sql<number>`sum(${chApiStat.errors})::int`,
				rateLimited: sql<number>`sum(${chApiStat.rateLimited})::int`,
			})
			.from(chApiStat)
			.where(since)
			.groupBy(chApiStat.hour),
		db
			.select({
				endpoint: chApiStat.endpoint,
				calls: sql<number>`sum(${chApiStat.calls})::int`,
				errors: sql<number>`sum(${chApiStat.errors})::int`,
				rateLimited: sql<number>`sum(${chApiStat.rateLimited})::int`,
				totalMs: sql<number>`sum(${chApiStat.totalMs})::float8`,
			})
			.from(chApiStat)
			.where(since)
			.groupBy(chApiStat.endpoint),
		db.select({ until: chSettings.publicCooldownUntil }).from(chSettings).where(eq(chSettings.id, 1)),
		db
			.select({ username: chConnection.username, until: chConnection.cooldownUntil })
			.from(chConnection)
			.where(gt(chConnection.cooldownUntil, nowDate))
			.orderBy(desc(chConnection.cooldownUntil)),
		db.select().from(chApiError).orderBy(desc(chApiError.at)).limit(ERRORS_SHOWN),
	]);

	const hours = new Map(byHour.map((row) => [row.hour.getTime(), row]));
	const endpoints: ChaalHealthEndpoint[] = byEndpoint
		.map((row) => ({
			endpoint: row.endpoint,
			calls: row.calls,
			errors: row.errors,
			rateLimited: row.rateLimited,
			avgMs: avg(row.totalMs, row.calls),
		}))
		.sort((a, b) => b.calls - a.calls || a.endpoint.localeCompare(b.endpoint));
	const totals = byEndpoint.reduce(
		(sum, row) => ({
			calls: sum.calls + row.calls,
			errors: sum.errors + row.errors,
			rateLimited: sum.rateLimited + row.rateLimited,
			totalMs: sum.totalMs + row.totalMs,
		}),
		{ calls: 0, errors: 0, rateLimited: 0, totalMs: 0 },
	);
	const publicUntil = settings[0]?.until;

	return {
		hours: Array.from({ length: count }, (_, index) => {
			const hour = first + index * HOUR_MS;
			const row = hours.get(hour);
			return {
				hour: new Date(hour).toISOString(),
				calls: row?.calls ?? 0,
				errors: row?.errors ?? 0,
				rateLimited: row?.rateLimited ?? 0,
			};
		}),
		endpoints,
		totals: {
			calls: totals.calls,
			errors: totals.errors,
			rateLimited: totals.rateLimited,
			avgMs: avg(totals.totalMs, totals.calls),
		},
		cooldowns: {
			public: publicUntil && publicUntil.getTime() > now ? publicUntil.toISOString() : null,
			connections: cooling.flatMap((row) =>
				row.until ? [{ username: row.username, until: row.until.toISOString() }] : [],
			),
		},
		errors: errors.map((row) => ({
			id: row.id,
			at: row.at.toISOString(),
			endpoint: row.endpoint,
			status: row.status,
			ms: row.ms,
			lane: row.lane,
		})),
	};
}

/**
 * "Test Lichess": the daily puzzle through the public lane, past the cache, timed. During
 * the public lane's cooldown it says so without calling ("wait"); any other failure is "down".
 */
export async function pingLichess(lichess: Lichess, now: () => number = Date.now): Promise<ChaalPing> {
	const started = now();
	try {
		await lichess.json({ endpoint: "ping", path: "/api/puzzle/daily", lane: "public" }, dailyPuzzleAnswer);
		return { ok: true, status: 200, ms: now() - started };
	} catch (error) {
		const wait = error instanceof AppError && error.code === "RATE_LIMITED";
		return { ok: false, reason: wait ? "wait" : "down", ms: now() - started };
	}
}
