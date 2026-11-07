import {
	Area,
	Bar,
	CartesianGrid,
	Line,
	AreaChart as RechartsArea,
	BarChart as RechartsBar,
	LineChart as RechartsLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatNumber } from "@/lib/i18n/intl";
import { type ChartProps, chartConfig } from "./types";

/**
 * Area, bar and line charts on Recharts (loaded with React.lazy from ./index.tsx, so
 * Recharts is in this chunk only). Colours come from --color-<series>, set by
 * ChartContainer from the series; Graphite's grid and axis tokens style the rest.
 */
type Props = ChartProps & { kind: "area" | "bar" | "line"; stacked?: boolean };

export default function CartesianChart({
	kind,
	data,
	index,
	series,
	stacked = false,
	format = (value) => formatNumber(value),
}: Props) {
	// Phones drop the value axis: the tooltip and the screen-reader table carry the numbers.
	const narrow = useMediaQuery("(max-width: 639px)");
	const Chart = kind === "area" ? RechartsArea : kind === "line" ? RechartsLine : RechartsBar;
	return (
		<ChartContainer config={chartConfig(series)} className="aspect-auto size-full">
			<Chart data={[...data]} accessibilityLayer={false} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
				<CartesianGrid vertical={false} />
				<XAxis dataKey={index} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
				<YAxis
					hide={narrow}
					tickLine={false}
					axisLine={false}
					width={48}
					tickFormatter={(value: number) => format(value)}
				/>
				<ChartTooltip content={<ChartTooltipContent indicator={kind === "bar" ? "dot" : "line"} />} />
				{series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
				{series.map((each) =>
					kind === "line" ? (
						<Line
							key={each.key}
							dataKey={each.key}
							type="linear"
							stroke={`var(--color-${each.key})`}
							strokeWidth={2}
							strokeDasharray={each.dashed ? "5 4" : undefined}
							dot={false}
							connectNulls={false}
							isAnimationActive={false}
						/>
					) : kind === "area" ? (
						<Area
							key={each.key}
							dataKey={each.key}
							type="monotone"
							stroke={`var(--color-${each.key})`}
							fill={`var(--color-${each.key})`}
							fillOpacity={0.15}
							strokeWidth={2}
							isAnimationActive={false}
							{...(stacked ? { stackId: "stack" } : {})}
						/>
					) : (
						<Bar
							key={each.key}
							dataKey={each.key}
							fill={`var(--color-${each.key})`}
							radius={stacked ? 0 : 4}
							isAnimationActive={false}
							{...(stacked ? { stackId: "stack" } : {})}
						/>
					),
				)}
			</Chart>
		</ChartContainer>
	);
}
