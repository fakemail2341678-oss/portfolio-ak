import { formatNumber } from "@/lib/i18n/intl";
import { getLocale, type Locale } from "@/paraglide/runtime";
import type { MetricRecord } from "../schema";

type MetricValue = Pick<MetricRecord, "value" | "format">;

/**
 * A metric's number as localized text: "63%", "1.2M", "3×", "48 ms", "10+".
 * Digits follow the locale (Devanagari in Nepali) through src/lib/i18n/intl.ts.
 */
export function formatMetric({ value, format }: MetricValue, locale: Locale = getLocale()): string {
	switch (format) {
		case "percent":
			return formatNumber(value, { style: "percent", maximumFractionDigits: value < 0.99 ? 0 : 2 }, locale);
		case "compact":
			return formatNumber(value, { notation: "compact", maximumFractionDigits: 1 }, locale);
		case "multiplier":
			return `${formatNumber(value, { maximumFractionDigits: 1 }, locale)}×`;
		case "plus":
			return `${formatNumber(value, {}, locale)}+`;
		case "ms":
			return `${formatNumber(value, {}, locale)} ms`;
		case "seconds":
			return `${formatNumber(value, { maximumFractionDigits: 1 }, locale)} s`;
		default:
			return formatNumber(value, {}, locale);
	}
}
