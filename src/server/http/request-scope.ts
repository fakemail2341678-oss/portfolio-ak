import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The scope of one HTTP request, opened by the server entry and by every server route
 * (runInRequestScope, decision 0300):
 * - its id (decision 0123), returned as `x-request-id` and read by log lines
 *   (src/server/log.ts), the error envelope (AppError.requestId, shown on the error
 *   page) and Sentry events (src/instrument.server.ts). Always generated: an
 *   incoming x-request-id is client input and isn't trusted;
 * - who asked (setRequestUser, once the session is known) and in which language
 *   (setRequestLocale), so every log line of the request says so;
 * - when it started, and what took the time: `recordTiming` adds a line to the
 *   `Server-Timing` header, and a request slower than SLOW_REQUEST_MS leaves a
 *   "slow request" log line with the same parts;
 * - a memo for work every part of the request would otherwise repeat (requestMemo),
 *   such as resolving the session: the root route, the admin gate and each server
 *   function called during SSR share one lookup (decision 0153).
 */
export const REQUEST_ID_HEADER = "x-request-id";
export const SERVER_TIMING_HEADER = "server-timing";

/** The parts of a request named in `Server-Timing` (the rest is only counted in the total). */
const MAX_TIMINGS = 12;

type Timing = { name: string; ms: number; desc?: string };

type RequestScope = {
	id: string;
	memo: Map<string, Promise<unknown>>;
	startedAt: number;
	method: string | undefined;
	path: string | undefined;
	userId: string | undefined;
	locale: string | undefined;
	timings: Timing[];
};

const storage = new AsyncLocalStorage<RequestScope>();

/** The current request's id; undefined outside a request (scripts, tests). */
export const currentRequestId = (): string | undefined => storage.getStore()?.id;

/** What the log lines of this request carry: its id, and the user and locale once they are known. */
export const currentRequest = ():
	| {
			id: string;
			userId: string | undefined;
			locale: string | undefined;
			method: string | undefined;
			path: string | undefined;
	  }
	| undefined => {
	const scope = storage.getStore();
	return scope && { id: scope.id, userId: scope.userId, locale: scope.locale, method: scope.method, path: scope.path };
};

/** Says who the request is from, once the session is resolved (src/server/auth/session.ts). */
export const setRequestUser = (userId: string | undefined) => {
	const scope = storage.getStore();
	if (scope) scope.userId = userId;
};

/** Says which language the request is answered in (the server entry, a server route). */
export const setRequestLocale = (locale: string) => {
	const scope = storage.getStore();
	if (scope) scope.locale = locale;
};

/** Adds a part to the request's `Server-Timing` header and to its "slow request" line. */
export const recordTiming = (name: string, ms: number, desc?: string) => {
	const scope = storage.getStore();
	if (scope && scope.timings.length < MAX_TIMINGS) {
		scope.timings.push({ name, ms: Math.round(ms), ...(desc ? { desc } : {}) });
	}
};

/** `work()`, with the time it took recorded under `name` (also when it fails). */
export const timed = async <T>(name: string, work: () => Promise<T>, desc?: string): Promise<T> => {
	const started = performance.now();
	try {
		return await work();
	} finally {
		recordTiming(name, performance.now() - started, desc);
	}
};

/**
 * `compute()` once per request for `key`: later calls in the same request get the
 * same promise. Outside a request (scripts, tests) it just computes.
 * A failure is not kept, so a later call in the same request tries again.
 */
export const requestMemo = <T>(key: string, compute: () => Promise<T>): Promise<T> => {
	const scope = storage.getStore();
	if (!scope) return compute();
	const cached = scope.memo.get(key) as Promise<T> | undefined;
	if (cached) return cached;
	const promise = compute();
	scope.memo.set(key, promise);
	promise.catch(() => scope.memo.delete(key));
	return promise;
};

/** Drops a memoized value, for a request that changes it (e.g. leaving an impersonated session). */
export const forgetRequestMemo = (key: string) => {
	storage.getStore()?.memo.delete(key);
};

/** The response with `headers` set, copied first when its headers are immutable (e.g. Response.redirect). */
const withHeaders = (response: Response, values: Record<string, string>): Response => {
	try {
		for (const [name, value] of Object.entries(values)) response.headers.set(name, value);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		for (const [name, value] of Object.entries(values)) headers.set(name, value);
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	}
};

/** `Server-Timing`'s value: the total first, then each recorded part. Names are tokens, descriptions quoted. */
const serverTiming = (totalMs: number, timings: readonly Timing[]) =>
	[{ name: "total", ms: totalMs } as Timing, ...timings]
		.map(({ name, ms, desc }) => {
			const token = name.replace(/[^\w-]/g, "_");
			return desc ? `${token};dur=${ms};desc="${desc.replace(/[^\w .:/-]/g, "_")}"` : `${token};dur=${ms}`;
		})
		.join(", ");

export type RequestScopeOptions = {
	/** The request, for the method and the path of its "slow request" line (never its query string). */
	request?: Request;
	createId?: () => string;
};

/**
 * Runs `handle` as one request: inside it `currentRequestId()`, `requestMemo` and the
 * rest of this file work. Inside a scope that is already open (a server route of the
 * app, called under the server entry) it joins that one: one request, one id.
 * The response carries `x-request-id` and `Server-Timing`. The time is measured to the
 * response's head: a streamed body goes on after it.
 */
export const runInRequestScope = async (
	handle: (requestId: string) => Promise<Response>,
	{ request, createId = () => crypto.randomUUID() }: RequestScopeOptions = {},
): Promise<Response> => {
	const open = storage.getStore();
	if (open) return handle(open.id);

	const url = request ? new URL(request.url) : undefined;
	const scope: RequestScope = {
		id: createId(),
		memo: new Map(),
		startedAt: performance.now(),
		method: request?.method,
		path: url?.pathname,
		userId: undefined,
		locale: undefined,
		timings: [],
	};
	const response = await storage.run(scope, () => handle(scope.id));
	const ms = Math.round(performance.now() - scope.startedAt);
	// Loaded here, not at the top: the log reads this file's scope, and the environment must not
	// load with a file that component tests reach (jsdom has a window, which env.ts refuses).
	const [{ serverEnv }, { log }] = await Promise.all([import("../env"), import("../log")]);
	const slow = serverEnv.SLOW_REQUEST_MS;
	if (slow > 0 && ms >= slow) {
		storage.run(scope, () =>
			log("warn", "slow request", {
				method: scope.method,
				path: scope.path,
				status: response.status,
				ms,
				timings: scope.timings,
			}),
		);
	}
	return withHeaders(response, {
		[REQUEST_ID_HEADER]: scope.id,
		[SERVER_TIMING_HEADER]: serverTiming(ms, scope.timings),
	});
};
