import { getRouteApi } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { m } from "@/paraglide/messages";
import { BudgetsTab } from "../budgets/budgets-tab";
import { kharchaLinks } from "../links";
import { INSIGHTS_TABS, type InsightsSearch, type InsightsTab } from "../search";
import { OverviewTab } from "./overview";
import { StatementTab } from "./statement";
import { TrendsTab } from "./trends";

const route = getRouteApi("/_kharcha/app/kharcha/_shell/insights/$tab");

export const INSIGHTS_TAB_LABELS: Record<InsightsTab, () => string> = {
	overview: () => m.kharcha_insights_overview(),
	budgets: () => m.kharcha_insights_budgets(),
	trends: () => m.kharcha_insights_trends(),
	statement: () => m.kharcha_insights_statement(),
};

/**
 * Insights (PLAN Task 94, decision 0288): the caller's own spending, a tab each: the
 * overview (a month against the one before), budgets, trends (twelve months) and a
 * statement of any days, printable. Every total is one currency's; the tabs say which.
 */
export function InsightsPage() {
	const { tab } = route.useParams();
	return <InsightsView tab={tab} search={route.useSearch()} />;
}

/** Insights at a tab (the route's, or a story's). */
export function InsightsView({ tab, search }: { tab: InsightsTab; search: InsightsSearch }) {
	const keep = { month: search.month, currency: search.currency };
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-insights">
			<header className="flex flex-col gap-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5 print:hidden">
				<h1 className="kh-display text-kh-title">{m.kharcha_nav_insights()}</h1>
				<SegmentNav
					label={m.kharcha_insights_tabs()}
					items={INSIGHTS_TABS.map((value) => ({ value, label: INSIGHTS_TAB_LABELS[value]() }))}
					current={tab}
					link={(value) => kharchaLinks.insights(value, value === "statement" || value === "budgets" ? {} : keep)}
					testId="kharcha-insights-tabs"
				/>
			</header>
			<div className="flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6 print:max-w-none print:p-0">
				{tab === "overview" ? <OverviewTab search={search} /> : null}
				{tab === "budgets" ? <BudgetsTab /> : null}
				{tab === "trends" ? <TrendsTab search={search} /> : null}
				{tab === "statement" ? <StatementTab search={search} /> : null}
			</div>
		</main>
	);
}
