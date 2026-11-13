import { describe, expect, it } from "vitest";
import {
	EXPORT_COLUMNS,
	guessMapping,
	IMPORT_FIELDS,
	type ImportMapping,
	type ImportOptions,
	parseImportAmount,
	parseImportCurrency,
	previewImport,
	tableProblem,
} from "@/features/kharcha/spend/csv";
import {
	DATE_WORDS,
	type FieldTerm,
	MAX_TERMS,
	MAX_VALUES,
	QUERY_FIELDS,
	QUERY_OPS,
	type QueryTerm,
} from "@/features/kharcha/spend/query/ast";
import {
	dateRange,
	parseQueryAmount,
	parseQueryCurrency,
	termProblem,
	usableTerms,
} from "@/features/kharcha/spend/query/check";
import {
	COMPLEX,
	controlValue,
	foldControls,
	queryMonth,
	setField,
	stepMonth,
	withoutTerm,
} from "@/features/kharcha/spend/query/edit";
import { parseQuery } from "@/features/kharcha/spend/query/parse";
import { printQuery, printTerm, valueNeedsQuotes, wordNeedsQuotes } from "@/features/kharcha/spend/query/print";
import { applySuggestion, suggest, type Vocabulary } from "@/features/kharcha/spend/query/suggest";

/** Spend's search language and CSV (Task 93): the parser, printer, checks, edits, suggestions and import preview. */

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function random(seed: number) {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
	const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
	const pick = <T>(items: ReadonlyArray<T>): T => items[int(0, items.length - 1)] as T;
	return { next, int, pick };
}

const text = (value: string, quoted = false, negated = false): QueryTerm => ({ kind: "text", value, quoted, negated });
const field = (name: FieldTerm["field"], op: FieldTerm["op"], values: string[], negated = false): FieldTerm => ({
	kind: "field",
	field: name,
	op,
	values,
	negated,
});

describe("parseQuery", () => {
	it("reads words and quoted phrases", () => {
		expect(parseQuery("  coffee   beans ")).toEqual([text("coffee"), text("beans")]);
		expect(parseQuery('"corner shop" tea')).toEqual([text("corner shop", true), text("tea")]);
		expect(parseQuery("")).toEqual([]);
		expect(parseQuery("   ")).toEqual([]);
	});

	it("negates words, phrases and fields", () => {
		expect(parseQuery('-tea -"corner shop" -category:food')).toEqual([
			text("tea", false, true),
			text("corner shop", true, true),
			field("category", ":", ["food"], true),
		]);
	});

	it("reads every operator, the longest first", () => {
		for (const op of QUERY_OPS) {
			expect(parseQuery(`amount${op}5`), op).toEqual([field("amount", op, ["5"])]);
		}
		expect(parseQuery("amount>=5")).toEqual([field("amount", ">=", ["5"])]);
		expect(parseQuery("amount<=5")).toEqual([field("amount", "<=", ["5"])]);
	});

	it("reads comma-separated values as OR", () => {
		expect(parseQuery("tag:trip,work,,food")).toEqual([field("tag", ":", ["trip", "work", "food"])]);
	});

	it("reads quoted values with spaces, commas and escaped quotes and backslashes", () => {
		expect(parseQuery('category:"Eating out",Food')).toEqual([field("category", ":", ["Eating out", "Food"])]);
		expect(parseQuery(String.raw`merchant:"say \"hi\", ok"`)).toEqual([field("merchant", ":", ['say "hi", ok'])]);
		expect(parseQuery(String.raw`merchant:"a\\b"`)).toEqual([field("merchant", ":", [String.raw`a\b`])]);
		// A backslash before anything else stays itself.
		expect(parseQuery(String.raw`"a\nb"`)).toEqual([text(String.raw`a\nb`, true)]);
	});

	it("keeps an unknown name as a word", () => {
		expect(parseQuery("re:trip")).toEqual([text("re:trip")]);
		expect(parseQuery("foo>3")).toEqual([text("foo>3")]);
		expect(parseQuery("category")).toEqual([text("category")]);
		expect(parseQuery("-re:trip")).toEqual([text("re:trip", false, true)]);
	});

	it("reads field names in any case, keeping the value's", () => {
		expect(parseQuery("Category:Food")).toEqual([field("category", ":", ["Food"])]);
		expect(parseQuery("PAID-BY:Asha")).toEqual([field("paid-by", ":", ["Asha"])]);
	});

	it("gives no values for an empty one", () => {
		expect(parseQuery("category:")).toEqual([field("category", ":", [])]);
		expect(parseQuery('category:""')).toEqual([field("category", ":", [])]);
		expect(parseQuery("tag:,,")).toEqual([field("tag", ":", [])]);
	});

	it("runs an unclosed quote to the end", () => {
		expect(parseQuery('"corner sho')).toEqual([text("corner sho", true)]);
		expect(parseQuery('category:"Eating ou')).toEqual([field("category", ":", ["Eating ou"])]);
		expect(parseQuery('tea "a b')).toEqual([text("tea"), text("a b", true)]);
	});

	it("reads Devanagari values", () => {
		expect(parseQuery("category:खाना")).toEqual([field("category", ":", ["खाना"])]);
		expect(parseQuery("खाना -चिया")).toEqual([text("खाना"), text("चिया", false, true)]);
	});

	it("keeps the first MAX_TERMS terms and MAX_VALUES values", () => {
		const words = Array.from({ length: MAX_TERMS + 5 }, (_, at) => `w${at}`);
		const terms = parseQuery(words.join(" "));
		expect(terms).toHaveLength(MAX_TERMS);
		expect(terms.at(-1)).toEqual(text(`w${MAX_TERMS - 1}`));
		const values = Array.from({ length: MAX_VALUES + 5 }, (_, at) => `v${at}`);
		const [term] = parseQuery(`tag:${values.join(",")}`);
		expect(term?.kind === "field" ? term.values : []).toEqual(values.slice(0, MAX_VALUES));
	});

	it("reads a lone dash as a word, not as a negation", () => {
		expect(parseQuery("-")).toEqual([text("-")]);
		expect(parseQuery("- tea")).toEqual([text("-"), text("tea")]);
		expect(parseQuery("tea -")).toEqual([text("tea"), text("-")]);
	});

	it("reads a quote run into text as one word", () => {
		expect(parseQuery('"a"b c')).toEqual([text("ab", true), text("c")]);
	});
});

