import { describe, expect, it } from "vitest";
import {
	APP_TIME_ZONE,
	type DateFormatOptions,
	formatCurrency,
	formatDate,
	formatDateTime,
	formatNumber,
	formatRelativeTime,
	formatRelativeTimeFrom,
} from "@/lib/i18n/intl";

// Node ships full ICU with CLDR `ne`, so it serves as the reference ("oracle")
// for our portable Nepali implementation, which must match it exactly.
const oracle = "ne-NP";

describe("intl: English", () => {
	it("uses Nepal time for dates regardless of the machine's time zone", () => {
		expect(APP_TIME_ZONE).toBe("Asia/Kathmandu");
		// 20:00 UTC is 01:45 the next day in Kathmandu (UTC+5:45).
		expect(formatDate("2026-01-15T20:00:00Z", { dateStyle: "long" }, "en")).toBe("January 16, 2026");
		expect(formatDateTime("2026-01-15T20:00:00Z", "en").replace(/\s/g, " ")).toBe("Jan 16, 2026, 1:45 AM");
	});

	it("formats numbers and NPR", () => {
		expect(formatNumber(1234567.89, {}, "en")).toBe("1,234,567.89");
		expect(formatCurrency(1234567.5, {}, "en").replace(/\s/g, " ")).toBe("NPR 1,234,567.50");
		expect(formatCurrency(10, { currency: "USD" }, "en")).toBe("$10.00");
	});

	it("formats relative time with the largest fitting unit", () => {
		const now = "2026-01-18T10:30:00Z";
		expect(formatRelativeTimeFrom("2026-01-15T10:30:00Z", now, undefined, "en")).toBe("3 days ago");
		expect(formatRelativeTimeFrom("2026-01-18T12:30:00Z", now, undefined, "en")).toBe("in 2 hours");
		expect(formatRelativeTimeFrom(now, now, undefined, "en")).toBe("now");
		expect(formatRelativeTime(-1, "day", undefined, "en")).toBe("yesterday");
	});

	it("defaults to the current Paraglide locale (en outside a request)", () => {
		expect(formatNumber(1000)).toBe("1,000");
	});
});

describe("intl: Nepali matches CLDR ne (Node full ICU) without using ICU ne data", () => {
	const dates = [
		"2026-01-05T03:07:00Z",
		"2026-02-14T18:20:09Z",
		"2025-12-31T23:59:59Z",
		"2026-07-04T00:00:00Z",
		...Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-${String(i + 10)}T06:15:30Z`),
	];
	const styles: DateFormatOptions[] = [
		{ dateStyle: "full" },
		{ dateStyle: "long" },
		{ dateStyle: "medium" },
		{ dateStyle: "short" },
		{ timeStyle: "short" },
		{ timeStyle: "medium" },
		{ dateStyle: "full", timeStyle: "short" },
		{ dateStyle: "long", timeStyle: "short" },
		{ dateStyle: "medium", timeStyle: "short" },
		{ dateStyle: "short", timeStyle: "medium" },
	];

	it.each(styles)("dates with %o", (style) => {
		for (const value of dates) {
			const expected = new Intl.DateTimeFormat(oracle, { timeZone: APP_TIME_ZONE, ...style }).format(new Date(value));
			expect(formatDate(value, style, "ne")).toBe(expected);
		}
	});

	it("numbers, percent and currency", () => {
		for (const value of [0, 7, 1234.5, 1234567.89, -98765.4321, 100000000]) {
			expect(formatNumber(value, {}, "ne")).toBe(new Intl.NumberFormat(oracle).format(value));
			expect(formatCurrency(value, {}, "ne")).toBe(
				new Intl.NumberFormat(oracle, { style: "currency", currency: "NPR" }).format(value),
			);
		}
		expect(formatNumber(0.256, { style: "percent" }, "ne")).toBe(
			new Intl.NumberFormat(oracle, { style: "percent" }).format(0.256),
		);
		expect(formatCurrency(10, { currency: "USD" }, "ne")).toBe(
			new Intl.NumberFormat(oracle, { style: "currency", currency: "USD" }).format(10),
		);
	});

	const units = ["year", "quarter", "month", "week", "day", "hour", "minute", "second"] as const;

	it.each(units)("relative time in %s (numeric auto and always)", (unit) => {
		for (const numeric of ["auto", "always"] as const) {
			const reference = new Intl.RelativeTimeFormat(oracle, { numeric });
			for (const value of [-10, -3, -2, -1, -0, 0, 1, 2, 3, 12]) {
				expect(formatRelativeTime(value, unit, { numeric }, "ne")).toBe(reference.format(value, unit));
			}
		}
	});

	it("uses Devanagari digits and no Latin digits", () => {
		const text = formatDate("2026-01-15T10:30:00Z", { dateStyle: "full", timeStyle: "short" }, "ne");
		expect(text).toMatch(/[०-९]/);
		expect(text).not.toMatch(/[0-9]/);
	});
});
