import { describe, expect, it } from "vitest";
import { RELIEF_PRESETS } from "@/features/portfolio/components/art/relief";
import { COVER_MOTIFS } from "@/features/portfolio/constants";
import { HOME, minutesBehindHome, skyAt, sunTimes } from "@/features/portfolio/lib/daylight";
import { fitEm, fitEmOfWords, widthUnits } from "@/features/portfolio/lib/fit";
import { panorama } from "@/features/portfolio/lib/terrain/panorama";
import { relief } from "@/features/portfolio/lib/terrain/relief";

/** The markup a relief adds to the page: each sheet's path and its attributes. */
const markupBytes = (model: ReturnType<typeof relief>) =>
	model.layers.reduce((sum, layer) => sum + layer.d.length + 110, 0);

/** The x coordinates of a path (every other number after M or Q). */
const xs = (d: string) =>
	[...d.matchAll(/[MQ]([-\d\s]+)/g)].flatMap((match) =>
		(match[1] as string)
			.trim()
			.split(/\s+/)
			.map(Number)
			.filter((_, index) => index % 2 === 0),
	);

/** Every subpath of a closed ring starts with M and ends with Z, and no coordinate is NaN or Infinity. */
const closedRings = (d: string) =>
	(d.match(/M/g)?.length ?? 0) === (d.match(/Z/g)?.length ?? 0) && /^[MQZ\d\s-]+$/.test(d);

describe("relief", () => {
	it("draws the same relief from the same seed, and a different one from another", () => {
		const options = { seed: "AS", landform: "range", ...RELIEF_PRESETS.hero } as const;
		expect(relief(options)).toEqual(relief(options));
		expect(relief(options).layers).not.toEqual(relief({ ...options, seed: "BK" }).layers);
	});

	it("closes every contour and prints only whole numbers", () => {
		for (const motif of [...COVER_MOTIFS, "range"] as const) {
			const model = relief({ seed: motif, landform: motif, ...RELIEF_PRESETS.cover });
			expect(model.layers.length).toBeGreaterThan(2);
			for (const layer of model.layers) expect(closedRings(layer.d)).toBe(true);
		}
	});

	it("keeps the hero under 35 kB of markup and a cover under 8 kB", () => {
		for (const seed of ["AS", "MK", "SG", "आरव"]) {
			expect(markupBytes(relief({ seed, landform: "range", ...RELIEF_PRESETS.hero }))).toBeLessThan(35 * 1024);
		}
		for (const motif of COVER_MOTIFS) {
			for (const seed of ["ledgerline", "haat-bazaar", "sathi"]) {
				expect(markupBytes(relief({ seed, landform: motif, ...RELIEF_PRESETS.cover }))).toBeLessThan(8 * 1024);
			}
		}
	});

	it("runs the hero's low land off both edges of the frame, with no rounded ends inside it", () => {
		const model = relief({ seed: "AS", landform: "range", ...RELIEF_PRESETS.hero });
		const lowest = xs(model.layers.find((layer) => layer.k === 0)?.d ?? "");
		expect(Math.min(...lowest)).toBeLessThan(0);
		expect(Math.max(...lowest)).toBeGreaterThan(model.width);
	});

	it("lifts each level one step above the one below", () => {
		const model = relief({ seed: "AS", landform: "range", ...RELIEF_PRESETS.hero });
		expect(model.layers.map((layer) => layer.k)).toEqual(
			[...model.layers.map((layer) => layer.k)].sort((a, b) => a - b),
		);
		expect(model.height).toBe(30 + model.levels * model.step + RELIEF_PRESETS.hero.depth + model.step);
	});
});

describe("panorama", () => {
	it("raises one summit per project, inside the board, the same every time", () => {
		const slugs = ["ledgerline", "haat-bazaar", "sathi", "pulse"];
		const board = panorama(slugs);
		expect(board).toEqual(panorama(slugs));
		expect(board.peaks.map((peak) => peak.slug)).toEqual(slugs);
		for (const peak of board.peaks) {
			expect(peak.x).toBeGreaterThan(0);
			expect(peak.x).toBeLessThan(1);
			expect(peak.y).toBeGreaterThan(0);
			expect(peak.y).toBeLessThan(1);
		}
		// Printed like the hero: closed sheets, within the hero's budget.
		expect(board.relief.layers.length).toBeGreaterThan(4);
		for (const layer of board.relief.layers) expect(closedRings(layer.d)).toBe(true);
		expect(markupBytes(board.relief)).toBeLessThan(35 * 1024);
		// Summits stand left to right in the projects' order.
		expect(board.peaks.map((peak) => peak.x)).toEqual([...board.peaks.map((peak) => peak.x)].sort((a, b) => a - b));
	});
});

