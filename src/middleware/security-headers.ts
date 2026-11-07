import { createMiddleware } from "@tanstack/react-start";
import { clientEnv } from "@/lib/env/client";
import { buildCsp, CSP_REPORT_PATH, originOf, reportingEndpoints } from "@/lib/http/csp";
import { analyticsHost, analyticsKey } from "@/lib/observability/analytics";

/** Sentry ingest and PostHog hosts, only when those services are configured. */
const clientConnectOrigins = [
	...new Set(
		[originOf(clientEnv.VITE_SENTRY_DSN), analyticsKey ? originOf(analyticsHost) : null].filter(
			(origin): origin is string => origin !== null,
		),
	),
];

/**
 * Cloudinary's upload (connect) and delivery (img) origins when it's configured.
 * Server config, so it's read lazily on the server (this file is part of the
 * isomorphic request middleware chain) and cached.
 */
let cloudinaryOrigins: Promise<{ connect: string[]; img: string[] }> | undefined;
const loadCloudinaryOrigins = () => {
	cloudinaryOrigins ??= import("@/server/attachments/store").then(({ imageStore }) => {
		if (!imageStore) return { connect: [], img: [] };
		const api = originOf(imageStore.config.apiBase);
		const delivery = originOf(imageStore.config.deliveryBase);
		return { connect: api ? [api] : [], img: delivery ? [delivery] : [] };
	});
	return cloudinaryOrigins;
};

/** Cloudflare Turnstile's script and challenge frame, when a captcha is configured (decisions.md 0128). */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
let turnstileOrigins: Promise<string[]> | undefined;
const loadTurnstileOrigins = () => {
	turnstileOrigins ??= import("@/server/env").then(({ serverEnv }) =>
		serverEnv.TURNSTILE_SITE_KEY ? [TURNSTILE_ORIGIN] : [],
	);
	return turnstileOrigins;
};

// parda:start
/** Parda's pages may frame its enabled sources; the player lab also its disabled ones (decision 0230). */
const PARDA_PAGE = /^(?:\/ne)?\/(?:app|admin)\/parda(?:\/|$)/;
const PARDA_LAB = /^(?:\/ne)?\/admin\/parda\/player-lab(?:\/|$)/;
// parda:end

const createNonce = () => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

/**
 * A fresh CSP nonce per request, passed on as `context.nonce` (the router puts
 * it on Start's inline scripts via ssr.nonce, see src/router.tsx) and sent in
 * the Content-Security-Policy header of HTML responses, with violations
 * reported to CSP_REPORT_PATH (Reporting-Endpoints names it for report-to).
 *
 * Production only: Vite's dev server and the TanStack Devtools inject inline
 * scripts without a nonce. The other security headers are static (Nitro
 * routeRules in vite.config.ts) and apply to every response.
 */
export const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
	const nonce = createNonce();
	const result = await next({ context: { nonce } });
	if (import.meta.env.PROD && result.response.headers.get("content-type")?.includes("text/html")) {
		const [cloudinary, frameOrigins] = await Promise.all([loadCloudinaryOrigins(), loadTurnstileOrigins()]);
		const reportUrl = new URL(CSP_REPORT_PATH, request.url).href;
		// What one section's pages add: other pages keep the strict policy.
		const section = { embed: [] as string[], img: [] as string[], connect: [] as string[] };
		// parda:start
		const { pathname } = new URL(request.url);
		if (PARDA_PAGE.test(pathname)) {
			const { pardaCspOrigins } = await import("@/server/parda/player/csp");
			Object.assign(section, await pardaCspOrigins({ includeDisabled: PARDA_LAB.test(pathname) }));
		}
		// parda:end
		result.response.headers.set("reporting-endpoints", reportingEndpoints(reportUrl));
		result.response.headers.set(
			"content-security-policy",
			buildCsp({
				nonce,
				connectOrigins: [...new Set([...clientConnectOrigins, ...cloudinary.connect, ...section.connect])],
				imgOrigins: [...cloudinary.img, ...section.img],
				frameOrigins,
				embedOrigins: section.embed,
				upgradeInsecureRequests: true,
				reportUrl,
			}),
		);
	}
	return result;
});
