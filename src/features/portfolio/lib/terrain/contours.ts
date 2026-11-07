import type { HeightField } from "./heightfield";

/**
 * Contour lines by marching squares, then smoothed SVG paths.
 *
 * The height field is framed by "sea" (heightfield.ts), so every line closes
 * into a ring. A level's filled region (everything at or above it) is all its
 * rings drawn with `fill-rule="evenodd"`: nested rings alternate inside and
 * outside, which also handles valleys inside a plateau. Coordinates are
 * rounded to whole units, so the server and the browser print the same `d`.
 */

type Point = readonly [number, number];

/** Where the plan's [0, 1] square lands in the drawing. */
export type Projection = { width: number; depth: number; offsetX?: number; offsetY?: number };

/** One contour level: its threshold and its filled region as a path. */
export type ContourLevel = { threshold: number; d: string };

// Edge ids: twice the index of the edge's first corner, + 1 for vertical edges.
const horizontal = (col: number, row: number, width: number) => (row * width + col) * 2;
const vertical = (col: number, row: number, width: number) => (row * width + col) * 2 + 1;

/** The edges each marching-squares case joins, as [from, to] pairs of T(op) R(ight) B(ottom) L(eft). */
type Side = "T" | "R" | "B" | "L";
const CASES: ReadonlyArray<ReadonlyArray<readonly [Side, Side]>> = [
	[],
	[["L", "B"]],
	[["B", "R"]],
	[["L", "R"]],
	[["T", "R"]],
	[], // saddle (5): decided by the centre
	[["T", "B"]],
	[["T", "L"]],
	[["L", "T"]],
	[["T", "B"]],
	[], // saddle (10): decided by the centre
	[["T", "R"]],
	[["L", "R"]],
	[["B", "R"]],
	[["L", "B"]],
	[],
];

/** The rings of one level, in grid coordinates (columns and rows of the framed grid). */
function rings(field: HeightField, threshold: number): Point[][] {
	const width = field.cols + 2;
	const height = field.rows + 2;
	const value = (col: number, row: number) => field.heights[row * width + col] as number;
	const points = new Map<number, Point>();
	const links = new Map<number, number[]>();

	const point = (id: number, side: Side, col: number, row: number) => {
		if (points.has(id)) return id;
		// The two corners at the ends of this edge, and where the threshold crosses between them.
		const [ax, ay, bx, by] =
			side === "T"
				? [col, row, col + 1, row]
				: side === "B"
					? [col, row + 1, col + 1, row + 1]
					: side === "L"
						? [col, row, col, row + 1]
						: [col + 1, row, col + 1, row + 1];
		const va = value(ax, ay);
		const vb = value(bx, by);
		const t = (threshold - va) / (vb - va);
		points.set(id, [ax + (bx - ax) * t, ay + (by - ay) * t]);
		return id;
	};
	const edge = (side: Side, col: number, row: number) =>
		side === "T"
			? point(horizontal(col, row, width), side, col, row)
			: side === "B"
				? point(horizontal(col, row + 1, width), side, col, row)
				: side === "L"
					? point(vertical(col, row, width), side, col, row)
					: point(vertical(col + 1, row, width), side, col, row);
	const link = (a: number, b: number) => {
		links.set(a, [...(links.get(a) ?? []), b]);
		links.set(b, [...(links.get(b) ?? []), a]);
	};

	for (let row = 0; row < height - 1; row++) {
		for (let col = 0; col < width - 1; col++) {
			const tl = value(col, row) >= threshold;
			const tr = value(col + 1, row) >= threshold;
			const br = value(col + 1, row + 1) >= threshold;
			const bl = value(col, row + 1) >= threshold;
			const index = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
			let pairs = CASES[index] ?? [];
			if (index === 5 || index === 10) {
				const centre =
					(value(col, row) + value(col + 1, row) + value(col + 1, row + 1) + value(col, row + 1)) / 4 >= threshold;
				// Joined through the centre, the inside corners form one region and the lines cut off the outside ones.
				const cutTopLeft = (index === 5) === centre;
				pairs = cutTopLeft
					? [
							["L", "T"],
							["B", "R"],
						]
					: [
							["T", "R"],
							["L", "B"],
						];
			}
			for (const [from, to] of pairs) link(edge(from, col, row), edge(to, col, row));
		}
	}

	const visited = new Set<number>();
	const result: Point[][] = [];
	for (const start of links.keys()) {
		if (visited.has(start)) continue;
		const ring: Point[] = [];
		let previous = -1;
		let current = start;
		while (!visited.has(current)) {
			visited.add(current);
			ring.push(points.get(current) as Point);
			const next = (links.get(current) ?? []).find((candidate) => candidate !== previous && !visited.has(candidate));
			if (next === undefined) break;
			previous = current;
			current = next;
		}
		if (ring.length >= 3) result.push(ring);
	}
	return result;
}

