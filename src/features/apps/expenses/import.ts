import { type CsvDateFormat, parseCsvDay } from "@/lib/csv";
import { formatNumber, parseLocaleNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type ImportRow, importRowSchema } from "./schema";
import { EXPENSES_QUOTAS, type ExpenseCurrency, isExpenseCurrency, MINOR_UNITS } from "./types";

/**
 * The CSV import's middle step (decision 0192): a parsed table, the columns the user
 * mapped and their options -> one preview row per line, each either an import row
 * (checked by the same Zod schema the server uses) or its errors. Pure, so the
 * preview is unit-tested and the server's check can never disagree with it.
 */

export const IMPORT_FIELDS = ["date", "amount", "category", "note", "currency"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Which column (0-based) holds each field; null is "not in the file" (date and amount are required). */
export type ImportMapping = Record<ImportField, number | null>;

export type ImportOptions = {
	/** The first row names the columns (it isn't imported). */
	header: boolean;
	dateFormat: CsvDateFormat;
	/** The currency of rows without a currency column (or with an empty cell). */
	currency: ExpenseCurrency;
};

export type ImportProblem = { field: ImportField; message: string };

export type PreviewRow = {
	/** The row's number in the file, 1-based (the header is row 1). */
	line: number;
	cells: string[];
	row: ImportRow | null;
	problems: ImportProblem[];
};

/**
 * "1,250.50", "रु १२,५००", "$ 12" -> minor units (125050, 1250000, 1200); NaN when it
 * isn't an amount or has more than two decimals. Signs are kept (the schema refuses
 * zero and negatives with its own message).
 */
export function parseAmount(text: string): number {
	const number = parseLocaleNumber(text.replace(/[^\d०-९.,+-]/g, ""));
	if (number === undefined || !Number.isFinite(number)) return Number.NaN;
	const minor = number * MINOR_UNITS;
	return Math.abs(Math.round(minor) - minor) < 1e-6 ? Math.round(minor) : Number.NaN;
}

/** A currency cell: an ISO code or a common symbol; "" is the default; null when unknown. */
export function parseCurrency(text: string, fallback: ExpenseCurrency): ExpenseCurrency | null {
	const value = text.trim().toUpperCase();
	if (value === "") return fallback;
	if (isExpenseCurrency(value)) return value;
	if (["RS", "NRS", "RS.", "रु", "रू", "नेरू"].includes(value)) return "NPR";
	if (value === "$" || value === "US$") return "USD";
	return null;
}

/** Header names each field is recognized by (the export's own, in both languages, and common ones). */
const HEADER_NAMES: Record<ImportField, ReadonlyArray<string>> = {
	date: ["date", "day", "occurred on", "मिति"],
	amount: ["amount", "value", "sum", "रकम"],
	category: ["category", "type", "श्रेणी"],
	note: ["note", "description", "memo", "details", "टिप्पणी"],
	currency: ["currency", "मुद्रा"],
};

/** A first guess at the mapping from the header row: each field takes the first column named like it. */
export function guessMapping(header: ReadonlyArray<string>): ImportMapping {
	const names = header.map((cell) => cell.trim().toLowerCase());
	const find = (field: ImportField) => {
		const index = names.findIndex((name) => HEADER_NAMES[field].includes(name));
		return index === -1 ? null : index;
	};
	return {
		date: find("date"),
		amount: find("amount"),
		category: find("category"),
		note: find("note"),
		currency: find("currency"),
	};
}

const FIELD_OF: Record<keyof ImportRow, ImportField> = {
	occurredOn: "date",
	amountMinor: "amount",
	currency: "currency",
	category: "category",
	note: "note",
};

/** Every line of the table (after the header), as an import row or its problems. */
export function previewImport(
	table: ReadonlyArray<ReadonlyArray<string>>,
	mapping: ImportMapping,
	options: ImportOptions,
): PreviewRow[] {
	const body = options.header ? table.slice(1) : table;
	const first = options.header ? 2 : 1;
	return body.map((cells, offset): PreviewRow => {
		const cell = (column: number | null) => (column === null ? "" : (cells[column] ?? "").trim());
		const problems: ImportProblem[] = [];
		const currency = parseCurrency(cell(mapping.currency), options.currency);
		if (!currency) problems.push({ field: "currency", message: m.expenses_import_error_currency() });
		const dateText = cell(mapping.date);
		const candidate = {
			occurredOn: parseCsvDay(dateText, options.dateFormat) ?? dateText,
			amountMinor: parseAmount(cell(mapping.amount)),
			currency: currency ?? options.currency,
			category: cell(mapping.category),
			note: cell(mapping.note),
		};
		const parsed = importRowSchema.safeParse(candidate);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path[0];
				const field = typeof key === "string" && key in FIELD_OF ? FIELD_OF[key as keyof ImportRow] : "date";
				problems.push({ field, message: issue.message });
			}
		}
		return {
			line: first + offset,
			cells: [...cells],
			row: parsed.success && problems.length === 0 ? parsed.data : null,
			problems,
		};
	});
}

/** Why the table can't be imported at all (no rows, too many), or null. */
export function tableProblem(table: ReadonlyArray<ReadonlyArray<string>>, options: Pick<ImportOptions, "header">) {
	const rows = table.length - (options.header ? 1 : 0);
	if (rows <= 0) return m.expenses_import_error_empty();
	if (rows > EXPENSES_QUOTAS.importRows)
		return m.expenses_import_error_rows({ max: formatNumber(EXPENSES_QUOTAS.importRows) });
	return null;
}
