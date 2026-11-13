import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { RecurringUnit } from "../recurring/cadence";
import type { BudgetView, RecurringProblem, RecurringView } from "../types";
import type { BudgetPeriod, PeriodRange } from "./period";

/** Planning's words (Task 94): periods, cadences, a budget's name and a period's days. */

export const PERIOD_LABELS: Record<BudgetPeriod, () => string> = {
	week: () => m.kharcha_budget_weekly(),
	month: () => m.kharcha_budget_monthly(),
	year: () => m.kharcha_budget_yearly(),
};

/** A budget's name: its category's, or "Everything". */
export const budgetName = (budget: Pick<BudgetView, "category">): string =>
	budget.category?.name ?? m.kharcha_budget_everything();

/** A period's days ("1 Nov – 30 Nov"). */
export const periodDays = (range: PeriodRange): string =>
	m.kharcha_budget_period_days({ from: formatDayMonth(range.start), to: formatDayMonth(range.end) });

/** "Every month", "Every 2 weeks". */
export function cadenceLabel(unit: RecurringUnit, every: number): string {
	if (every === 1) {
		return unit === "week"
			? m.kharcha_recurring_weekly()
			: unit === "month"
				? m.kharcha_recurring_monthly()
				: m.kharcha_recurring_yearly();
	}
	const count = formatNumber(every);
	return unit === "week"
		? m.kharcha_recurring_every_weeks({ count })
		: unit === "month"
			? m.kharcha_recurring_every_months({ count })
			: m.kharcha_recurring_every_years({ count });
}

export const UNIT_LABELS: Record<RecurringUnit, () => string> = {
	week: () => m.kharcha_recurring_unit_week(),
	month: () => m.kharcha_recurring_unit_month(),
	year: () => m.kharcha_recurring_unit_year(),
};

/** Why the daily job paused one. */
export const PROBLEM_LABELS: Record<RecurringProblem, () => string> = {
	group: () => m.kharcha_recurring_problem_group(),
	people: () => m.kharcha_recurring_problem_people(),
	quota: () => m.kharcha_recurring_problem_quota(),
	currency: () => m.kharcha_recurring_problem_currency(),
	split: () => m.kharcha_recurring_problem_split(),
};

/** What a recurring expense is called: its title, else its merchant. */
export const recurringName = (recurring: Pick<RecurringView, "title" | "merchant">): string =>
	recurring.title || recurring.merchant || m.kharcha_untitled();
