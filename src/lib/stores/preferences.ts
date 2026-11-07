import { createStore } from "@tanstack/react-store";
import { z } from "zod";

/**
 * UI preferences (theme, Graphite presets, admin sidebar, table settings) in one TanStack Store.
 *
 * Persistence is cookies, not localStorage: the server reads them on every
 * request, so SSR renders the user's real theme / sidebar / page size and the
 * first client render matches it (no flash, no hydration mismatch). One store is
 * created per router (per request on the server, once in the browser) from the
 * cookies, see src/router.tsx. Cookie values are untrusted input and are parsed
 * with Zod; anything invalid falls back to the defaults.
 */

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

/** Graphite presets (src/styles/app.css): set on <html> as data-accent, data-radius and data-density. */
export const ACCENTS = ["indigo", "violet", "emerald", "amber", "rose"] as const;
export type AccentPreference = (typeof ACCENTS)[number];
export const RADII = ["sharp", "default", "round"] as const;
export type RadiusPreference = (typeof RADII)[number];
export const DENSITIES = ["comfortable", "compact"] as const;
export type DensityPreference = (typeof DENSITIES)[number];

export const PREFERENCE_COOKIES = {
	theme: "theme",
	accent: "accent",
	radius: "radius",
	density: "density",
	sidebar: "sidebar",
	tables: "table-prefs",
	analytics: "analytics-consent",
} as const;

/** Analytics consent. "unset" shows the banner; nothing is tracked unless "granted". */
export const ANALYTICS_CONSENT = ["unset", "granted", "denied"] as const;
export type AnalyticsConsent = (typeof ANALYTICS_CONSENT)[number];

export const PAGE_SIZES = [10, 20, 50, 100] as const;

const tablePreferencesSchema = z.object({
	pageSize: z
		.number()
		.refine((value) => (PAGE_SIZES as ReadonlyArray<number>).includes(value))
		.optional(),
	hiddenColumns: z.array(z.string().max(64)).max(50).optional(),
	/** Columns hidden until asked for (a column's `defaultHidden`) that the user showed. */
	shownColumns: z.array(z.string().max(64)).max(50).optional(),
});
export type TablePreferences = z.infer<typeof tablePreferencesSchema>;

const tablesSchema = z.record(z.string().regex(/^[\w-]{1,64}$/), tablePreferencesSchema);

export type Preferences = {
	theme: ThemePreference;
	accent: AccentPreference;
	radius: RadiusPreference;
	density: DensityPreference;
	sidebarCollapsed: boolean;
	tables: Record<string, TablePreferences>;
	analyticsConsent: AnalyticsConsent;
};

export const DEFAULT_PREFERENCES: Preferences = {
	theme: "system",
	accent: "indigo",
	radius: "default",
	density: "comfortable",
	sidebarCollapsed: false,
	tables: {},
	analyticsConsent: "unset",
};

const parseJson = (text: string | undefined): unknown => {
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

/** Preferences from decoded cookie values (server: getCookies(); browser: parseCookieHeader(document.cookie)). */
export const parsePreferences = (cookies: Readonly<Record<string, string | undefined>>): Preferences => {
	const theme = z.enum(THEMES).safeParse(cookies[PREFERENCE_COOKIES.theme]);
	const accent = z.enum(ACCENTS).safeParse(cookies[PREFERENCE_COOKIES.accent]);
	const radius = z.enum(RADII).safeParse(cookies[PREFERENCE_COOKIES.radius]);
	const density = z.enum(DENSITIES).safeParse(cookies[PREFERENCE_COOKIES.density]);
	const tables = tablesSchema.safeParse(parseJson(cookies[PREFERENCE_COOKIES.tables]));
	const consent = z.enum(["granted", "denied"]).safeParse(cookies[PREFERENCE_COOKIES.analytics]);
	return {
		theme: theme.success ? theme.data : DEFAULT_PREFERENCES.theme,
		accent: accent.success ? accent.data : DEFAULT_PREFERENCES.accent,
		radius: radius.success ? radius.data : DEFAULT_PREFERENCES.radius,
		density: density.success ? density.data : DEFAULT_PREFERENCES.density,
		sidebarCollapsed: cookies[PREFERENCE_COOKIES.sidebar] === "collapsed",
		tables: tables.success ? tables.data : DEFAULT_PREFERENCES.tables,
		analyticsConsent: consent.success ? consent.data : "unset",
	};
};

/** "a=1; b=x%20y" -> { a: "1", b: "x y" }. Malformed encodings are kept raw. */
export const parseCookieHeader = (header: string): Record<string, string> => {
	const cookies: Record<string, string> = {};
	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index < 0) continue;
		const name = part.slice(0, index).trim();
		const raw = part.slice(index + 1).trim();
		if (!name || name in cookies) continue;
		try {
			cookies[name] = decodeURIComponent(raw);
		} catch {
			cookies[name] = raw;
		}
	}
	return cookies;
};

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Writes a preference cookie (browser only; readable by the server on the next request). */
export const writePreferenceCookie = (name: string, value: string) => {
	if (typeof document === "undefined") return;
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not available in Firefox/Safari; these are non-sensitive UI preferences.
	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
};

