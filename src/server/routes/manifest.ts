/**
 * GET /manifest.webmanifest and /<locale>/manifest.webmanifest (vite.config.ts,
 * nitro.routes): the web app manifest in that language (src/server/seo/manifest.ts).
 *
 * A Nitro route, not a Start server route: browsers fetch manifests with
 * `Sec-Fetch-Dest: manifest`, and Nitro's dev server hands such requests to
 * Vite's static files unless a Nitro route matches (the same issue as images,
 * decision 0067), so a Start route answered 404 in dev only.
 */
import { defineHandler } from "nitro";
import { baseLocale, extractLocaleFromUrl } from "../../paraglide/runtime.js";
import { webManifest } from "../seo/manifest";

export default defineHandler((event) => {
	const locale = extractLocaleFromUrl(event.req.url) ?? baseLocale;
	return new Response(JSON.stringify(webManifest(locale)), {
		headers: {
			"content-type": "application/manifest+json; charset=utf-8",
			"cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
		},
	});
});
