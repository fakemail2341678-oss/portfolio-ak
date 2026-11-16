import "@tanstack/react-start/server-only";
import { log } from "../log";
import { recordTiming } from "./request-scope";

/**
 * The one way the server calls another service (decision 0300): TMDB, Lichess,
 * Cloudinary, Turnstile and PostHog get their `fetch` from `createOutbound`, and an SDK
 * that makes its own request (Resend) is wrapped in `outboundCall`.
 *
 * What a call gets:
 * - **the service's own hosts only.** A URL outside `bases` is refused before anything is
 *   sent, and a redirect is an error: whatever a user's input adds to a path or a query,
 *   the request can't be pointed at another machine (no SSRF);
 * - **a timeout** for the whole answer (for a stream: for its head), joined with the
 *   caller's own abort signal;
 * - **retries with backoff** for a GET or a HEAD answered 429 or 5xx, waiting what
 *   `Retry-After` asks (capped). A write is sent once; a timeout is not tried again,
 *   because a page is waiting;
 * - **a size cap** on the answer's body;
 * - **one log line**, with the service, the path and the status, and never a header, a
 *   query string or a body. The time goes to the request's `Server-Timing` too.
 *
 * What it throws is an UpstreamError, which the error mapper turns into
 * UPSTREAM_UNAVAILABLE (src/server/http/errors.ts). An answer with an error status is
 * returned: what a 404 means is the client's to say.
 */
export type UpstreamFailure = "blocked" | "network" | "timeout" | "too-large";

export class UpstreamError extends Error {
	override name = "UpstreamError";
	readonly service: string;
	readonly kind: UpstreamFailure;

	constructor(service: string, kind: UpstreamFailure, detail: string, cause?: unknown) {
		super(`${service}: ${detail}`, cause === undefined ? undefined : { cause });
		this.service = service;
		this.kind = kind;
	}
}

export type OutboundOptions = {
	/** The service's name in the log and in `Server-Timing`: "tmdb". */
	service: string;
	/** Where the service lives: its base URLs. Only their origins can be called. */
	bases: readonly string[];
	/** How long a call may take, body included. 8 s. */
	timeoutMs?: number;
	/** How many times a GET or a HEAD answered 429 or 5xx is sent again. 1. */
	retries?: number;
	/** The longest wait a `Retry-After` gets. 10 s. */
	retryAfterCapMs?: number;
	/** The largest body read. 5 MB. */
	maxBytes?: number;
	/** Which calls leave a log line: all of them, or only the ones that failed. */
	logs?: "all" | "failures" | "none";
	fetcher?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
};

/** What one call may say about itself, in `init.outbound`. */
export type OutboundCall = {
	/** A stream that stays open: the timeout covers the answer's head only, and its body has no cap. */
	stream?: boolean;
	/** The call's name in the log, instead of its path. */
	label?: string;
	/** This call's own timeout. */
	timeoutMs?: number;
};

export type OutboundInit = RequestInit & { outbound?: OutboundCall };