describe("printQuery", () => {
	it("prints the canonical form", () => {
		expect(printQuery(parseQuery("  Category:Food   -tea  amount>=5 "))).toBe("category:Food -tea amount>=5");
		expect(printQuery([])).toBe("");
	});

	it("quotes what would read back as something else", () => {
		expect(printTerm(text("a b"))).toBe('"a b"');
		expect(printTerm(text("-x"))).toBe('"-x"');
		expect(printTerm(text("re:trip"))).toBe('"re:trip"');
		expect(printTerm(text("a>b"))).toBe('"a>b"');
		expect(printTerm(text('say "hi"'))).toBe(String.raw`"say \"hi\""`);
		expect(printTerm(text("x", true, true))).toBe('-"x"');
		expect(printTerm(text("plain"))).toBe("plain");
		expect(printTerm(text("5:30"))).toBe("5:30");
		expect(printTerm(field("category", ":", ["Eating out", "Food"]))).toBe('category:"Eating out",Food');
		expect(printTerm(field("tag", ":", ["a,b"]))).toBe('tag:"a,b"');
		expect(printTerm(field("merchant", ":", ["-x"]))).toBe("merchant:-x");
		expect(printTerm(field("merchant", ":", [String.raw`a\b`]))).toBe(String.raw`merchant:a\b`);
		expect(printTerm(field("category", ":", [], true))).toBe("-category:");
	});

	it("says which words and values need quotes", () => {
		expect(wordNeedsQuotes("")).toBe(true);
		expect(wordNeedsQuotes("food")).toBe(false);
		expect(wordNeedsQuotes("a,b")).toBe(false);
		expect(wordNeedsQuotes("tag:x")).toBe(true);
		expect(wordNeedsQuotes("खाना")).toBe(false);
		expect(valueNeedsQuotes("")).toBe(true);
		expect(valueNeedsQuotes("a,b")).toBe(true);
		expect(valueNeedsQuotes("a b")).toBe(true);
		expect(valueNeedsQuotes('a"b')).toBe(true);
		expect(valueNeedsQuotes("-a")).toBe(false);
	});

	it('reads an operator-looking value back as a value (amount>"=5")', () => {
		const terms = [field("amount", ">", ["=5"])];
		expect(parseQuery(printQuery(terms))).toEqual(terms);
	});

	const ALPHABET = [...'abXY09 ,"\\-:é'].concat(["खाना", "ख", " ", " ", "re", "tag", "-"]);

	function randomText(r: ReturnType<typeof random>) {
		const length = r.int(1, 7);
		let value = "";
		for (let at = 0; at < length; at += 1) value += r.pick(ALPHABET);
		return value;
	}

	function randomTerm(r: ReturnType<typeof random>): QueryTerm {
		const negated = r.next() < 0.3;
		if (r.next() < 0.4) {
			return { kind: "text", value: randomText(r), quoted: r.next() < 0.4, negated };
		}
		const count = r.int(0, 4);
		return {
			kind: "field",
			field: r.pick(QUERY_FIELDS),
			op: r.pick(QUERY_OPS),
			values: Array.from({ length: count }, () => randomText(r)).filter(
				(value) => !/^[\s]*$/.test(value) || value !== "",
			),
			negated,
		};
	}

	it("parse(print(terms)) gives the terms back (seeded property)", () => {
		const r = random(93);
		for (let run = 0; run < 600; run += 1) {
			const terms = Array.from({ length: r.int(0, 6) }, () => randomTerm(r)).map((term): QueryTerm => {
				if (term.kind === "text") return term;
				// A value starting with "=" after ">" or "<" would read as ">=" / "<=": the one known ambiguity (tested above).
				const values = term.values.map((value) =>
					(term.op === ">" || term.op === "<") && value.startsWith("=") ? `x${value}` : value,
				);
				return { ...term, values };
			});
			const printed = printQuery(terms);
			const expected = terms.map(
				(term): QueryTerm =>
					term.kind === "text" ? { ...term, quoted: term.quoted || wordNeedsQuotes(term.value) } : term,
			);
			expect(parseQuery(printed), `seed 93 run ${run}: ${JSON.stringify(terms)} printed as ${printed}`).toEqual(
				expected,
			);
		}
	});

	it("print(parse(print(parse(s)))) is print(parse(s)) for random strings (seeded property)", () => {
		const r = random(287);
		const pieces = [
			"category",
			"tag",
			"amount",
			"is",
			"paid-by",
			"-",
			":",
			">",
			"<",
			"=",
			">=",
			'"',
			",",
			" ",
			" ",
			"\\",
			"foo",
			"खाना",
			"re:",
			"a b",
			'\\"',
			"\t",
		];
		for (let run = 0; run < 1000; run += 1) {
			let input = "";
			for (let at = r.int(0, 12); at > 0; at -= 1) input += r.pick(pieces);
			const once = printQuery(parseQuery(input));
			const twice = printQuery(parseQuery(once));
			expect(
				twice,
				`seed 287 run ${run}: ${JSON.stringify(input)} -> ${JSON.stringify(once)} -> ${JSON.stringify(twice)}`,
			).toBe(once);
		}
	});
});

