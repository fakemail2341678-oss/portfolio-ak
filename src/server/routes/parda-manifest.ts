/**
 * GET /app/parda/manifest.webmanifest and /ne/app/parda/manifest.webmanifest
 * (vite.config.ts, nitro.routes): Parda's manifest in that language
 * (src/server/parda/manifest.ts). A Nitro route for the reason ./manifest.ts gives.
 */
import { defineHandler } from "nitro";
import { baseLocale, extractLocaleFromUrl } from "../../paraglide/runtime.js";
import { pardaManifest } from "../parda/manifest";

export default defineHandler((event) => {
	const locale = extractLocaleFromUrl(event.req.url) ?? baseLocale;
	return new Response(JSON.stringify(pardaManifest(locale)), {
		headers: {
			"content-type": "application/manifest+json; charset=utf-8",
			"cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
		},
	});
});
