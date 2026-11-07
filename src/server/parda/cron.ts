import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";
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
export async function runPardaCron(
	db: Db,
	tmdb: Tmdb | null,
	options: {
		now?: Date;
		onRanked?: () => void;
		/** The controls the alerts read (takedowns, the kids' cap); a fresh reader when not given. */
		controls?: PardaControls;
		emailProvider?: EmailProvider;
		sleep?: (ms: number) => Promise<void>;
	} = {},
): Promise<PardaCronResult> {
	let titles: PardaCronResult["titles"];
	if (!tmdb) titles = { ok: true, skipped: true };
	else {
		try {
			titles = { ok: true, ...(await refreshTitles(db, tmdb)) };
		} catch (error) {
			log("error", "parda title refresh failed", errorFields(error));
			titles = { ok: false };
		}
	}
	let certificates: PardaCronResult["certificates"];
	if (!tmdb) certificates = { ok: true, skipped: true };
	else {
		try {
			certificates = { ok: true, ...(await refreshCertificates(db, tmdb, options.now ? { now: options.now } : {})) };
		} catch (error) {
			log("error", "parda certificate refresh failed", errorFields(error));
			certificates = { ok: false };
		}
	}
	let ranking: PardaCronResult["ranking"];
	try {
		ranking = { ok: true, ...(await rollupSources(db, options.now)) };
		// This process orders from the new scores at once; others within 30 s.
		options.onRanked?.();
	} catch (error) {
		log("error", "parda source rollup failed", errorFields(error));
		ranking = { ok: false };
	}
	let overview: PardaCronResult["overview"];
	try {
		overview = { ok: true, ...(await rollupDaily(db, options.now)) };
	} catch (error) {
		log("error", "parda daily rollup failed", errorFields(error));
		overview = { ok: false };
	}
	const controls = options.controls ?? createPardaControls(db);
	let episodes: PardaCronResult["episodes"];
	if (!tmdb) episodes = { ok: true, skipped: true };
	else {
		try {
			episodes = {
				ok: true,
				...(await checkNewEpisodes(db, tmdb, controls, {
					...(options.now ? { now: options.now } : {}),
					...(options.sleep ? { sleep: options.sleep } : {}),
				})),
			};
		} catch (error) {
			log("error", "parda episode check failed", errorFields(error));
			episodes = { ok: false };
		}
	}
	// After the check's transactions committed (as decision 0214): yesterday's unsent alerts go too.
	let digest: PardaCronResult["digest"];
	try {
		digest = {
			ok: true,
			...(await sendDigests(db, await controls.blocked(), {
				...(options.now ? { now: options.now } : {}),
				...(options.emailProvider ? { provider: options.emailProvider } : {}),
			})),
		};
	} catch (error) {
		log("error", "parda digest failed", errorFields(error));
		digest = { ok: false };
	}
	let parties: PardaCronResult["parties"];
	try {
		parties = { ok: true, ...(await endIdleParties(db, options.now)) };
	} catch (error) {
		log("error", "parda party cleanup failed", errorFields(error));
		parties = { ok: false };
	}
	return { titles, certificates, ranking, overview, episodes, digest, parties };
}
