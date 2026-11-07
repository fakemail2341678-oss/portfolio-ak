/**
 * The new-episode check's rules (PLAN Task 68, decision 0241), pure so they're unit-tested
 * case by case (tests/unit/parda-alerts.test.ts).
 */

export type EpisodePoint = { season: number; episode: number };
export type NewEpisodes = { season: number; episode: number; lastEpisode: number };

/** A series is checked daily; one TMDB says ended, weekly (it may come back). */
export const CHECK_EVERY_MS = 20 * 60 * 60 * 1000;
export const ENDED_CHECK_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
/** An episode that aired longer ago than this is old news: the state catches up without an alert. */
export const FRESH_DAYS = 14;

const later = (a: EpisodePoint, b: EpisodePoint) =>
	a.season > b.season || (a.season === b.season && a.episode > b.episode);

/**
 * The episodes that aired since the check last saw `seen`, as one range of the latest's
 * season, or null: on the first check (no `seen`, which only records where the series
 * is), when nothing moved, for specials (season 0), and when the latest aired more than
 * `FRESH_DAYS` before `today` (a gap in checking, or TMDB filling in old data).
 */
export function newEpisodes(
	seen: EpisodePoint | null,
	latest: (EpisodePoint & { airDate: string | null }) | null,
	today: string,
): NewEpisodes | null {
	if (!seen || !latest || latest.season < 1 || !later(latest, seen)) return null;
	if (latest.airDate && daysBetween(latest.airDate, today) > FRESH_DAYS) return null;
	const first = seen.season === latest.season ? seen.episode + 1 : 1;
	return { season: latest.season, episode: Math.min(first, latest.episode), lastEpisode: latest.episode };
}

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Whether a series is due a check: never checked, or not since its interval. */
export function isDue(state: { checkedAt: Date; ended: boolean } | undefined, now: Date): boolean {
	if (!state) return true;
	const every = state.ended ? ENDED_CHECK_EVERY_MS : CHECK_EVERY_MS;
	return now.getTime() - state.checkedAt.getTime() >= every;
}

/** TMDB's statuses after which no new episode is expected. */
export const isEnded = (status: string | null) => status === "Ended" || status === "Canceled";

/**
 * Runs `work` over `items` at most `perSecond` a second (TMDB allows about 40, PLAN 12.4),
 * `concurrency` at a time: each batch takes at least `concurrency / perSecond` seconds.
 * Stops early when `stop()` says so (TMDB down), leaving the rest for the next run.
 */
export async function paced<T>(
	items: ReadonlyArray<T>,
	work: (item: T) => Promise<void>,
	{
		perSecond,
		concurrency,
		stop = () => false,
		sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
		now = Date.now,
	}: {
		perSecond: number;
		concurrency: number;
		stop?: () => boolean;
		sleep?: (ms: number) => Promise<void>;
		now?: () => number;
	},
): Promise<number> {
	const slot = (concurrency / perSecond) * 1000;
	let done = 0;
	for (let at = 0; at < items.length; at += concurrency) {
		if (stop()) break;
		const started = now();
		const batch = items.slice(at, at + concurrency);
		await Promise.all(batch.map(work));
		done += batch.length;
		const left = slot - (now() - started);
		if (left > 0 && at + concurrency < items.length) await sleep(left);
	}
	return done;
}
