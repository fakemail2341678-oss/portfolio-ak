/**
 * GET /app/chaal/manifest.webmanifest and /ne/app/chaal/manifest.webmanifest
 * (vite.config.ts, nitro.routes): Chaal's manifest in that language
 * (src/server/chaal/manifest.ts). A Nitro route for the reason ./manifest.ts gives.
 */
import { chaalManifest } from "../chaal/manifest";
import { defineApiRoute } from "../http/api-route";
import { manifestResponse } from "../seo/manifest";

export default defineApiRoute({
	name: "chaal-manifest",
	methods: ["GET"],
	handler: ({ locale }) => manifestResponse(chaalManifest(locale)),
}).nitro;
