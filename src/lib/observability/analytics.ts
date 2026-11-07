import type { PostHog } from "posthog-js";
import { clientEnv } from "../env/client";

/**
 * Browser analytics (PostHog), strictly opt-in.
 *
 * - No VITE_POSTHOG_KEY: everything here is a no-op.
 * - posthog-js is downloaded and initialised only after the visitor grants
 *   consent (startAnalytics). Before that there is no PostHog code, no cookie
 *   and no network request.
 * - Revoking consent opts out, forgets the identity and removes PostHog's storage.
 */
export const analyticsKey = clientEnv.VITE_POSTHOG_KEY;
export const analyticsHost = clientEnv.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** PostHog's own cookie/localStorage name; the server reads the distinct id from it. */
export const posthogCookieName = (key: string) => `ph_${key}_posthog`;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

/** Loads and initialises PostHog (once). Call only after consent. */
export function startAnalytics(): Promise<PostHog | null> {
	if (!analyticsKey || typeof window === "undefined") return Promise.resolve(null);
	if (client) {
		client.opt_in_capturing({ captureEventName: false });
		return Promise.resolve(client);
	}
	const key = analyticsKey;
	loading ??= import("posthog-js").then(({ default: posthog }) => {
		posthog.init(key, {
			api_host: analyticsHost,
			// Pageviews are sent on router navigation (ObservabilitySync), not by URL polling.
			capture_pageview: false,
			capture_pageleave: true,
			// Only named events (pageviews, Test CRUD events); no automatic click capture,
			// no session recording, no surveys.
			autocapture: false,
			disable_session_recording: true,
			disable_surveys: true,
			person_profiles: "identified_only",
			persistence: "localStorage+cookie",
		});
		client = posthog;
		return posthog;
	});
	return loading;
}

/** Consent withdrawn: stop sending, drop the identity and remove PostHog's storage. */
export function stopAnalytics() {
	if (client) {
		client.opt_out_capturing();
		client.reset();
	}
	if (analyticsKey && typeof document !== "undefined") {
		const name = posthogCookieName(analyticsKey);
		try {
			localStorage.removeItem(name);
		} catch {
			// Storage can be unavailable (privacy mode); nothing to remove then.
		}
		// biome-ignore lint/suspicious/noDocumentCookie: removing PostHog's own cookie; the Cookie Store API isn't in Firefox/Safari.
		document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
	}
}

type TrackOptions = {
	/** Skip PostHog's batch queue; on a page being hidden or unloaded it uses sendBeacon. */
	sendInstantly?: boolean;
};

/** Sends an event if analytics is running (consented); otherwise does nothing. */
export function track(
	event: string,
	properties?: Record<string, string | number | boolean | null>,
	{ sendInstantly = false }: TrackOptions = {},
) {
	const options = sendInstantly ? { send_instantly: true } : undefined;
	if (client) client.capture(event, properties, options);
	// Consented but still downloading (first page load): send once it's ready.
	else void loading?.then((ready) => ready?.capture(event, properties, options));
}

export function identifyUser(userId: string) {
	client?.identify(userId);
}

/** After logout: a fresh anonymous id, so the next visitor isn't linked to the previous user. */
export function resetIdentity() {
	client?.reset();
}

export const analyticsRunning = () => client !== null && !client.has_opted_out_capturing();
