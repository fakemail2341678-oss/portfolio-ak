import { lazy } from "react";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";

/**
 * The charts a page uses. Each renders a same-size skeleton on the server and loads
 * Recharts on demand in the browser (React.lazy), so no page pays for Recharts
 * until it shows a chart, and nothing shifts when the chart appears (ChartFrame).
 */
const Cartesian = lazy(() => import("./cartesian-chart"));
const Donut = lazy(() => import("./donut-chart"));

/** A trend over time: one area per series (`stacked` piles them up). */
export function AreaChart({ stacked, ...props }: ChartProps & { stacked?: boolean }) {
	return (
		<ChartFrame {...props} aspect="wide">
			<Cartesian kind="area" stacked={stacked} {...props} />
		</ChartFrame>
	);
}

/** Amounts per category: one bar per series (`stacked` piles them up). */
export function BarChart({ stacked, ...props }: ChartProps & { stacked?: boolean }) {
	return (
		<ChartFrame {...props} aspect="wide">
			<Cartesian kind="bar" stacked={stacked} {...props} />
		</ChartFrame>
	);
}

/** Values over time as lines: gaps where a row has null, `dashed` series for guides (a burndown's ideal). */
export function LineChart(props: ChartProps) {
	return (
		<ChartFrame {...props} aspect="wide">
			<Cartesian kind="line" {...props} />
		</ChartFrame>
	);
}

/** Parts of a whole: a slice per row, the total in the middle; `colors` (by row) overrides the palette. */
export function DonutChart(props: ChartProps & { colors?: ReadonlyArray<string> }) {
	return (
		<ChartFrame {...props} aspect="square">
			<Donut {...props} />
		</ChartFrame>
	);
}

export { Sparkline } from "./sparkline";
