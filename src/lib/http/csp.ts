/**
 * Content-Security-Policy for HTML pages (see docs/decisions.md 0081).
 *
 * Scripts: only those carrying this request's nonce ('strict-dynamic' lets them
 * load their own chunks, e.g. route code, Tiptap, posthog-js), so injected
 * <script> tags can't run. Network: same origin plus the configured Sentry,
 * PostHog and Cloudinary upload hosts. Images: same origin plus Cloudinary delivery. Frames: none, or
 * Cloudflare Turnstile's challenge when a captcha is configured. Styles allow inline style attributes (Radix positions popovers
 * with them); stylesheets themselves are same-origin. Violations are reported to
 * CSP_REPORT_PATH when a report URL is given (production, decision 0139).
 */

/** The endpoint browsers send violation reports to (src/routes/api/csp-report.ts). */
export const CSP_REPORT_PATH = "/api/csp-report";
/** Reporting API endpoint name, declared in the Reporting-Endpoints header. */
export const CSP_REPORT_GROUP = "csp";

/** Reporting-Endpoints header value naming the report URL (absolute, as the Reporting API expects). */
export const reportingEndpoints = (reportUrl: string) => `${CSP_REPORT_GROUP}="${reportUrl}"`;

export type CspOptions = {
	nonce: string;
	/** Extra origins the browser may send data to (Sentry ingest, PostHog, Cloudinary uploads). */
	connectOrigins?: ReadonlyArray<string>;
	/** Extra origins images may load from (Cloudinary delivery). */
	imgOrigins?: ReadonlyArray<string>;
	/** Origins that may be framed and serve scripts our code loads (Cloudflare Turnstile). */
	frameOrigins?: ReadonlyArray<string>;
	/** Origins that may only be framed: frame-src, never script-src or connect-src (a section's embedded players). */
	embedOrigins?: ReadonlyArray<string>;
	/** Adds upgrade-insecure-requests (production only; it would break http://localhost). */
	upgradeInsecureRequests?: boolean;
	/**
	 * Where violations are reported: report-to (Reporting API, with the
	 * Reporting-Endpoints header) and report-uri for browsers without it.
	 */
	reportUrl?: string;
};

export const originOf = (url: string | undefined): string | null => {
	if (!url) return null;
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
};

export function buildCsp({
	nonce,
	connectOrigins = [],
	imgOrigins = [],
	frameOrigins = [],
	embedOrigins = [],
	upgradeInsecureRequests = false,
	reportUrl,
}: CspOptions): string {
	const framed = [...new Set([...frameOrigins, ...embedOrigins])];
	const directives: Record<string, ReadonlyArray<string>> = {
		"default-src": ["'self'"],
		// Host sources only matter to browsers without 'strict-dynamic' (which ignore them otherwise).
		"script-src": [`'nonce-${nonce}'`, "'strict-dynamic'", ...frameOrigins],
		"style-src": ["'self'", "'unsafe-inline'"],
		"img-src": ["'self'", "data:", "blob:", ...imgOrigins],
		"font-src": ["'self'"],
		"connect-src": ["'self'", ...connectOrigins],
		...(framed.length > 0 ? { "frame-src": framed } : {}),
		"object-src": ["'none'"],
		"base-uri": ["'self'"],
		"form-action": ["'self'"],
		"frame-ancestors": ["'none'"],
	};
	const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
	if (upgradeInsecureRequests) policy.push("upgrade-insecure-requests");
	// Browsers that know report-to ignore report-uri when both are present.
	if (reportUrl) policy.push(`report-uri ${reportUrl}`, `report-to ${CSP_REPORT_GROUP}`);
	return policy.join("; ");
}

/** Headers sent on every response (assets and API routes included), set via Nitro routeRules. */
export const STATIC_SECURITY_HEADERS = {
	"strict-transport-security": "max-age=63072000; includeSubDomains",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
	"x-frame-options": "DENY",
	"cross-origin-opener-policy": "same-origin",
} as const;
