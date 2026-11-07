import { addMonths, type IsoMonth } from "@/lib/i18n/date-only";
import { formatCurrency, formatMonthYear } from "@/lib/i18n/intl";
import { type ExpenseCurrency, toMajor } from "./types";

/** An amount in minor units, in its currency and the page's language (Devanagari digits in Nepali). */
export const formatMoney = (amountMinor: number, currency: ExpenseCurrency) =>
	formatCurrency(toMajor(amountMinor), { currency });

/** A whole amount in major units for chart axes and totals ("NPR 25,600"). */
export const formatWholeMoney = (amount: number, currency: ExpenseCurrency) =>
	formatCurrency(amount, { currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** "October 2026" / "२०२६ अक्टोबर". */
export const formatMonth = (month: IsoMonth) => {
	const [year = 1970, number = 1] = month.split("-").map(Number);
	return formatMonthYear(new Date(year, number - 1, 1));
};

/** The month before and after `month`; `next` is null past the current month (nothing is spent there yet). */
export const monthNeighbours = (month: IsoMonth, current: IsoMonth) => ({
	previous: addMonths(month, -1),
	next: month >= current ? null : addMonths(month, 1),
});

/** Major units as a plain decimal for the CSV ("1234.50"): no grouping, no symbol, any locale. */
export const csvAmount = (amountMinor: number) => toMajor(amountMinor).toFixed(2);
