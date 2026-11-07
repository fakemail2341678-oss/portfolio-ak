import "@tanstack/react-start/server-only";
import { errorFields, log } from "../log";

export type DbHealth =
	| { status: "ok"; latencyMs: number; checkedAt: string }
	| { status: "error"; latencyMs: number; checkedAt: string };

/** A check that takes longer than this counts as down (a hung connection must not hang the monitor). */
export const HEALTH_TIMEOUT_MS = 3000;

/**
 * Runs a trivial query and times it. Failures (and timeouts) are logged on the
 * server and reported as `status: "error"` without details, so connection
 * strings, hostnames and driver errors never reach the client.
 */
export const checkDatabaseHealth = async (
	ping: () => Promise<unknown>,
	now: () => number = () => performance.now(),
	timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<DbHealth> => {
	const started = now();
	const checkedAt = new Date().toISOString();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
	});
	try {
		await Promise.race([ping(), timeout]);
		return { status: "ok", latencyMs: Math.round(now() - started), checkedAt };
	} catch (error) {
		log("error", "db health check failed", errorFields(error));
		return { status: "error", latencyMs: Math.round(now() - started), checkedAt };
	} finally {
		clearTimeout(timer);
	}
};

/** The app database's health (`select 1`). The client is loaded lazily so the checks above stay testable without env. */
export const checkAppDatabase = async (): Promise<DbHealth> => {
	const [{ sql }, { db }] = await Promise.all([import("drizzle-orm"), import("./client")]);
	return checkDatabaseHealth(() => db.execute(sql`select 1`));
};

/**
 * GET /api/health for uptime monitors: 200 when the database answers, 503 when
 * it doesn't. Only the status and latency, never why; never cached.
 */
export const healthResponse = (health: DbHealth, method = "GET"): Response => {
	const body = {
		status: health.status,
		checks: { database: { status: health.status, latencyMs: health.latencyMs } },
		checkedAt: health.checkedAt,
	};
	return new Response(method === "HEAD" ? null : JSON.stringify(body), {
		status: health.status === "ok" ? 200 : 503,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
};
