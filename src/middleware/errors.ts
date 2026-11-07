import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { AppError, zodFieldErrors } from "@/lib/errors";
import { logServerFn, requestLoggingMiddleware } from "./logging";

/**
 * Maps anything a server function throws onto the AppError shape.
 * - Router control flow (redirect / notFound) passes through untouched.
 * - AppError keeps its code; the request id is attached.
 * - ZodError (a schema parsed inside a handler) becomes BAD_REQUEST.
 * - Anything else becomes INTERNAL with no details; the original is logged.
 */
export const normalizeServerError = (error: unknown, requestId: string): unknown => {
	if (isRedirect(error) || isNotFound(error)) return error;

	if (error instanceof AppError) {
		return error.requestId ? error : error.withRequestId(requestId);
	}

	if (error instanceof z.ZodError) {
		return new AppError("BAD_REQUEST", "Invalid input", { fieldErrors: zodFieldErrors(error), requestId });
	}

	// The only place unexpected server-function errors reach Sentry: here the original
	// error (and stack) still exists. The request id matches what the user is shown.
	// Imported here, not at the top: start.ts brings this module into the browser too, where
	// a static import kept the whole SDK in every page's entry chunk (decision 0152).
	void import("@sentry/tanstackstart-react").then((Sentry) => Sentry.captureException(error, { tags: { requestId } }));
	logServerFn("error", {
		requestId,
		error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
	});
	return new AppError("INTERNAL", "Internal error", { requestId });
};

export const errorNormalizationMiddleware = createMiddleware({ type: "function" })
	.middleware([requestLoggingMiddleware])
	.server(async ({ next, context }) => {
		try {
			return await next();
		} catch (error) {
			throw normalizeServerError(error, context.requestId);
		}
	});
