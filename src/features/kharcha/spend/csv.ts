import { type CsvColumn, type CsvDateFormat, parseCsvDay } from "@/lib/csv";
import { minorDigits, toMajor } from "@/lib/i18n/currency";
import { formatNumber, parseLocaleNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import { IMPORT_ROWS_MAX, type ImportRow, importRowSchema } from "../schema";
import type { ExpenseKind, SpendExportRow } from "../types";

/**
 * Spend's CSV (Task 93, decision 0287): the export's columns, with headers in the page's
 * language, and the import's middle step (Expenses' pipeline, 0192, moved and extended): a
 * parsed table, the columns the user mapped and their options → one preview row per line,
 * each an import row (checked by the schema the server uses) or its problems. The import
 * knows the export's headers in every language, so a file read back maps itself.
 */

/** The export's amounts: plain digits in the currency's minor places, so any locale reads them back. */
const plainAmount = (amountMinor: number, currency: string) =>
	toMajor(amountMinor, currency).toFixed(minorDigits(currency));

export const EXPORT_COLUMNS = (): Array<CsvColumn<SpendExportRow>> => [
	{ header: m.kharcha_csv_date(), value: (row) => row.spentOn },
	{ header: m.kharcha_csv_type(), value: (row) => row.kind },
	{ header: m.kharcha_csv_title(), value: (row) => row.title },
	{ header: m.kharcha_csv_merchant(), value: (row) => row.merchant },
	{ header: m.kharcha_csv_category(), value: (row) => row.category },
	{ header: m.kharcha_csv_tags(), value: (row) => row.tags.join(", ") },
	{ header: m.kharcha_csv_method(), value: (row) => row.method },
	{ header: m.kharcha_csv_currency(), value: (row) => row.currency },
	{ header: m.kharcha_csv_amount(), value: (row) => plainAmount(row.amountMinor, row.currency) },
	{ header: m.kharcha_csv_share(), value: (row) => plainAmount(row.shareMinor, row.currency) },
	{ header: m.kharcha_csv_group(), value: (row) => row.group },
	{ header: m.kharcha_csv_paid_by(), value: (row) => row.paidBy.join(", ") },
	{ header: m.kharcha_csv_notes(), value: (row) => row.notes },
];

export const IMPORT_FIELDS = [
	"date",
	"amount",
	"currency",
	"type",
	"title",
	"merchant",
	"category",
	"tags",
	"method",
	"notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Which column (0-based) holds each field; null is "not in the file" (date and amount are required). */
export type ImportMapping = Record<ImportField, number | null>;

export type ImportOptions = {
	/** The first row names the columns (it isn't imported). */
	header: boolean;
	dateFormat: CsvDateFormat;
	/** The currency of rows without a currency column (or with an empty cell). */
	currency: string;
};

export type ImportProblem = { field: ImportField; message: string };

export type PreviewRow = {
	/** The row's number in the file, 1-based (the header is row 1). */
	line: number;
	row: ImportRow | null;
	problems: ImportProblem[];
};

const HEADERS: Record<ImportField, (options?: { locale?: (typeof locales)[number] }) => string> = {
	date: (options) => m.kharcha_csv_date({}, options),
	amount: (options) => m.kharcha_csv_amount({}, options),
	currency: (options) => m.kharcha_csv_currency({}, options),
	type: (options) => m.kharcha_csv_type({}, options),
	title: (options) => m.kharcha_csv_title({}, options),
	merchant: (options) => m.kharcha_csv_merchant({}, options),
	category: (options) => m.kharcha_csv_category({}, options),
	tags: (options) => m.kharcha_csv_tags({}, options),
	method: (options) => m.kharcha_csv_method({}, options),
	notes: (options) => m.kharcha_csv_notes({}, options),
};

/** Other names each field is known by (common exports, Expenses' own columns). */
const OTHER_NAMES: Record<ImportField, ReadonlyArray<string>> = {
	date: ["date", "day", "spent on", "occurred on", "मिति"],
	amount: ["amount", "total", "value", "sum", "रकम"],
	currency: ["currency", "मुद्रा"],
	type: ["type", "kind"],
	title: ["title", "description", "note", "memo", "details", "टिप्पणी"],
	merchant: ["merchant", "payee", "shop", "store", "vendor"],
	category: ["category", "श्रेणी"],
	tags: ["tags", "tag", "labels"],
	method: ["method", "payment method", "paid with", "account"],
	notes: ["notes"],
};

const headerNames = (field: ImportField): string[] => [
	...locales.map((locale) => HEADERS[field]({ locale }).toLocaleLowerCase()),
	...OTHER_NAMES[field],
];

/** A first guess at the mapping from the header row: each field takes the first column named like it, once. */
export function guessMapping(header: ReadonlyArray<string>): ImportMapping {
	const names = header.map((cell) => cell.trim().toLocaleLowerCase());
	const taken = new Set<number>();
	const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, null])) as ImportMapping;
	for (const field of IMPORT_FIELDS) {
		const known = headerNames(field);
		const index = names.findIndex((name, at) => !taken.has(at) && known.includes(name));
		if (index !== -1) {
			mapping[field] = index;
			taken.add(index);
		}
	}
	return mapping;
}

