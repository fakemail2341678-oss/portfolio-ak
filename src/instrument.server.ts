/**
 * Server Sentry setup, imported first by src/server.ts. This is Sentry's
 * "without --import" option, the one that works on serverless hosts (Vercel);
 * it instruments Node's native fetch/http. No DSN, no Sentry.
 */
import * as Sentry from "@sentry/tanstackstart-react";
import { dropExpectedErrors, sentryDsn, sentryOptions, tagRequestId } from "./lib/observability/sentry";
import { currentRequestId } from "./server/http/request-scope";

if (sentryDsn) {
	Sentry.init({
		...sentryOptions(sentryDsn),
		// Every server event carries the request id: the same one as the x-request-id header and the log lines.
		beforeSend: (event, hint) => {
			const kept = dropExpectedErrors(event, hint);
			return kept && tagRequestId(kept, currentRequestId());
		},
	});
}
