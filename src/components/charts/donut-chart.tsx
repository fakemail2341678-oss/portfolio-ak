import { Cell, Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatNumber } from "@/lib/i18n/intl";
import { type ChartProps, seriesColor } from "./types";

/**
 * Parts of a whole: one slice per row (`index` names it, the first series holds the
 * numbers), with the total in the middle. `colors` gives slices their own colours (a
 * category's), in row order. Loaded with React.lazy from ./index.tsx.
 */
export default function DonutChart({
	data,
	index,
	series,
	colors,
	format = (value) => formatNumber(value),
}: ChartProps & { colors?: ReadonlyArray<string> }) {
	const [values] = series;
	if (!values) return null;
	// Slices are the rows: each gets a colour of its own, named by its category.
	const slices = data.map((row, position) => ({
		key: String(row[index]),
		value: Number(row[values.key] ?? 0),
		color: colors?.[position] ?? seriesColor({ key: String(row[index]), label: String(row[index]) }, position),
	}));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const config = Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.key, color: slice.color }]));
	return (
		<ChartContainer config={config} className="aspect-square size-full">
			<PieChart accessibilityLayer={false}>
				<ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
				<Pie
					data={slices}
					dataKey="value"
					nameKey="key"
					innerRadius="62%"
					outerRadius="92%"
					strokeWidth={2}
					stroke="var(--background)"
					isAnimationActive={false}
					// Recharts makes the pie a tab stop; the drawing is aria-hidden (the table carries the numbers).
					rootTabIndex={-1}
				>
					{slices.map((slice) => (
						<Cell key={slice.key} fill={slice.color} />
					))}
					<Label
						position="center"
						content={({ viewBox }) =>
							viewBox && "cx" in viewBox ? (
								<text
									x={viewBox.cx}
									y={viewBox.cy}
									textAnchor="middle"
									dominantBaseline="middle"
									className="fill-foreground font-semibold text-title"
								>
									{format(total)}
								</text>
							) : null
						}
					/>
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
