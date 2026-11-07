/**
 * Locale-aware formatting, keyed to the current Paraglide locale.
 *
 * Every helper takes an optional `locale` (defaults to getLocale()) so it works
 * in components, loaders, server functions and emails alike.
 *
 * Hydration safety: the server and the browser must produce identical strings.
 * - Nepali never uses ICU's `ne` data, which desktop Chrome doesn't ship
 *   (see intl-ne.ts). English uses Intl directly.
 * - Dates use a fixed APP_TIME_ZONE, never the machine's zone (UTC on servers,
 *   local time in browsers).
 * - Relative time takes an explicit `now`; never call Date.now() during render.
 */
import { getLocale, type Locale } from "@/paraglide/runtime.js";
import {
	NE_CURRENCY_SYMBOLS,
	NE_MONTHS,
	NE_NUMBER_LOCALE,
	NE_RELATIVE,
	NE_WEEKDAYS,
	NE_WEEKDAYS_SHORT,
	type NeRelativeUnit,
	toDevanagariDigits,
} from "./intl-ne";

/** All dates render in Nepal time unless a caller overrides `timeZone`. */
export const APP_TIME_ZONE = "Asia/Kathmandu";

export const DEFAULT_CURRENCY = "NPR";

export type DateInput = Date | number | string;

/** A deliberately small, portable subset of Intl.DateTimeFormatOptions. */
export type DateFormatOptions = {
	dateStyle?: "full" | "long" | "medium" | "short";
	timeStyle?: "medium" | "short";
	timeZone?: string;
};

// Intl constructors are relatively expensive; cache one instance per tag + options.
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(
	key: string,
	create: () => T,
): T {
	const hit = formatters.get(key);
	if (hit) return hit as T;
	const formatter = create();
	formatters.set(key, formatter);
	return formatter;
}

const numberFormat = (tag: string, options: Intl.NumberFormatOptions) =>
	cached(`number|${tag}|${JSON.stringify(options)}`, () => new Intl.NumberFormat(tag, options));

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const WEEKDAY_INDEX: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Calendar fields of `date` in `timeZone`, via locale-neutral Intl data every runtime has. */
const dateFields = (date: Date, timeZone: string) => {
	const parts = cached(
		`fields|${timeZone}`,
		() =>
			new Intl.DateTimeFormat("en-US-u-nu-latn-ca-gregory", {
				timeZone,
				year: "numeric",
				month: "numeric",
				day: "numeric",
				weekday: "short",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hourCycle: "h23",
			}),
	).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
	return {
		year: get("year"),
		month: Number(get("month")),
		day: get("day"),
		weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
		hour: get("hour"),
		minute: get("minute"),
		second: get("second"),
	};
};

/** CLDR `ne` date/time patterns: y MMMM d, EEEE · HH:mm · date–time glue ", " or ": ". */
const formatDateNe = (date: Date, { dateStyle, timeStyle, timeZone = APP_TIME_ZONE }: DateFormatOptions): string => {
	const f = dateFields(date, timeZone);
	const month = NE_MONTHS[f.month - 1] ?? "";
	const datePart = {
		full: `${f.year} ${month} ${Number(f.day)}, ${NE_WEEKDAYS[f.weekday]}`,
		long: `${f.year} ${month} ${Number(f.day)}`,
		medium: `${f.year} ${month} ${Number(f.day)}`,
		short: `${f.year.slice(-2)}/${f.month}/${Number(f.day)}`,
	};
	const timePart = { short: `${f.hour}:${f.minute}`, medium: `${f.hour}:${f.minute}:${f.second}` };

	const text =
		dateStyle && timeStyle
			? `${datePart[dateStyle]}${dateStyle === "full" || dateStyle === "long" ? ": " : ", "}${timePart[timeStyle]}`
			: dateStyle
				? datePart[dateStyle]
				: timeStyle
					? timePart[timeStyle]
					: datePart.medium;
	return toDevanagariDigits(text);
};

