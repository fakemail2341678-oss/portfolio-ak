import "@tanstack/react-start/server-only";
import { getCookie } from "@tanstack/react-start/server";
import { PostHog } from "posthog-node";
import { analyticsHost, analyticsKey, posthogCookieName } from "@/lib/observability/analytics";
import { PREFERENCE_COOKIES } from "@/lib/stores/preferences";
import { serverEnv } from "@/server/env";
import { errorFields, log } from "../log";

/**
 * Server-side PostHog (posthog-node). Same consent rule as the browser: events
 * are sent only when the request carries the "granted" consent cookie. With no
 * VITE_POSTHOG_KEY no client is created and nothing is sent.
 */
let client: PostHog | null | undefined;

const getClient = (): PostHog | null => {
	if (client === undefined) {
		client = analyticsKey
			? new PostHog(analyticsKey, {
					host: analyticsHost,
					// Serverless: send each event right away instead of batching in memory.
					flushAt: 1,
					flushInterval: 0,
					// With a secret key, flag definitions are polled (every 30 s) and evaluated here:
					// no network call while rendering a page (decision 0154).
					secretKey: serverEnv.POSTHOG_SECRET_KEY,
					// Without one, a slow PostHog must not slow page renders: the flag falls back
					// to off after 300 ms, and answers are cached below.
					featureFlagsRequestTimeoutMs: 300,
				})
			: null;
	}
	return client;
};

const hasConsent = () => getCookie(PREFERENCE_COOKIES.analytics) === "granted";

/** The browser's PostHog distinct id, if the visitor consented (the cookie only exists then). */
const consentedDistinctId = (): string | null => {
	if (!analyticsKey || !hasConsent()) return null;
	const raw = getCookie(posthogCookieName(analyticsKey));
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		const id = parsed && typeof parsed === "object" && "distinct_id" in parsed ? parsed.distinct_id : undefined;
		return typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null;
	} catch {
		return null;
	}
};

/** Records a server event for a user, if PostHog is configured and they consented. Never throws. */
export async function captureServerEvent(
	event: string,
	distinctId: string,
	properties: Record<string, string | number | boolean | null> = {},
) {
	const posthog = getClient();
	if (!posthog || !hasConsent()) return;
	try {
		await posthog.captureImmediate({ event, distinctId, properties, disableGeoip: true });
	} catch (error) {
		log("warn", "analytics capture failed", errorFields(error));
	}
}

/** Remote flag answers, per flag and distinct id, for FLAG_CACHE_MS (no secret key only). */
const FLAG_CACHE_MS = 30_000;
const FLAG_CACHE_MAX = 1_000;
const flagCache = new Map<string, { value: boolean; expires: number }>();

const cachedFlag = async (key: string, evaluate: () => Promise<boolean>): Promise<boolean> => {
	const now = Date.now();
	const hit = flagCache.get(key);
	if (hit && hit.expires > now) return hit.value;
	const value = await evaluate();
	if (flagCache.size >= FLAG_CACHE_MAX) flagCache.clear();
	flagCache.set(key, { value, expires: now + FLAG_CACHE_MS });
	return value;
};

/**
 * Evaluates a boolean feature flag for this request. Without consent the
 * evaluation uses a shared anonymous id (no per-visitor identifier leaves the
 * server) and never records a `$feature_flag_called` event. Off on any failure.
 */
export async function isFlagEnabled(flag: string): Promise<boolean> {
	const posthog = getClient();
	if (!posthog) return false;
	const distinctId = consentedDistinctId() ?? "anonymous";
	const evaluate = async () => {
		try {
			const value = await posthog.getFeatureFlag(flag, distinctId, {
				sendFeatureFlagEvents: false,
				disableGeoip: true,
			});
			return value === true || (typeof value === "string" && value !== "control");
		} catch {
			return false;
		}
	};
	// Local evaluation is already in memory; remote answers are cached briefly.
	return serverEnv.POSTHOG_SECRET_KEY ? evaluate() : cachedFlag(`${flag}:${distinctId}`, evaluate);
}
