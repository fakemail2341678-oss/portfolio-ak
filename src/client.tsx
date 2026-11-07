import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { isAppError } from "./lib/errors";
import { loadSentry } from "./lib/observability/sentry-client";

// Browser Sentry downloads in parallel with hydration instead of being part of the
// entry chunk; errors before it's ready are buffered (src/lib/observability/sentry-client.ts).
// (Zod is configured by src/lib/zod.ts.)
void loadSentry();

/**
 * React logs every error an error boundary catches. Expected app errors
 * (FORBIDDEN, UNAUTHORIZED, NOT_FOUND… anything below 500) are the page's
 * intended outcome, shown as the localized error page, so they aren't logged;
 * everything else is, as React would (and ErrorPage reports it to Sentry).
 */
const onCaughtError = (error: unknown, info: { componentStack?: string | undefined }) => {
	if (isAppError(error) && error.status < 500) return;
	console.error(error, info.componentStack ?? "");
};

/** Custom client entry (TanStack Start's default plus the Sentry loader and error filter above). */
startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
		{ onCaughtError },
	);
});
