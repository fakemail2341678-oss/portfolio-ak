import { describe, expect, it } from "vitest";
import {
	CURRENCIES,
	fitsCurrency,
	formatMoney,
	isCurrency,
	minorDigits,
	minorUnits,
	money,
	toMajor,
	toMinor,
} from "@/lib/i18n/currency";
import { NE_CURRENCY_SYMBOLS } from "@/lib/i18n/intl-ne";

/** Money in more than one currency (src/lib/i18n/currency.ts, decision 0278). */
describe("currency", () => {
	it("takes each currency's minor unit from Intl", () => {
		expect(minorDigits("NPR")).toBe(2);
		expect(minorDigits("JPY")).toBe(0);
		expect(minorDigits("KRW")).toBe(0);
		expect(minorDigits("KWD")).toBe(3);
		expect(minorUnits("NPR")).toBe(100);
		expect(minorUnits("JPY")).toBe(1);
		expect(minorUnits("BHD")).toBe(1000);
	});

	it("converts major and minor units exactly, by the currency's digits", () => {
		expect(toMinor(12.5, "NPR")).toBe(1250);
		expect(toMinor(0.1 + 0.2, "NPR")).toBe(30);
		expect(toMinor(1999.99, "USD")).toBe(199_999);
		expect(toMinor(1500, "JPY")).toBe(1500);
		expect(toMinor(1.234, "KWD")).toBe(1234);
		expect(toMajor(1250, "NPR")).toBe(12.5);
		expect(toMajor(1234, "KWD")).toBe(1.234);
		expect(toMajor(1500, "JPY")).toBe(1500);
	});

	it("knows the codes it offers", () => {
		expect(isCurrency("NPR")).toBe(true);
		expect(isCurrency("npr")).toBe(false);
		expect(isCurrency("XYZ")).toBe(false);
		expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
	});

	it("checks an amount's decimals against its currency", () => {
		expect(fitsCurrency(12.5, "NPR")).toBe(true);
		expect(fitsCurrency(12.555, "NPR")).toBe(false);
		expect(fitsCurrency(10.5, "JPY")).toBe(false);
		expect(fitsCurrency(1.234, "KWD")).toBe(true);
		expect(money("NPR").safeParse(12.25).success).toBe(true);
		expect(money("NPR").safeParse(12.255).success).toBe(false);
		expect(money("JPY").safeParse(10).success).toBe(true);
		expect(money("JPY").safeParse(10.5).success).toBe(false);
		expect(money("KWD").safeParse(1.234).success).toBe(true);
		expect(money("NPR").safeParse(-1).success).toBe(false);
		expect(money("NPR", { min: 1 }).safeParse(0.5).success).toBe(false);
	});

	it("formats minor units in both languages", () => {
		expect(formatMoney(125_000, "NPR", "en").replace(/\s/g, " ")).toBe("NPR 1,250.00");
		expect(formatMoney(1500, "JPY", "en")).toBe("¥1,500");
		expect(formatMoney(125_000, "NPR", "ne")).toContain("१,२५०.००");
	});

	// Node ships full ICU with CLDR `ne`: the table must match it wherever it differs from the code.
	it("has the CLDR ne symbol of every offered currency that has one", () => {
		for (const code of CURRENCIES) {
			const symbol = new Intl.NumberFormat("ne", { style: "currency", currency: code })
				.formatToParts(0)
				.find((part) => part.type === "currency")?.value;
			expect(NE_CURRENCY_SYMBOLS[code] ?? code, code).toBe(symbol);
		}
	});
});