export const formatDate = (
	value: DateInput,
	options: DateFormatOptions = { dateStyle: "medium" },
	locale: Locale = getLocale(),
): string => {
	const date = toDate(value);
	if (locale === "ne") return formatDateNe(date, options);
	const resolved = { timeZone: APP_TIME_ZONE, ...options };
	return cached(`date|en|${JSON.stringify(resolved)}`, () => new Intl.DateTimeFormat("en", resolved)).format(date);
};

export const formatDateTime = (value: DateInput, locale: Locale = getLocale()): string =>
	formatDate(value, { dateStyle: "medium", timeStyle: "short" }, locale);

// ---------------------------------------------------------------------------
// Numbers and currency
// ---------------------------------------------------------------------------

/** Supports decimal, percent and currency styles in both locales. */
export const formatNumber = (
	value: number | bigint,
	options: Intl.NumberFormatOptions = {},
	locale: Locale = getLocale(),
): string => {
	if (locale !== "ne") return numberFormat("en", options).format(value);
	if (options.style !== "currency") return numberFormat(NE_NUMBER_LOCALE, options).format(value);

	// en-IN with the ISO code, then swap in the CLDR `ne` symbol.
	const parts = numberFormat(NE_NUMBER_LOCALE, { ...options, currencyDisplay: "code" }).formatToParts(value);
	return parts
		.map((part) => (part.type === "currency" ? (NE_CURRENCY_SYMBOLS[part.value] ?? part.value) : part.value))
		.join("");
};

export const formatCurrency = (
	amount: number | bigint,
	options: Omit<Intl.NumberFormatOptions, "style"> = {},
	locale: Locale = getLocale(),
): string => formatNumber(amount, { style: "currency", currency: DEFAULT_CURRENCY, ...options }, locale);

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

type RelativeUnit = NeRelativeUnit | `${NeRelativeUnit}s`;

const singular = (unit: RelativeUnit): NeRelativeUnit => unit.replace(/s$/, "") as NeRelativeUnit;

export const formatRelativeTime = (
	value: number,
	unit: RelativeUnit,
	options: Intl.RelativeTimeFormatOptions = { numeric: "auto" },
	locale: Locale = getLocale(),
): string => {
	if (locale !== "ne") {
		return cached(`relative|en|${JSON.stringify(options)}`, () => new Intl.RelativeTimeFormat("en", options)).format(
			value,
			unit,
		);
	}
	const patterns = NE_RELATIVE[singular(unit)];
	const word = options.numeric === "auto" ? patterns.words[value] : undefined;
	if (word !== undefined) return word;
	// Intl treats -0 as past ("० दिन पहिले") and +0 as future.
	const isPast = value < 0 || Object.is(value, -0);
	const amount = numberFormat(NE_NUMBER_LOCALE, {}).format(Math.abs(value));
	const pattern = isPast ? patterns.past : value === 1 && patterns.futureOne ? patterns.futureOne : patterns.future;
	return pattern.replace("{n}", amount);
};

const RELATIVE_STEPS: ReadonlyArray<[NeRelativeUnit, number]> = [
	["year", 365 * 24 * 60 * 60],
	["month", 30 * 24 * 60 * 60],
	["week", 7 * 24 * 60 * 60],
	["day", 24 * 60 * 60],
	["hour", 60 * 60],
	["minute", 60],
	["second", 1],
];

/**
 * "3 days ago", "in 2 hours", picking the largest fitting unit.
 * `now` is required so server and client render the same string.
 */
export const formatRelativeTimeFrom = (
	value: DateInput,
	now: DateInput,
	options: Intl.RelativeTimeFormatOptions = { numeric: "auto" },
	locale: Locale = getLocale(),
): string => {
	const diffSeconds = (toDate(value).getTime() - toDate(now).getTime()) / 1000;
	const [unit, seconds] = RELATIVE_STEPS.find(([, size]) => Math.abs(diffSeconds) >= size) ?? ["second", 1];
	return formatRelativeTime(Math.round(diffSeconds / seconds), unit, options, locale);
};

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

