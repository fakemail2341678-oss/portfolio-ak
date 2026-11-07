import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server-side PostHog: consent gating, anonymous flag evaluation, failures.
 * posthog-node and the request cookies are mocked; the module is re-imported per
 * test so the VITE_POSTHOG_KEY stub (read at module load) takes effect.
 */
const cookies = vi.hoisted(() => new Map<string, string>());
vi.mock("@tanstack/react-start/server", () => ({ getCookie: (name: string) => cookies.get(name) }));

const posthog = vi.hoisted(() => ({
	instances: 0,
	captureImmediate: vi.fn(async () => {}),
	getFeatureFlag: vi.fn(async (): Promise<boolean | string | undefined> => true),
}));
vi.mock("posthog-node", () => ({
	PostHog: class {
		constructor() {
			posthog.instances += 1;
		}
		captureImmediate = posthog.captureImmediate;
		getFeatureFlag = posthog.getFeatureFlag;
	},
}));

const load = async (key: string | undefined) => {
	vi.resetModules();
	if (key) vi.stubEnv("VITE_POSTHOG_KEY", key);
	return import("@/server/analytics/posthog");
};

beforeEach(() => {
	cookies.clear();
	posthog.instances = 0;
	posthog.captureImmediate.mockClear();
	posthog.getFeatureFlag.mockReset().mockResolvedValue(true);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe("without VITE_POSTHOG_KEY", () => {
	it("never creates a client, sends nothing and reports flags as off", async () => {
		const analytics = await load(undefined);
		cookies.set("analytics-consent", "granted");
		await analytics.captureServerEvent("test_crud_created", "user-1");
		expect(await analytics.isFlagEnabled("home-items-cta")).toBe(false);
		expect(posthog.instances).toBe(0);
		expect(posthog.captureImmediate).not.toHaveBeenCalled();
		expect(posthog.getFeatureFlag).not.toHaveBeenCalled();
	});
});

describe("with VITE_POSTHOG_KEY", () => {
	it("sends server events only when the request carries consent", async () => {
		const analytics = await load("phc_test");
		await analytics.captureServerEvent("test_crud_created", "user-1", { item_id: "x" });
		cookies.set("analytics-consent", "denied");
		await analytics.captureServerEvent("test_crud_created", "user-1", { item_id: "x" });
		expect(posthog.captureImmediate).not.toHaveBeenCalled();

		cookies.set("analytics-consent", "granted");
		await analytics.captureServerEvent("test_crud_created", "user-1", { item_id: "x" });
		expect(posthog.captureImmediate).toHaveBeenCalledWith({
			event: "test_crud_created",
			distinctId: "user-1",
			properties: { item_id: "x" },
			disableGeoip: true,
		});
	});

	it("evaluates flags anonymously before consent, per visitor after, and never records flag events", async () => {
		const analytics = await load("phc_test");
		cookies.set("ph_phc_test_posthog", JSON.stringify({ distinct_id: "visitor-42" }));
		expect(await analytics.isFlagEnabled("home-items-cta")).toBe(true);
		expect(posthog.getFeatureFlag).toHaveBeenLastCalledWith("home-items-cta", "anonymous", {
			sendFeatureFlagEvents: false,
			disableGeoip: true,
		});

		cookies.set("analytics-consent", "granted");
		await analytics.isFlagEnabled("home-items-cta");
		expect(posthog.getFeatureFlag).toHaveBeenLastCalledWith("home-items-cta", "visitor-42", expect.anything());

		// A tampered PostHog cookie falls back to the anonymous id (another flag: answers are cached).
		cookies.set("ph_phc_test_posthog", "{not json");
		await analytics.isFlagEnabled("other-flag");
		expect(posthog.getFeatureFlag).toHaveBeenLastCalledWith("other-flag", "anonymous", expect.anything());
	});

	it("treats off, missing, 'control' and failures as off", async () => {
		const analytics = await load("phc_test");
		// One flag key per case: answers are cached per flag and visitor.
		posthog.getFeatureFlag.mockResolvedValueOnce(false);
		expect(await analytics.isFlagEnabled("f1")).toBe(false);
		posthog.getFeatureFlag.mockResolvedValueOnce(undefined);
		expect(await analytics.isFlagEnabled("f2")).toBe(false);
		posthog.getFeatureFlag.mockResolvedValueOnce("control");
		expect(await analytics.isFlagEnabled("f3")).toBe(false);
		posthog.getFeatureFlag.mockResolvedValueOnce("variant-b");
		expect(await analytics.isFlagEnabled("f4")).toBe(true);
		posthog.getFeatureFlag.mockRejectedValueOnce(new Error("timeout"));
		expect(await analytics.isFlagEnabled("f5")).toBe(false);
	});

	it("caches a remote answer for 30 seconds per flag and visitor", async () => {
		vi.useFakeTimers();
		try {
			const analytics = await load("phc_test");
			posthog.getFeatureFlag.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
			expect(await analytics.isFlagEnabled("cached")).toBe(true);
			expect(await analytics.isFlagEnabled("cached")).toBe(true);
			expect(posthog.getFeatureFlag).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(30_001);
			expect(await analytics.isFlagEnabled("cached")).toBe(false);
			expect(posthog.getFeatureFlag).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("never throws when sending fails", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const analytics = await load("phc_test");
		cookies.set("analytics-consent", "granted");
		posthog.captureImmediate.mockRejectedValueOnce(new Error("network down"));
		await expect(analytics.captureServerEvent("e", "u")).resolves.toBeUndefined();
		expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({
			level: "warn",
			msg: "analytics capture failed",
			error: "network down",
		});
	});
});
