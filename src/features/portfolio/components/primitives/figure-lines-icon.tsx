import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";
import { formatMetric } from "../../lib/format-metric";
import type { Metric } from "../../types";

type FigureLinesProps = {
	metrics: ReadonlyArray<Metric>;
	/** "large" on the home page's impact section, "small" in a case study's facts. */
	size?: "large" | "small";
	label?: string | undefined;
	className?: string | undefined;
};

/**
 * Numbers stated quietly: each figure beside the one sentence it belongs to,
 * at the sentence's own size (a figure is a fact, not a headline), figures
 * sharing a right edge and sentences a left one (one grid, its rows subgrids,
 * so the widest figure sets the column). A <dl>: the sentence is the term,
 * the figure its value (read in that order, shown figure first).
 */
export function FigureLines({ metrics, size = "large", label, className }: FigureLinesProps) {
	return (
		<dl
			aria-label={label}
			className={cn(
				"grid grid-cols-[auto_1fr] gap-x-5",
				size === "large" ? "gap-y-5 text-hm-lead" : "gap-y-3 text-hm-body",
				className,
			)}
		>
			{metrics.map((metric, position) => (
				<div
					key={metric.label}
					lang={metric.lang}
					className="hm-reveal col-span-2 grid grid-cols-subgrid items-baseline"
					style={cssVars({ "--hm-i": position })}
				>
					<dt className="col-start-2 row-start-1">{metric.label}</dt>
					<dd className="col-start-1 row-start-1 text-right font-hm-display font-semibold tabular-nums">
						{formatMetric(metric)}
					</dd>
				</div>
			))}
		</dl>
	);
}
