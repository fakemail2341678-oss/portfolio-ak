import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BarChart } from "@/components/charts";
import { formatMoney, toMajor, toMinor } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { Money } from "../kit/money";
import { kharchaMeQueryOptions, kharchaOverviewQueryOptions } from "../queries";
import type { InsightsSearch } from "../search";
import { useKharchaUserId } from "../shell/actions";
import { type InsightsOverview, SPEND_OTHER_BUCKET } from "../types";
import { CalendarHeatmap } from "./heatmap";
import { MonthCurrency } from "./month-currency";
import { monthLabel } from "./words";

/** Categories the overview's chart keeps before folding the rest into "Other". */
const CATEGORY_BARS = 8;

/** A card of the overview: its heading and what it shows. */
export function InsightCard({
	title,
	children,
	aside,
	testId,
}: {
	title: string;
	children: ReactNode;
	aside?: ReactNode;
	testId?: string;
}) {
	return (
		<section
			aria-label={title}
			className="flex min-w-0 flex-col gap-3 rounded-lg border border-kh-hair bg-kh-page p-4 print:break-inside-avoid"
			data-testid={testId}
		>
			<header className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="font-medium text-kh-ink">{title}</h3>
				{aside}
			</header>
			{children}
		</section>
	);
}

/** A category's name, "Uncategorized", or "Other". */
export const categoryLabel = (bucket: { key: string; label: string }) =>
	bucket.key === SPEND_OTHER_BUCKET
		? m.kharcha_spend_other()
		: bucket.key === ""
			? m.kharcha_category_none()
			: bucket.label;

function foldCategories(rows: InsightsOverview["byCategory"]) {
	const kept = rows.slice(0, CATEGORY_BARS);
	const rest = rows.slice(CATEGORY_BARS);
	if (rest.length === 0) return kept;
	return [
		...kept,
		{
			key: SPEND_OTHER_BUCKET,
			label: "",
			color: null,
			amountMinor: rest.reduce((sum, row) => sum + row.amountMinor, 0),
			previousMinor: rest.reduce((sum, row) => sum + row.previousMinor, 0),
		},
	];
}

/**
 * Insights → Overview (Task 94): a month of the caller's spending in one currency against
 * the month before: the total, by their own categories (both months as two series, so a
 * legend names them), the top merchants as a ranked list, every day as bars, and the month
 * as a calendar whose shade is the day's spending.
 */
export function OverviewTab({ search }: { search: InsightsSearch }) {
	const userId = useKharchaUserId();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const { data } = useSuspenseQuery(
		kharchaOverviewQueryOptions(userId, { month: search.month, currency: search.currency }),
	);
	const { currency } = data;
	const format = (value: number) => formatMoney(toMinor(value, currency), currency);
	const difference = data.total - data.previousTotal;
	const empty = data.total === 0 && data.previousTotal === 0 && data.byCategory.length === 0;
	const top = data.merchants[0]?.amountMinor ?? 0;
	return (
		<div className="flex flex-col gap-4" data-testid="kharcha-insights-overview">
			<MonthCurrency
				tab="overview"
				search={search}
				month={data.month}
				thisMonth={me.today.slice(0, 7)}
				currency={currency}
				currencies={data.currencies}
			/>
			{empty ? (
				<KharchaEmpty kind="insights" className="rounded-lg border border-kh-hair bg-kh-page" />
			) : (
				<>
					<section
						aria-label={m.kharcha_insights_spent_in({ month: monthLabel(data.month) })}
						className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-kh-hair bg-kh-page p-4"
						data-testid="kharcha-insights-total"
					>
						<div className="flex flex-col gap-1">
							<p className="text-kh-muted text-sm">{m.kharcha_insights_spent_in({ month: monthLabel(data.month) })}</p>
							<Money amountMinor={data.total} currency={currency} size="hero" />
							<p className="text-caption text-kh-muted">{m.kharcha_insights_your_share()}</p>
						</div>
						<p className="text-sm text-kh-ink">
							{difference === 0
								? m.kharcha_insights_same({ month: monthLabel(data.previous) })
								: difference > 0
									? m.kharcha_insights_more({
											amount: formatMoney(difference, currency),
											month: monthLabel(data.previous),
										})
									: m.kharcha_insights_less({
											amount: formatMoney(-difference, currency),
											month: monthLabel(data.previous),
										})}
						</p>
					</section>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
						<InsightCard title={m.kharcha_insights_by_category()} testId="kharcha-insights-categories">
							<BarChart
								label={m.kharcha_insights_by_category_caption({ currency })}
								data={foldCategories(data.byCategory).map((row) => ({
									label: categoryLabel(row),
									current: toMajor(row.amountMinor, currency),
									previous: toMajor(row.previousMinor, currency),
								}))}
								index="label"
								series={[
									{ key: "current", label: monthLabel(data.month) },
									{ key: "previous", label: monthLabel(data.previous) },
								]}
								format={format}
							/>
						</InsightCard>
						<InsightCard title={m.kharcha_insights_merchants()} testId="kharcha-insights-merchants">
							{data.merchants.length === 0 ? (
								<p className="text-kh-muted text-sm">{m.kharcha_insights_no_merchants()}</p>
							) : (
								<ol className="flex flex-col gap-2.5">
									{data.merchants.map((merchant, position) => (
										<li key={merchant.key || "none"} className="flex flex-col gap-1">
											<div className="flex items-baseline gap-2 text-sm">
												<span className="kh-figures w-5 shrink-0 text-kh-muted">{formatNumber(position + 1)}</span>
												<span className="min-w-0 flex-1 truncate text-kh-ink">
													{merchant.label || m.kharcha_untitled()}
												</span>
												<Money amountMinor={merchant.amountMinor} currency={currency} size="sm" />
											</div>
											<div aria-hidden className="ml-7 h-1.5 overflow-hidden rounded-full bg-kh-hair">
												<div
													className="h-full rounded-full bg-[var(--chart-1)]"
													style={{ width: `${top > 0 ? Math.max(2, (merchant.amountMinor / top) * 100) : 0}%` }}
												/>
											</div>
										</li>
									))}
								</ol>
							)}
						</InsightCard>
					</div>
					<InsightCard title={m.kharcha_insights_daily()} testId="kharcha-insights-daily">
						<BarChart
							label={m.kharcha_insights_daily_caption({ month: monthLabel(data.month), currency })}
							data={data.days.map((day) => ({
								label: formatNumber(Number(day.day.slice(8, 10))),
								amount: toMajor(day.amountMinor, currency),
							}))}
							index="label"
							series={[{ key: "amount", label: m.kharcha_spend_your_spending() }]}
							format={format}
						/>
					</InsightCard>
					<InsightCard title={m.kharcha_insights_calendar()} testId="kharcha-insights-calendar">
						<CalendarHeatmap days={data.days} currency={currency} month={data.month} />
					</InsightCard>
				</>
			)}
		</div>
	);
}