describe("termProblem", () => {
	const problem = (source: string) => {
		const [term] = parseQuery(source);
		return term ? termProblem(term) : "none";
	};

	it("is null for a term that can be used", () => {
		for (const ok of [
			"coffee",
			'"a b"',
			"category:food",
			"amount>5",
			"amount:12.50",
			"amount:१२५०",
			"currency:npr",
			"type:refund",
			"type:EXPENSE",
			"is:shared,personal",
			"has:receipt",
			"date:this-month",
			"date:2026",
			"date:2026-11",
			"date:2026-11-05",
			"date>2026-01-01",
			"merchant=Cafe",
		]) {
			expect(problem(ok), ok).toBeNull();
		}
	});

	it("says empty for a term with nothing in it", () => {
		expect(problem("category:")).toBe("empty");
		expect(problem("amount>")).toBe("empty");
		expect(termProblem(text("  "))).toBe("empty");
		expect(termProblem(text(""))).toBe("empty");
	});

	it("says op for an operator the field does not take", () => {
		expect(problem("category>5")).toBe("op");
		expect(problem("merchant>x")).toBe("op");
		expect(problem("type<=refund")).toBe("op");
		expect(problem("is>shared")).toBe("op");
	});

	it("says value for a value the field cannot read", () => {
		expect(problem("amount:abc")).toBe("value");
		expect(problem("is:whatever")).toBe("value");
		expect(problem("is:shared,whatever")).toBe("value");
		expect(problem("type:foo")).toBe("value");
		expect(problem("has:photo")).toBe("value");
		expect(problem("currency:NP")).toBe("value");
		expect(problem("currency:NPRS")).toBe("value");
		expect(problem("date:2026-13")).toBe("value");
		expect(problem("date:2026-02-30")).toBe("value");
		expect(problem("date:soon")).toBe("value");
	});

	it("keeps the usable terms only", () => {
		const terms = parseQuery("tea category: amount:abc amount>5 merchant>x type:refund");
		expect(usableTerms(terms).map(printTerm)).toEqual(["tea", "amount>5", "type:refund"]);
	});
});

