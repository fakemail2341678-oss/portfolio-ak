import { contourLevels } from "./contours";
import { type HeightField, heightField, type Landform } from "./heightfield";

/**
 * A stepped relief: the contour levels of a landform seen at an angle, each
 * level lifted by `step` above the one below, like a model cut from stacked
 * sheets (or a woodblock print, one block per altitude). Layer k sits at its
 * risen position; the motion (himal.css) starts it flat and lifts it.
 */

export type ReliefLayer = {
	/** Altitude index: 0 is the lowest level drawn. */
	k: number;
	d: string;
};

export type Relief = {
	width: number;
	height: number;
	/** How far each level is lifted above the one below, in drawing units. */
	step: number;
	levels: number;
	layers: ReliefLayer[];
};

export type ReliefOptions = {
	seed: string;
	landform: Landform;
	/** Drawing width; the plan's depth is foreshortened to `depth` (the viewing angle). */
	width: number;
	depth: number;
	/** Grid resolution of the height field. */
	cols: number;
	rows: number;
	levels: number;
	step: number;
	/** Empty space above the highest level (the sky). */
	headroom?: number;
	tolerance?: number;
	/** Rings smaller than this are dropped (drawing units²), at every level: a speck of a summit floats above its peak. */
	minArea?: number;
	/**
	 * The share of the plan drawn beyond each side edge, out of view: the land
	 * closes out there, so its lowest levels run off the frame instead of
	 * ending in rounded caps.
	 */
	bleed?: number;
};

/** The thresholds of `levels` contour levels, from just above sea level to just below the summit. */
export const thresholds = (levels: number) =>
	Array.from({ length: levels }, (_, k) => 0.06 + (0.88 * k) / Math.max(1, levels - 1));

/** How a relief is laid out: everything but what it is a relief of. */
export type ReliefLayout = Omit<ReliefOptions, "seed" | "landform">;

/** The plan's drawn width (wider than the drawing by the bleed) and its left edge. */
const plan = ({ width, bleed = 0 }: ReliefLayout) => {
	const planWidth = width / (1 - 2 * bleed);
	return { planWidth, left: -bleed * planWidth };
};

/** Where the plan point (x, y), both in [0, 1], stands on level k, in drawing units. */
export function planPoint(layout: ReliefLayout, x: number, y: number, k: number): readonly [number, number] {
	const { planWidth, left } = plan(layout);
	const top = (layout.headroom ?? 0) + layout.levels * layout.step;
	return [left + x * planWidth, top - k * layout.step + y * layout.depth];
}

/** The highest level a height reaches (−1 below the lowest). */
export const levelOf = (height: number, levels: number) => thresholds(levels).filter((t) => t <= height).length - 1;

/** The relief of any height field: relief() draws a landform's, the work index's board its own. */
export function reliefOf(field: HeightField, layout: ReliefLayout): Relief {
	const { width, depth, levels, step, headroom = 0, minArea } = layout;
	const top = headroom + levels * step;
	const { planWidth, left } = plan(layout);
	const layers = thresholds(levels).flatMap((threshold, k) =>
		contourLevels(field, {
			thresholds: [threshold],
			projection: { width: planWidth, depth, offsetX: left, offsetY: top - k * step },
			tolerance: layout.tolerance,
			minArea,
			// Land cut off at the bleed closes along long straight sides: keep their corners sharp.
			maxSide: (layout.bleed ?? 0) > 0 ? 64 : undefined,
		}).map(({ d }) => ({ k, d })),
	);
	return { width, height: top + depth + step, step, levels, layers };
}

export function relief({ seed, landform, ...layout }: ReliefOptions): Relief {
	return reliefOf(heightField(seed, landform, layout.cols, layout.rows), layout);
}

/**
 * Reliefs are pure functions of their options, and a page draws the same few
 * over and over (the hero on every visit, each project's cover), so they're
 * kept: the server computes each once, and the browser once per page load.
 */
const cache = new Map<string, Relief>();
const CACHE_SIZE = 64;

export function cachedRelief(options: ReliefOptions): Relief {
	const key = JSON.stringify(options);
	const hit = cache.get(key);
	if (hit) return hit;
	const value = relief(options);
	if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
	cache.set(key, value);
	return value;
}

/** The height a relief is drawn to: a strip of the foothills hangs below the frame, so the range stands on the page. */
export const viewHeightOf = (model: Relief) => model.height - model.step * 1.6;