describe("daylight", () => {
	/** "HH:MM" in Kathmandu for an instant. */
	const local = (time: number) => {
		const minutes = Math.round((time / 60_000 + HOME.utcOffsetMinutes) % 1440);
		return minutes;
	};
	const clock = (hh: number, mm: number) => hh * 60 + mm;

	it("puts sunrise and sunset within two minutes of the published times for Kathmandu", () => {
		// NOAA / timeanddate.com for Kathmandu (27.72° N, 85.32° E), local time.
		const published: ReadonlyArray<readonly [string, number, number]> = [
			["2026-10-23", clock(6, 8), clock(17, 27)],
			["2026-06-21", clock(5, 9), clock(19, 2)],
			["2026-12-21", clock(6, 50), clock(17, 13)],
		];
		for (const [day, sunrise, sunset] of published) {
			const times = sunTimes(Date.parse(`${day}T12:00:00+05:45`));
			expect(Math.abs(local(times.sunrise) - sunrise)).toBeLessThanOrEqual(2);
			expect(Math.abs(local(times.sunset) - sunset)).toBeLessThanOrEqual(2);
		}
	});

	it("tells the phases of the day apart, with alpenglow at first and last light", () => {
		const at = (time: string) => skyAt(Date.parse(`2026-10-23T${time}:00+05:45`));
		expect(at("05:30")).toMatchObject({ phase: "night", alpenglow: false, sun: null });
		expect(at("06:15")).toMatchObject({ phase: "dawn", alpenglow: true });
		expect(at("06:15").sun?.x).toBeGreaterThan(80);
		// At noon the sun is behind someone looking north at the range.
		expect(at("12:00")).toMatchObject({ phase: "day", alpenglow: false, sun: null });
		expect(at("17:15")).toMatchObject({ phase: "dusk", alpenglow: true });
		expect(at("17:15").sun?.x).toBeLessThan(20);
		expect(at("23:00").phase).toBe("night");
	});

	it("knows how far the visitor's clock is from Kathmandu's", () => {
		expect(minutesBehindHome(60)).toBe(285);
		expect(minutesBehindHome(345)).toBe(0);
		expect(minutesBehindHome(600)).toBe(-255);
	});
});

describe("fit", () => {
	it("counts Devanagari by what takes width: vowel signs above add nothing, half forms half", () => {
		expect(widthUnits("Ana")).toBe(3);
		expect(widthUnits("आरव")).toBe(3);
		// श ् र े: a half श, a full र, a sign above it.
		expect(widthUnits("श्रे")).toBe(1.5);
	});

	it("estimates wide enough that a name never overflows, and the widest word for phones", () => {
		expect(fitEm("आरव श्रेष्ठ")).toBeGreaterThan(3.92);
		expect(fitEmOfWords("Aarav Shrestha")).toBe(fitEm("Shrestha"));
	});

	it("fits Latin within a few percent of its width in Eczar 700, measured in Chrome", () => {
		// Rendered widths in em at hm-name's tracking (the space is FittedName's 0.24em margin).
		const measured = { "Aarav Shrestha": 6.925, Shrestha: 4.024, "hello@example.com": 9.122, "Li Wei": 2.702 };
		for (const [text, width] of Object.entries(measured)) {
			expect(fitEm(text)).toBeGreaterThanOrEqual(width);
			expect(fitEm(text)).toBeLessThanOrEqual(width * 1.1);
		}
		expect(fitEm("Aarav Shrestha") / measured["Aarav Shrestha"]).toBeLessThan(1.03);
		// An accent adds nothing; an unknown letter counts as an average one.
		expect(fitEm("Zoë")).toBe(fitEm("Zoe"));
		expect(fitEm("Ω")).toBe(0.6);
	});
});
