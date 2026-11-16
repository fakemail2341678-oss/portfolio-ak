/**
 * GET /app/parda/manifest.webmanifest and /ne/app/parda/manifest.webmanifest
 * (vite.config.ts, nitro.routes): Parda's manifest in that language
 * (src/server/parda/manifest.ts). A Nitro route for the reason ./manifest.ts gives.
 */
import { defineApiRoute } from "../http/api-route";
import { pardaManifest } from "../parda/manifest";
import { manifestResponse } from "../seo/manifest";

export default defineApiRoute({
	name: "parda-manifest",
	methods: ["GET"],
	handler: ({ locale }) => manifestResponse(pardaManifest(locale)),
}).nitro;