/** A `fetch` that only reaches its service. Fits wherever a `typeof fetch` is taken. */
export type Outbound = (input: RequestInfo | URL, init?: OutboundInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const BACKOFF_MS = 200;

// timer: the wait between two attempts of one call (what Retry-After asks, or the backoff).
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How long to wait before the next attempt: what the answer asks for, or twice the last wait. */
const retryDelay = (response: Response, attempt: number, capMs: number): number => {
	const header = response.headers.get("retry-after");
	if (header !== null && header.trim() !== "") {
		const seconds = Number(header);
		const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
		if (Number.isFinite(ms)) return Math.min(Math.max(ms, 0), capMs);
	}
	return Math.min(BACKOFF_MS * 2 ** (attempt - 1), capMs);
};

const isTimeoutError = (error: unknown) => error instanceof Error && error.name === "TimeoutError";

export function createOutbound(options: OutboundOptions): Outbound {
	const {
		service,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		retries = 1,
		retryAfterCapMs = 10_000,
		maxBytes = DEFAULT_MAX_BYTES,
		logs = "all",
	} = options;
	const fetcher = options.fetcher ?? fetch;
	const sleep = options.sleep ?? defaultSleep;
	const origins = new Set(options.bases.map((base) => new URL(base).origin));

	const note = (call: string, method: string, status: number, started: number, attempts: number, failure?: string) => {
		const ms = Math.round(performance.now() - started);
		recordTiming(service, ms);
		const failed = failure !== undefined || status >= 500 || status === 429;
		if (logs === "none" || (logs === "failures" && !failed)) return;
		log(failed ? "warn" : "info", "outbound", {
			service,
			method,
			call,
			status,
			ms,
			...(attempts > 1 ? { attempts } : {}),
			...(failure ? { failure } : {}),
		});
	};

	return async (input, init = {}) => {
		const { outbound: call = {}, ...request } = init;
		const url = new URL(input instanceof Request ? input.url : String(input));
		const method = (request.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
		const label = call.label ?? url.pathname;
		const started = performance.now();
		if (!origins.has(url.origin)) {
			note(label, method, 0, started, 1, "blocked");
			throw new UpstreamError(service, "blocked", `${url.origin} is not one of its hosts`);
		}
		const limit = call.timeoutMs ?? timeoutMs;
		const attempts = method === "GET" || method === "HEAD" ? retries + 1 : 1;

		for (let attempt = 1; ; attempt += 1) {
			const deadline = new AbortController();
			// timer: this attempt's timeout, cleared when its answer (a stream: its head) has arrived.
			const timer =
				limit > 0 ? setTimeout(() => deadline.abort(new DOMException("timed out", "TimeoutError")), limit) : undefined;
			const settle = () => clearTimeout(timer);
			const signal = request.signal ? AbortSignal.any([request.signal, deadline.signal]) : deadline.signal;

			let response: Response;
			try {
				response = await fetcher(input instanceof Request ? input : url, { redirect: "error", ...request, signal });
			} catch (error) {
				settle();
				// The caller gave up (a page was closed): theirs to handle, not a failure of the service.
				if (request.signal?.aborted) throw error;
				const kind: UpstreamFailure = deadline.signal.aborted || isTimeoutError(error) ? "timeout" : "network";
				note(label, method, 0, started, attempt, kind);
				throw new UpstreamError(
					service,
					kind,
					kind === "timeout" ? `no answer in ${limit} ms` : "the request failed",
					error,
				);
			}

			if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
				settle();
				await response.body?.cancel().catch(() => {});
				await sleep(retryDelay(response, attempt, retryAfterCapMs));
				continue;
			}

			if (call.stream || response.body === null) {
				settle();
				note(label, method, response.status, started, attempt);
				return response;
			}

			const declared = Number(response.headers.get("content-length"));
			if (Number.isFinite(declared) && declared > maxBytes) {
				settle();
				await response.body.cancel().catch(() => {});
				note(label, method, response.status, started, attempt, "too-large");
				throw new UpstreamError(service, "too-large", `an answer of ${declared} bytes (the cap is ${maxBytes})`);
			}
			note(label, method, response.status, started, attempt);
			return new Response(cappedBody(response.body, { service, maxBytes, limit, deadline: deadline.signal, settle }), {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		}
	};
}

/** The answer's body, cut off past `maxBytes` and failing as a timeout when the deadline passes while it is read. */
function cappedBody(
	body: ReadableStream<Uint8Array>,
	{
		service,
		maxBytes,
		limit,
		deadline,
		settle,
	}: { service: string; maxBytes: number; limit: number; deadline: AbortSignal; settle: () => void },
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	let seen = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					settle();
					controller.close();
					return;
				}
				seen += value.byteLength;
				if (seen > maxBytes) {
					settle();
					await reader.cancel().catch(() => {});
					controller.error(new UpstreamError(service, "too-large", `an answer over ${maxBytes} bytes`));
					return;
				}
				controller.enqueue(value);
			} catch (error) {
				settle();
				controller.error(
					deadline.aborted ? new UpstreamError(service, "timeout", `no whole answer in ${limit} ms`, error) : error,
				);
			}
		},
		cancel(reason) {
			settle();
			return reader.cancel(reason);
		},
	});
}

/**
 * A call out through an SDK that makes its own request: the deadline, the timing and the
 * log line of `createOutbound`. The SDK owns the host, and its request can't be aborted:
 * past the deadline the caller stops waiting and gets an UpstreamError.
 */
export async function outboundCall<T>(
	service: string,
	label: string,
	run: () => Promise<T>,
	timeoutMs = 10_000,
): Promise<T> {
	const started = performance.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const note = (failure?: string) => {
		const ms = Math.round(performance.now() - started);
		recordTiming(service, ms);
		log(failure ? "warn" : "info", "outbound", { service, call: label, ms, ...(failure ? { failure } : {}) });
	};
	try {
		const result = await Promise.race([
			run(),
			new Promise<never>((_, reject) => {
				// timer: the call's deadline, cleared when the SDK answers first.
				timer = setTimeout(
					() => reject(new UpstreamError(service, "timeout", `no answer in ${timeoutMs} ms`)),
					timeoutMs,
				);
			}),
		]);
		note();
		return result;
	} catch (error) {
		note(error instanceof UpstreamError ? error.kind : "failed");
		throw error;
	} finally {
		clearTimeout(timer);
	}
}
