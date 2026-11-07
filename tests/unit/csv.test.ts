import { describe, expect, it } from "vitest";
import { CsvParseError, csvCell, parseCsv, toCsv } from "@/lib/csv";

describe("CSV export", () => {
	it("quotes commas, quotes and line breaks, and leaves plain values alone", () => {
		expect(csvCell("plain")).toBe("plain");
		expect(csvCell('say "hi", twice')).toBe('"say ""hi"", twice"');
		expect(csvCell("two\nlines")).toBe('"two\nlines"');
		expect(csvCell(12.5)).toBe("12.5");
		expect(csvCell(null)).toBe("");
	});

	it("neutralizes cells a spreadsheet would run as formulas", () => {
		expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
		expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
		expect(csvCell(-5)).toBe("-5");
	});

	it("writes a header row and one row per item, CRLF-separated", () => {
		const rows = [
			{ title: "मोमो", done: true },
			{ title: "Tea, hot", done: false },
		];
		expect(
			toCsv(rows, [
				{ header: "Title", value: (row) => row.title },
				{ header: "Done", value: (row) => row.done },
			]),
		).toBe('Title,Done\r\nमोमो,true\r\n"Tea, hot",false');
	});
});

describe("CSV parsing (RFC 4180)", () => {
	it("splits rows and cells, with CRLF, LF or CR line ends", () => {
		expect(parseCsv("a,b\r\nc,d")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
		expect(parseCsv("a,b\nc,d\n")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
		expect(parseCsv("a,b\rc,d")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
	});

	it("reads quoted cells with commas, doubled quotes and line breaks", () => {
		expect(parseCsv('"Tea, hot","say ""hi""","two\r\nlines"\r\nx,y,z')).toEqual([
			["Tea, hot", 'say "hi"', "two\r\nlines"],
			["x", "y", "z"],
		]);
	});

	it("keeps empty cells, drops blank lines and a leading BOM", () => {
		expect(parseCsv(`${String.fromCharCode(0xfeff)}a,,c\n\n,b,\n`)).toEqual([
			["a", "", "c"],
			["", "b", ""],
		]);
	});

	it("reads back what toCsv writes, Devanagari included", () => {
		const rows = [
			{ title: "मोमो", note: 'with "achar", hot' },
			{ title: "=SUM(A1)", note: "two\nlines" },
		];
		const csv = toCsv(rows, [
			{ header: "Title", value: (row) => row.title },
			{ header: "Note", value: (row) => row.note },
		]);
		expect(parseCsv(csv)).toEqual([
			["Title", "Note"],
			["मोमो", 'with "achar", hot'],
			["'=SUM(A1)", "two\nlines"],
		]);
	});

	it("is lenient with a quote inside an unquoted cell, and takes another delimiter", () => {
		expect(parseCsv('5" pipe,ok')).toEqual([['5" pipe', "ok"]]);
		expect(parseCsv("a;b\n1,5;2", ";")).toEqual([
			["a", "b"],
			["1,5", "2"],
		]);
	});

	it("reports the line where an unclosed quote starts", () => {
		expect(() => parseCsv('a,b\nc,"never\nclosed')).toThrow(CsvParseError);
		try {
			parseCsv('a,b\nc,"never\nclosed');
		} catch (error) {
			expect(error instanceof CsvParseError && error.line).toBe(2);
		}
	});
});
