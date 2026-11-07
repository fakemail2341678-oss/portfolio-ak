import "@tanstack/react-start/server-only";
import { type LogLevel, writeLogLine } from "@/lib/observability/log-line";
import { currentRequestId } from "./http/request-scope";

/** A server log line: JSON, with the current request's id when there is one. */
export const log = (level: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
	const requestId = currentRequestId();
	writeLogLine(level, msg, requestId ? { requestId, ...fields } : fields);
};

/** An error's name and message for a log line (never the stack of an expected failure). */
export const errorFields = (error: unknown) =>
	error instanceof Error
		? {
				error: error.message,
				// Drizzle wraps driver errors ("Failed query: ..."); the useful reason is on `cause`.
				...(error.cause instanceof Error ? { cause: error.cause.message } : {}),
			}
		: { error: String(error) };
