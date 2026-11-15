import { addDays, addMonths, type IsoDate, isIsoDate, monthDays, weekdayOf } from "@/lib/i18n/date-only";
import { FIELD_OPS, FIELD_WORDS, type FieldTerm, type QueryTerm } from "./ast";

/**
 * What a term means, shared by the bar (which marks a term it can't use) and the server's
 * compiler (which leaves such a term out): amounts, currencies and dates read here, once.
 */

export type TermProblem = "empty" | "op" | "value";

const DEVANAGARI = /[०-९]/g;
const latinDigits = (text: string) => text.replace(DEVANAGARI, (digit) => String(digit.charCodeAt(0) - 0x0966));

/** An amount in major units ("500", "12.50", "१२५०"); null when it isn't one. No grouping commas: a comma means OR. */
export function parseQueryAmount(text: string): string | null {
	const value = latinDigits(text.trim());
	return /^\d{1,12}(\.\d{1,3})?$/.test(value) ? value : null;
}

export const parseQueryCurrency = (text: string): string | null =>
	/^[A-Za-z]{3}$/.test(text.trim()) ? text.trim().toUpperCase() : null;

export type DayRange = { first: IsoDate; last: IsoDate };

/** Sunday of the week `day` is in. */
const weekStart = (day: IsoDate): IsoDate => addDays(day, -weekdayOf(day));

/**
 * The days a `date:` value covers, from `today` in the caller's time zone: a word, a year,
 * a month or a day; null when it is none of them.
 */
export function dateRange(text: string, today: IsoDate): DayRange | null {
	const value = latinDigits(text.trim().toLowerCase());
	const month = today.slice(0, 7);
	const year = Number(today.slice(0, 4));
	switch (value) {
		case "today":
			return { first: today, last: today };
		case "yesterday":
			return { first: addDays(today, -1), last: addDays(today, -1) };
		case "this-week":
			return { first: weekStart(today), last: addDays(weekStart(today), 6) };
		case "last-week":
			return { first: addDays(weekStart(today), -7), last: addDays(weekStart(today), -1) };
		case "this-month":
			return monthDays(month);
		case "last-month":
			return monthDays(addMonths(month, -1));
		case "this-year":
			return { first: `${year}-01-01`, last: `${year}-12-31` };
		case "last-year":
			return { first: `${year - 1}-01-01`, last: `${year - 1}-12-31` };
	}
	if (/^\d{4}$/.test(value)) return { first: `${value}-01-01`, last: `${value}-12-31` };
	if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return monthDays(value);
	if (isIsoDate(value)) return { first: value, last: value };
	return null;
}

/** Whether a value is one the field can't read (a date is checked for its shape: any day stands in for today). */
function valueProblem(term: FieldTerm, value: string): boolean {
	const words = FIELD_WORDS[term.field];
	switch (term.field) {
		case "amount":
			return parseQueryAmount(value) === null;
		case "currency":
			return parseQueryCurrency(value) === null;
		case "date":
			return dateRange(value, "2000-01-01") === null;
		default:
			return words ? !words.includes(value.toLowerCase()) : false;
	}
}

/** Whether a term can be used, and if not why: no value yet, an operator the field doesn't take, a value it can't read. */
export function termProblem(term: QueryTerm): TermProblem | null {
	if (term.kind === "text") return term.value.trim() === "" ? "empty" : null;
	if (term.values.length === 0) return "empty";
	if (!FIELD_OPS[term.field].includes(term.op)) return "op";
	return term.values.some((value) => valueProblem(term, value)) ? "value" : null;
}

/** The terms the server applies: those without a problem. */
export const usableTerms = <T extends QueryTerm>(terms: ReadonlyArray<T>): T[] =>
	terms.filter((term) => termProblem(term) === null);
