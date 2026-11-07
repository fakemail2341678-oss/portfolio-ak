import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The scope of one HTTP request, opened by the server entry (runInRequestScope):
 * - its id (decision 0123), returned as `x-request-id` and read by log lines
 *   (src/server/log.ts), server-function errors (AppError.requestId, shown on the
 *   error page) and Sentry events (src/instrument.server.ts). Always generated: an
 *   incoming x-request-id is client input and isn't trusted;
 * - a memo for work every part of the request would otherwise repeat (requestMemo),
 *   such as resolving the session: the root route, the admin gate and each server
 *   function called during SSR share one lookup (decision 0153).
 */
export const REQUEST_ID_HEADER = "x-request-id";

type RequestScope = { id: string; memo: Map<string, Promise<unknown>> };

const storage = new AsyncLocalStorage<RequestScope>();

/** The current request's id; undefined outside a request (scripts, Nitro routes, tests). */
export const currentRequestId = (): string | undefined => storage.getStore()?.id;

/**
 * `compute()` once per request for `key`: later calls in the same request get the
 * same promise. Outside a request (scripts, Nitro routes, tests) it just computes.
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

/** The response with `name: value` set, copied first when its headers are immutable (e.g. Response.redirect). */
const withHeader = (response: Response, name: string, value: string): Response => {
	try {
		response.headers.set(name, value);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		headers.set(name, value);
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	}
};

export const runInRequestScope = async (
	handle: (requestId: string) => Promise<Response>,
	createId: () => string = () => crypto.randomUUID(),
): Promise<Response> => {
	const id = createId();
	const response = await storage.run({ id, memo: new Map() }, () => handle(id));
	return withHeader(response, REQUEST_ID_HEADER, id);
};