/** Deletes a preference cookie (browser only). */
export const clearPreferenceCookie = (name: string) => {
	if (typeof document === "undefined") return;
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not available in Firefox/Safari; these are non-sensitive UI preferences.
	document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

const withTable = (
	tables: Preferences["tables"],
	tableId: string,
	update: (current: TablePreferences) => TablePreferences,
) => ({ ...tables, [tableId]: update(tables[tableId] ?? {}) });

/** A preferences store; its actions update state and persist the matching cookie. */
export const createPreferencesStore = (initial: Preferences) =>
	createStore(initial, ({ setState, get }) => {
		const persistTables = () => writePreferenceCookie(PREFERENCE_COOKIES.tables, JSON.stringify(get().tables));
		return {
			setTheme: (theme: ThemePreference) => {
				setState((state) => ({ ...state, theme }));
				writePreferenceCookie(PREFERENCE_COOKIES.theme, theme);
			},
			setAccent: (accent: AccentPreference) => {
				setState((state) => ({ ...state, accent }));
				writePreferenceCookie(PREFERENCE_COOKIES.accent, accent);
			},
			setRadius: (radius: RadiusPreference) => {
				setState((state) => ({ ...state, radius }));
				writePreferenceCookie(PREFERENCE_COOKIES.radius, radius);
			},
			setDensity: (density: DensityPreference) => {
				setState((state) => ({ ...state, density }));
				writePreferenceCookie(PREFERENCE_COOKIES.density, density);
			},
			setSidebarCollapsed: (sidebarCollapsed: boolean) => {
				setState((state) => ({ ...state, sidebarCollapsed }));
				writePreferenceCookie(PREFERENCE_COOKIES.sidebar, sidebarCollapsed ? "collapsed" : "open");
			},
			/** "unset" brings the banner back (cookie removed); the choice itself is remembered for a year. */
			setAnalyticsConsent: (analyticsConsent: AnalyticsConsent) => {
				setState((state) => ({ ...state, analyticsConsent }));
				if (analyticsConsent === "unset") clearPreferenceCookie(PREFERENCE_COOKIES.analytics);
				else writePreferenceCookie(PREFERENCE_COOKIES.analytics, analyticsConsent);
			},
			setTablePageSize: (tableId: string, pageSize: number) => {
				setState((state) => ({ ...state, tables: withTable(state.tables, tableId, (t) => ({ ...t, pageSize })) }));
				persistTables();
			},
			/** A `defaultHidden` column is remembered as shown, the others as hidden (only what differs from the default). */
			setColumnVisible: (tableId: string, column: string, visible: boolean, defaultHidden = false) => {
				setState((state) => ({
					...state,
					tables: withTable(state.tables, tableId, (t) => {
						const hidden = new Set(t.hiddenColumns ?? []);
						const shown = new Set(t.shownColumns ?? []);
						if (visible) hidden.delete(column);
						else if (!defaultHidden) hidden.add(column);
						if (visible && defaultHidden) shown.add(column);
						else shown.delete(column);
						const next = { ...t, hiddenColumns: [...hidden] };
						return shown.size > 0 || t.shownColumns ? { ...next, shownColumns: [...shown].slice(-50) } : next;
					}),
				}));
				persistTables();
			},
		};
	});

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
