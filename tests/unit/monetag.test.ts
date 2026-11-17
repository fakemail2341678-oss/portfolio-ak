// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Monetag's tag (decision 0301): added once, when idle, with the dashboard's attributes; nothing
 * without both variables; removing it unregisters the push worker and reloads only a page that
 * runs the tag.
 */
const TAG = "https://ads.example/88/tag.min.js";

const load = async (env: Record<string, string> = {}) => {
	for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
	vi.resetModules();
	return import("@/lib/ads/monetag");
};

afterEach(() => {
	for (const script of document.querySelectorAll("script")) script.remove();
});

describe("loadAds", () => {
	it("does nothing without both variables", async () => {
		const ads = await load({ VITE_MONETAG_TAG_URL: TAG });
		expect(ads.adsConfigured).toBe(false);
		ads.loadAds();
		expect(ads.adsLoaded()).toBe(false);
		expect(document.querySelector("script")).toBeNull();
	});

	it("adds the tag once, when the browser is idle", async () => {
		const idle: Array<() => void> = [];
		vi.stubGlobal("requestIdleCallback", (run: () => void) => idle.push(run));
		const ads = await load({ VITE_MONETAG_TAG_URL: TAG, VITE_MONETAG_ZONE: "311177" });
		ads.loadAds();
		ads.loadAds();
		expect(document.querySelector("script")).toBeNull();
		expect(idle).toHaveLength(1);
		idle[0]?.();
		const scripts = document.querySelectorAll("script");
		expect(scripts).toHaveLength(1);
		expect(scripts[0]?.src).toBe(TAG);
		expect(scripts[0]?.async).toBe(true);
		expect(scripts[0]?.dataset).toMatchObject({ zone: "311177", cfasync: "false" });
		expect(ads.adsLoaded()).toBe(true);
	});
});

describe("sectionShowsAds", () => {
	it("is true in a section that says so, when ads are configured", async () => {
		const off = await load();
		expect(off.sectionShowsAds([{ staticData: { ads: true } }])).toBe(false);
		const on = await load({ VITE_MONETAG_TAG_URL: TAG, VITE_MONETAG_ZONE: "1" });
		expect(on.sectionShowsAds([{ staticData: {} }, { staticData: { ads: true } }])).toBe(true);
		expect(on.sectionShowsAds([{ staticData: {} }])).toBe(false);
	});
});

describe("removeAds", () => {
	const registration = (path: string) => ({
		active: { scriptURL: `https://app.example${path}` },
		waiting: null,
		installing: null,
		unregister: vi.fn(async () => true),
	});

	it("unregisters the push worker only", async () => {
		const push = registration("/sw.js");
		const other = registration("/other-worker.js");
		vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: async () => [push, other] } });
		const ads = await load({ VITE_MONETAG_TAG_URL: TAG, VITE_MONETAG_ZONE: "1" });
		// The tag never ran in this page, so there is nothing to reload.
		await ads.removeAds();
		expect(push.unregister).toHaveBeenCalledOnce();
		expect(other.unregister).not.toHaveBeenCalled();
	});
});