/** Squared distance from p to the segment a–b. */
const segmentDistance = (p: Point, a: Point, b: Point) => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = dx * dx + dy * dy;
	const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
	const x = a[0] + t * dx - p[0];
	const y = a[1] + t * dy - p[1];
	return x * x + y * y;
};

/** Ramer–Douglas–Peucker on an open polyline. */
const simplifyLine = (line: Point[], tolerance: number): Point[] => {
	if (line.length < 3) return line;
	const first = line[0] as Point;
	const last = line[line.length - 1] as Point;
	let worst = 0;
	let at = 0;
	for (let index = 1; index < line.length - 1; index++) {
		const distance = segmentDistance(line[index] as Point, first, last);
		if (distance > worst) {
			worst = distance;
			at = index;
		}
	}
	if (worst <= tolerance * tolerance) return [first, last];
	return [...simplifyLine(line.slice(0, at + 1), tolerance).slice(0, -1), ...simplifyLine(line.slice(at), tolerance)];
};

/** A closed ring simplified: split at the point farthest from the first, simplify both halves. */
const simplifyRing = (ring: Point[], tolerance: number): Point[] => {
	const first = ring[0] as Point;
	let far = 0;
	let farthest = 0;
	ring.forEach((p, index) => {
		const dx = p[0] - first[0];
		const dy = p[1] - first[1];
		const distance = dx * dx + dy * dy;
		if (distance > farthest) {
			farthest = distance;
			far = index;
		}
	});
	const a = simplifyLine(ring.slice(0, far + 1), tolerance);
	const b = simplifyLine([...ring.slice(far), first], tolerance);
	return [...a.slice(0, -1), ...b.slice(0, -1)];
};

const area = (ring: ReadonlyArray<Point>) => {
	let sum = 0;
	for (let index = 0; index < ring.length; index++) {
		const [x1, y1] = ring[index] as Point;
		const [x2, y2] = ring[(index + 1) % ring.length] as Point;
		sum += x1 * y2 - x2 * y1;
	}
	return Math.abs(sum) / 2;
};

const n = (value: number) => String(Math.round(value));

/**
 * A ring with every side longer than `maxSide` split into equal parts, so the
 * smoothing rounds a corner only near itself. Land cut off by the frame (a
 * relief's bleed) closes along long straight sides, and smoothed through their
 * midpoints its corners would round across half the drawing.
 */
const densify = (ring: ReadonlyArray<Point>, maxSide: number): Point[] =>
	ring.flatMap((p, index) => {
		const q = ring[(index + 1) % ring.length] as Point;
		const dx = q[0] - p[0];
		const dy = q[1] - p[1];
		// sqrt is exactly rounded everywhere; Math.hypot and ** aren't (the server and the browser must agree).
		const parts = Math.ceil(Math.sqrt(dx * dx + dy * dy) / maxSide);
		return Array.from(
			{ length: parts },
			(_, part): Point => [p[0] + ((q[0] - p[0]) * part) / parts, p[1] + ((q[1] - p[1]) * part) / parts],
		);
	});

/** A closed ring as a smooth path: quadratic curves through the midpoints of its sides. */
const ringPath = (ring: ReadonlyArray<Point>) => {
	const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const last = ring[ring.length - 1] as Point;
	const start = mid(last, ring[0] as Point);
	let d = `M${n(start[0])} ${n(start[1])}`;
	for (let index = 0; index < ring.length; index++) {
		const p = ring[index] as Point;
		const m = mid(p, ring[(index + 1) % ring.length] as Point);
		d += `Q${n(p[0])} ${n(p[1])} ${n(m[0])} ${n(m[1])}`;
	}
	return `${d}Z`;
};

type ContourOptions = {
	/** Thresholds in (0, 1), lowest first. */
	thresholds: ReadonlyArray<number>;
	projection: Projection;
	/** Simplification tolerance, in drawing units. */
	tolerance?: number;
	/** Rings smaller than this (drawing units²) are dropped: specks only add markup. */
	minArea?: number;
	/** Split sides longer than this before smoothing (see densify); off by default. */
	maxSide?: number;
};

/** The filled region of every threshold as a path, in drawing coordinates. Empty levels are left out. */
export function contourLevels(field: HeightField, options: ContourOptions): ContourLevel[] {
	const { width, depth, offsetX = 0, offsetY = 0 } = options.projection;
	const toDrawing = ([col, row]: Point): Point => [
		offsetX + ((col - 1) / (field.cols - 1)) * width,
		offsetY + ((row - 1) / (field.rows - 1)) * depth,
	];
	const tolerance = options.tolerance ?? 1.5;
	const minArea = options.minArea ?? 60;
	return options.thresholds.flatMap((threshold) => {
		const paths = rings(field, threshold)
			.map((ring) => simplifyRing(ring.map(toDrawing), tolerance))
			.filter((ring) => ring.length >= 3 && area(ring) >= minArea)
			.map((ring) => ringPath(options.maxSide ? densify(ring, options.maxSide) : ring));
		return paths.length > 0 ? [{ threshold, d: paths.join("") }] : [];
	});
}
