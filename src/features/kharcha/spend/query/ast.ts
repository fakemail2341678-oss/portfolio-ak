/**
 * Spend's search language (PLAN Task 93, docs/guides/kharcha.md "Spend's search"): a
 * query is a list of terms, all of which must match. A term is a word or a quoted phrase
 * (searched in the title, merchant and notes), or a field with an operator and values
 * (`category:food`, `amount>500`, `date:this-month`); a leading `-` negates it and commas
 * between values mean OR (`tag:trip,work`). Field names are English in every language
 * (decision 0287); values are the caller's own names, in any script.
 */

/** Every field, in the order suggestions list them. The server's compiler allows only these. */
export const QUERY_FIELDS = [
	"type",
	"category",
	"tag",
	"merchant",
	"amount",
	"currency",
	"date",
	"group",
	"with",
	"paid-by",
	"method",
	"has",
	"is",
] as const;
export type QueryField = (typeof QUERY_FIELDS)[number];

export const QUERY_OPS = [":", "=", ">=", "<=", ">", "<"] as const;
export type QueryOp = (typeof QUERY_OPS)[number];

/** A word, or a phrase in quotes: both search the title, merchant and notes. */
export type TextTerm = { kind: "text"; value: string; quoted: boolean; negated: boolean };
/** `field op value[,value…]`; no values while it is being typed (`category:`). */
export type FieldTerm = { kind: "field"; field: QueryField; op: QueryOp; values: string[]; negated: boolean };
export type QueryTerm = TextTerm | FieldTerm;
export type SpendQuery = QueryTerm[];

/** What `type:` takes: an expense, money back, or a payment between two people (settling up). */
export const TYPE_VALUES = ["expense", "refund", "payment"] as const;
export const HAS_VALUES = ["receipt"] as const;
export const IS_VALUES = ["shared", "personal", "unsettled", "duplicate", "uncategorized"] as const;
/** `date:` words, besides `YYYY`, `YYYY-MM` and `YYYY-MM-DD`. Weeks start on Sunday, as Nepal's do. */
export const DATE_WORDS = [
	"today",
	"yesterday",
	"this-week",
	"last-week",
	"this-month",
	"last-month",
	"this-year",
	"last-year",
] as const;

/** Which operators each field takes: `:` and `=` alike, except `merchant` (contains / exact). */
export const FIELD_OPS: Record<QueryField, ReadonlyArray<QueryOp>> = {
	type: [":", "="],
	category: [":", "="],
	tag: [":", "="],
	merchant: [":", "="],
	amount: [":", "=", ">=", "<=", ">", "<"],
	currency: [":", "="],
	date: [":", "=", ">=", "<=", ">", "<"],
	group: [":", "="],
	with: [":", "="],
	"paid-by": [":", "="],
	method: [":", "="],
	has: [":", "="],
	is: [":", "="],
};

/** The words a field takes, when it is a closed list. */
export const FIELD_WORDS: Partial<Record<QueryField, ReadonlyArray<string>>> = {
	type: TYPE_VALUES,
	has: HAS_VALUES,
	is: IS_VALUES,
	date: DATE_WORDS,
};

/** At most this many terms, and values in one term: a longer query keeps the first ones. */
export const MAX_TERMS = 30;
export const MAX_VALUES = 20;

export const isQueryField = (value: string): value is QueryField => QUERY_FIELDS.some((field) => field === value);
