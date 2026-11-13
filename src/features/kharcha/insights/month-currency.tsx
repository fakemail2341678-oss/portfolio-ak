import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Button } from "@/components/ui/button";
import { addMonths, type IsoMonth } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { kharchaLinks } from "../links";
import type { InsightsSearch } from "../search";
import { monthLabel } from "./words";

/**
 * The month and currency a tab shows: the month before and after as links (never past this
 * month), and the currencies the caller spent in, when more than one.
 */
export function MonthCurrency({
	tab,
	search,
	month,
	thisMonth,
	currency,
	currencies,
}: {
	tab: "overview" | "trends";
	search: InsightsSearch;
	month: IsoMonth;
	thisMonth: IsoMonth;
	currency: string;
	currencies: ReadonlyArray<string>;
}) {
	const at = (next: IsoMonth) =>
		kharchaLinks.insights(tab, { ...search, month: next === thisMonth ? undefined : next });
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-1">
				<Button asChild variant="ghost" size="icon">
					<Link {...at(addMonths(month, -1))} resetScroll={false} data-testid="kharcha-insights-previous">
						<ChevronLeftIcon aria-hidden />
						<span className="sr-only">{m.kharcha_insights_previous_month()}</span>
					</Link>
				</Button>
				<h2 className="min-w-36 text-center font-medium text-kh-ink" data-testid="kharcha-insights-month">
					{tab === "trends"
						? m.kharcha_insights_twelve_months({ from: monthLabel(addMonths(month, -11)), to: monthLabel(month) })
						: monthLabel(month)}
				</h2>
				{month < thisMonth ? (
					<Button asChild variant="ghost" size="icon">
						<Link {...at(addMonths(month, 1))} resetScroll={false} data-testid="kharcha-insights-next">
							<ChevronRightIcon aria-hidden />
							<span className="sr-only">{m.kharcha_insights_next_month()}</span>
						</Link>
					</Button>
				) : null}
			</div>
			{currencies.length > 1 ? (
				<SegmentNav
					label={m.kharcha_field_currency()}
					items={currencies.map((value) => ({ value, label: value }))}
					current={currency}
					link={(value) => kharchaLinks.insights(tab, { ...search, currency: value })}
					testId="kharcha-insights-currency"
				/>
			) : null}
		</div>
	);
}
