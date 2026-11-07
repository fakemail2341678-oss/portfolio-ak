import "@tanstack/react-start/server-only";
import { AppError } from "@/lib/errors";
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

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const unavailable = (path: string, detail: string, cause?: unknown) => {
	log("warn", "tmdb unavailable", { path, detail });
	return new AppError("UPSTREAM_UNAVAILABLE", `TMDB: ${detail}`, cause === undefined ? {} : { cause });
};

export function createTmdb(config: TmdbConfig, fetcher: typeof fetch = fetch, sleep = defaultSleep): Tmdb {
	const get = async (path: string, params: TmdbParams = {}): Promise<unknown> => {
		const url = new URL(`${config.apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
		for (const [key, value] of Object.entries({ ...params, include_adult: "false" })) {
			url.searchParams.set(key, String(value));
		}
		let retried5xx = false;
		let waited429 = false;
		while (true) {
			let response: Response;
			try {
				response = await fetcher(url, {
					headers: { authorization: `Bearer ${config.token}`, accept: "application/json" },
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch (error) {
				throw unavailable(path, "request failed", error);
			}
			if (response.ok) return response.json();
			if (response.status === 404) throw new AppError("NOT_FOUND", `TMDB: no ${path}`);
			if (response.status === 429 && !waited429) {
				waited429 = true;
				const seconds = Number(response.headers.get("retry-after"));
				await sleep(Math.min((Number.isFinite(seconds) ? seconds : 1) * 1000, MAX_RETRY_AFTER_MS));
				continue;
			}
			if (response.status >= 500 && !retried5xx) {
				retried5xx = true;
				continue;
			}
			throw unavailable(path, `status ${response.status}`);
		}
	};
	return { config, get };
}
