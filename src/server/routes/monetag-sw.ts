/**
 * GET /sw.js: Monetag's push-notification service worker (decision 0301), as the `sw.js`
 * Monetag gives for the push zone: its options, then Monetag's own worker script. Served by
 * a route, not a file in public/, so the zone comes from MONETAG_PUSH_DOMAIN and
 * MONETAG_PUSH_ZONE and a deployment without them has no worker (404).
 *
 * At the site's root because Monetag's tag registers it there: its scope is the whole site.
 * Monetag's tag registers it only on Parda's ad pages, after consent; withdrawing consent or
 * switching to a kids' profile unregisters it (src/lib/ads/monetag.ts).
 */
import { AppError } from "@/lib/errors";
import { serverEnv } from "../env";
import { defineApiRoute } from "../http/api-route";

/** The worker Monetag's push format runs: the same three lines as its downloadable sw.js. */
export const pushWorker = (domain: string, zone: string) =>
	[
		`self.options = ${JSON.stringify({ domain, zoneId: Number(zone) })};`,
		`self.lary = "";`,
		`importScripts(${JSON.stringify(`https://${domain}/act/files/service-worker.min.js?r=sw`)});`,
		"",
	].join("\n");

export default defineApiRoute({
	name: "monetag-sw",
	methods: ["GET"],
	handler: () => {
		const domain = serverEnv.MONETAG_PUSH_DOMAIN;
		const zone = serverEnv.MONETAG_PUSH_ZONE;
		if (!domain || !zone) throw new AppError("NOT_FOUND", "Push ads are not configured");
		return new Response(pushWorker(domain, zone), {
			headers: {
				"content-type": "text/javascript; charset=utf-8",
				// The browser checks a worker for updates itself; this keeps a changed zone from waiting a day.
				"cache-control": "public, max-age=0, must-revalidate",
			},
		});
	},
}).nitro;
