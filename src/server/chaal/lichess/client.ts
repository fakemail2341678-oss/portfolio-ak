import "@tanstack/react-start/server-only";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { log } from "@/server/log";
import { type Counters, createCounters } from "./counters";
import { cooldownKey, createLanes, type LaneKey, type Lanes, laneKind } from "./lanes";

/**
 * Chaal's only way to Lichess (PLAN 13.5, decision 0255). Every call is logged with its
 * endpoint class, status and time (never a token) and counted for the lab and the health
 * page. JSON calls run in their lane, one at a time; they time out after 8 s, a GET is
 * retried once on a 5xx, and the answer is mapped by a Zod schema to a lean shape. A 429
 * starts a cooldown for the lane's key (60 s, doubling on repeats) that every instance
 * sees; until it ends, calls on that key fail fast with "lichess-wait" and reads serve
 * their stale cache (./cache.ts). A 401 on a call with a token is a `LichessAuthError`:
 * the connection service marks the connection revoked, and the UI offers "Reconnect".
 */

const TIMEOUT_MS = 8_000;
/** The first cooldown after a 429: Lichess asks for a minute. */
export const COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 60 * 60_000;
/** A 429 this soon after the last cooldown ended doubles the next one. */
const REPEAT_WINDOW_MS = 10 * 60_000;

export type LichessHost = "api" | "explorer" | "tablebase";
export type LichessConfig = { apiBase: string; explorerBase: string; tablebaseBase: string; userAgent: string };

export type Cooldown = { until: number; ms: number };
/** Where cooldowns live: in Postgres for the app (./cooldown.ts), in memory for tests. */
export type CooldownStore = {
	read: (key: string) => Promise<Cooldown | null>;
	start: (key: string, cooldown: Cooldown) => Promise<void>;
};

export type LichessRequest = {
	/** The endpoint class, for the log and the counters ("account", "puzzle-daily", "stream:event"). */
	endpoint: string;
	host?: LichessHost;
	path: string;
	params?: Readonly<Record<string, string | number | boolean | undefined>>;
	method?: "GET" | "POST" | "DELETE";
	/** An `application/x-www-form-urlencoded` body. */
	form?: Readonly<Record<string, string>>;
	/** A `text/plain` body. */
	text?: string;
	/** An `application/json` body (the puzzle batch's solutions, Task 80). */
	json?: unknown;
	/** The user's token (decrypted inside a service call only), or the app's for the explorer. */
	token?: string | null;
	lane: LaneKey;
};

export type Lichess = {
	config: LichessConfig;
	/** A JSON answer, mapped by `schema`. */
	json: <S extends z.ZodType>(request: LichessRequest, schema: S) => Promise<z.output<S>>;
	/** A call whose answer has no body Chaal needs (a 204, a move's `{ ok: true }`). */
	send: (request: LichessRequest) => Promise<void>;
	/** A long-lived ndjson or PGN stream, outside the lanes. `signal` ends it. */
	stream: (request: LichessRequest & { signal?: AbortSignal }) => Promise<ReadableStream<Uint8Array>>;
	counters: Counters;
	lanes: Lanes;
};

/** The user's token was refused (revoked, expired, or the account closed): reconnect. */
export class LichessAuthError extends AppError {
	constructor(endpoint: string) {
		super("FORBIDDEN", `Lichess refused the token (${endpoint})`, { reason: "lichess-reconnect" });
	}
}

/** The next cooldown after a 429: a minute, or double the last one when it ended less than ten minutes ago. */
export function nextCooldown(previous: Cooldown | null, now: number): Cooldown {
	const repeat = previous !== null && now - previous.until < REPEAT_WINDOW_MS;
	const ms = repeat ? Math.min(previous.ms * 2, MAX_COOLDOWN_MS) : COOLDOWN_MS;
	return { until: now + ms, ms };
}

export const waitError = (endpoint: string) =>
	new AppError("RATE_LIMITED", `Lichess cooldown (${endpoint})`, { reason: "lichess-wait" });

const unavailable = (endpoint: string, detail: string, cause?: unknown) =>
	new AppError("UPSTREAM_UNAVAILABLE", `Lichess ${endpoint}: ${detail}`, cause === undefined ? {} : { cause });

/** Memory-only cooldowns: tests, and the fallback when there's no database. */
export function memoryCooldowns(): CooldownStore {
	const cooldowns = new Map<string, Cooldown>();
	return {
		read: async (key) => cooldowns.get(key) ?? null,
		start: async (key, cooldown) => {
			cooldowns.set(key, cooldown);
		},
	};
}

export type LichessDeps = {
	cooldowns?: CooldownStore;
	counters?: Counters;
	lanes?: Lanes;
	now?: () => number;
	/** How long a call (or a stream's headers) may take: 8 s, shorter in tests. */
	timeoutMs?: number;
};

