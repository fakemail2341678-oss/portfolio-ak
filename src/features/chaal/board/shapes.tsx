import type { Square } from "./fen";
import { cellOf, type Orientation } from "./geometry";

/**
 * Arrows and circles on the board (PLAN 13.5): the engine's best moves and the player's
 * own (right-drag draws an arrow, a right-click a circle). Vermilion ("mark") for the
 * engine and the annotator, ink for the player's.
 */
export type Shape = { from: Square; to?: Square; brush?: "mark" | "ink" };

/** Adds a shape, or takes it away when the same one is there (drawing twice erases). */
export function toggleShape(shapes: ReadonlyArray<Shape>, shape: Shape): Shape[] {
	const same = (other: Shape) => other.from === shape.from && other.to === shape.to;
	return shapes.some(same) ? shapes.filter((other) => !same(other)) : [...shapes, shape];
}

const HEAD = 0.42;

export function Shapes({ shapes, orientation }: { shapes: ReadonlyArray<Shape>; orientation: Orientation }) {
	if (shapes.length === 0) return null;
	return (
		<svg aria-hidden="true" viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 z-[3] size-full">
			{shapes.map((shape) => {
				const color = shape.brush === "ink" ? "var(--ch-frame)" : "var(--ch-sq-mark)";
				const from = cellOf(shape.from, orientation);
				const x1 = from.col + 0.5;
				const y1 = from.row + 0.5;
				if (!shape.to || shape.to === shape.from) {
					return (
						<circle
							key={`${shape.from}`}
							cx={x1}
							cy={y1}
							r={0.44}
							fill="none"
							stroke={color}
							strokeWidth={0.07}
							opacity={0.9}
						/>
					);
				}
				const to = cellOf(shape.to, orientation);
				const x2 = to.col + 0.5;
				const y2 = to.row + 0.5;
				const length = Math.hypot(x2 - x1, y2 - y1);
				const ux = (x2 - x1) / length;
				const uy = (y2 - y1) / length;
				// The shaft stops where the head starts; the head's base is 0.45 wide.
				const bx = x2 - ux * HEAD;
				const by = y2 - uy * HEAD;
				const head = `${x2},${y2} ${bx - uy * 0.225},${by + ux * 0.225} ${bx + uy * 0.225},${by - ux * 0.225}`;
				return (
					<g key={`${shape.from}${shape.to}`} opacity={0.9}>
						<line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={0.16} />
						<polygon points={head} fill={color} />
					</g>
				);
			})}
		</svg>
	);
}