const DEVANAGARI_ZERO = 0x0966;

/**
 * Parses a number typed by a user in either locale: accepts Devanagari digits
 * (१२,३४५.६७), Latin digits, grouping commas and surrounding spaces. Returns
 * undefined for empty input and NaN for anything that isn't a plain decimal.
 */
export const parseLocaleNumber = (input: string): number | undefined => {
	const latin = input
		.trim()
		.replace(/[\u0966-\u096F]/g, (digit) => String(digit.charCodeAt(0) - DEVANAGARI_ZERO))
		.replace(/[,\s\u00a0\u202f]/g, "");
	if (latin === "") return undefined;
	return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(latin) ? Number(latin) : Number.NaN;
};

/** The symbol shown next to an amount in `locale` (en: "NPR", ne: "नेरू"). */
export const currencySymbol = (currency: string = DEFAULT_CURRENCY, locale: Locale = getLocale()): string => {
	if (locale === "ne") return NE_CURRENCY_SYMBOLS[currency] ?? currency;
	const part = numberFormat("en", { style: "currency", currency })
		.formatToParts(0)
		.find((p) => p.type === "currency");
	return part?.value ?? currency;
};

// ---------------------------------------------------------------------------
// Calendar labels and file sizes
// ---------------------------------------------------------------------------

/** Calendar caption from a local Date: "January 2026" / "२०२६ जनवरी" (CLDR ne puts the year first). */
export const formatMonthYear = (date: Date, locale: Locale = getLocale()): string =>
	locale === "ne"
		? toDevanagariDigits(`${date.getFullYear()} ${NE_MONTHS[date.getMonth()] ?? ""}`)
		: cached("month-year|en", () => new Intl.DateTimeFormat("en", { year: "numeric", month: "long" })).format(date);

/**
 * A calendar day ("YYYY-MM-DD") as a short day and month: "Oct 30" / "अक्टोबर ३०". The
 * date is a calendar day, not an instant, so no time zone applies (chart axes, 0191).
 *
 * @public
 */
export const formatDayMonth = (day: string, locale: Locale = getLocale()): string => {
	const [year, month, date] = day.split("-").map(Number);
	const instant = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1, 12));
	return locale === "ne"
		? toDevanagariDigits(`${NE_MONTHS[instant.getUTCMonth()] ?? ""} ${instant.getUTCDate()}`)
		: cached(
				"day-month|en",
				() => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }),
			).format(instant);
};

/** @public A calendar month ("YYYY-MM") as its short name, for chart axes: "Oct" / "अक्टोबर" (no time zone applies). */
export const formatMonthShort = (month: string, locale: Locale = getLocale()): string => {
	const [year, number] = month.split("-").map(Number);
	const instant = new Date(Date.UTC(year ?? 1970, (number ?? 1) - 1, 15));
	return locale === "ne"
		? (NE_MONTHS[instant.getUTCMonth()] ?? "")
		: cached("month-short|en", () => new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" })).format(
				instant,
			);
};

/** Short weekday from a local Date: "Mon" / "सोम". */
export const formatWeekdayShort = (date: Date, locale: Locale = getLocale()): string =>
	locale === "ne"
		? (NE_WEEKDAYS_SHORT[date.getDay()] ?? "")
		: cached("weekday|en", () => new Intl.DateTimeFormat("en", { weekday: "short" })).format(date);

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** "5 MB", "१.५ MB": unit symbols stay Latin in both locales, as in CLDR ne. */
export const formatBytes = (bytes: number, locale: Locale = getLocale()): string => {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${formatNumber(value, { maximumFractionDigits: unit === 0 ? 0 : 1 }, locale)} ${BYTE_UNITS[unit]}`;
};
