import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { FilterBar } from "@/components/filters/filter-bar";
import { SelectFilter } from "@/components/filters/filters";
import { formatMoney, toMajor, toMinor } from "@/lib/i18n/currency";
import { formatDayMonth, formatMonthYear, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { Money } from "../kit/money";
import { kharchaSpendChartQueryOptions } from "../queries";
import { SPEND_CHARTS, SPEND_GROUP_BY, type SpendGroupBy, type SpendSearch } from "../search";
import { SPEND_OTHER_BUCKET, type SpendBucket } from "../types";
import { spendChartInput } from "./input";

/**
 * Spend's chart view (Task 93): the search's spending (the caller's share, refunds against
 * it) summed by what the address groups by, one chart per currency (amounts in different
 * currencies never share an axis). A single series, so its heading names it and no legend
 * box is drawn; the donut keeps the five largest slices and folds the rest into "Other",
 * since its colours are the kit's five in order, never cycled. Every chart has its numbers
 * as a table for screen readers (ChartFrame).
 */

const GROUP_LABELS: Record<SpendGroupBy, () => string> = {
	category: () => m.kharcha_field_category(),
	merchant: () => m.kharcha_field_merchant(),
	tag: () => m.kharcha_field_tags(),
	method: () => m.kharcha_field_method(),
	group: () => m.kharcha_spend_by_group(),
	friend: () => m.kharcha_spend_by_friend(),
	day: () => m.kharcha_spend_by_day(),
	week: () => m.kharcha_spend_by_week(),
	month: () => m.kharcha_spend_by_month(),
	year: () => m.kharcha_spend_by_year(),
};

const CHART_LABELS = {
	bar: () => m.kharcha_spend_chart_bar(),
	donut: () => m.kharcha_spend_chart_donut(),
	line: () => m.kharcha_spend_chart_line(),
} as const;

/** What "none" is called for each grouping (uncategorized, no tag, just you…). */
const NONE_LABELS: Partial<Record<SpendGroupBy, () => string>> = {
	category: () => m.kharcha_category_none(),
	merchant: () => m.kharcha_spend_none_merchant(),
	tag: () => m.kharcha_spend_none_tag(),
	method: () => m.kharcha_spend_none_method(),
	group: () => m.kharcha_spend_none_group(),
	friend: () => m.kharcha_spend_none_friend(),
};

/** A bucket's name on the axis and in the table. */
export function bucketLabel(groupBy: SpendGroupBy, bucket: SpendBucket): string {
	if (bucket.key === SPEND_OTHER_BUCKET) return m.kharcha_spend_other();
	if (bucket.key === "") return NONE_LABELS[groupBy]?.() ?? "";
	switch (groupBy) {
		case "day":
			return formatDayMonth(bucket.key);
		case "week":
			return m.kharcha_spend_week_of({
				day: formatDayMonth(bucket.key),
			});
		case "month": {
			const [year, month] = bucket.key.split("-").map(Number);
			return formatMonthYear(new Date(year ?? 1970, (month ?? 1) - 1, 15));
		}
		case "year":
			return formatNumber(Number(bucket.key), { useGrouping: false });
		default:
			return bucket.label || bucket.key;
	}
}

/** A slice's colour: the kit's five in order, and a grey for "Other". */
const sliceColor = (bucket: SpendBucket, position: number) =>
	bucket.key === SPEND_OTHER_BUCKET ? "var(--muted-foreground)" : `var(--chart-${position + 1})`;

/** The donut's slices: the five largest positive buckets, then the rest as "Other". */
const DONUT_SLICES = 5;
function donutBuckets(buckets: ReadonlyArray<SpendBucket>): SpendBucket[] {
	const positive = buckets.filter((bucket) => bucket.amountMinor > 0 && bucket.key !== SPEND_OTHER_BUCKET);
	const sorted = [...positive].sort((a, b) => b.amountMinor - a.amountMinor);
	const rest = buckets
		.filter((bucket) => bucket.amountMinor > 0 && !sorted.slice(0, DONUT_SLICES).includes(bucket))
		.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
	return [
		...sorted.slice(0, DONUT_SLICES),
		...(rest > 0 ? [{ key: SPEND_OTHER_BUCKET, label: "", amountMinor: rest }] : []),
	];
}

export default function SpendChartView({ userId, search }: { userId: string; search: SpendSearch }) {
	const { data: chart } = useSuspenseQuery(kharchaSpendChartQueryOptions(userId, spendChartInput(search)));
	return (
		<div className="flex flex-col gap-4" data-testid="kharcha-spend-chart">
			<FilterBar values={search} preserve={["q", "view", "sort", "pageSize"]} label={m.kharcha_spend_chart_options()}>
				<SelectFilter
					name="groupBy"
					label={m.kharcha_spend_group_by()}
					value={search.groupBy}
					options={SPEND_GROUP_BY.map((value) => ({ value, label: GROUP_LABELS[value]() }))}
				/>
				<SelectFilter
					name="chart"
					label={m.kharcha_spend_chart_kind()}
					value={search.chart}
					options={SPEND_CHARTS.map((value) => ({ value, label: CHART_LABELS[value]() }))}
				/>
			</FilterBar>
			{chart.currencies.length === 0 ? (
				<KharchaEmpty kind="search" className="rounded-lg border border-kh-hair bg-kh-page" />
			) : (
				chart.currencies.map(({ currency, total, buckets }) => {
					const shown = search.chart === "donut" ? donutBuckets(buckets) : buckets;
					const data = shown.map((bucket) => ({
						label: bucketLabel(search.groupBy, bucket),
						amount: toMajor(bucket.amountMinor, currency),
					}));
					const props = {
						label: m.kharcha_spend_chart_caption({ by: GROUP_LABELS[search.groupBy](), currency }),
						data,
						index: "label",
						series: [{ key: "amount", label: m.kharcha_spend_your_spending() }],
						format: (value: number) => formatMoney(toMinor(value, currency), currency),
					};
					return (
						<section
							key={currency}
							aria-label={currency}
							className="flex flex-col gap-3 rounded-lg border border-kh-hair bg-kh-page p-4"
						>
							<header className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="font-medium text-kh-ink">
									{m.kharcha_spend_chart_heading({ by: GROUP_LABELS[search.groupBy](), currency })}
								</h2>
								<p className="flex items-baseline gap-2 text-sm">
									<span className="text-kh-muted">{m.kharcha_spend_total()}</span>
									<Money amountMinor={total} currency={currency} />
								</p>
							</header>
							{search.chart === "donut" ? (
								<div className="grid items-center gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
									<DonutChart {...props} colors={shown.map(sliceColor)} />
									{/* The slices' names beside their colours: identity is never colour alone. */}
									<ul className="flex flex-col gap-1.5 text-sm">
										{shown.map((bucket, position) => (
											<li key={bucket.key || "none"} className="flex items-center gap-2">
												<span
													aria-hidden
													className="size-3 shrink-0 rounded-sm"
													style={{ background: sliceColor(bucket, position) }}
												/>
												<span className="min-w-0 flex-1 truncate">{bucketLabel(search.groupBy, bucket)}</span>
												<Money amountMinor={bucket.amountMinor} currency={currency} />
											</li>
										))}
									</ul>
								</div>
							) : search.chart === "line" ? (
								<LineChart {...props} />
							) : (
								<BarChart {...props} />
							)}
						</section>
					);
				})
			)}
		</div>
	);
}
