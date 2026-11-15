import { cn } from "@/lib/utils";

/** Rows of a plan: [start, length, tone] in twelfths of the width; the tones are accent strengths. */
const ROWS: ReadonlyArray<readonly [number, number, number]> = [
	[0, 4, 1],
	[2, 5, 0.75],
	[5, 3, 0.5],
	[4, 6, 0.9],
	[8, 3, 0.6],
	[1, 3, 0.4],
	[6, 5, 0.8],
	[9, 3, 0.55],
];

/**
 * A plan laid out in time: staggered bars on a quiet grid, the shape of the mark
 * at the size of a panel. Decorative (the text beside it says what Taskline does);
 * it scales to its box and takes the accent from the theme.
 */
export function TasklineArt({ className }: { className?: string }) {
	const width = 480;
	const row = 44;
	const height = ROWS.length * row + 24;
	const column = width / 12;
	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
			className={cn("text-primary", className)}
		>
			{Array.from({ length: 13 }, (_, index) => (
				<line
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid that never reorders
					key={index}
					x1={index * column}
					x2={index * column}
					y1="0"
					y2={height}
					className="stroke-border"
					strokeWidth="1"
				/>
			))}
			{ROWS.map(([start, length, tone], index) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing that never reorders
					key={index}
					x={start * column + 4}
					y={index * row + 16}
					width={length * column - 8}
					height="20"
					rx="6"
					fill="currentColor"
					opacity={tone}
				/>
			))}
		</svg>
	);
}
