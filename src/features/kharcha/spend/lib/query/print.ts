import type { QueryTerm, SpendQuery } from "./ast";

/**
 * Terms → text, the parser's inverse: `parseQuery(printQuery(terms))` gives the terms back
 * (a word that needs quotes comes back quoted), and printing a parsed query is stable.
 * Field names print in lower case; a value or word is quoted when it holds a space, a
 * comma or a quote, is empty, or would read as something else (a word's leading `-` or
 * `name:`; a value's leading `=`, `<` or `>`, which would join the operator: `amount>=5`).
 */

const quote = (value: string) => `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;

/** Whether a field's value must be quoted to read back as itself. */
export const valueNeedsQuotes = (value: string) => value === "" || /[\s,"]/u.test(value) || /^[=<>]/.test(value);

/** Whether a word must be quoted to read back as a word. */
export const wordNeedsQuotes = (value: string) =>
	value === "" || /[\s"]/u.test(value) || value.startsWith("-") || /^[A-Za-z-]+(:|=|<|>)/.test(value);

export const printValue = (value: string) => (valueNeedsQuotes(value) ? quote(value) : value);

export function printTerm(term: QueryTerm): string {
	const sign = term.negated ? "-" : "";
	if (term.kind === "text") {
		return `${sign}${term.quoted || wordNeedsQuotes(term.value) ? quote(term.value) : term.value}`;
	}
	return `${sign}${term.field}${term.op}${term.values.map(printValue).join(",")}`;
}

export const printQuery = (terms: SpendQuery): string => terms.map(printTerm).join(" ");
