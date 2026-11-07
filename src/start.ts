import { createStart } from "@tanstack/react-start";
import { appErrorSerializationAdapter } from "@/lib/errors";
import { csrfMiddleware } from "@/middleware/csrf";
import { errorNormalizationMiddleware } from "@/middleware/errors";
import { localeFunctionMiddleware } from "@/middleware/locale";
import { securityHeadersMiddleware } from "@/middleware/security-headers";
import { sentryRequestMiddleware } from "@/middleware/sentry";
import { sessionExpiryMiddleware } from "@/middleware/session-expiry";

export const startInstance = createStart(() => ({
	// Runs for every request; the CSRF check itself only applies to server functions.
	// Sentry first so it sees every request (no-op without a DSN). Server-function
	// errors are captured in normalizeServerError instead, with their original stack.
	// The security headers middleware also provides context.nonce (CSP) for the router.
	requestMiddleware: [sentryRequestMiddleware, securityHeadersMiddleware, csrfMiddleware],
	// Order matters: locale first, then request logging + error normalisation
	// (errorNormalizationMiddleware pulls in requestLoggingMiddleware).
	// sessionExpiryMiddleware is client-only: UNAUTHORIZED in the browser -> /login.
	functionMiddleware: [localeFunctionMiddleware, sessionExpiryMiddleware, errorNormalizationMiddleware],
	serializationAdapters: [appErrorSerializationAdapter],
}));
