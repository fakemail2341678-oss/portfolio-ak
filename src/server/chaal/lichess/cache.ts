import "@tanstack/react-start/server-only";
import { isAppError } from "@/lib/errors";
import { createLruCache, type LruOptions, type Ttl } from "@/server/cache/lru";

/**
 * Chaal's cache of Lichess answers (PLAN 13.5, decision 0255), on the shared LRU
 * (src/server/cache/lru.ts). Keys carry `ch_settings.cache_epoch` (bumping it purges) and,
 * for a personal read, the connection, so one user's answers never reach another. While
 * Lichess asks us to wait, or can't be reached, a read serves whatever the cache still
 * holds, however old, before failing.
 */

const SECOND = 1_000;

// Each read's TTL arrives with the feature that makes it (PLAN 13.5, "Cache TTLs"): TV
// channels 5 s, profiles and tournaments 60 s, broadcasts 5 min, leaderboards 1 h, the
// masters explorer 7 d and Lichess's 1 h, the tablebase 30 d, cloud eval 1 d.

/** The daily puzzle changes at midnight UTC: it's fresh until then (at least a second). */
export function untilUtcMidnight(now: number): number {
	const midnight = new Date(now);
	midnight.setUTCHours(24, 0, 0, 0);
	return Math.max(SECOND, midnight.getTime() - now);
}

export type ChaalCacheKey = {
	endpoint: string;
	path: string;
	params?: Readonly<Record<string, string | number | boolean | undefined>>;
	epoch: number;
	/** The connection (its user's id) for a personal read; absent for public answers. */
	owner?: string;
};

export const chaalCacheKey = ({ endpoint, path, params = {}, epoch, owner }: ChaalCacheKey) =>
	JSON.stringify([
		endpoint,
		path,
		Object.entries(params)
			.filter(([, value]) => value !== undefined)
			.sort(([a], [b]) => a.localeCompare(b)),
		epoch,
		owner ?? null,
	]);

export type ChaalCache = {
	/** `ttlMs` may depend on the answer: a position Lichess hasn't evaluated is asked again sooner. */
	read: <T>(key: ChaalCacheKey, ttlMs: Ttl<T>, load: () => Promise<T>) => Promise<T>;
	size: () => number;
};

/** Errors a stale answer may stand in for: a cooldown, or Lichess unreachable. */
const servesStale = (error: unknown) =>
	isAppError(error) &&
	((error.code === "RATE_LIMITED" && error.reason === "lichess-wait") || error.code === "UPSTREAM_UNAVAILABLE");

export function createChaalCache(options: Omit<LruOptions, "label"> = {}): ChaalCache {
	const lru = createLruCache({ ...options, label: "lichess" });
	return {
		size: lru.size,
		read: async (key, ttlMs, load) => {
			const id = chaalCacheKey(key);
			try {
				return await lru.read(id, ttlMs, load);
			} catch (error) {
				if (servesStale(error)) {
					const stale = lru.peek<Awaited<ReturnType<typeof load>>>(id);
					if (stale !== null) return stale;
				}
				throw error;
			}
		},
	};
}
