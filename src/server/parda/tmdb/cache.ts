import "@tanstack/react-start/server-only";
import { createLruCache } from "@/server/cache/lru";

/**
 * The server's cache of TMDB answers (decision 0229): the shared LRU (src/server/cache/lru.ts,
 * decision 0255) with a TTL per class, stale-while-revalidate for one more TTL, and one call
 * for concurrent readers. Keys carry the catalogue epoch, so bumping it purges everything
 * without touching the map.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TMDB_TTL = { configuration: 7 * DAY, details: DAY, list: HOUR, search: 10 * MINUTE } as const;
export type TmdbCacheClass = keyof typeof TMDB_TTL;

export type TmdbKey = {
	path: string;
	params?: Readonly<Record<string, string | number>>;
	locale: string;
	region: string;
	cap: string | null;
	epoch: number;
};

export const tmdbCacheKey = ({ path, params = {}, locale, region, cap, epoch }: TmdbKey) =>
	JSON.stringify([path, Object.entries(params).sort(([a], [b]) => a.localeCompare(b)), locale, region, cap, epoch]);

export type TmdbCache = {
	read: <T>(key: TmdbKey, cacheClass: TmdbCacheClass, load: () => Promise<T>) => Promise<T>;
	size: () => number;
};

export function createTmdbCache({ max = 2_000, now = Date.now }: { max?: number; now?: () => number } = {}): TmdbCache {
	const lru = createLruCache({ max, now, label: "tmdb" });
	return {
		size: lru.size,
		read: (tmdbKey, cacheClass, load) => lru.read(tmdbCacheKey(tmdbKey), TMDB_TTL[cacheClass], load),
	};
}
