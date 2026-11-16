/**
 * GET /app/taskline/manifest.webmanifest and /ne/app/taskline/manifest.webmanifest
 * (vite.config.ts, nitro.routes): Taskline's manifest in that language
 * (src/server/taskline/manifest.ts). A Nitro route for the reason ./manifest.ts gives.
 */
import { defineApiRoute } from "../http/api-route";
import { manifestResponse } from "../seo/manifest";
import { tasklineManifest } from "../taskline/manifest";

export default defineApiRoute({
	name: "taskline-manifest",
	methods: ["GET"],
	handler: ({ locale }) => manifestResponse(tasklineManifest(locale)),
}).nitro;
