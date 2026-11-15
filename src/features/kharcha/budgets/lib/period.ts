import { addDays, addMonths, type IsoDate, type IsoMonth, monthDays, weekdayOf } from "@/lib/i18n/date-only";

/**
 * Budget periods (Task 94, decision 0288; docs/guides/kharcha.md "Budgets"). Pure and
 * isomorphic: the server totals a period with them, the pages draw it. A week starts on
 * Sunday (as Spend's `date:this-week`), a month and a year are the calendar's. A budget
 * applies from the period holding its `startsOn`; a monthly one may have its own amount for
 * one month. Money stays integer minor units.
 */

export const BUDGET_PERIODS = ["week", "month", "year"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

/** The alerts: once each per period (`kh_budget_alert`). */
export const BUDGET_THRESHOLDS = [80, 100] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

/** A period's first and last days (both included). */
export type PeriodRange = { start: IsoDate; end: IsoDate };

/** The period of `period` that holds `day`. */
export function periodOf(period: BudgetPeriod, day: IsoDate): PeriodRange {
	if (period === "week") {
		const start = addDays(day, -weekdayOf(day));
		return { start, end: addDays(start, 6) };
	}
	if (period === "month") {
		const { first, last } = monthDays(day.slice(0, 7));
		return { start: first, end: last };
	}
	const year = day.slice(0, 4);
	return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** The period `by` periods away from the one holding `day` (−1: the one before). */
export function periodShift(period: BudgetPeriod, day: IsoDate, by: number): PeriodRange {
	const { start } = periodOf(period, day);
	if (period === "week") return periodOf(period, addDays(start, 7 * by));
	if (period === "month") return periodOf(period, `${addMonths(start.slice(0, 7), by)}-01`);
	return periodOf(period, `${Number(start.slice(0, 4)) + by}-01-01`);
}

/** Whether the budget applies in the period starting `start`: from the period of its `startsOn`. */
export const periodCounts = (period: BudgetPeriod, startsOn: IsoDate, start: IsoDate): boolean =>
	periodOf(period, startsOn).start <= start;

/**
 * A budget's amount in the period starting `start`: a monthly budget's own amount for that
 * month when it has one, else its amount.
 */
export const amountFor = (
	budget: { period: BudgetPeriod; amountMinor: number },
	months: ReadonlyArray<{ month: IsoMonth; amountMinor: number }>,
	start: IsoDate,
): number =>
	(budget.period === "month" ? months.find((own) => own.month === start.slice(0, 7))?.amountMinor : undefined) ??
	budget.amountMinor;

/** The thresholds `spent` has reached of `amount` (integers: spent × 100 ≥ amount × threshold). */
export const thresholdsReached = (spent: number, amount: number): BudgetThreshold[] =>
	amount > 0 ? BUDGET_THRESHOLDS.filter((threshold) => spent * 100 >= amount * threshold) : [];

/** How a budget stands: under 80%, near its limit, or at it and over. */
export type BudgetState = "ok" | "near" | "over";
export const budgetState = (spent: number, amount: number): BudgetState => {
	const reached = thresholdsReached(spent, amount);
	return reached.includes(100) ? "over" : reached.includes(80) ? "near" : "ok";
};

/** Spent as a whole percentage of the amount, rounded down (for the bar and the words). */
export const percentOf = (spent: number, amount: number): number =>
	amount > 0 ? Math.floor((Math.max(0, spent) * 100) / amount) : 0;

/** How many days of the period are left after `today`, today included. */
export const daysLeft = (range: PeriodRange, today: IsoDate): number => {
	if (today > range.end) return 0;
	const from = today < range.start ? range.start : today;
	return Math.round((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
};
