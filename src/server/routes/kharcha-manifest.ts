/**
 * GET /app/kharcha/manifest.webmanifest and /ne/app/kharcha/manifest.webmanifest
 * (vite.config.ts, nitro.routes): Kharcha's manifest in that language
 * (src/server/kharcha/manifest.ts). A Nitro route for the reason ./manifest.ts gives.
 */
import { defineApiRoute } from "../http/api-route";
import { kharchaManifest } from "../kharcha/manifest";
import { manifestResponse } from "../seo/manifest";

export default defineApiRoute({
	name: "kharcha-manifest",
	methods: ["GET"],
	handler: ({ locale }) => manifestResponse(kharchaManifest(locale)),
}).nitro;
