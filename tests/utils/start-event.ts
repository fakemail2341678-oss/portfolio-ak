import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Runs `work` as Start would during `request`: inside its request storage, so
 * `getRequest()`, `getRequestIP()` and the cookie helpers of `@tanstack/react-start/server`
 * see it. Start's packages share the storage through globalThis, under this key.
 */
export function inStartEvent<T>(request: Request, work: () => T): T {
	const global = globalThis as unknown as Record<symbol, AsyncLocalStorage<unknown> | undefined>;
	const key = Symbol.for("tanstack-start:event-storage");
	global[key] ??= new AsyncLocalStorage();
	return global[key].run({ request, requestUrl: new URL(request.url) }, work);
}
