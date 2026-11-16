import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import type { EmailProvider } from "@/server/email/types";
import { type CronSteps, runSteps } from "@/server/http/cron";
import { refreshCertificates, refreshTitles } from "./catalog/refresh";
import { createPardaControls, type PardaControls } from "./controls";
import { type CheckResult, checkNewEpisodes } from "./notify/check";
import { type DigestResult, sendDigests } from "./notify/digest";
import { endIdleParties } from "./party/service";
import { type DailyResult, rollupDaily } from "./player/daily";
import { type RollupResult, rollupSources } from "./player/stats";
import type { Tmdb } from "./tmdb/client";

export type PardaCronResult = {
	titles: { ok: boolean; skipped?: boolean; titles?: number };
	certificates: { ok: boolean; skipped?: boolean; checked?: number; failed?: number };
	ranking: { ok: boolean } & Partial<RollupResult>;
	overview: { ok: boolean } & Partial<DailyResult>;
	episodes: { ok: boolean; skipped?: boolean } & Partial<CheckResult>;
	digest: { ok: boolean } & Partial<DigestResult>;
	parties: { ok: boolean; ended?: number; deleted?: number };
};

/**
 * `GET /api/cron/parda`, once a day: the `pd_title` refresh, the titles' US certificates
 * (decision 0240), the sources' rollup and scores (decision 0238), the overview's rollup
 * and the 90-day prune (decision 0242), then the new-episode
 * check and, once its alerts are committed, the digest emails (decision 0241), each on
 * its own, so one failing leaves the others done. Running it twice changes nothing but
 * `refreshed_at` and today's rollup rows: a series checked today waits a day, and an
 * alert is emailed once. Idle watch parties end last (decision 0243).
 */
type PardaCronOptions = {
	now?: Date;
	onRanked?: () => void;
	/** The controls the alerts read (takedowns, the kids' cap); a fresh reader when not given. */
	controls?: PardaControls;
	emailProvider?: EmailProvider;
	sleep?: (ms: number) => Promise<void>;
};

/** A step that needs TMDB, when the catalogue isn't configured. */
const SKIPPED = { skipped: true } as const;

/** The job's steps, in the order they run (`defineCron`, src/server/http/cron.ts). */
export function pardaCronSteps(db: Db, tmdb: Tmdb | null, options: PardaCronOptions = {}) {
	const controls = options.controls ?? createPardaControls(db);
	const at = options.now ? { now: options.now } : {};
	return {
		titles: async () => (tmdb ? refreshTitles(db, tmdb) : SKIPPED),
		certificates: async () => (tmdb ? refreshCertificates(db, tmdb, at) : SKIPPED),
		ranking: async () => {
			const result = await rollupSources(db, options.now);
			// This process orders from the new scores at once; others within 30 s.
			options.onRanked?.();
			return result;
		},
		overview: () => rollupDaily(db, options.now),
		episodes: async () =>
			tmdb
				? checkNewEpisodes(db, tmdb, controls, { ...at, ...(options.sleep ? { sleep: options.sleep } : {}) })
				: SKIPPED,
		// After the check's transactions committed (as decision 0214): yesterday's unsent alerts go too.
		digest: async () =>
			sendDigests(db, await controls.blocked(), {
				...at,
				...(options.emailProvider ? { provider: options.emailProvider } : {}),
			}),
		parties: () => endIdleParties(db, options.now),
	} satisfies CronSteps;
}

/** The whole job, as the route runs it: what each step left. */
export async function runPardaCron(
	db: Db,
	tmdb: Tmdb | null,
	options: PardaCronOptions = {},
): Promise<PardaCronResult> {
	return (await runSteps("parda", pardaCronSteps(db, tmdb, options))).results;
}
