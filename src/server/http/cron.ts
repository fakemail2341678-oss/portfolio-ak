import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import { rateLimit } from "../db/schema";
import type { Db } from "../db/types";
import { serverEnv } from "../env";
import { errorFields, log } from "../log";
import { type ApiRoute, defineApiRoute, jsonResponse } from "./api-route";

/**
 * The one way to write a scheduled job (decision 0300). A job is a list of named steps:
 *
 *   export default defineCron({ name: "kharcha", steps: () => kharchaCronSteps(db) }).nitro;
 *
 * - **The secret:** `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends. Without
 *   CRON_SECRET the route doesn't exist (404); another token is a 401.
 * - **One run at a time,** on every instance: a run takes a lease first, and a second
 *   request while it is held answers `{ ok: true, skipped: "running" }` (Vercel may
 *   deliver one event twice).
 * - **Named steps, each on its own:** one failing leaves the others done. Every step
 *   is timed. Steps must be safe to run again: that is what a failed run needs next day.
 * - **Failures reported:** a failed step is logged with its stack and sent to Sentry,
 *   and the run answers 500 with `ok: false`, so the host's cron log shows it.
 *
 * The answer is `{ ok, ms, timings, <step>: { ok, …what it returned } }`.
 */
export type CronSteps = Record<string, () => Promise<object>>;

/** What a step left: what it returned and `ok: true`, or `ok: false` when it threw. */
export type StepResult<T> = ({ ok: true } & T) | { ok: false };

export type CronRun<T extends CronSteps> = {
	ok: boolean;
	ms: number;
	results: { [K in keyof T]: StepResult<Awaited<ReturnType<T[K]>>> };
	timings: { [K in keyof T]: number };
	failed: string[];
};

/** Runs a job's steps in order, each on its own, and says what each left and how long it took. */
export async function runSteps<T extends CronSteps>(job: string, steps: T): Promise<CronRun<T>> {
	const started = performance.now();
	const results: Record<string, object> = {};
	const timings: Record<string, number> = {};
	const failed: string[] = [];
	for (const [step, run] of Object.entries(steps)) {
		const stepStarted = performance.now();
		try {
			results[step] = { ok: true, ...(await run()) };
		} catch (error) {
			failed.push(step);
			results[step] = { ok: false };
			log("error", "cron step failed", { job, step, ...errorFields(error, { stack: true }) });
			void import("@sentry/tanstackstart-react").then((Sentry) =>
				Sentry.captureException(error, { tags: { cron: job, step } }),
			);
		}
		timings[step] = Math.round(performance.now() - stepStarted);
	}
	return {
		ok: failed.length === 0,
		ms: Math.round(performance.now() - started),
		results: results as CronRun<T>["results"],
		timings: timings as CronRun<T>["timings"],
		failed,
	};
}

const leaseKey = (job: string) => `cron:${job}`;

/**
 * Takes the job's lease, or says another run holds it. A row in Better Auth's
 * `rate_limit` table, as the rate limits of decision 0146 (its key prefixed `cron:`),
 * taken with one upsert: Postgres decides, whichever instance asks. A lease older than
 * `leaseMs` belonged to a run that died, and is taken over.
 */
export async function acquireLease(db: Db, job: string, leaseMs: number, now = Date.now()): Promise<boolean> {
	const key = leaseKey(job);
	const taken = await db
		.insert(rateLimit)
		.values({ id: key, key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: { lastRequest: now },
			setWhere: sql`${rateLimit.lastRequest} <= ${now - leaseMs}`,
		})
		.returning({ key: rateLimit.key });
	return taken.length > 0;
}

export async function releaseLease(db: Db, job: string): Promise<void> {
	await db.delete(rateLimit).where(eq(rateLimit.key, leaseKey(job)));
}

export type CronOptions<T extends CronSteps> = {
	/** The job's name in the log and in its lease: "kharcha". */
	name: string;
	/** The steps, in the order they run. Built per run, so each run has its own "now". */
	steps: () => T | Promise<T>;
	/** How long a run may hold its lease before another may start. 15 minutes. */
	leaseMs?: number;
	/** For tests: the database and the secret, instead of the app's own. */
	db?: Db;
	secret?: () => string | undefined;
};

export function defineCron<T extends CronSteps>(options: CronOptions<T>): ApiRoute {
	const { name, leaseMs = 15 * 60_000 } = options;
	return defineApiRoute({
		name: `cron-${name}`,
		methods: ["GET"],
		secret: options.secret ?? (() => serverEnv.CRON_SECRET),
		// A job runs as long as the host lets it; its lease, not a deadline, keeps a second one out.
		timeoutMs: false,
		handler: async () => {
			const db = options.db ?? (await import("../db/client")).db;
			if (!(await acquireLease(db, name, leaseMs))) {
				log("warn", "cron skipped", { job: name, reason: "running" });
				return jsonResponse(200, { ok: true, skipped: "running" });
			}
			try {
				const run = await runSteps(name, await options.steps());
				log(run.ok ? "info" : "error", "cron", {
					job: name,
					ok: run.ok,
					ms: run.ms,
					timings: run.timings,
					...(run.failed.length > 0 ? { failed: run.failed } : {}),
					results: run.results,
				});
				return jsonResponse(run.ok ? 200 : 500, { ok: run.ok, ms: run.ms, timings: run.timings, ...run.results });
			} finally {
				await releaseLease(db, name).catch((error: unknown) =>
					log("error", "cron lease not released", { job: name, ...errorFields(error) }),
				);
			}
		},
	});
}
