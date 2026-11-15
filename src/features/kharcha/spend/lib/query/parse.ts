import { isQueryField, MAX_TERMS, MAX_VALUES, QUERY_OPS, type QueryOp, type QueryTerm, type SpendQuery } from "./ast";

/**
 * Text → terms. It never fails: anything that isn't a field term is a word, an unclosed
 * quote runs to the end, and `name:` with an unknown name is a word too ("re:trip"). Inside
 * quotes `\"` is a quote and `\\` a backslash. Whether a term's values make sense is
 * `termProblem`'s (check.ts), so a query being typed keeps its shape.
 */

const SPACE = /\s/u;
const NAME = /[A-Za-z-]/;

type Cursor = { text: string; at: number };

/** A quoted string from `cursor.at` (on the opening quote); the cursor ends after the closing one. */
function readQuoted(cursor: Cursor): string {
	let value = "";
	cursor.at += 1;
	while (cursor.at < cursor.text.length) {
		const char = cursor.text[cursor.at] ?? "";
		if (char === '"') {
			cursor.at += 1;
			return value;
		}
		const next = cursor.text[cursor.at + 1];
		if (char === "\\" && (next === '"' || next === "\\")) {
			value += next;
			cursor.at += 2;
			continue;
		}
		value += char;
		cursor.at += 1;
	}
	return value;
}

/** The operator at the cursor, longest first (`>=` before `>`), or null. */
function readOp(cursor: Cursor): QueryOp | null {
	const rest = cursor.text.slice(cursor.at, cursor.at + 2);
	const op = QUERY_OPS.find((each) => rest.startsWith(each));
	if (!op) return null;
	cursor.at += op.length;
	return op;
}

/** Values separated by commas, each quoted or bare, up to the next space. */
function readValues(cursor: Cursor): string[] {
	const values: string[] = [];
	while (cursor.at < cursor.text.length) {
		const char = cursor.text[cursor.at] ?? "";
		if (SPACE.test(char)) break;
		if (char === ",") {
			cursor.at += 1;
			continue;
		}
		if (char === '"') {
			values.push(readQuoted(cursor));
			continue;
		}
		let value = "";
		while (cursor.at < cursor.text.length) {
			const each = cursor.text[cursor.at] ?? "";
			if (SPACE.test(each) || each === ",") break;
			value += each;
			cursor.at += 1;
		}
		values.push(value);
	}
	return values.filter((value) => value !== "").slice(0, MAX_VALUES);
}

/** A bare word, up to the next space. */
function readWord(cursor: Cursor): string {
	let value = "";
	while (cursor.at < cursor.text.length && !SPACE.test(cursor.text[cursor.at] ?? "")) {
		value += cursor.text[cursor.at];
		cursor.at += 1;
	}
	return value;
}

function readTerm(cursor: Cursor): QueryTerm | null {
	const start = cursor.at;
	const negated = cursor.text[cursor.at] === "-" && !SPACE.test(cursor.text[cursor.at + 1] ?? " ");
	if (negated) cursor.at += 1;
	if (cursor.text[cursor.at] === '"') {
		const value = readQuoted(cursor);
		// A quote run straight into more text ("a"b) reads on as one word.
		const rest = readWord(cursor);
		return { kind: "text", value: value + rest, quoted: true, negated };
	}
	let name = "";
	while (cursor.at < cursor.text.length && NAME.test(cursor.text[cursor.at] ?? "")) {
		name += cursor.text[cursor.at];
		cursor.at += 1;
	}
	const field = name.toLowerCase();
	if (name !== "" && isQueryField(field)) {
		const op = readOp(cursor);
		if (op) return { kind: "field", field, op, values: readValues(cursor), negated };
	}
	cursor.at = start + (negated ? 1 : 0);
	const value = readWord(cursor);
	return value === "" ? null : { kind: "text", value, quoted: false, negated };
}

export function parseQuery(text: string): SpendQuery {
	const cursor: Cursor = { text, at: 0 };
	const terms: SpendQuery = [];
	while (cursor.at < text.length && terms.length < MAX_TERMS) {
		if (SPACE.test(text[cursor.at] ?? "")) {
			cursor.at += 1;
			continue;
		}
		const before = cursor.at;
		const term = readTerm(cursor);
		if (term) terms.push(term);
		// Never stand still on text no term takes (a lone "-" reads as the word "-").
		if (cursor.at === before) cursor.at += 1;
	}
	return terms;
}
