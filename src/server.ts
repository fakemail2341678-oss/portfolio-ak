/**
 * Custom server entry (TanStack Start). Paraglide's middleware resolves the
 * request locale and scopes it with AsyncLocalStorage, so getLocale() is correct
 * during SSR. The original request is passed on because the router does its own
 * URL de-localization (see router.tsx); passing the rewritten one causes loops.
 */
// Sentry first, so it sees everything after it. (Zod is configured by src/lib/zod.ts.)
import "./instrument.server";
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { LOCALE_HEADER } from "./lib/i18n/locale-header";
import { defineCustomServerStrategy, toLocale } from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { runWithErrorStatus } from "./server/http/error-status";
import { runInRequestScope } from "./server/http/request-scope";

// Used for /_serverFn/* and /api/auth/* (routeStrategies in project.inlang/paraglide.config.ts).
// toLocale() rejects anything that isn't a configured locale.
defineCustomServerStrategy("custom-header", {
	getLocale: (request) => toLocale(request?.headers.get(LOCALE_HEADER) ?? undefined),
});

export default createServerEntry(
	// Request tracing + capture (a pass-through when Sentry isn't initialised).
	wrapFetchWithSentry({
		fetch(request: Request) {
			// One id per request, returned as x-request-id and attached to logs, errors and Sentry events.
			// Pages that fail with an AppError (e.g. FORBIDDEN) get its status instead of 500.
			return runInRequestScope(() =>
				runWithErrorStatus(() => paraglideMiddleware(request, () => handler.fetch(request))),
			);
		},
	}),
);
