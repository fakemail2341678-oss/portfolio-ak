import { FIELD_WORDS, QUERY_FIELDS, type QueryField } from "./ast";
import { printValue } from "./print";

/**
 * What the bar offers while typing (Task 93): at the word under the caret, the fields that
 * start like it, or, after `field:`, that field's values (its words, or the caller's own
 * names: categories, tags, methods, groups, friends, merchants). Pure, so it is unit-tested.
 */

/** The caller's names for each field that takes names; the closed lists come from the language. */
export type Vocabulary = Partial<Record<QueryField, ReadonlyArray<string>>>;

export type Suggestion = {
	/** What replaces the word (or the value being typed). */
	insert: string;
	/** A field name (more to type after it) or a value (the term is complete). */
	kind: "field" | "value";
	field: QueryField;
};

export type Suggestions = { from: number; to: number; items: Suggestion[] };

/** At most this many suggestions at once. */
export const SUGGESTIONS_MAX = 8;

const NONE: Suggestions = { from: 0, to: 0, items: [] };
const FIELD_PREFIX = /^(-?)([A-Za-z-]+)(>=|<=|:|=|>|<)(.*)$/;

const startsLike = (value: string, typed: string) => value.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase());
const containsLike = (value: string, typed: string) => value.toLocaleLowerCase().includes(typed.toLocaleLowerCase());

/** The values that start like `typed`, then those that contain it, each once, in the vocabulary's order. */
function matching(values: ReadonlyArray<string>, typed: string): string[] {
	const unique = [...new Set(values.filter((value) => value.trim() !== ""))];
	const first = unique.filter((value) => startsLike(value, typed));
	const then = typed === "" ? [] : unique.filter((value) => !startsLike(value, typed) && containsLike(value, typed));
	return [...first, ...then];
}

const valuesOf = (field: QueryField, vocabulary: Vocabulary): ReadonlyArray<string> => [
	...(FIELD_WORDS[field] ?? []),
	...(vocabulary[field] ?? []),
];

export function suggest(text: string, caret: number, vocabulary: Vocabulary): Suggestions {
	const before = text.slice(0, caret);
	const start = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\t"), before.lastIndexOf("\n")) + 1;
	const after = text.slice(caret).search(/\s/u);
	const end = after === -1 ? text.length : caret + after;
	const word = text.slice(start, caret);
	if (word.includes('"')) return NONE;
	const field = FIELD_PREFIX.exec(word);
	const name = field?.[2]?.toLowerCase() ?? "";
	if (field && QUERY_FIELDS.some((each) => each === name)) {
		const known = name as QueryField;
		const values = field[4] ?? "";
		const typed = values.slice(values.lastIndexOf(",") + 1);
		const valueStart = caret - typed.length;
		const items = matching(valuesOf(known, vocabulary), typed)
			.filter((value) => value.toLocaleLowerCase() !== typed.toLocaleLowerCase())
			.slice(0, SUGGESTIONS_MAX)
			.map((value): Suggestion => ({ insert: printValue(value), kind: "value", field: known }));
		return { from: valueStart, to: end, items };
	}
	const typed = word.startsWith("-") ? word.slice(1) : word;
	if (typed === "") return NONE;
	const sign = word.startsWith("-") ? "-" : "";
	const fields = QUERY_FIELDS.filter((each) => startsLike(each, typed)).map(
		(each): Suggestion => ({ insert: `${sign}${each}:`, kind: "field", field: each }),
	);
	// A name of the caller's straight away: "food" offers category:Food.
	const named = (["category", "tag", "group", "with", "method"] as const).flatMap((each) =>
		matching(vocabulary[each] ?? [], typed)
			.slice(0, 2)
			.map((value): Suggestion => ({ insert: `${sign}${each}:${printValue(value)}`, kind: "value", field: each })),
	);
	return { from: start, to: end, items: [...fields, ...named].slice(0, SUGGESTIONS_MAX) };
}

/** The text with a suggestion taken, and where the caret goes: after a value, a space to go on typing. */
export function applySuggestion(
	text: string,
	suggestions: Suggestions,
	item: Suggestion,
): { text: string; caret: number } {
	const head = text.slice(0, suggestions.from) + item.insert;
	const tail = text.slice(suggestions.to);
	const space = item.kind === "value" && !tail.startsWith(" ") ? " " : "";
	return { text: head + space + tail, caret: head.length + space.length };
}
