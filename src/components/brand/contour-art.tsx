import { cn } from "@/lib/utils";

/**
 * Generative contour lines, like a topographic map of a ridge: two summits, each
 * ringed by contours that merge into wider rings around both. Deterministic for a
 * seed (the same SVG on the server and in the browser, in every render), pure SVG
 * with no script, and decorative (aria-hidden). Every fifth line is an "index
 * contour", drawn heavier, as on survey maps. It takes its colour from `currentColor`.
 *
 * Used by the sign-in pages' brand panel; the portfolio's art direction (Task 40)
 * can reuse it.
 */

const WIDTH = 600;
const HEIGHT = 800;
const POINTS = 28;

/** mulberry32: a tiny seeded PRNG, so the art is the same for a seed everywhere. */
const random = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

type Point = readonly [number, number];
type Wobble = ReadonlyArray<{ amplitude: number; frequency: number; phase: number }>;

/** Whole units: invisible at this scale, and it keeps the server-rendered SVG small. */
const round = Math.round;

/**
 * A closed ring around `center`: an ellipse (radii `rx` along `rotation`, `ry` across it)
 * bent by a wobble shared by every ring of the same hill, so neighbours never cross.
 */
const ring = (center: Point, rx: number, ry: number, rotation: number, wobble: Wobble): Point[] =>
	Array.from({ length: POINTS }, (_, index) => {
		const angle = (index / POINTS) * Math.PI * 2;
		const bend = wobble.reduce((sum, w) => sum + w.amplitude * Math.sin(w.frequency * angle + w.phase), 1);
		const [x, y] = [Math.cos(angle) * rx * bend, Math.sin(angle) * ry * bend];
		return [
			center[0] + x * Math.cos(rotation) - y * Math.sin(rotation),
			center[1] + x * Math.sin(rotation) + y * Math.cos(rotation),
		] as const;
	});

/** A smooth closed path through the points (Catmull-Rom as cubic Béziers). */
const smoothPath = (points: ReadonlyArray<Point>) => {
	const at = (index: number) => points[(index + points.length) % points.length] as Point;
	let d = `M${round(at(0)[0])} ${round(at(0)[1])}`;
	for (let index = 0; index < points.length; index++) {
		const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += `C${round(c1[0] ?? 0)} ${round(c1[1] ?? 0)} ${round(c2[0] ?? 0)} ${round(c2[1] ?? 0)} ${round(p2[0])} ${round(p2[1])}`;
	}
	return `${d}Z`;
};

export type ContourLine = { d: string; index: boolean };

/** The contour lines for a seed, in drawing order. Exported for tests. */
export function contourLines(seed: number): ContourLine[] {
	const next = random(seed);
	const between = (min: number, max: number) => min + next() * (max - min);
	const wobble = (strength: number): Wobble =>
		[2, 3, 5].map((frequency) => ({
			amplitude: (between(0.4, 1) * strength) / (frequency / 2),
			frequency,
			phase: between(0, Math.PI * 2),
		}));

	const spacing = 22;
	const middle: Point = [between(0.4, 0.6) * WIDTH, between(0.38, 0.55) * HEIGHT];
	const angle = between(-0.6, 0.6);
	const half = between(90, 130);
	const summits: Point[] = [-1, 1].map(
		(side) => [middle[0] + Math.cos(angle) * half * side, middle[1] + Math.sin(angle) * half * side] as const,
	);
	const lines: ContourLine[] = [];
	let level = 0;
	let reach = 0;

	// Each summit's own rings, smallest first, while they stay apart.
	summits.forEach((summit, which) => {
		const shape = wobble(0.09);
		const rings = Math.floor((half * (which === 0 ? 0.82 : 0.68)) / spacing);
		reach = Math.max(reach, rings * spacing * 1.2);
		for (let n = 1; n <= rings; n++) {
			lines.push({ d: smoothPath(ring(summit, n * spacing, n * spacing, 0, shape)), index: n % 5 === 0 });
		}
		level = Math.max(level, rings);
	});
	// Then the rings around both: ellipses along the ridge that hug the summits' rings
	// (the saddle between them), widening out past the edges of the frame.
	const shape = wobble(0.035);
	// Out to the frame's farthest corner (rings past it are never seen).
	const outer = Math.max(
		...[0, WIDTH].flatMap((x) => [0, HEIGHT].map((y) => Math.hypot(x - middle[0], y - middle[1]))),
	);
	for (let gap = spacing; reach + gap < outer * 0.92; gap += spacing) {
		level += 1;
		const rx = (half + reach + gap) / 0.92;
		const ry = (reach + gap) / 0.92;
		lines.push({ d: smoothPath(ring(middle, rx, ry, angle, shape)), index: level % 5 === 0 });
	}
	return lines;
}

export function ContourArt({ seed = 8848, className }: { seed?: number; className?: string }) {
	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio="xMidYMid slice"
			fill="none"
			stroke="currentColor"
			aria-hidden="true"
			className={cn("pointer-events-none", className)}
		>
			{contourLines(seed).map((line, index) => (
				<path
					// The lines are fixed for a seed and never reorder.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above.
					key={index}
					d={line.d}
					strokeWidth={line.index ? 1.4 : 0.7}
					strokeOpacity={line.index ? 0.75 : 0.4}
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</svg>
	);
}
