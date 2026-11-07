import { createMiddleware } from "@tanstack/react-start";
import { type LogLevel, writeLogLine } from "@/lib/observability/log-line";

/** One JSON line per server function call, with its request id. */
export const logServerFn = (level: LogLevel, fields: Record<string, unknown>) =>
	writeLogLine(level, "server-fn", fields);

/**
 * Passes the request's id (src/server/http/request-scope.ts, the x-request-id
 * header) to downstream middleware as context.requestId, and logs the function
 * name, method, duration and outcome of every call.
 */
export const requestLoggingMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next, serverFnMeta, method }) => {
		// Server-only module, loaded inside the server callback (this file is in the client bundle too).
		const { currentRequestId } = await import("@/server/http/request-scope");
		const requestId = currentRequestId() ?? crypto.randomUUID();
		const started = performance.now();
		const base = { fn: serverFnMeta.name, method, requestId };
		try {
			const result = await next({ context: { requestId } });
			logServerFn("info", { ...base, ms: Math.round(performance.now() - started), outcome: "ok" });
			return result;
		} catch (error) {
			const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
			const status = error instanceof Error && "status" in error ? Number(error.status) : undefined;
			logServerFn(status !== undefined && status < 500 ? "warn" : "error", {
				...base,
				ms: Math.round(performance.now() - started),
				outcome: code ?? (error instanceof Error ? error.name : "thrown"),
			});
			throw error;
		}
	},
);
