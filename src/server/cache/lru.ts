import "@tanstack/react-start/server-only";
import { errorFields, log } from "@/server/log";

/**
 * The server's in-process cache of upstream answers (decisions 0229 and 0255): LRU, a TTL
 * per read, stale-while-revalidate for one more TTL, and one call for concurrent readers
 * of a key. Parda's TMDB answers and Chaal's Lichess answers use it, each with its own
 * keys (which carry the layer's cache epoch, so bumping it purges without touching this map).
 */

type Entry = { value: unknown; freshUntil: number; staleUntil: number };

export type LruCache = {
	/**
	 * The value for `key`: fresh from the map; stale (within a second TTL) from the map while
	 * `load` refreshes it in the background; otherwise from `load`, awaited.
	 */
	read: <T>(key: string, ttlMs: number, load: () => Promise<T>) => Promise<T>;
	/** Whatever the map holds for `key`, however old (null when nothing): what a caller serves when it can't call upstream. */
	peek: <T>(key: string) => T | null;
	size: () => number;
};

export type LruOptions = {
	max?: number;
	now?: () => number;
	/** Named in the log line when a background refresh fails. */
	label?: string;
};

export function createLruCache({ max = 2_000, now = Date.now, label = "cache" }: LruOptions = {}): LruCache {
	const entries = new Map<string, Entry>();
	const inFlight = new Map<string, Promise<unknown>>();

	const refresh = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
		const running = inFlight.get(key);
		if (running) return running as Promise<T>;
		const started = load()
			.then((value) => {
				entries.delete(key);
				entries.set(key, { value, freshUntil: now() + ttlMs, staleUntil: now() + 2 * ttlMs });
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
		peek: <T>(key: string) => (entries.has(key) ? (entries.get(key)?.value as T) : null),
		read: async <T>(key: string, ttlMs: number, load: () => Promise<T>) => {
			const entry = entries.get(key);
			if (entry && now() < entry.staleUntil) {
				// Reinserted: a Map iterates in insertion order, so its first key is the least recently used.
				entries.delete(key);
				entries.set(key, entry);
				if (now() >= entry.freshUntil) {
					refresh(key, ttlMs, load).catch((error) => {
						log("warn", `${label} background refresh failed`, { key, ...errorFields(error) });
					});
				}
				return entry.value as T;
			}
			return refresh(key, ttlMs, load);
		},
	};
}
