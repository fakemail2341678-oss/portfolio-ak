import { createMiddleware } from "@tanstack/react-start";

/**
 * Reports errors that escape request handling to Sentry: the same as Sentry's
 * `sentryGlobalRequestMiddleware`, which is a try/catch around `next()`.
 *
 * It is written here instead of imported because src/start.ts also runs in the
 * browser: a static import of `@sentry/tanstackstart-react` there kept the whole
 * SDK in every page's entry chunk, even though the browser half was a stub
 * (decision 0152). The SDK is loaded inside `.server()`, which never reaches the
 * client bundle. A no-op without a DSN: Sentry was never initialised.
 */
export const sentryRequestMiddleware = createMiddleware().server(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		const { captureException } = await import("@sentry/tanstackstart-react");
		captureException(error, { mechanism: { type: "auto.middleware.tanstackstart.request", handled: false } });
		throw error;
	}
});
