import { createIsomorphicFn } from "@tanstack/react-start";
import { isAppError } from "../errors";

/**
 * During SSR, makes the HTTP response carry the AppError's status (403, 401, …)
 * instead of the generic 500 TanStack Router uses for any thrown error. No-op in
 * the browser. Call it in beforeLoad/loader right before rethrowing an AppError.
 * The server entry applies the recorded status (src/server/http/error-status.ts).
 */
export const setErrorStatus = createIsomorphicFn()
	.server(async (error: unknown) => {
		if (!isAppError(error)) return;
		const { recordErrorStatus } = await import("@/server/http/error-status");
		recordErrorStatus(error.status);
	})
	.client(async (_error: unknown) => {});
