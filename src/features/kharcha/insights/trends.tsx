import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart, LineChart } from "@/components/charts";
import { formatMoney, toMajor, toMinor } from "@/lib/i18n/currency";
import { formatMonthShort } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { kharchaMeQueryOptions, kharchaTrendsQueryOptions } from "../queries";
import type { InsightsSearch } from "../search";
import { useKharchaUserId } from "../shell/actions";
import { SPEND_OTHER_BUCKET, type TrendSeries } from "../types";
import { MonthCurrency } from "./month-currency";
import { categoryLabel, InsightCard } from "./overview";

/** A line's colour: the kit's first four in order, "Other" grey (never a fifth generated hue). */
const lineColor = (line: TrendSeries, position: number) =>
	line.key === SPEND_OTHER_BUCKET ? "var(--muted-foreground)" : `var(--chart-${position + 1})`;

/**
 * Insights → Trends (Task 94): twelve months to the chosen one, in one currency: the monthly
 * totals as bars, then lines by the caller's categories, by their tags (an expense with two
 * tags counts in both), and shared spending by group and, outside groups, by friend (one
 * with two friends counts for each). Each keeps its four largest lines and folds the rest
 * into "Other", so the kit's colours are never cycled; the legend names every line.
 */
export function TrendsTab({ search }: { search: InsightsSearch }) {
	const userId = useKharchaUserId();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const { data } = useSuspenseQuery(
		kharchaTrendsQueryOptions(userId, { month: search.month, currency: search.currency }),
	);
	const { currency } = data;
	const format = (value: number) => formatMoney(toMinor(value, currency), currency);
	const monthOf = (month: string) => formatMonthShort(month);
	const lines = (title: string, testId: string, series: TrendSeries[], name: (line: TrendSeries) => string) => (
		<InsightCard title={title} testId={testId}>
			{series.length === 0 ? (
				<p className="text-kh-muted text-sm">{m.kharcha_insights_nothing_yet()}</p>
			) : (
				<LineChart
					label={m.kharcha_insights_trend_caption({ title, currency })}
					data={data.months.map((month, index) => ({
						month: monthOf(month),
						...Object.fromEntries(
							series.map((line, position) => [`s${position}`, toMajor(line.values[index] ?? 0, currency)]),
						),
					}))}
					index="month"
					series={series.map((line, position) => ({
						key: `s${position}`,
						label: name(line),
						color: lineColor(line, position),
					}))}
					format={format}
				/>
			)}
		</InsightCard>
	);
	return (
		<div className="flex flex-col gap-4" data-testid="kharcha-insights-trends">
			<MonthCurrency
				tab="trends"
				search={search}
				month={data.months.at(-1) ?? me.today.slice(0, 7)}
				thisMonth={me.today.slice(0, 7)}
				currency={currency}
				currencies={data.currencies}
			/>
			{data.totals.every((total) => total === 0) && data.byCategory.length === 0 ? (
				<KharchaEmpty kind="insights" className="rounded-lg border border-kh-hair bg-kh-page" />
			) : (
				<>
					<InsightCard title={m.kharcha_insights_monthly()} testId="kharcha-insights-monthly">
						<BarChart
							label={m.kharcha_insights_trend_caption({ title: m.kharcha_insights_monthly(), currency })}
							data={data.months.map((month, index) => ({
								month: monthOf(month),
								amount: toMajor(data.totals[index] ?? 0, currency),
							}))}
							index="month"
							series={[{ key: "amount", label: m.kharcha_spend_your_spending() }]}
							format={format}
						/>
					</InsightCard>
					<div className="grid gap-4 lg:grid-cols-2">
						{lines(m.kharcha_insights_by_category(), "kharcha-trends-category", data.byCategory, categoryLabel)}
						{lines(m.kharcha_insights_by_tag(), "kharcha-trends-tag", data.byTag, (line) =>
							line.key === SPEND_OTHER_BUCKET ? m.kharcha_spend_other() : line.label,
						)}
					</div>
					{lines(m.kharcha_insights_shared(), "kharcha-trends-shared", data.shared, (line) =>
						line.key === SPEND_OTHER_BUCKET ? m.kharcha_spend_other() : line.label || m.kharcha_untitled(),
					)}
				</>
			)}
		</div>
	);
}
