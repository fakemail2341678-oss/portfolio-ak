/**
 * Nitro runs plugins when the server boots, before handling any request.
 * TanStack Start's SSR handler is loaded lazily on the first request, so validating
 * there would be too late. Doing it here makes `pnpm start` (and a serverless
 * cold start) fail immediately on:
 * - missing or invalid env (importing ../env runs the T3 Env schema), and
 * - a production build with no usable email provider (getEmailProvider throws), and
 * - a production deploy built with VITE_DEV_ROUTES=true (the /dev pages would be live).
 */
import "../env";
import { definePlugin } from "nitro";
import { DEV_ROUTES_IN_PRODUCTION, devRoutesInProduction } from "@/lib/env/client.schema";
import { getEmailProvider } from "../email/config";

export default definePlugin(() => {
	getEmailProvider();
	// The flag was inlined at build time; VERCEL_ENV is read at boot.
	if (devRoutesInProduction({ VITE_DEV_ROUTES: import.meta.env.VITE_DEV_ROUTES, VERCEL_ENV: process.env.VERCEL_ENV })) {
		throw new Error(DEV_ROUTES_IN_PRODUCTION);
	}
});
