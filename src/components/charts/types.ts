import type { ChartConfig } from "@/components/ui/chart";

/** One row of chart data: the category (a month, a status) and a number per series; null is "no value" (a line has a gap). */
export type ChartRow = Record<string, string | number | null>;

export type ChartSeries = {
	/** The row field holding this series' numbers. */
	key: string;
	/** Localized name, in the tooltip, the legend and the screen-reader table. */
	label: string;
	/** A CSS colour; defaults to Graphite's --chart-1…5 in series order (chart 1 is the accent). */
	color?: string;
	/** Line charts: a dashed line (a guide, such as a burndown's ideal). */
	dashed?: boolean;
};

export type ChartProps = {
	/** What the chart shows, as a sentence: the caption of the screen-reader table. */
	label: string;
	data: ReadonlyArray<ChartRow>;
	/** The row field with each row's category (the x axis, or the donut's slices). */
	index: string;
	series: ReadonlyArray<ChartSeries>;
	/** How values are printed (axis, tooltip, table). Default: formatNumber in the page's locale. */
	format?: (value: number) => string;
	className?: string;
};

export const seriesColor = (series: ChartSeries, position: number) =>
	series.color ?? `var(--chart-${(position % 5) + 1})`;

/** The shadcn chart config for these series: their labels and colours (as --color-<key>). */
export const chartConfig = (series: ReadonlyArray<ChartSeries>): ChartConfig =>
	Object.fromEntries(
		series.map((each, position) => [each.key, { label: each.label, color: seriesColor(each, position) }]),
	);
