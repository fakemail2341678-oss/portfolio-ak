import { isAppError } from "@/lib/errors";

/**
 * The browser's errors, sent to the server log when Sentry is off (decision 0300):
 * an uncaught error, an unhandled rejection, or what an error boundary caught. Without
 * this a page that breaks in a visitor's browser leaves no trace anywhere.
 *
 * Loaded on the first error (src/lib/observability/sentry-client.ts), so a page that
 * works pays nothing for it. `POST /api/client-errors` (src/routes/api/client-errors.ts)
 * limits, cuts and redacts what it is sent; here a page sends each error once and five
 * at most, so a render loop can't flood it.
 */

/** Where the reports go; the route file names the same path. */
export const CLIENT_ERRORS_PATH = "/api/client-errors";

/** What sent the error: the window's two events, or an error boundary. */
export type ClientErrorSource = "error" | "unhandledrejection" | "boundary";

const MAX_REPORTS = 5;
const seen = new Set<string>();

/** Sends one error to the server log: once per message, and not an expected refusal (the server logged that itself). */
export const reportClientError = (error: unknown, source: ClientErrorSource) => {
	if (isAppError(error) && error.status < 500) return;
	const known = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-error thrown");
	const key = `${known.name}:${known.message}`;
	if (seen.has(key) || seen.size >= MAX_REPORTS) return;
	seen.add(key);
	const requestId = isAppError(error) ? error.requestId : undefined;
	void fetch(CLIENT_ERRORS_PATH, {
		method: "POST",
		headers: { "content-type": "application/json" },
		// Sent even while the page is closing.
		keepalive: true,
		body: JSON.stringify({
			source,
			name: known.name.slice(0, 80),
			message: known.message.slice(0, 500),
			...(known.stack ? { stack: known.stack.slice(0, 4000) } : {}),
			url: window.location.href.slice(0, 2000),
			...(requestId ? { requestId } : {}),
		}),
	}).catch(() => {
		// Offline, or the server is what broke: there is nobody to tell.
	});
};
