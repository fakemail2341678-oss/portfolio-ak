import { clientEnv } from "@/lib/env/client";

/**
 * Monetag's MultiTag (decision 0301): one script that runs the formats chosen in Monetag's
 * dashboard (push notifications, in-page push, vignette, popunder). This file adds it to a
 * page and takes it away; which pages may show ads is the section's call (`staticData.ads`
 * says a section can, and the section's own rules say on which pages: Parda's
 * `src/features/parda/ads/`).
 *
 * Nothing here runs without both VITE_MONETAG_* variables, and nothing loads before the
 * visitor accepts the consent banner (src/components/layout/observability.tsx).
 */

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** true: this section can show ads, so the consent banner asks about them on its pages. */
		ads?: boolean;
	}
}

const tagUrl = clientEnv.VITE_MONETAG_TAG_URL;
const zone = clientEnv.VITE_MONETAG_ZONE;

/** Whether ads are configured: the tag's URL and its zone are both set. */
export const adsConfigured = Boolean(tagUrl && zone);

/** Whether a matched route's section can show ads (for the consent banner). */
export const sectionShowsAds = (matches: ReadonlyArray<{ staticData: { ads?: boolean | undefined } }>): boolean =>
	adsConfigured && matches.some((match) => match.staticData.ads === true);

let added = false;

/**
 * Adds the tag to this document, once, when the browser is idle: the page has painted and
 * answers its first input before any ad script runs. The scripts it loads stay for the
 * document's life, which is why a section reloads the page to leave its ad pages.
 */
export function loadAds(): void {
	if (!adsConfigured || added || typeof document === "undefined") return;
	added = true;
	const add = () => {
		const script = document.createElement("script");
		script.src = tagUrl ?? "";
		script.async = true;
		script.dataset.zone = zone ?? "";
		script.dataset.cfasync = "false";
		document.body.appendChild(script);
	};
	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(add, { timeout: 3000 });
		return;
	}
	// timer: Safari has no requestIdleCallback, so it waits until the page has painted.
	setTimeout(add, 1500);
}

/** Whether the tag was added to this document: its scripts are running here. */
export const adsLoaded = (): boolean => added;

/** Where Monetag's push format registers its service worker: the site's root (src/server/routes/monetag-sw.ts). */
export const PUSH_WORKER_PATH = "/sw.js";

/**
 * Takes ads away: unregisters the push worker (its notifications stop), then reloads the
 * page when the tag runs in it, since an ad script can't be unloaded. For consent
 * withdrawn and a kids' profile.
 */
export async function removeAds(): Promise<void> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
	const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
	await Promise.all(
		registrations
			.filter((registration) => {
				const worker = registration.active ?? registration.waiting ?? registration.installing;
				return worker !== null && new URL(worker.scriptURL).pathname === PUSH_WORKER_PATH;
			})
			.map((registration) => registration.unregister()),
	);
	if (added) window.location.reload();
}