describe("parseQueryAmount and parseQueryCurrency", () => {
	it("reads plain amounts, Latin or Devanagari digits", () => {
		expect(parseQueryAmount("1250.50")).toBe("1250.50");
		expect(parseQueryAmount("१२५०")).toBe("1250");
		expect(parseQueryAmount("१२.५")).toBe("12.5");
		expect(parseQueryAmount(" 7 ")).toBe("7");
		expect(parseQueryAmount("1,250")).toBeNull();
		expect(parseQueryAmount("")).toBeNull();
		expect(parseQueryAmount("-5")).toBeNull();
		expect(parseQueryAmount("1.2345")).toBeNull();
		expect(parseQueryAmount("1234567890123")).toBeNull();
	});

	it("reads three-letter currency codes", () => {
		expect(parseQueryCurrency("npr")).toBe("NPR");
		expect(parseQueryCurrency(" Usd ")).toBe("USD");
		expect(parseQueryCurrency("NP")).toBeNull();
		expect(parseQueryCurrency("NPRS")).toBeNull();
		expect(parseQueryCurrency("N1R")).toBeNull();
	});
});

describe("dateRange", () => {
	const today = "2026-11-13";
	const range = (value: string) => dateRange(value, today);

	it("reads every date word from a Friday", () => {
		expect(range("today")).toEqual({ first: "2026-11-13", last: "2026-11-13" });
		expect(range("yesterday")).toEqual({ first: "2026-11-12", last: "2026-11-12" });
		expect(range("this-week")).toEqual({ first: "2026-11-08", last: "2026-11-14" });
		expect(range("last-week")).toEqual({ first: "2026-11-01", last: "2026-11-07" });
		expect(range("this-month")).toEqual({ first: "2026-11-01", last: "2026-11-30" });
		expect(range("last-month")).toEqual({ first: "2026-10-01", last: "2026-10-31" });
		expect(range("this-year")).toEqual({ first: "2026-01-01", last: "2026-12-31" });
		expect(range("last-year")).toEqual({ first: "2025-01-01", last: "2025-12-31" });
		for (const word of DATE_WORDS) expect(range(word), word).not.toBeNull();
	});

	it("reads words in any case", () => {
		expect(range("THIS-WEEK")).toEqual(range("this-week"));
	});

	it("reads a year, a month and a day", () => {
		expect(range("2026")).toEqual({ first: "2026-01-01", last: "2026-12-31" });
		expect(range("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
		expect(range("2024-02")).toEqual({ first: "2024-02-01", last: "2024-02-29" });
		expect(range("2026-11-05")).toEqual({ first: "2026-11-05", last: "2026-11-05" });
		expect(range("२०२६-११")).toEqual({ first: "2026-11-01", last: "2026-11-30" });
	});

	it("crosses a year boundary for last-month and last-week", () => {
		expect(dateRange("last-month", "2026-01-10")).toEqual({ first: "2025-12-01", last: "2025-12-31" });
		expect(dateRange("this-week", "2026-01-01")).toEqual({ first: "2025-12-28", last: "2026-01-03" });
	});

	it("gives null for anything else", () => {
		for (const bad of ["", "soon", "2026-13", "2026-00", "2026-02-30", "26", "2026-1", "tomorrow"]) {
			expect(range(bad), bad).toBeNull();
		}
	});
});

describe("controlValue, setField and withoutTerm", () => {
	it("shows what a control would", () => {
		expect(controlValue(parseQuery("tea"), "category")).toBe("");
		expect(controlValue(parseQuery("category:food"), "category")).toBe("food");
		expect(controlValue(parseQuery("category=food"), "category")).toBe("food");
		expect(controlValue(parseQuery("category:food,rent"), "category")).toBe(COMPLEX);
		expect(controlValue(parseQuery("-category:food"), "category")).toBe(COMPLEX);
		expect(controlValue(parseQuery("category:food category:rent"), "category")).toBe(COMPLEX);
		expect(controlValue(parseQuery("amount>5"), "amount")).toBe(COMPLEX);
		expect(controlValue(parseQuery("category:"), "category")).toBe(COMPLEX);
		expect(controlValue(parseQuery("type:refund"), "category")).toBe("");
	});

	it("sets a field alone, negated terms of it included, and removes it for an empty value", () => {
		const terms = parseQuery("tea category:food -category:rent type:refund");
		expect(printQuery(setField(terms, "category", "fuel"))).toBe("tea type:refund category:fuel");
		expect(printQuery(setField(terms, "category", ""))).toBe("tea type:refund");
		expect(printQuery(setField(parseQuery("tea"), "date", "this-month"))).toBe("tea date:this-month");
		expect(printQuery(setField(parseQuery("tea"), "category", "Eating out"))).toBe('tea category:"Eating out"');
	});

	it("drops one term by its place", () => {
		const terms = parseQuery("a b c");
		expect(printQuery(withoutTerm(terms, 1))).toBe("a c");
		expect(printQuery(withoutTerm(terms, 9))).toBe("a b c");
		expect(terms).toHaveLength(3);
	});
});

describe("foldControls", () => {
	it("leaves q alone for a control equal to what the previous query showed (typed text wins)", () => {
		expect(foldControls("category:rent", { category: "food" }, "category:food")).toBe("category:rent");
		expect(foldControls("category:food", { category: "food" }, "category:food")).toBe("category:food");
		expect(foldControls("  tea  ", { type: "" })).toBe("  tea  ");
	});

	it("rewrites q for a control that changed", () => {
		expect(foldControls("tea category:food", { category: "rent" }, "tea category:food")).toBe("tea category:rent");
		expect(foldControls("tea", { type: "refund", date: "this-month" }, "tea")).toBe("tea type:refund date:this-month");
		expect(foldControls('category:food "a b"', { category: "Eating out" }, "category:food")).toBe(
			'"a b" category:"Eating out"',
		);
	});

	it("ignores a COMPLEX control", () => {
		expect(foldControls("category:a,b", { category: COMPLEX }, "category:a,b")).toBe("category:a,b");
		expect(foldControls("tea", { category: COMPLEX }, "")).toBe("tea");
	});

	it("clears a field for an empty control, unless the previous query showed COMPLEX", () => {
		expect(foldControls("tea category:food", { category: "" }, "tea category:food")).toBe("tea");
		expect(foldControls("tea category:a,b", { category: "" }, "tea category:a,b")).toBe("tea category:a,b");
	});

	it("compares case-insensitively", () => {
		expect(foldControls("category:food", { category: "FOOD" }, "category:food")).toBe("category:food");
		expect(foldControls("category:खाना", { category: "खाना" }, "category:खाना")).toBe("category:खाना");
	});

	it("takes q as the previous query when none is given (the no-JavaScript form)", () => {
		expect(foldControls("category:food", { category: "rent" })).toBe("category:rent");
		expect(foldControls("category:food", { category: "food" })).toBe("category:food");
		expect(foldControls("tea", { type: "refund" })).toBe("tea type:refund");
		expect(foldControls("tea", { category: undefined })).toBe("tea");
	});
});

describe("queryMonth and stepMonth", () => {
	it("names the one month a query is about", () => {
		expect(queryMonth(parseQuery("date:2026-11"), "2026-11")).toBe("2026-11");
		expect(queryMonth(parseQuery("date:2025-03"), "2026-11")).toBe("2025-03");
		expect(queryMonth(parseQuery("date:this-month"), "2026-11")).toBe("2026-11");
		expect(queryMonth(parseQuery("date:LAST-MONTH"), "2026-11")).toBe("2026-10");
		expect(queryMonth(parseQuery("date:last-month"), "2026-01")).toBe("2025-12");
	});

	it("is null otherwise", () => {
		expect(queryMonth(parseQuery("tea"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("date:2026"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("date:2026-11-05"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("date:this-week"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("date:2026-11,2026-12"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("-date:2026-11"), "2026-11")).toBeNull();
		expect(queryMonth(parseQuery("date:2026-13"), "2026-11")).toBeNull();
	});

	it("steps across a year boundary", () => {
		const terms = parseQuery("tea date:2026-01");
		expect(printQuery(stepMonth(terms, "2026-01", -1))).toBe("tea date:2025-12");
		expect(printQuery(stepMonth(parseQuery("date:2025-12"), "2025-12", 1))).toBe("date:2026-01");
		expect(printQuery(stepMonth(parseQuery("date:2026-11"), "2026-11", 14))).toBe("date:2028-01");
	});
});

describe("suggest", () => {
	const vocabulary = {
		category: ["Food", "Fuel", "Eating out"],
		tag: ["work", "trip", "wolf"],
	};
	const at = (value: string, vocab: Vocabulary = vocabulary) => suggest(value, value.length, vocab);

	it("offers fields that start like the word", () => {
		const result = at("cat");
		expect(result.items[0]).toEqual({ insert: "category:", kind: "field", field: "category" });
		expect(result).toMatchObject({ from: 0, to: 3 });
		expect(at("-cat").items[0]).toEqual({ insert: "-category:", kind: "field", field: "category" });
		expect(at("tea paid").items[0]).toEqual({ insert: "paid-by:", kind: "field", field: "paid-by" });
		expect(at("tea paid")).toMatchObject({ from: 4, to: 8 });
		expect(at("").items).toEqual([]);
		expect(at("tea ").items).toEqual([]);
		expect(at("-").items).toEqual([]);
	});

	it("offers a field's values, those starting with the typed text before those containing it", () => {
		const startsFirst = at("category:ea", { category: ["Seafood", "Eating out"] });
		expect(startsFirst.items.map((item) => item.insert)).toEqual(['"Eating out"', "Seafood"]);
		expect(at("category:fo").items.map((item) => item.insert)).toEqual(["Food"]);
		const all = at("category:");
		expect(all.items.map((item) => item.insert)).toEqual(["Food", "Fuel", '"Eating out"']);
		expect(all.items.every((item) => item.kind === "value" && item.field === "category")).toBe(true);
		expect(at("category:o").items.map((item) => item.insert)).toEqual(["Food", '"Eating out"']);
		expect(at("category:food").items).toEqual([]);
		expect(at("-category:fo").items.map((item) => item.insert)).toEqual(["Food"]);
	});

	it("offers values after a comma", () => {
		const result = at("tag:trip,wo");
		expect(result.items.map((item) => item.insert)).toEqual(["work", "wolf"]);
		expect(result).toMatchObject({ from: 9, to: 11 });
	});

	it("takes closed lists from the language, without a vocabulary", () => {
		expect(at("is:", {}).items.map((item) => item.insert)).toEqual([
			"shared",
			"personal",
			"unsettled",
			"duplicate",
			"uncategorized",
		]);
		expect(at("type:", {}).items.map((item) => item.insert)).toEqual(["expense", "refund", "payment"]);
		expect(at("has:", {}).items.map((item) => item.insert)).toEqual(["receipt"]);
		expect(at("date:", {}).items.map((item) => item.insert)).toEqual([...DATE_WORDS]);
		expect(at("date:this", {}).items.map((item) => item.insert)).toEqual(["this-week", "this-month", "this-year"]);
		expect(at("IS:sh", {}).items.map((item) => item.insert)).toEqual(["shared"]);
	});

	it("offers a plain word as a name of the caller's, too", () => {
		const items = at("food").items;
		expect(items).toContainEqual({ insert: "category:Food", kind: "value", field: "category" });
		expect(at("-food").items).toContainEqual({ insert: "-category:Food", kind: "value", field: "category" });
		expect(at("eat").items).toContainEqual({ insert: 'category:"Eating out"', kind: "value", field: "category" });
	});

	it("offers nothing inside a quote", () => {
		expect(at('"Fo').items).toEqual([]);
		expect(at('category:"Fo').items).toEqual([]);
	});

	it("works at a caret in the middle of the text", () => {
		const value = "tea cat rent";
		const result = suggest(value, 7, vocabulary);
		expect(result).toMatchObject({ from: 4, to: 7 });
		expect(result.items[0]?.insert).toBe("category:");
	});

	it("takes a suggestion, with a space after a value and not after a field", () => {
		const field = at("cat");
		const item = field.items[0];
		expect(item).toBeDefined();
		if (!item) return;
		expect(applySuggestion("cat", field, item)).toEqual({ text: "category:", caret: 9 });

		const value = at("category:fo");
		const food = value.items[0];
		if (!food) throw new Error("no suggestion");
		expect(applySuggestion("category:fo", value, food)).toEqual({ text: "category:Food ", caret: 14 });

		const mid = suggest("category:fo rent", 11, vocabulary);
		const midFood = mid.items[0];
		if (!midFood) throw new Error("no suggestion");
		expect(applySuggestion("category:fo rent", mid, midFood)).toEqual({ text: "category:Food rent", caret: 13 });

		const comma = at("tag:trip,wo");
		const work = comma.items[0];
		if (!work) throw new Error("no suggestion");
		expect(applySuggestion("tag:trip,wo", comma, work)).toEqual({ text: "tag:trip,work ", caret: 14 });
	});
});

describe("Spend's CSV", () => {
	const options: ImportOptions = { header: true, dateFormat: "ymd", currency: "NPR" };
	const offered = ["NPR", "USD", "JPY"];
	const header = ["Date", "Amount", "Currency", "Type", "Title", "Merchant", "Category", "Tags", "Method", "Notes"];
	const mapping = guessMapping(header);

	it("guesses the mapping from the export's English headers", () => {
		const names = EXPORT_COLUMNS().map((column) => column.header);
		const guessed = guessMapping(names);
		const at = (name: string) => names.indexOf(name);
		expect(guessed).toMatchObject({
			date: at("Date"),
			type: at("Type"),
			title: at("Title"),
			merchant: at("Merchant"),
			category: at("Category"),
			tags: at("Tags"),
			method: at("Method"),
			currency: at("Currency"),
			amount: at("Amount"),
			notes: at("Notes"),
		});
		expect(new Set(Object.values(guessed).filter((value) => value !== null)).size).toBe(IMPORT_FIELDS.length);
	});

	it("guesses the mapping from Nepali headers", () => {
		const guessed = guessMapping(["मिति", "रकम", "मुद्रा", "श्रेणी", "प्रकार", "शीर्षक", "पसल", "ट्यागहरू", "माध्यम", "टिप्पणी"]);
		expect(guessed).toEqual({
			date: 0,
			amount: 1,
			currency: 2,
			category: 3,
			type: 4,
			title: 5,
			merchant: 6,
			tags: 7,
			method: 8,
			notes: 9,
		});
	});

	it("guesses from other names, case and spacing, each column once, and null for the rest", () => {
		const guessed = guessMapping([" DATE ", "Total", "Payee", "Description", "Whatever"]);
		expect(guessed).toMatchObject({
			date: 0,
			amount: 1,
			merchant: 2,
			title: 3,
			category: null,
			notes: null,
			currency: null,
		});
	});

	it("previews a valid row, with tags split on commas and semicolons and de-duplicated", () => {
		const [row] = previewImport(
			[header, ["2026-11-05", "12.50", "", "", "Lunch", "Cafe", "Food", "a; b, a ,", "Cash", "with Asha"]],
			mapping,
			options,
			offered,
		);
		expect(row?.problems).toEqual([]);
		expect(row?.line).toBe(2);
		expect(row?.row).toMatchObject({
			spentOn: "2026-11-05",
			kind: "expense",
			amountMinor: 1250,
			currency: "NPR",
			title: "Lunch",
			merchant: "Cafe",
			category: "Food",
			tags: ["a", "b"],
			method: "Cash",
			notes: "with Asha",
		});
	});

	it("turns a negative amount with no type into a refund, and honours an explicit type", () => {
		const rows = previewImport(
			[
				header,
				["2026-11-05", "-5", "", "", "", "", "", "", "", ""],
				["2026-11-06", "5", "", "refund", "", "", "", "", "", ""],
				["2026-11-07", "-5", "", "expense", "", "", "", "", "", ""],
			],
			mapping,
			options,
			offered,
		);
		expect(rows[0]?.row).toMatchObject({ kind: "refund", amountMinor: 500 });
		expect(rows[1]?.row).toMatchObject({ kind: "refund", amountMinor: 500 });
		expect(rows[2]?.row).toMatchObject({ kind: "expense", amountMinor: 500 });
	});

	it("reads currency symbols and the default currency", () => {
		const rows = previewImport(
			[
				header,
				["2026-11-05", "1,250", "रु", "", "", "", "", "", "", ""],
				["2026-11-05", "$ 12", "$", "", "", "", "", "", "", ""],
				["2026-11-05", "1200", "JPY", "", "", "", "", "", "", ""],
			],
			mapping,
			options,
			offered,
		);
		expect(rows[0]?.row).toMatchObject({ currency: "NPR", amountMinor: 125000 });
		expect(rows[1]?.row).toMatchObject({ currency: "USD", amountMinor: 1200 });
		expect(rows[2]?.row).toMatchObject({ currency: "JPY", amountMinor: 1200 });
	});

	it("parses amounts in minor units of the currency", () => {
		expect(parseImportAmount("1200", "JPY")).toBe(1200);
		expect(parseImportAmount("12.5", "JPY")).toBeNaN();
		expect(parseImportAmount("12.5", "USD")).toBe(1250);
		expect(parseImportAmount("12.505", "USD")).toBeNaN();
		expect(parseImportAmount("1,250.50", "USD")).toBe(125050);
		expect(parseImportAmount("रु 1,250", "NPR")).toBe(125000);
		expect(parseImportAmount("$ -12", "USD")).toBe(-1200);
		expect(parseImportAmount("१२५०", "NPR")).toBe(125000);
		expect(parseImportAmount("abc", "USD")).toBeNaN();
		expect(parseImportAmount("", "USD")).toBeNaN();
	});

	it("parses a currency cell", () => {
		expect(parseImportCurrency("", "NPR", offered)).toBe("NPR");
		expect(parseImportCurrency(" usd ", "NPR", offered)).toBe("USD");
		expect(parseImportCurrency("Rs.", "NPR", offered)).toBe("NPR");
		expect(parseImportCurrency("रु", "USD", offered)).toBe("NPR");
		expect(parseImportCurrency("$", "NPR", offered)).toBe("USD");
		expect(parseImportCurrency("₹", "NPR", offered)).toBeNull();
		expect(parseImportCurrency("₹", "NPR", [...offered, "INR"])).toBe("INR");
		expect(parseImportCurrency("EUR", "NPR", offered)).toBeNull();
		expect(parseImportCurrency("$", "NPR", ["NPR"])).toBeNull();
	});

	it("reports a bad date, a bad currency, a bad type and a zero amount against the right field", () => {
		const rows = previewImport(
			[
				header,
				["not a date", "5", "", "", "", "", "", "", "", ""],
				["2026-11-05", "5", "XYZ", "", "", "", "", "", "", ""],
				["2026-11-05", "0", "", "", "", "", "", "", "", ""],
				["2026-11-05", "5", "", "gift", "", "", "", "", "", ""],
				["2026-11-05", "abc", "", "", "", "", "", "", "", ""],
				["2026-02-30", "5", "", "", "", "", "", "", "", ""],
			],
			mapping,
			options,
			offered,
		);
		const fields = rows.map((row) => row.problems.map((problem) => problem.field));
		expect(fields[0]).toContain("date");
		expect(fields[1]).toContain("currency");
		expect(fields[2]).toContain("amount");
		expect(fields[3]).toContain("type");
		expect(fields[4]).toContain("amount");
		expect(fields[5]).toContain("date");
		for (const row of rows) {
			expect(row.row).toBeNull();
			expect(row.problems.every((problem) => problem.message !== "")).toBe(true);
		}
	});

	it("numbers lines from 2 with a header and from 1 without", () => {
		const body = [
			["2026-11-05", "5"],
			["bad", "5"],
			["2026-11-07", "5"],
		];
		const small: ImportMapping = { ...guessMapping([]), date: 0, amount: 1 };
		const withHeader = previewImport([["Date", "Amount"], ...body], small, options, offered);
		expect(withHeader.map((row) => row.line)).toEqual([2, 3, 4]);
		expect(withHeader.map((row) => row.row !== null)).toEqual([true, false, true]);
		const without = previewImport(body, small, { ...options, header: false }, offered);
		expect(without.map((row) => row.line)).toEqual([1, 2, 3]);
	});

	it("reads other date formats", () => {
		const small: ImportMapping = { ...guessMapping([]), date: 0, amount: 1 };
		const [dmy] = previewImport(
			[["05/11/2026", "5"]],
			small,
			{ header: false, dateFormat: "dmy", currency: "NPR" },
			offered,
		);
		expect(dmy?.row?.spentOn).toBe("2026-11-05");
		const [mdy] = previewImport(
			[["11/05/2026", "5"]],
			small,
			{ header: false, dateFormat: "mdy", currency: "NPR" },
			offered,
		);
		expect(mdy?.row?.spentOn).toBe("2026-11-05");
	});

	it("says why a table cannot be imported at all", () => {
		expect(tableProblem([], { header: false })).not.toBeNull();
		expect(tableProblem([header], { header: true })).not.toBeNull();
		expect(tableProblem([["a"]], { header: false })).toBeNull();
		expect(tableProblem([header, ["a"]], { header: true })).toBeNull();
		const many = (count: number) => Array.from({ length: count }, () => ["a"]);
		expect(tableProblem(many(1000), { header: false })).toBeNull();
		expect(tableProblem(many(1001), { header: false })).not.toBeNull();
		expect(tableProblem(many(1001), { header: true })).toBeNull();
		expect(tableProblem(many(1002), { header: true })).not.toBeNull();
		expect(tableProblem(many(1001), { header: false })).not.toBe(tableProblem([], { header: false }));
	});
});
