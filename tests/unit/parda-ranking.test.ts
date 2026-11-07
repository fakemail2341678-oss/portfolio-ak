import { describe, expect, it } from "vitest";
import {
	adsPenalty,
	effectiveAdaptive,
	effectiveHeight,
	explorePick,
	factorsOf,
	okOrder,
	qualityFactor,
	qualityLabel,
	RANKING,
	type RankRow,
	type SourceMeasures,
	scoreOf,
	scoreSource,
	skipLast,
	slowOrder,
	smoothnessFactor,
	speedFactor,
	watchOrders,
} from "@/server/parda/player/ranking";

/**
 * Task 65a's score and orders (PLAN 12.5, "Source ranking"; decision 0238), pure: each
 * factor and its floor, neutral values, the probe standing in under 20 plays, the seed
 * fallback, pins, the slow order, skips and exploration.
 */

const measures = (extra: Partial<SourceMeasures> = {}): SourceMeasures => ({
	adapter: "parda",
	plays: 30,
	failed: 0,
	startMedianMs: 0,
	stallMs: 0,
	watchedS: 1800,
	probeRuns: 0,
	probeAlive: 0,
	probeHeight: null,
	probePopups: 0,
	probeClicks: 0,
	quality: null,
	...extra,
});

const row = (id: string, extra: Partial<RankRow> = {}): RankRow => ({
	id,
	position: Number(id),
	pinned: false,
	adaptive: false,
	score: null,
	plays: 0,
	measurable: true,
	...extra,
});

describe("the factors", () => {
	it("quality: 1080p or more is 1, 720p 0.67, 480p 0.44, unknown 0.5", () => {
		expect(qualityFactor(2160)).toBe(1);
		expect(qualityFactor(1080)).toBe(1);
		expect(qualityFactor(720)).toBe(0.67);
		expect(qualityFactor(480)).toBe(0.44);
		expect(qualityFactor(null)).toBe(0.5);
	});

	it("smoothness: 1 − stall seconds per watched minute ÷ 6, floor 0, neutral with nothing watched", () => {
		expect(smoothnessFactor(0, 600)).toBe(1);
		// 30 s stalled over 10 minutes: 3 s a minute, half way to the floor.
		expect(smoothnessFactor(30_000, 600)).toBeCloseTo(0.5);
		expect(smoothnessFactor(120_000, 600)).toBe(0);
		expect(smoothnessFactor(5_000, 0)).toBe(RANKING.neutral);
	});

	it("speed: 1 − median start ÷ 20 s, floor 0, neutral without a start", () => {
		expect(speedFactor(0)).toBe(1);
		expect(speedFactor(5_000)).toBeCloseTo(0.75);
		expect(speedFactor(25_000)).toBe(0);
		expect(speedFactor(null)).toBe(RANKING.neutral);
	});

	it("ads: 0.1 × popups per click, nothing without clicks", () => {
		expect(adsPenalty(3, 6)).toBe(0.05);
		expect(adsPenalty(5, 0)).toBe(0);
	});

	it("availability is 1 − the failure rate, and the score puts them together", () => {
		const factors = factorsOf(measures({ plays: 40, failed: 10, startMedianMs: 10_000, probeHeight: 720 }));
		expect(factors).toMatchObject({ availability: 0.75, quality: 0.67, smoothness: 1, speed: 0.5, from: "viewers" });
		// 0.75 × (0.4 × 0.67 + 0.4 × 1 + 0.2 × 0.5)
		expect(scoreOf(factors ?? ({} as never))).toBeCloseTo(0.576);
	});
});

describe("the data a score needs", () => {
	it("with 20 plays or more, viewers decide availability: a probe failure alone never demotes", () => {
		const factors = factorsOf(measures({ plays: 20, failed: 0, probeRuns: 3, probeAlive: 0 }));
		expect(factors?.availability).toBe(1);
		expect(factors?.from).toBe("viewers");
	});

	it("under 20 plays, the probe's numbers and neutral values", () => {
		const factors = factorsOf(
			measures({ plays: 19, failed: 19, startMedianMs: 1, probeRuns: 4, probeAlive: 3, probeHeight: 1080 }),
		);
		expect(factors).toEqual({
			availability: 0.75,
			quality: 1,
			smoothness: RANKING.neutral,
			speed: RANKING.neutral,
			ads: 0,
			from: "probe",
		});
	});

	it("with neither, no score: the source keeps its seed position", () => {
		expect(scoreSource(measures({ plays: 5 }))).toBeNull();
	});

	it("a source that reports nothing is never scored", () => {
		expect(scoreSource(measures({ adapter: "none", plays: 100, probeRuns: 3, probeAlive: 3 }))).toBeNull();
	});

	it("the admin's quality wins over the probe's, and so does their adaptive flag", () => {
		expect(factorsOf(measures({ quality: 720, probeHeight: 1080 }))?.quality).toBe(0.67);
		expect(effectiveHeight(720, 1080)).toBe(720);
		expect(effectiveHeight(null, 1080)).toBe(1080);
		expect(effectiveHeight(null, undefined)).toBeNull();
		expect(effectiveAdaptive(false, true)).toBe(false);
		expect(effectiveAdaptive(null, true)).toBe(true);
		expect(effectiveAdaptive(null, null)).toBe(false);
		expect(qualityLabel(1080)).toBe("1080p");
		expect(qualityLabel(null)).toBeNull();
	});
});

