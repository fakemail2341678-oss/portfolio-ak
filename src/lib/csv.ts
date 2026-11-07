import { isIsoDate } from "@/lib/i18n/date-only";

/**
 * Recipe (docs/guides/recipes.md, "CSV export"; decision 0148): rows to CSV
 * (RFC 4180) and a browser download. Columns pick and label the values, so the
 * export matches what the table shows. `parseCsv` reads CSV back (Expenses' import,
 * decision 0192).
 *
 * Cells that a spreadsheet would run as a formula (starting with = + - @, tab
 * or carriage return) are prefixed with an apostrophe (OWASP "CSV injection").
 */
export type CsvColumn<Row> = { header: string; value: (row: Row) => string | number | boolean | null | undefined };

const FORMULA = /^[=+\-@\t\r]/;

export const csvCell = (value: string | number | boolean | null | undefined): string => {
	if (value === null || value === undefined) return "";
	let text = String(value);
	if (typeof value === "string" && FORMULA.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The CSV text, with a header row and CRLF line ends. */
export const toCsv = <Row>(rows: ReadonlyArray<Row>, columns: ReadonlyArray<CsvColumn<Row>>): string =>
	[
		columns.map((column) => csvCell(column.header)),
		...rows.map((row) => columns.map((column) => csvCell(column.value(row)))),
	]
		.map((cells) => cells.join(","))
		.join("\r\n");

const BOM = String.fromCharCode(0xfeff);

/** Saves `csv` as `filename` (UTF-8 with a BOM, so Excel reads Devanagari correctly). */
export function downloadCsv(filename: string, csv: string) {
	saveBlob(filename, new Blob([BOM, csv], { type: "text/csv;charset=utf-8" }));
}

/**
 * Saves JSON text as `filename`.
 *
 * @public
 */
export function downloadJson(filename: string, json: string) {
	saveBlob(filename, new Blob([json], { type: "application/json;charset=utf-8" }));
}

function saveBlob(filename: string, blob: Blob) {
	const url = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement("a"), { href: url, download: filename });
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export class CsvParseError extends Error {
	constructor(
		message: string,
		/** The 1-based line the problem starts on. */
		readonly line: number,
	) {
		super(message);
		this.name = "CsvParseError";
	}
}

/**
 * CSV text (RFC 4180) -> rows of cells. Fields are separated by `delimiter`; a quoted
 * field may hold delimiters, line breaks and doubled quotes (`""`). Lines end in CRLF,
 * LF or CR; a leading BOM is ignored, and so are lines with nothing on them (the final
 * line break included). Lenient where the RFC allows it: a quote inside an unquoted
 * field is kept as text. An unclosed quote throws CsvParseError with its line.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
	const input = text.startsWith(BOM) ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let line = 1;
	let index = 0;
	const endRow = () => {
		row.push(field);
		if (row.length > 1 || row[0] !== "") rows.push(row);
		row = [];
		field = "";
	};
	while (index < input.length) {
		const char = input[index];
		if (char === '"' && field === "") {
			// A quoted field: up to the closing quote, `""` being one quote.
			const start = line;
			index++;
			for (;;) {
				if (index >= input.length) throw new CsvParseError("Unclosed quote", start);
				const inner = input[index] ?? "";
				if (inner === '"' && input[index + 1] === '"') {
					field += '"';
					index += 2;
				} else if (inner === '"') {
					index++;
					break;
				} else {
					if (inner === "\n" || (inner === "\r" && input[index + 1] !== "\n")) line++;
					field += inner;
					index++;
				}
			}
		} else if (char === delimiter) {
			row.push(field);
			field = "";
			index++;
		} else if (char === "\r" || char === "\n") {
			endRow();
			line++;
			index += char === "\r" && input[index + 1] === "\n" ? 2 : 1;
		} else {
			field += char;
			index++;
		}
	}
	if (field !== "" || row.length > 0) endRow();
	return rows;
}

/** How a CSV's date column is written (the imports' "Date format"). */
export const CSV_DATE_FORMATS = ["ymd", "dmy", "mdy"] as const;
export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];

/**
 * "2026-10-30", "30/10/2026" or "10/30/2026" (also with - or . between) -> "YYYY-MM-DD", or null.
 *
 * @public
 */
export function parseCsvDay(text: string, format: CsvDateFormat): string | null {
	const parts = text.trim().split(/[-/.]/);
	if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
	const [a = "", b = "", c = ""] = parts;
	const [year, month, day] = format === "ymd" ? [a, b, c] : format === "dmy" ? [c, b, a] : [c, a, b];
	if (year.length !== 4) return null;
	const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	return isIsoDate(iso) ? iso : null;
}
