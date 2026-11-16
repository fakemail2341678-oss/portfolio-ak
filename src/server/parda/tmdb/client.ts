import "@tanstack/react-start/server-only";
import { AppError } from "@/lib/errors";
import { createOutbound } from "@/server/http/outbound";
import { log } from "@/server/log";

/** TMDB's API (decision 0229). Reads only; `include_adult=false` on every call. */

const TIMEOUT_MS = 8_000;
/** The longest Retry-After we wait for: a request is holding a page open. */
const MAX_RETRY_AFTER_MS = 10_000;

export type TmdbConfig = { token: string; apiBase: string; imageBase: string };
export type TmdbParams = Readonly<Record<string, string | number>>;
export type Tmdb = {
	config: TmdbConfig;
	get: (path: string, params?: TmdbParams) => Promise<unknown>;
};

const unavailable = (path: string, detail: string, cause?: unknown) => {
	log("warn", "tmdb unavailable", { path, detail });
	return new AppError("UPSTREAM_UNAVAILABLE", `TMDB: ${detail}`, cause === undefined ? {} : { cause });
};

/**
 * The calls go out through `createOutbound` (src/server/http/outbound.ts, decision 0300):
 * TMDB's host only, 8 s, and one more try after a 429 (waiting its Retry-After) or a 5xx.
 * A timeout or a failed connection is not tried again: a page is waiting.
 */
export function createTmdb(
	config: TmdbConfig,
	fetcher: typeof fetch = fetch,
	sleep?: (ms: number) => Promise<void>,
): Tmdb {
	const call = createOutbound({
		service: "tmdb",
		bases: [config.apiBase],
		timeoutMs: TIMEOUT_MS,
		retries: 1,
		retryAfterCapMs: MAX_RETRY_AFTER_MS,
		fetcher,
		...(sleep ? { sleep } : {}),
	});
	const get = async (path: string, params: TmdbParams = {}): Promise<unknown> => {
		const url = new URL(`${config.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
		for (const [key, value] of Object.entries({ ...params, include_adult: "false" })) {
			url.searchParams.set(key, String(value));
		}
		let response: Response;
		try {
			response = await call(url, {
				headers: { authorization: `Bearer ${config.token}`, accept: "application/json" },
			});
		} catch (error) {
			throw unavailable(path, "request failed", error);
		}
		if (response.status === 404) throw new AppError("NOT_FOUND", `TMDB: no ${path}`);
		if (!response.ok) throw unavailable(path, `status ${response.status}`);
		try {
			return await response.json();
		} catch (error) {
			throw unavailable(path, "unreadable answer", error);
		}
	};
	return { config, get };
}