export function createLichess(config: LichessConfig, fetcher: typeof fetch = fetch, deps: LichessDeps = {}): Lichess {
	const cooldowns = deps.cooldowns ?? memoryCooldowns();
	const counters = deps.counters ?? createCounters();
	const lanes = deps.lanes ?? createLanes();
	const now = deps.now ?? Date.now;
	const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
	const bases: Record<LichessHost, string> = {
		api: config.apiBase,
		explorer: config.explorerBase,
		tablebase: config.tablebaseBase,
	};

	const urlOf = (request: LichessRequest) => {
		const url = new URL(`${bases[request.host ?? "api"].replace(/\/$/, "")}/${request.path.replace(/^\//, "")}`);
		for (const [key, value] of Object.entries(request.params ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}
		return url;
	};

	const initOf = (request: LichessRequest, accept: string, signal: AbortSignal): RequestInit => {
		const headers: Record<string, string> = { "user-agent": config.userAgent, accept };
		if (request.token) headers.authorization = `Bearer ${request.token}`;
		let body: string | undefined;
		if (request.form) {
			headers["content-type"] = "application/x-www-form-urlencoded";
			body = new URLSearchParams(request.form).toString();
		} else if (request.text !== undefined) {
			headers["content-type"] = "text/plain";
			body = request.text;
		} else if (request.json !== undefined) {
			headers["content-type"] = "application/json";
			body = JSON.stringify(request.json);
		}
		return { method: request.method ?? "GET", headers, body, signal, redirect: "manual" };
	};

	const note = (request: LichessRequest, status: number, started: number) => {
		const ms = now() - started;
		const lane = laneKind(request.lane);
		counters.record(request.endpoint, { status, ms, lane, at: started });
		log(status === 0 || status >= 500 || status === 429 ? "warn" : "info", "lichess call", {
			endpoint: request.endpoint,
			status,
			ms,
			lane,
		});
	};

	/** One attempt (and the retry of a GET after a 5xx), returning a response with a 2xx status. */
	const call = async (
		request: LichessRequest,
		accept: string,
		signal: () => AbortSignal,
		retried = false,
	): Promise<Response> => {
		const key = cooldownKey(request.lane);
		const cooldown = await cooldowns.read(key);
		if (cooldown && cooldown.until > now()) throw waitError(request.endpoint);
		const started = now();
		let response: Response;
		try {
			response = await fetcher(urlOf(request), initOf(request, accept, signal()));
		} catch (error) {
			note(request, 0, started);
			throw unavailable(request.endpoint, "request failed", error);
		}
		note(request, response.status, started);
		if (response.ok) return response;
		// Nothing more is read from a refused answer: free its connection.
		await response.body?.cancel().catch(() => {});
		if (response.status === 401) {
			if (request.token) throw new LichessAuthError(request.endpoint);
			throw new AppError("FORBIDDEN", `Lichess ${request.endpoint} needs a token`);
		}
		if (response.status === 429) {
			await cooldowns.start(key, nextCooldown(cooldown, now()));
			throw waitError(request.endpoint);
		}
		if (response.status === 404) throw new AppError("NOT_FOUND", `Lichess ${request.endpoint}: not found`);
		if (response.status >= 500) {
			if ((request.method ?? "GET") === "GET" && !retried) return call(request, accept, signal, true);
			throw unavailable(request.endpoint, `status ${response.status}`);
		}
		throw new AppError("BAD_REQUEST", `Lichess ${request.endpoint}: status ${response.status}`);
	};

	return {
		config,
		counters,
		lanes,
		json: (request, schema) =>
			lanes.run(request.lane, async () => {
				const timeout = AbortSignal.timeout(timeoutMs);
				const response = await call(request, "application/json", () => timeout);
				let body: unknown;
				try {
					body = await response.json();
				} catch (error) {
					throw unavailable(request.endpoint, "unreadable answer", error);
				}
				const parsed = schema.safeParse(body);
				if (!parsed.success) {
					log("warn", "lichess answer changed shape", {
						endpoint: request.endpoint,
						issues: parsed.error.issues.length,
					});
					throw unavailable(request.endpoint, "unexpected answer");
				}
				return parsed.data;
			}),
		send: (request) =>
			lanes.run(request.lane, async () => {
				const response = await call(request, "application/json", () => AbortSignal.timeout(timeoutMs));
				await response.body?.cancel().catch(() => {});
			}),
		stream: async (request) => {
			// The timeout covers the answer's headers only: the body stays open for minutes.
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
			const signal = request.signal ? AbortSignal.any([controller.signal, request.signal]) : controller.signal;
			try {
				const response = await call(request, "application/x-ndjson", () => signal);
				if (!response.body) throw unavailable(request.endpoint, "no body");
				return response.body;
			} finally {
				clearTimeout(timer);
			}
		},
	};
}
