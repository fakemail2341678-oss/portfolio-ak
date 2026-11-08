import { linkOptions } from "@tanstack/react-router";

/**
 * Where Chaal lives (PLAN 13.2): its base path is here and nowhere else, so a rename is
 * one edit (with a move of src/routes/_chaal/app/chaal). Task 71 has the connect routes and
 * the admin's lab; its pages start with Task 73.
 */
export const CHAAL_BASE = "/app/chaal";

/**
 * Every link into Chaal: pages link through these. A link arrives with its route
 * (PLAN 13.3), never before.
 */
export const chaalLinks = {
	home: () => linkOptions({ to: "/app/chaal" }),
	/** The analysis board (Task 75): empty, at a position, or a saved analysis. */
	analysis: (search: { fen?: string; moves?: string; id?: string } = {}) =>
		linkOptions({ to: "/app/chaal/analysis", search }),
	/** Preferences, the Lichess connection, this browser's data (noindex). `hash` opens a section. */
	settings: (hash?: "connection" | "board" | "device") =>
		linkOptions({ to: "/app/chaal/settings", ...(hash ? { hash } : {}) }),
	about: (hash?: string) => linkOptions({ to: "/app/chaal/about", ...(hash ? { hash } : {}) }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/chaal/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/chaal/sign-up", search: { redirect } }),
};

/** De-localized paths for redirects, `?redirect=` targets, heads and the sitemap. */
export const CHAAL_PATHS = {
	home: CHAAL_BASE,
	analysis: `${CHAAL_BASE}/analysis`,
	about: `${CHAAL_BASE}/about`,
	settings: `${CHAAL_BASE}/settings`,
} as const;

/** Chaal's indexable pages (PLAN 13.5, "SEO"): each joins with its route. */
export const CHAAL_SITEMAP: ReadonlyArray<string> = [CHAAL_PATHS.home, CHAAL_PATHS.analysis, CHAAL_PATHS.about];

/** The admin's Chaal: connecting from the lab returns there. */
const CHAAL_ADMIN = "/admin/chaal";

/** The Nitro routes that connect Lichess (src/server/routes/chaal-oauth.ts, decision 0256). */
export const CHAAL_OAUTH_START = "/api/chaal/oauth/start";
export const CHAAL_OAUTH_CALLBACK = "/api/chaal/oauth/callback";

/** The event stream, through our server (src/server/routes/chaal-stream.ts). */
export const CHAAL_EVENT_STREAM = "/api/chaal/stream/events";

/** What a connect result adds to the return path (`?lichess=connected`, `?lichess=taken`, ...). */
export const CONNECT_RESULT_PARAM = "lichess";

export const CONNECT_RESULTS = [
	"connected",
	"denied",
	"taken",
	"blocked",
	"off",
	"expired",
	"failed",
	"no-session",
] as const;
export type ConnectResult = (typeof CONNECT_RESULTS)[number];

/**
 * A path connecting may return to: one of Chaal's own pages, or the admin's lab, optionally
 * localized (`/ne/...`), with a query but never another origin (no open redirect: no `//`,
 * no backslash, no scheme). Anything else falls back to Chaal's home.
 */
export function safeReturnPath(value: string | null | undefined): string {
	if (!value || value.length > 512) return CHAAL_BASE;
	if (
		!value.startsWith("/") ||
		value.startsWith("//") ||
		/[\\\s]/.test(value) ||
		value.includes("://") ||
		value.includes("..")
	) {
		return CHAAL_BASE;
	}
	const path = value.split(/[?#]/)[0] ?? "";
	const unlocalized = path.replace(/^\/ne(?=\/|$)/, "") || "/";
	const allowed = [CHAAL_BASE, CHAAL_ADMIN].some((base) => unlocalized === base || unlocalized.startsWith(`${base}/`));
	return allowed ? value : CHAAL_BASE;
}

/** The address that starts connecting Lichess and comes back to `returnTo`. */
export const connectHref = (returnTo: string) => `${CHAAL_OAUTH_START}?return=${encodeURIComponent(returnTo)}`;