/**
 * "1,250.50", "रु १२,५००", "$ -12" → a signed number of minor units of `currency`; NaN when
 * it isn't an amount or has more decimals than the currency's.
 */
export function parseImportAmount(text: string, currency: string): number {
	const number = parseLocaleNumber(text.replace(/[^\d०-९.,+-]/g, ""));
	if (number === undefined || !Number.isFinite(number)) return Number.NaN;
	const minor = number * 10 ** minorDigits(currency);
	return Math.abs(Math.round(minor) - minor) < 1e-6 ? Math.round(minor) : Number.NaN;
}

/** A currency cell: an ISO code or a common symbol; "" is the default; null when unknown. */
export function parseImportCurrency(text: string, fallback: string, offered: ReadonlyArray<string>): string | null {
	const value = text.trim().toUpperCase();
	if (value === "") return fallback;
	if (offered.includes(value)) return value;
	if (["RS", "NRS", "RS.", "रु", "रू", "नेरू"].includes(value) && offered.includes("NPR")) return "NPR";
	if ((value === "$" || value === "US$") && offered.includes("USD")) return "USD";
	if (value === "₹" && offered.includes("INR")) return "INR";
	return null;
}

const KIND_NAMES: Record<ExpenseKind, (options?: { locale?: (typeof locales)[number] }) => string> = {
	expense: (options) => m.kharcha_kind_expense({}, options),
	refund: (options) => m.kharcha_kind_refund({}, options),
};

/** A type cell: `expense` or `refund` (or their names in any language); "" follows the amount's sign. */
function parseKind(text: string): ExpenseKind | null | undefined {
	const value = text.trim().toLocaleLowerCase();
	if (value === "") return undefined;
	for (const kind of ["expense", "refund"] as const) {
		if (value === kind || locales.some((locale) => KIND_NAMES[kind]({ locale }).toLocaleLowerCase() === value)) {
			return kind;
		}
	}
	return null;
}

const FIELD_OF: Record<keyof ImportRow, ImportField> = {
	spentOn: "date",
	kind: "type",
	amountMinor: "amount",
	currency: "currency",
	title: "title",
	merchant: "merchant",
	notes: "notes",
	category: "category",
	tags: "tags",
	method: "method",
};

/** Every line of the table (after the header), as an import row or its problems. */
export function previewImport(
	table: ReadonlyArray<ReadonlyArray<string>>,
	mapping: ImportMapping,
	options: ImportOptions,
	offered: ReadonlyArray<string>,
): PreviewRow[] {
	const body = options.header ? table.slice(1) : table;
	const first = options.header ? 2 : 1;
	return body.map((cells, offset): PreviewRow => {
		const cell = (field: ImportField) => {
			const column = mapping[field];
			return column === null ? "" : (cells[column] ?? "").trim();
		};
		const problems: ImportProblem[] = [];
		const currency = parseImportCurrency(cell("currency"), options.currency, offered);
		if (!currency) problems.push({ field: "currency", message: m.kharcha_import_error_currency() });
		const kind = parseKind(cell("type"));
		if (kind === null) problems.push({ field: "type", message: m.kharcha_import_error_type() });
		const signed = parseImportAmount(cell("amount"), currency ?? options.currency);
		const dateText = cell("date");
		const candidate = {
			spentOn: parseCsvDay(dateText, options.dateFormat) ?? dateText,
			// A negative amount with no type is money back.
			kind: kind ?? (signed < 0 ? "refund" : "expense"),
			amountMinor: Number.isNaN(signed) ? signed : Math.abs(signed),
			currency: currency ?? options.currency,
			title: cell("title"),
			merchant: cell("merchant"),
			notes: cell("notes"),
			category: cell("category"),
			tags: [
				...new Set(
					cell("tags")
						.split(/[,;]/)
						.map((tag) => tag.trim())
						.filter(Boolean),
				),
			],
			method: cell("method"),
		};
		const parsed = importRowSchema.safeParse(candidate);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path[0];
				const field = typeof key === "string" && key in FIELD_OF ? FIELD_OF[key as keyof ImportRow] : "date";
				problems.push({ field, message: issue.message });
			}
		}
		return { line: first + offset, row: parsed.success && problems.length === 0 ? parsed.data : null, problems };
	});
}

/** Why the table can't be imported at all (no rows, too many), or null. */
export function tableProblem(table: ReadonlyArray<ReadonlyArray<string>>, options: Pick<ImportOptions, "header">) {
	const rows = table.length - (options.header ? 1 : 0);
	if (rows <= 0) return m.kharcha_import_error_empty();
	if (rows > IMPORT_ROWS_MAX) return m.kharcha_import_error_rows({ max: formatNumber(IMPORT_ROWS_MAX) });
	return null;
}
