import { describe, expect, it } from "vitest";
import { guessMapping, parseAmount, parseCurrency, previewImport, tableProblem } from "@/features/apps/expenses/import";
import { parseCsv, parseCsvDay } from "@/lib/csv";

/**
 * Expenses' CSV import (decision 0192): the mapping step's guess, how dates, amounts
 * and currencies are read, and the preview's rows and errors, checked by the same
 * schema the server uses.
 */
const options = { header: true, dateFormat: "ymd" as const, currency: "NPR" as const };

describe("reading cells", () => {
	it("reads dates in the chosen order, and nothing that isn't a real day", () => {
		expect(parseCsvDay("2026-10-30", "ymd")).toBe("2026-10-30");
		expect(parseCsvDay("30/10/2026", "dmy")).toBe("2026-10-30");
		expect(parseCsvDay("10/30/2026", "mdy")).toBe("2026-10-30");
		expect(parseCsvDay("1.2.2026", "dmy")).toBe("2026-02-01");
		expect(parseCsvDay("2026-02-30", "ymd")).toBeNull();
		expect(parseCsvDay("30/10/26", "dmy")).toBeNull();
		expect(parseCsvDay("yesterday", "ymd")).toBeNull();
	});

	it("reads amounts with symbols, grouping and Devanagari digits, in minor units", () => {
		expect(parseAmount("1,250.50")).toBe(125_050);
		expect(parseAmount("रु १२,५००")).toBe(1_250_000);
		expect(parseAmount("$ 12")).toBe(1_200);
		expect(parseAmount("0.1")).toBe(10);
		expect(parseAmount("-45")).toBe(-4_500);
		expect(parseAmount("1.005")).toBeNaN();
		expect(parseAmount("ten")).toBeNaN();
		expect(parseAmount("")).toBeNaN();
	});

	it("reads currency codes and common symbols, empty as the default", () => {
		expect(parseCurrency("usd", "NPR")).toBe("USD");
		expect(parseCurrency("Rs", "USD")).toBe("NPR");
		expect(parseCurrency("रु", "USD")).toBe("NPR");
		expect(parseCurrency("", "USD")).toBe("USD");
		expect(parseCurrency("EUR", "NPR")).toBeNull();
	});
});

describe("mapping", () => {
	it("guesses columns from the header, the export's own names in both languages", () => {
		expect(guessMapping(["Date", "Amount", "Currency", "Category", "Note"])).toEqual({
			date: 0,
			amount: 1,
			currency: 2,
			category: 3,
			note: 4,
		});
		expect(guessMapping(["मिति", "रकम", "मुद्रा", "श्रेणी", "टिप्पणी"])).toEqual({
			date: 0,
			amount: 1,
			currency: 2,
			category: 3,
			note: 4,
		});
		expect(guessMapping(["Posted", "Description", "Value"])).toEqual({
			date: null,
			amount: 2,
			category: null,
			note: 1,
			currency: null,
		});
	});
});

describe("preview", () => {
	const table = parseCsv(
		[
			"Date,Amount,Category,Note,Currency",
			"2026-10-01,450,Food,Momo,",
			"2026-10-02,1250.50,Transport,,USD",
			"2026-13-01,10,Food,,",
			"2026-10-03,0,,Free,",
			"2026-10-04,12,Food,Tea,EUR",
		].join("\n"),
	);

	it("turns valid lines into import rows and lists every problem of the others", () => {
		const rows = previewImport(table, guessMapping(table[0] ?? []), options);
		expect(rows.map((row) => row.line)).toEqual([2, 3, 4, 5, 6]);
		expect(rows[0]?.row).toEqual({
			occurredOn: "2026-10-01",
			amountMinor: 45_000,
			currency: "NPR",
			category: "Food",
			note: "Momo",
		});
		expect(rows[1]?.row).toMatchObject({ amountMinor: 125_050, currency: "USD", category: "Transport" });
		expect(rows[2]?.row).toBeNull();
		expect(rows[2]?.problems.map((problem) => problem.field)).toEqual(["date"]);
		expect(rows[3]?.problems.map((problem) => problem.field)).toEqual(["amount"]);
		expect(rows[4]?.problems.map((problem) => problem.field)).toEqual(["currency"]);
	});

	it("reads a file without a header, with day-first dates and a default currency", () => {
		const plain = parseCsv("30/10/2026,99\n31/10/2026,1");
		const rows = previewImport(
			plain,
			{ date: 0, amount: 1, category: null, note: null, currency: null },
			{ header: false, dateFormat: "dmy", currency: "USD" },
		);
		expect(rows.map((row) => row.row)).toEqual([
			{ occurredOn: "2026-10-30", amountMinor: 9_900, currency: "USD", category: "", note: "" },
			{ occurredOn: "2026-10-31", amountMinor: 100, currency: "USD", category: "", note: "" },
		]);
		expect(rows[0]?.line).toBe(1);
	});

	it("refuses an empty table and one over the row limit", () => {
		expect(tableProblem([["Date", "Amount"]], { header: true })).not.toBeNull();
		expect(tableProblem([["2026-10-01", "1"]], { header: false })).toBeNull();
		const big = Array.from({ length: 1_002 }, () => ["2026-10-01", "1"]);
		expect(tableProblem(big, { header: true })).not.toBeNull();
		expect(tableProblem(big.slice(0, 1_001), { header: true })).toBeNull();
	});
});
