import "@tanstack/react-start/server-only";
import { errorFields, log } from "@/server/log";

/**
 * The server's cache of TMDB answers (decision 0229): LRU, a TTL per class,
 * stale-while-revalidate for one more TTL, and one call for concurrent readers. Keys
 * carry the catalogue epoch, so bumping it purges everything without touching this map.
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

type Entry = { value: unknown; freshUntil: number; staleUntil: number };

export type TmdbCache = {
	read: <T>(key: TmdbKey, cacheClass: TmdbCacheClass, load: () => Promise<T>) => Promise<T>;
	size: () => number;
};

export function createTmdbCache({ max = 2_000, now = Date.now }: { max?: number; now?: () => number } = {}): TmdbCache {
	const entries = new Map<string, Entry>();
	const inFlight = new Map<string, Promise<unknown>>();

	const refresh = <T>(key: string, cacheClass: TmdbCacheClass, load: () => Promise<T>): Promise<T> => {
		const running = inFlight.get(key);
		if (running) return running as Promise<T>;
		const started = load()
			.then((value) => {
				const ttl = TMDB_TTL[cacheClass];
				entries.delete(key);
				entries.set(key, { value, freshUntil: now() + ttl, staleUntil: now() + 2 * ttl });
				for (const oldest of entries.keys()) {
					if (entries.size <= max) break;
					entries.delete(oldest);
				}
				return value;
			})
			.finally(() => inFlight.delete(key));
		inFlight.set(key, started);
		return started;
	};

	return {
		size: () => entries.size,
		read: async <T>(tmdbKey: TmdbKey, cacheClass: TmdbCacheClass, load: () => Promise<T>) => {
			const key = tmdbCacheKey(tmdbKey);
			const entry = entries.get(key);
			if (entry && now() < entry.staleUntil) {
				// Reinserted: a Map iterates in insertion order, so its first key is the least recently used.
				entries.delete(key);
				entries.set(key, entry);
				if (now() >= entry.freshUntil) {
					refresh(key, cacheClass, load).catch((error) => {
						log("warn", "tmdb background refresh failed", { path: tmdbKey.path, ...errorFields(error) });
					});
				}
				return entry.value as T;
			}
			return refresh(key, cacheClass, load);
		},
	};
}
