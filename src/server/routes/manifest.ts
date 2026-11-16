/**
 * GET /manifest.webmanifest and /<locale>/manifest.webmanifest (vite.config.ts,
 * nitro.routes): the web app manifest in that language (src/server/seo/manifest.ts).
 *
 * A Nitro route, not a Start server route: browsers fetch manifests with
 * `Sec-Fetch-Dest: manifest`, and Nitro's dev server hands such requests to
 * Vite's static files unless a Nitro route matches (the same issue as images,
 * decision 0067), so a Start route answered 404 in dev only.
 */
import { defineApiRoute } from "../http/api-route";
import { manifestResponse, webManifest } from "../seo/manifest";

export default defineApiRoute({
	name: "manifest",
	methods: ["GET"],
	handler: ({ locale }) => manifestResponse(webManifest(locale)),
}).nitro;
