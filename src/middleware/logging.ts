import { createMiddleware } from "@tanstack/react-start";

/**
 * Passes the request's id (src/server/http/request-scope.ts, the x-request-id
 * header) to downstream middleware as context.requestId, and logs the function
 * name, method, duration and outcome of every call: one "server-fn" line. The time
 * also goes to the request's `Server-Timing` header.
 */
export const requestLoggingMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next, serverFnMeta, method }) => {
		// Server-only modules, loaded inside the server callback (this file is in the client bundle too).
		const [{ currentRequestId, recordTiming }, { log }] = await Promise.all([
			import("@/server/http/request-scope"),
			import("@/server/log"),
		]);
		const requestId = currentRequestId() ?? crypto.randomUUID();
		const started = performance.now();
		const base = { fn: serverFnMeta.name, method };
		// Outside a request's scope (a test) the line still says which call it was.
		const id = currentRequestId() ? {} : { requestId };
		const done = () => {
			const ms = Math.round(performance.now() - started);
			recordTiming("fn", ms, serverFnMeta.name);
			return ms;
		};
		try {
			const result = await next({ context: { requestId } });
			log("info", "server-fn", { ...base, ...id, ms: done(), outcome: "ok" });
			return result;
		} catch (error) {
			const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
			const status = error instanceof Error && "status" in error ? Number(error.status) : undefined;
			log(status !== undefined && status < 500 ? "warn" : "error", "server-fn", {
				...base,
				...id,
				ms: done(),
				outcome: code ?? (error instanceof Error ? error.name : "thrown"),
			});
			throw error;
		}
	},
);
