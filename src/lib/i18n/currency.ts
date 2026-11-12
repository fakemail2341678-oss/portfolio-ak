/**
 * Money in more than one currency (decision 0278): the currencies an app can offer, each
 * one's minor unit, and the conversions between what a person types (major units, 12.50)
 * and what is stored and added up (integer minor units, 1250).
 *
 * A currency's digits come from Intl (ISO 4217 data every runtime has): JPY 0, NPR 2,
 * KWD 3. Nothing here converts between currencies.
 */
import { m } from "@/paraglide/messages";
import { getLocale, type Locale } from "@/paraglide/runtime";
import { numberRange } from "../validation";
import { formatCurrency, formatNumber } from "./intl";

/** The ISO 4217 codes an app can offer, the home ones first. */
export const CURRENCIES = [
	"NPR",
	"INR",
	"USD",
	"EUR",
	"GBP",
	"AUD",
	"CAD",
	"JPY",
	"CNY",
	"AED",
	"QAR",
	"SAR",
	"KWD",
	"BHD",
	"OMR",
	"MYR",
	"KRW",
	"SGD",
	"THB",
	"HKD",
	"CHF",
	"NZD",
	"BDT",
	"LKR",
	"PKR",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const isCurrency = (value: unknown): value is CurrencyCode => CURRENCIES.some((code) => code === value);

const digits = new Map<string, number>();

/** Decimal places of the currency's minor unit: 2 for NPR (paisa), 0 for JPY, 3 for KWD. */
export const minorDigits = (code: string): number => {
	const known = digits.get(code);
	if (known !== undefined) return known;
	const found =
		new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
	digits.set(code, found);
	return found;
};

/** Minor units per major unit: 100 paisa per rupee, 1 per yen. */
export const minorUnits = (code: string): number => 10 ** minorDigits(code);

/** An amount typed in major units (12.5) as minor units (1250), exactly when it has the currency's digits at most. */
export const toMinor = (amount: number, code: string): number => Math.round(amount * minorUnits(code));

/** Minor units as major units, for showing and for a form's field. Never add these up: sums stay in minor units. */
export const toMajor = (amountMinor: number, code: string): number => amountMinor / minorUnits(code);

/** Whether `amount` (major units) has no more decimals than the currency allows. */
export const fitsCurrency = (amount: number, code: string): boolean => {
	const scaled = amount * minorUnits(code);
	return Math.abs(Math.round(scaled) - scaled) < 1e-6;
};

/** Minor units as text in `locale`: "NPR 1,250.00" / "नेरू १,२५०.००", "¥1,250". */
export const formatMoney = (amountMinor: number, code: string, locale: Locale = getLocale()): string =>
	formatCurrency(toMajor(amountMinor, code), { currency: code }, locale);

/**
 * A form's amount in major units, with the currency's own digits at most: `money("JPY")`
 * refuses 10.5, `money("KWD")` takes 1.234. Non-negative unless `min` says otherwise.
 */
export const money = (code: string, { min = 0, max }: { min?: number; max?: number } = {}) => {
	const allowed = minorDigits(code);
	return numberRange({ min, ...(max === undefined ? {} : { max }) }).refine((value) => fitsCurrency(value, code), {
		error: () =>
			allowed === 0 ? m.validation_money_whole() : m.validation_money_decimals({ digits: formatNumber(allowed) }),
	});
};