describe("the measured table in PLAN 12.4", () => {
	// One run each on three titles, 10 viewer plays each, a few clicks per title.
	const table: Record<string, SourceMeasures> = {
		// 3.8–5.9 s, 1080p, no stalls, 0–1 popups per 3 clicks.
		vidy: measures({ startMedianMs: 5_800, probeHeight: 1080, probePopups: 1, probeClicks: 6 }),
		// 2–4 s after a click, mostly 720p, no stalls, no popups.
		viduki: measures({ startMedianMs: 3_000, probeHeight: 720, probePopups: 0, probeClicks: 6 }),
		// 6–15 s, 1080p, a 3.8 s stall on TV, 1 popup per 3 clicks.
		xpass: measures({
			startMedianMs: 10_000,
			probeHeight: 1080,
			stallMs: 3_800,
			watchedS: 600,
			probePopups: 2,
			probeClicks: 6,
		}),
		// 2–4 s, 1080p and 360p, a 5.5 s stall, anime unavailable, 1–2 popups per 3 clicks.
		vidrock: measures({
			failed: 10,
			startMedianMs: 3_000,
			probeHeight: 720,
			stallMs: 5_500,
			watchedS: 600,
			probePopups: 3,
			probeClicks: 6,
		}),
	};

	it("ranks Vidy first", () => {
		const scores = Object.entries(table).map(([name, each]) => ({ name, score: scoreSource(each) ?? 0 }));
		const ranked = scores.sort((a, b) => b.score - a.score).map((each) => each.name);
		expect(ranked[0]).toBe("vidy");
		expect(ranked.at(-1)).toBe("vidrock");
	});
});

describe("the orders", () => {
	it("manual: pinned first, then the admin's order", () => {
		const rows = [row("1", { score: 0.1 }), row("2", { score: 0.9 }), row("3", { pinned: true, score: 0 })];
		expect(okOrder(rows, "manual")).toEqual(["3", "1", "2"]);
	});

	it("automatic: by score, pinned still first, and an unscored row keeps its seed slot", () => {
		const rows = [
			row("1", { score: 0.2 }),
			row("2"),
			row("3", { score: 0.9 }),
			row("4", { score: 0.5 }),
			row("5", { pinned: true, score: 0.1 }),
		];
		expect(okOrder(rows, "auto")).toEqual(["5", "3", "2", "4", "1"]);
	});

	it("ties keep the seed order", () => {
		expect(okOrder([row("2", { score: 0.5 }), row("1", { score: 0.5 })], "auto")).toEqual(["1", "2"]);
	});

	it("slow: adaptive sources first, each part keeping the order; pins still lead", () => {
		const rows = [row("1"), row("2", { adaptive: true }), row("3"), row("4", { adaptive: true, pinned: true })];
		const ok = okOrder(rows, "auto");
		expect(ok).toEqual(["4", "1", "2", "3"]);
		expect(slowOrder(ok, rows)).toEqual(["4", "2", "1", "3"]);
	});

	it("sources failing on this title go last", () => {
		expect(skipLast(["1", "2", "3"], new Set(["1"]))).toEqual(["2", "3", "1"]);
	});
});

describe("exploration", () => {
	const dice = (...values: number[]) => {
		let index = 0;
		return () => values[index++] ?? 0.99;
	};

	it("picks an eligible source 5% of the time", () => {
		expect(explorePick(["a", "b"], { random: dice(0.04, 0.6) })).toBe("b");
		expect(explorePick(["a", "b"], { random: dice(0.05) })).toBeNull();
		expect(explorePick([], { random: dice(0) })).toBeNull();
	});

	const measured = [
		row("1", { score: 0.9, plays: 50 }),
		row("2", { score: 0.8, plays: 50 }),
		row("3", { plays: 3 }),
		row("4", { plays: 0, measurable: false }),
	];

	it("starts a play on a source short of data, in both orders", () => {
		expect(watchOrders(measured, { mode: "auto", skipped: new Set(), random: dice(0, 0) })).toEqual({
			ok: ["3", "1", "2", "4"],
			slow: ["3", "1", "2", "4"],
		});
	});

	it("never in manual order, past a pin, before any source has data, or onto a skipped or unmeasurable source", () => {
		const zero = () => 0;
		expect(watchOrders(measured, { mode: "manual", skipped: new Set(), random: zero }).ok[0]).toBe("1");
		const pinned = measured.map((each) => (each.id === "2" ? { ...each, pinned: true } : each));
		expect(watchOrders(pinned, { mode: "auto", skipped: new Set(), random: zero }).ok[0]).toBe("2");
		const fresh = [row("1", { plays: 5 }), row("2", { plays: 3 })];
		expect(watchOrders(fresh, { mode: "auto", skipped: new Set(), random: zero }).ok).toEqual(["1", "2"]);
		expect(watchOrders(measured, { mode: "auto", skipped: new Set(["3"]), random: zero }).ok).toEqual([
			"1",
			"2",
			"4",
			"3",
		]);
	});
});
