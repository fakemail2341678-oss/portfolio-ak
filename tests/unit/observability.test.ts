import type { ErrorEvent } from "@sentry/tanstackstart-react";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { dropExpectedErrors, sentryOptions } from "@/lib/observability/sentry";
import { webVitalProperties } from "@/lib/observability/web-vitals";
import {
	createPreferencesStore,
	DEFAULT_PREFERENCES,
	parseCookieHeader,
	parsePreferences,
} from "@/lib/stores/preferences";

describe("Sentry beforeSend", () => {
	const event = (user?: ErrorEvent["user"]): ErrorEvent => ({
		type: undefined,
		event_id: "1",
		...(user ? { user } : {}),
	});

	it("drops AppErrors (expected 4xx, or INTERNAL already reported with the original stack)", () => {
		expect(dropExpectedErrors(event(), { originalException: new AppError("NOT_FOUND") })).toBeNull();
		expect(dropExpectedErrors(event(), { originalException: new AppError("INTERNAL") })).toBeNull();
	});

	it("keeps real errors and strips the client IP, keeping only the user id", () => {
		const kept = dropExpectedErrors(event({ id: "u1", ip_address: "203.0.113.9" }), {
			originalException: new Error("boom"),
		});
		expect(kept?.user).toEqual({ id: "u1" });
		expect(dropExpectedErrors(event(), { originalException: new TypeError("x") })).not.toBeNull();
	});

	it("sends no default PII and, in development, no traces unless asked to", () => {
		const options = sentryOptions("https://key@o1.ingest.sentry.io/1");
		expect(options.sendDefaultPii).toBe(false);
		expect(options.tracesSampleRate).toBe(0);
		expect(options.beforeSend).toBe(dropExpectedErrors);
	});

	it("traces every development request with VITE_SENTRY_DEV_TRACING=true", async () => {
		vi.stubEnv("VITE_SENTRY_DEV_TRACING", "true");
		vi.resetModules();
		const sentry = await import("@/lib/observability/sentry");
		expect(sentry.sentryOptions("https://key@o1.ingest.sentry.io/1").tracesSampleRate).toBe(1);
	});
});

describe("analytics consent preference", () => {
	it("defaults to unset and only accepts granted/denied from the cookie", () => {
		expect(DEFAULT_PREFERENCES.analyticsConsent).toBe("unset");
		expect(parsePreferences({ "analytics-consent": "granted" }).analyticsConsent).toBe("granted");
		expect(parsePreferences({ "analytics-consent": "denied" }).analyticsConsent).toBe("denied");
		expect(parsePreferences({ "analytics-consent": "unset" }).analyticsConsent).toBe("unset");
		expect(parsePreferences({ "analytics-consent": "yes please" }).analyticsConsent).toBe("unset");
	});
});

describe("browser analytics without a key", () => {
	it("is a no-op: nothing to start, nothing tracked", async () => {
		const analytics = await import("@/lib/observability/analytics");
		expect(analytics.analyticsKey).toBeUndefined();
		expect(await analytics.startAnalytics()).toBeNull();
		expect(() => analytics.track("x")).not.toThrow();
		expect(analytics.analyticsRunning()).toBe(false);
	});
});

// The store writes cookies; exercised in jsdom by tests/unit/preferences.test.ts. Here: the action shape.
describe("setAnalyticsConsent", () => {
	it("updates state for every choice", () => {
		const store = createPreferencesStore(DEFAULT_PREFERENCES);
		store.actions.setAnalyticsConsent("granted");
		expect(store.state.analyticsConsent).toBe("granted");
		store.actions.setAnalyticsConsent("unset");
		expect(store.state.analyticsConsent).toBe("unset");
		expect(parseCookieHeader("")).toEqual({});
	});
});

describe("real-user Web Vitals", () => {
	it("sends the metric, a rounded value, its rating and the path only", () => {
		expect(
			webVitalProperties(
				{ name: "CLS", value: 0.012345, rating: "needs-improvement", navigationType: "navigate" },
				"/ne/test-crud",
			),
		).toEqual({
			metric: "CLS",
			value: 0.0123,
			rating: "needs-improvement",
			navigation_type: "navigate",
			path: "/ne/test-crud",
		});
		expect(
			webVitalProperties({ name: "LCP", value: 1234.56, rating: "good", navigationType: "reload" }, "/"),
		).toMatchObject({
			value: 1235,
		});
	});
});
