import type { AnyRouter } from "@tanstack/react-router";
import type { ClientErrorSource } from "./client-errors";
import { sentryDsn, sentryOptions } from "./sentry";

/**
 * Browser Sentry, loaded off the critical path (decision 0152).
 *
 * The SDK is about 45 kB gzip, and importing it statically put it in the entry
 * chunk of every page. src/client.tsx starts loading it right away, in parallel
 * with hydration. Errors thrown before it is ready are buffered by the listeners
 * below and sent once it is; after that, Sentry's own global handlers take over.
 * Every function here is a no-op without a DSN and on the server (server events
 * are captured by src/instrument.server.ts and normalizeServerError).
 */
type Sdk = typeof import("@sentry/tanstackstart-react");

let sdk: Promise<Sdk | undefined> | undefined;

/** Collects uncaught errors until the SDK has loaded, then reports them. */
const bufferEarlyErrors = (loading: Promise<Sdk>): Promise<Sdk | undefined> => {
	const early: unknown[] = [];
	const onError = (event: ErrorEvent) => early.push(event.error ?? event.message);
	const onRejection = (event: PromiseRejectionEvent) => early.push(event.reason);
	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onRejection);
	const stop = () => {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onRejection);
	};
	return loading.then(
		(Sentry) => {
			stop();
			for (const error of early) Sentry.captureException(error);
			return Sentry;
		},
		// A blocked or failed download leaves the app working, just unmonitored.
		() => {
			stop();
			return undefined;
		},
	);
};

/**
 * Without a DSN the browser's errors go to the server log instead (./client-errors.ts,
 * decision 0300). The reporter is loaded when the first error happens.
 */
const toServerLog = (error: unknown, source: ClientErrorSource) => {
	void import("./client-errors").then(({ reportClientError }) => reportClientError(error, source)).catch(() => {});
};

let listening = false;
const listenForServerLog = () => {
	if (listening) return;
	listening = true;
	window.addEventListener("error", (event) => toServerLog(event.error ?? event.message, "error"));
	window.addEventListener("unhandledrejection", (event) => toServerLog(event.reason, "unhandledrejection"));
};

/**
 * Starts loading and initialising the browser SDK (once). Undefined on the server, and
 * without a DSN, where it starts the server-log reporter instead.
 */
export const loadSentry = (): Promise<Sdk | undefined> | undefined => {
	const dsn = sentryDsn;
	if (typeof window === "undefined") return undefined;
	if (!dsn) {
		listenForServerLog();
		return undefined;
	}
	sdk ??= bufferEarlyErrors(
		import("@sentry/tanstackstart-react").then((Sentry) => {
			Sentry.init(sentryOptions(dsn));
			return Sentry;
		}),
	);
	return sdk;
};

/** Reports an error an error boundary caught: to Sentry, or to the server log without a DSN. */
export const captureException = (error: unknown) => {
	if (!sentryDsn && typeof window !== "undefined") toServerLog(error, "boundary");
	void loadSentry()?.then((Sentry) => Sentry?.captureException(error));
};

/** The signed-in user's id (never email or name), or null after sign-out. */
export const setSentryUser = (id: string | null) => {
	void loadSentry()?.then((Sentry) => Sentry?.setUser(id ? { id } : null));
};

/** Navigation performance traces for the router. */
export const traceNavigation = (router: AnyRouter) => {
	void loadSentry()?.then((Sentry) => Sentry?.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router)));
};
