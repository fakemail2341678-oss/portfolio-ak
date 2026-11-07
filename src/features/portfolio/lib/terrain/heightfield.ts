import type { CoverMotif } from "../../constants";
import { seededRandom } from "../seeded-random";
import { fbm, type Noise2, ridged, simplex2 } from "./noise";

/**
 * Height fields for the generated mountains: a grid of heights in [0, 1] over
 * the plan (x across, y from the back at 0 to the front at 1), framed by one
 * row of "sea" (−1) on every side so every contour line closes inside the
 * frame (contours.ts).
 *
 * Mountains are seeded peaks: cones with concave slopes (steep near the top,
 * gentle at the foot), roughened by ridged noise and joined by saddles. The
 * hero is a range running across the frame; a project cover takes its
 * landform from the project's motif. Only exact arithmetic is used (no
 * trigonometry, no fractional powers), so every engine computes the same field.
 */

export type Landform = "range" | CoverMotif;

export type HeightField = {
	/** Samples per row and per column, without the frame. */
	cols: number;
	rows: number;
	/** (cols + 2) × (rows + 2) heights, row by row, the frame included. */
	heights: Float64Array;
};

type Random = ReturnType<typeof seededRandom>;
/** Height at a point of the plan, x and y in [0, 1]. */
export type Shape = (x: number, y: number) => number;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = clamp((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
};
/** A triangle wave of period 1 in [0, 1]. */
const triangle = (value: number) => {
	const phase = value - Math.floor(value);
	return 1 - Math.abs(2 * phase - 1);
};

export type Peak = { x: number; y: number; height: number; rx: number; ry: number };

/**
 * A peak's height at (x, y): a pyramid with slightly rounded faces (half the
 * diamond distance, half the round one), so its contours have corners where
 * the ridges run down. Slopes steepen toward the summit.
 */
const peakAt = (peak: Peak, x: number, y: number) => {
	const dx = (x - peak.x) / peak.rx;
	const dy = (y - peak.y) / peak.ry;
	const distance = 0.55 * (Math.abs(dx) + Math.abs(dy)) + 0.45 * Math.sqrt(dx * dx + dy * dy);
	const slope = clamp(1 - distance);
	return peak.height * slope * (0.55 + 0.45 * slope);
};

/** The highest of several peaks, roughened by ridged noise (crests and gullies). */
export const peaks =
	(noise: Noise2, list: ReadonlyArray<Peak>, roughness = 0.22, warp = 0.02): Shape =>
	(x, y) => {
		// Domain warping bends the cones into spurs and gullies.
		const wx = x + warp * noise(x * 4 + 31, y * 4);
		const wy = y + warp * 1.6 * noise(x * 4, y * 4 + 17);
		let height = 0;
		for (const peak of list) height = Math.max(height, peakAt(peak, wx, wy));
		return height * (1 - roughness + roughness * ridged(noise, x * 6, y * 4, 3));
	};

/** Where land fades out at the frame (0 at the edge, 1 inside `margin`). */
const edgeTaper = (x: number, y: number, margin: number) =>
	smoothstep(0, margin, x) * smoothstep(0, margin, 1 - x) * smoothstep(0, margin, y) * smoothstep(0, margin, 1 - y);

const LANDFORMS: Record<Landform, (noise: Noise2, random: Random) => Shape> = {
	// The Himalaya from the south: a row of summits along a crest at the back, saddles between
	// them, foothills in front. The front edge runs out of the frame, so the range stands on the page.
	range: (noise, random) => {
		const count = 6;
		const tallest = random.int(1, count - 2);
		const list: Peak[] = Array.from({ length: count }, (_, index) => ({
			x: 0.04 + (0.92 * (index + random.between(0.3, 0.7))) / count,
			y: index % 2 === 0 ? random.between(0.3, 0.4) : random.between(0.48, 0.58),
			height: index === tallest ? 1 : index % 2 === 0 ? random.between(0.7, 0.9) : random.between(0.5, 0.68),
			rx: random.between(0.12, 0.17),
			ry: random.between(0.36, 0.44),
		}));
		// Each summit gets a lower shoulder on one side, so no two mountains are the same cone.
		const shoulders = list.map((peak) => ({
			...peak,
			x: peak.x + (random.chance(0.5) ? 1 : -1) * peak.rx * random.between(0.45, 0.7),
			y: peak.y + random.between(0.02, 0.08),
			height: peak.height * random.between(0.55, 0.75),
			rx: peak.rx * 0.7,
			ry: peak.ry * 0.75,
		}));
		// Rougher and more warped than a cover: crests break into spurs and gullies, not stacked discs.
		const summits = peaks(noise, [...list, ...shoulders], 0.27, 0.022);
		// Foothills along the front: the lowest level runs the full width, so the range stands on ground.
		return (x, y) => Math.max(summits(x, y), smoothstep(0.5, 0.72, y) * (0.11 + 0.04 * fbm(noise, x * 6, y * 4, 2)));
	},
	// Rice terraces: a broad hill cut into steps all the way up.
	grid: (noise, random) => {
		const hill = peaks(noise, [{ x: random.between(0.42, 0.58), y: 0.55, height: 1, rx: 0.62, ry: 0.55 }], 0.08);
		return (x, y) => {
			const height = hill(x, y);
			return height - 0.07 * triangle(height * 9);
		};
	},
	// A lone peak.
	orbit: (noise, random) =>
		peaks(noise, [{ x: random.between(0.42, 0.58), y: 0.5, height: 1, rx: 0.5, ry: 0.55 }], 0.18),
	// Foothills: low, rounded and many.
	waves: (noise, random) =>
		peaks(
			noise,
			Array.from({ length: 6 }, () => ({
				x: random.between(0.12, 0.88),
				y: random.between(0.2, 0.85),
				height: random.between(0.35, 0.6),
				rx: random.between(0.2, 0.3),
				ry: random.between(0.25, 0.35),
			})),
			0.12,
		),
	// A massif: a broad plateau with steep sides.
	blocks: (noise) => (x, y) => {
		const plateau = clamp(1.8 * (0.5 + 0.55 * fbm(noise, x * 1.6, y * 1.6, 3)) - 0.5);
		return plateau * edgeTaper(x, y, 0.16);
	},
	// One sharp summit (the glyph is its label).
	type: (noise, random) =>
		peaks(noise, [{ x: random.between(0.45, 0.55), y: 0.5, height: 1, rx: 0.42, ry: 0.5 }], 0.35),
	// A glacier valley between two ridges, opening toward the front.
	terrain: (noise, random) => {
		const sides = peaks(noise, [
			{ x: 0.16, y: random.between(0.35, 0.5), height: 1, rx: 0.32, ry: 0.85 },
			{ x: 0.84, y: random.between(0.35, 0.5), height: random.between(0.75, 0.95), rx: 0.32, ry: 0.85 },
		]);
		return (x, y) => sides(x, y) * (0.55 + 0.45 * smoothstep(0, 0.35, Math.abs(x - 0.5)));
	},
	// A pass: two peaks and the saddle between them.
	signal: (noise, random) =>
		peaks(noise, [
			{ x: 0.3, y: 0.5, height: 1, rx: random.between(0.3, 0.36), ry: 0.5 },
			{ x: 0.72, y: 0.48, height: random.between(0.78, 0.9), rx: random.between(0.28, 0.33), ry: 0.48 },
		]),
};

/** The heights of `landform` for `seed`, normalised so the highest point is 0.97. */
export function heightField(seed: string, landform: Landform, cols: number, rows: number): HeightField {
	const key = `${landform}:${seed}`;
	return sampleField(LANDFORMS[landform](simplex2(key), seededRandom(key)), cols, rows);
}

/** A shape sampled on a cols × rows grid inside its frame of sea, normalised so the highest point is 0.97. */
export function sampleField(shape: Shape, cols: number, rows: number): HeightField {
	const width = cols + 2;
	const heights = new Float64Array(width * (rows + 2)).fill(-1);
	let max = 0;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const value = shape(col / (cols - 1), row / (rows - 1));
			heights[(row + 1) * width + col + 1] = value;
			if (value > max) max = value;
		}
	}
	const scale = max > 0 ? 0.97 / max : 1;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const index = (row + 1) * width + col + 1;
			heights[index] = (heights[index] as number) * scale;
		}
	}
	return { cols, rows, heights };
}
