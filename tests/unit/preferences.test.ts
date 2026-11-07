// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	createPreferencesStore,
	DEFAULT_PREFERENCES,
	parseCookieHeader,
	parsePreferences,
} from "@/lib/stores/preferences";

const clearCookies = () => {
	for (const name of ["theme", "accent", "radius", "density", "sidebar", "table-prefs", "analytics-consent"]) {
		// biome-ignore lint/suspicious/noDocumentCookie: test cleanup of the cookies the store writes.
		document.cookie = `${name}=; Path=/; Max-Age=0`;
	}
};
afterEach(clearCookies);

describe("parsePreferences", () => {
	it("defaults when no cookies are set", () => {
		expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
	});

	it("reads valid cookies", () => {
		expect(
			parsePreferences({
				theme: "dark",
				accent: "emerald",
				radius: "sharp",
				density: "compact",
				sidebar: "collapsed",
				"table-prefs": JSON.stringify({ "test-crud": { pageSize: 50, hiddenColumns: ["price"] } }),
			}),
		).toEqual({
			theme: "dark",
			accent: "emerald",
			radius: "sharp",
			density: "compact",
			sidebarCollapsed: true,
			tables: { "test-crud": { pageSize: 50, hiddenColumns: ["price"] } },
			analyticsConsent: "unset",
		});
	});

	it("ignores tampered or malformed values", () => {
		expect(
			parsePreferences({
				theme: "neon",
				accent: "chartreuse",
				radius: "9px",
				density: "<x>",
				sidebar: "yes",
				"table-prefs": "{not json",
			}),
		).toEqual(DEFAULT_PREFERENCES);
		// Page sizes outside the allowed list and odd table ids are rejected as a whole.
		expect(parsePreferences({ "table-prefs": JSON.stringify({ t: { pageSize: 5000 } }) }).tables).toEqual({});
		expect(parsePreferences({ "table-prefs": JSON.stringify({ "<script>": {} }) }).tables).toEqual({});
	});
});

describe("parseCookieHeader", () => {
	it("splits, trims and decodes; first value wins; bad encodings stay raw", () => {
		expect(parseCookieHeader("a=1; b=x%20y;c=%E0%A4; a=2; junk")).toEqual({ a: "1", b: "x y", c: "%E0%A4" });
	});
});

describe("preferences store", () => {
	it("remembers a column hidden by default once shown, and forgets it when hidden again", () => {
		const store = createPreferencesStore(DEFAULT_PREFERENCES);
		store.actions.setColumnVisible("tasks", "field:a", true, true);
		expect(store.state.tables.tasks).toEqual({ hiddenColumns: [], shownColumns: ["field:a"] });
		store.actions.setColumnVisible("tasks", "field:a", false, true);
		expect(store.state.tables.tasks).toEqual({ hiddenColumns: [], shownColumns: [] });
	});

	it("updates state and persists each preference to a cookie the server can read", () => {
		const store = createPreferencesStore(DEFAULT_PREFERENCES);
		store.actions.setTheme("dark");
		store.actions.setAccent("amber");
		store.actions.setRadius("round");
		store.actions.setDensity("compact");
		store.actions.setSidebarCollapsed(true);
		store.actions.setTablePageSize("test-crud", 50);
		store.actions.setColumnVisible("test-crud", "price", false);
		store.actions.setColumnVisible("test-crud", "slug", false);
		store.actions.setColumnVisible("test-crud", "slug", true);

		expect(store.state).toEqual({
			theme: "dark",
			accent: "amber",
			radius: "round",
			density: "compact",
			sidebarCollapsed: true,
			tables: { "test-crud": { pageSize: 50, hiddenColumns: ["price"] } },
			analyticsConsent: "unset",
		});
		// A fresh store built from the cookies (what the next request does) restores everything.
		expect(parsePreferences(parseCookieHeader(document.cookie))).toEqual(store.state);
	});
});

describe("analytics consent cookie", () => {
	it("persists granted/denied and removes the cookie when reset to unset", () => {
		const store = createPreferencesStore(DEFAULT_PREFERENCES);
		store.actions.setAnalyticsConsent("granted");
		expect(parsePreferences(parseCookieHeader(document.cookie)).analyticsConsent).toBe("granted");
		store.actions.setAnalyticsConsent("denied");
		expect(parsePreferences(parseCookieHeader(document.cookie)).analyticsConsent).toBe("denied");
		store.actions.setAnalyticsConsent("unset");
		expect(document.cookie).not.toContain("analytics-consent");
	});
});
