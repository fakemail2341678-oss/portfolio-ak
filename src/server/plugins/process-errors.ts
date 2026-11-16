/**
 * What nothing else caught reaches the log (decision 0300). Nitro hands its `error` hook
 * every error that escaped a request, and the process's own `unhandledRejection` and
 * `uncaughtException` (tagged so): a promise nobody awaited that failed after its request
 * was answered would otherwise leave one unreadable line, or none.
 *
 * Errors of a server function or a server route never get here: they are mapped and
 * logged where they happen (src/server/http/errors.ts). An HTTP error below 500 that
 * Nitro raises itself (a path with no route) is an answer, not a failure.
 */
import { definePlugin } from "nitro";
import { errorFields, log } from "../log";

const statusOf = (error: unknown): number | undefined => {
	if (typeof error !== "object" || error === null) return undefined;
	const status = "status" in error ? error.status : "statusCode" in error ? error.statusCode : undefined;
	return typeof status === "number" ? status : undefined;
};

export default definePlugin((nitroApp) => {
	nitroApp.hooks.hook("error", (error, context) => {
		const status = statusOf(error);
		if (status !== undefined && status < 500) return;
		const tags = context?.tags ?? [];
		log("error", "unhandled error", {
			tags,
			...(context?.event ? { path: new URL(context.event.req.url).pathname } : {}),
			...errorFields(error, { stack: true }),
		});
		void import("@sentry/tanstackstart-react").then((Sentry) =>
			Sentry.captureException(error, { tags: { source: tags.join(",") || "nitro" } }),
		);
	});
});
