import type { Metric } from "web-vitals";
import { track } from "./analytics";

/** PostHog event carrying one Web Vitals measurement (decision 0138). */
export const WEB_VITAL_EVENT = "web_vital";

/**
 * The properties sent with each measurement. Values are rounded: CLS to 4
 * decimals, the rest to whole ms. `path` is the route without query or hash
 * (search strings can hold personal data).
 */
export const webVitalProperties = (
	metric: Pick<Metric, "name" | "value" | "rating" | "navigationType">,
	path: string,
) => ({
	metric: metric.name,
	value: metric.name === "CLS" ? Math.round(metric.value * 10_000) / 10_000 : Math.round(metric.value),
	rating: metric.rating,
	navigation_type: metric.navigationType,
	path,
});

let started = false;

/**
 * Real-user CLS, LCP and INP, sent to PostHog. Called by ObservabilitySync once
 * analytics runs, so it follows the consent choice: no consent, no
 * web-vitals code and nothing sent. The library reads buffered entries, so
 * starting after the page loaded still measures that load.
 *
 * CLS and INP are final when the page is hidden; those reports go out with
 * sendBeacon (sendInstantly). They cover the whole document's life, client-side
 * navigations included, and `path` is the route the visitor was on when the
 * value was reported.
 */
export function startWebVitals() {
	if (started || typeof window === "undefined") return;
	started = true;
	void import("web-vitals").then(({ onCLS, onINP, onLCP }) => {
		const send = (metric: Metric) =>
			track(WEB_VITAL_EVENT, webVitalProperties(metric, window.location.pathname), { sendInstantly: true });
		onCLS(send);
		onINP(send);
		onLCP(send);
	});
}
