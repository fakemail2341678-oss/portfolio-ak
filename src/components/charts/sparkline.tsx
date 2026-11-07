import { cn } from "@/lib/utils";

const WIDTH = 100;
const HEIGHT = 28;

/**
 * A trend line without axes, in plain SVG: rendered on the server at its final
 * size, no chart library (Recharts would add ~100 kB for one polyline). Decorative
 * (`aria-hidden`): the number next to it is what readers get; say the trend in
 * words if it matters ("up 12% this month").
 */
export function Sparkline({
	values,
	tone = "primary",
	className,
}: {
	values: ReadonlyArray<number>;
	tone?: "primary" | "success" | "danger" | "muted";
	className?: string;
}) {
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const points = values.map((value, position) => {
		const x = (position / (values.length - 1)) * WIDTH;
		// 2 px of headroom so the stroke isn't clipped at the extremes.
		const y = HEIGHT - 2 - ((value - min) / span) * (HEIGHT - 4);
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	});
	const line = points.join(" ");
	const color = {
		primary: "text-primary",
		success: "text-success",
		danger: "text-danger",
		muted: "text-muted-foreground",
	}[tone];
	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio="none"
			className={cn("h-7 w-full overflow-visible", color, className)}
			aria-hidden="true"
			focusable="false"
		>
			<polygon points={`0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`} className="fill-current opacity-10" />
			<polyline
				points={line}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
