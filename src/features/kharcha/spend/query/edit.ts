import { addMonths, type IsoMonth } from "@/lib/i18n/date-only";
import type { QueryField, SpendQuery } from "./ast";
import { parseQuery } from "./parse";
import { printQuery } from "./print";

/**
 * Changes to a query made by the bar (PLAN Task 93, "chips and FilterBar, both ways"): a
 * chip's ✕ drops its term, and a filter control sets its field in `q`, so the text, the
 * chips and the controls always say the same thing.
 */

/** The fields Spend's filter controls set: one value each, or none. */
export const BAR_FIELDS = ["type", "category", "date"] as const satisfies ReadonlyArray<QueryField>;
export type BarField = (typeof BAR_FIELDS)[number];
export type BarValues = Partial<Record<BarField, string>>;

/** A control's value when the query says more than one value can (`category:food,rent`, `-type:refund`). */
export const COMPLEX = "*";

export const withoutTerm = (terms: SpendQuery, index: number): SpendQuery => terms.filter((_, at) => at !== index);

/**
 * What a control shows for `field`: "" when the query doesn't name it, its one value when
 * it is a single positive `field:value`, else COMPLEX.
 */
export function controlValue(terms: SpendQuery, field: QueryField): string {
	const named = terms.filter((term) => term.kind === "field" && term.field === field);
	if (named.length === 0) return "";
	const [only] = named;
	if (named.length === 1 && only?.kind === "field" && !only.negated && (only.op === ":" || only.op === "=")) {
		const [value, ...rest] = only.values;
		if (value !== undefined && rest.length === 0) return value;
	}
	return COMPLEX;
}

/** The query with `field` set to `value` alone (every term of it replaced), or without it for "". */
export function setField(terms: SpendQuery, field: QueryField, value: string): SpendQuery {
	const rest = terms.filter((term) => term.kind !== "field" || term.field !== field);
	return value === "" ? rest : [...rest, { kind: "field", field, op: ":", values: [value], negated: false }];
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * The bar's form → `q`: each control that changed from what `previous` showed sets its
 * field; one that didn't leaves the text alone (what was typed wins). Without JavaScript
 * the form arrives as `?q=…&category=…`, with nothing to compare to: `previous` is then
 * the submitted text itself.
 */
export function foldControls(q: string, controls: BarValues, previous: string = q): string {
	const before = parseQuery(previous);
	let terms = parseQuery(q);
	let changed = false;
	for (const [field, value] of Object.entries(controls) as Array<[BarField, string | undefined]>) {
		if (value === undefined || value === COMPLEX) continue;
		const shown = controlValue(before, field);
		if (same(value, shown) || (shown === COMPLEX && value === "")) continue;
		terms = setField(terms, field, value);
		changed = true;
	}
	return changed ? printQuery(terms) : q;
}

/**
 * The month a query is about, when it names exactly one (`date:2026-11`, `date:this-month`,
 * `date:last-month`): the header steps through months from it. Null otherwise.
 */
export function queryMonth(terms: SpendQuery, thisMonth: IsoMonth): IsoMonth | null {
	const value = controlValue(terms, "date").toLowerCase();
	if (value === "this-month") return thisMonth;
	if (value === "last-month") return addMonths(thisMonth, -1);
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

/** The query with its month moved by `by`. */
export const stepMonth = (terms: SpendQuery, month: IsoMonth, by: number): SpendQuery =>
	setField(terms, "date", addMonths(month, by));
