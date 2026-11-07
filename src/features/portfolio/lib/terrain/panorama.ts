import { seededRandom } from "../seeded-random";
import { type Peak, peaks, sampleField } from "./heightfield";
import { fbm, simplex2 } from "./noise";
import { levelOf, planPoint, type Relief, type ReliefLayout, reliefOf, thresholds, viewHeightOf } from "./relief";

/**
 * The work index's panorama board (decision 0180): the range printed like the
 * hero's, in stacked sheets, with every published project one summit along
 * the crest, its height and shape grown from its slug, and a board naming
 * each summit as at a viewpoint. Exact arithmetic only, coordinates rounded:
 * the same markup on the server and in the browser.
 */

export const PANORAMA_LAYOUT = {
	width: 1600,
	depth: 200,
	cols: 120,
	rows: 34,
	levels: 9,
	step: 30,
	headroom: 0,
	tolerance: 1.8,
	minArea: 2400,
	bleed: 0.04,
} as const satisfies ReliefLayout;

export type PanoramaPeak = {
	slug: string;
	/** The summit's position, as fractions of the drawing's width and height. */
	x: number;
	y: number;
};

export type Panorama = { relief: Relief; peaks: PanoramaPeak[] };

const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
};

function draw(slugs: ReadonlyArray<string>, layout: ReliefLayout): Panorama {
	const noise = simplex2(`panorama:${slugs.join(",")}`);
	const count = Math.max(1, slugs.length);
	const bleed = layout.bleed ?? 0;
	// One summit per project, spread across the visible width, alternating a little in depth.
	const summits: Peak[] = slugs.map((slug, index) => {
		const random = seededRandom(`peak:${slug}`);
		return {
			x: bleed + ((1 - 2 * bleed) * (index + 0.5 + random.between(-0.15, 0.15))) / count,
			y: index % 2 === 0 ? random.between(0.3, 0.38) : random.between(0.4, 0.48),
			height: random.between(0.62, 1),
			rx: random.between(0.55, 0.8) / count,
			ry: random.between(0.42, 0.52),
		};
	});
	const crest = peaks(noise, summits, 0.28, 0.022);
	const shape = (x: number, y: number) =>
		// The foothills stay between the first two levels (0.06 and 0.17, after scaling): one even band, no blotches.
		Math.max(crest(x, y), smoothstep(0.42, 0.68, y) * (0.11 + 0.025 * fbm(noise, x * 6, y * 4, 2)));
	const field = sampleField(shape, layout.cols, layout.rows);
	const model = reliefOf(field, layout);
	const height = viewHeightOf(model);
	const at = (col: number, row: number) => field.heights[(row + 1) * (layout.cols + 2) + col + 1] as number;
	// A cap's area, roughly: the samples at or above a threshold near the summit, times one cell's area.
	const cellArea = (layout.width / (1 - 2 * bleed) / (layout.cols - 1)) * (layout.depth / (layout.rows - 1));
	const capArea = (layout.minArea ?? 0) * 1.2;
	const cellsAbove = (col0: number, row0: number, threshold: number) => {
		let count = 0;
		for (let row = Math.max(0, row0 - 5); row <= Math.min(layout.rows - 1, row0 + 5); row++) {
			for (let col = Math.max(0, col0 - 5); col <= Math.min(layout.cols - 1, col0 + 5); col++) {
				if (at(col, row) >= threshold) count++;
			}
		}
		return count;
	};
	return {
		relief: model,
		peaks: slugs.map((slug, index) => {
			const summit = summits[index] as Peak;
			// The top of the mountain: the highest sample near the summit (warping and roughness move it a little).
			let best = { col: 0, row: 0, height: -1 };
			const col0 = Math.round(summit.x * (layout.cols - 1));
			const row0 = Math.round(summit.y * (layout.rows - 1));
			for (let row = Math.max(0, row0 - 3); row <= Math.min(layout.rows - 1, row0 + 3); row++) {
				for (let col = Math.max(0, col0 - 3); col <= Math.min(layout.cols - 1, col0 + 3); col++) {
					if (at(col, row) > best.height) best = { col, row, height: at(col, row) };
				}
			}
			// The highest sheet drawn there: a cap smaller than the speck filter's limit isn't drawn, so step down past it.
			let k = Math.max(0, levelOf(best.height, layout.levels));
			while (k > 0 && cellsAbove(best.col, best.row, thresholds(layout.levels)[k] as number) * cellArea < capArea) k--;
			const [x, y] = planPoint(layout, best.col / (layout.cols - 1), best.row / (layout.rows - 1), k);
			return { slug, x: Math.round((x / model.width) * 1000) / 1000, y: Math.round((y / height) * 1000) / 1000 };
		}),
	};
}

/** Boards are pure functions of their slugs; the index draws the same one on every visit. */
const cache = new Map<string, Panorama>();

export function panorama(slugs: ReadonlyArray<string>, layout: ReliefLayout = PANORAMA_LAYOUT): Panorama {
	const key = JSON.stringify([slugs, layout]);
	const hit = cache.get(key);
	if (hit) return hit;
	const value = draw(slugs, layout);
	if (cache.size >= 8) cache.delete(cache.keys().next().value as string);
	cache.set(key, value);
	return value;
}
