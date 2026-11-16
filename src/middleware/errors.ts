import { createMiddleware } from "@tanstack/react-start";
import { requestLoggingMiddleware } from "./logging";

/**
 * Whatever a server function throws leaves as the error envelope: an AppError with its
 * code and the request's id (the mapping is src/server/http/errors.ts, shared with the
 * server routes). A function that takes longer than REQUEST_TIMEOUT_MS answers TIMEOUT.
 *
 * The server modules are imported inside `.server()`, which the client build strips:
 * src/start.ts brings this file into the browser too.
 */
export const errorNormalizationMiddleware = createMiddleware({ type: "function" })
	.middleware([requestLoggingMiddleware])
	.server(async ({ next, context, serverFnMeta }) => {
		const [{ normalizeServerError, withDeadline }, { serverEnv }] = await Promise.all([
			import("@/server/http/errors"),
			import("@/server/env"),
		]);
		try {
			return await withDeadline(next(), serverEnv.REQUEST_TIMEOUT_MS, serverFnMeta?.name ?? "The function");
		} catch (error) {
			throw normalizeServerError(error, context.requestId);
		}
	});
