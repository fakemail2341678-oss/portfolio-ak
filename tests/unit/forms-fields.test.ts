import { afterEach, describe, expect, it } from "vitest";
import {
	type Answers,
	compactAnswers,
	copyField,
	emptyAnswers,
	FIELD_ID_PATTERN,
	FIELD_TYPES,
	type FieldOf,
	FORM_FIELDS_MAX,
	type FormField,
	fieldSchema,
	formFieldsSchema,
	newField,
	OPTION_ID_PATTERN,
	toZodSchema,
} from "@/features/apps/forms/fields";
import { answerCsv, answerText, summarize } from "@/features/apps/forms/results";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * Forms' definitions and `toZodSchema` (decision 0195): what a form may hold, and what
 * a response to it may say. The same schema checks the public form in the browser and
 * the submission on the server, so these cases are the server's rules too.
 */

afterEach(() => overwriteGetLocale(() => "en"));

const base = { help: "", required: false } as const;
const text = (patch: Partial<FieldOf<"short_text">> = {}): FieldOf<"short_text"> => ({
	id: "ftext0001",
	type: "short_text",
	label: "Name",
	maxLength: 20,
	...base,
	...patch,
});
const opts = [
	{ id: "oaaaaaa", label: "Tea" },
	{ id: "obbbbbb", label: "Coffee" },
	{ id: "occcccc", label: "Momo" },
];
const single = (patch: Partial<FieldOf<"single_select">> = {}): FieldOf<"single_select"> => ({
	id: "fsingle01",
	type: "single_select",
	label: "Drink",
	options: opts,
	display: "radio",
	...base,
	...patch,
});
const multi = (patch: Partial<FieldOf<"multi_select">> = {}): FieldOf<"multi_select"> => ({
	id: "fmulti001",
	type: "multi_select",
	label: "Order",
	options: opts,
	maxChoices: null,
	...base,
	...patch,
});
const number = (patch: Partial<FieldOf<"number">> = {}): FieldOf<"number"> => ({
	id: "fnumber01",
	type: "number",
	label: "Guests",
	min: null,
	max: null,
	integer: false,
	...base,
	...patch,
});
const rating = (patch: Partial<FieldOf<"rating">> = {}): FieldOf<"rating"> => ({
	id: "frating01",
	type: "rating",
	label: "Visit",
	lowLabel: "",
	highLabel: "",
	...base,
	...patch,
});
const date = (patch: Partial<FieldOf<"date">> = {}): FieldOf<"date"> => ({
	id: "fdate0001",
	type: "date",
	label: "Day",
	min: null,
	max: null,
	...base,
	...patch,
});
const email = (patch: Partial<FieldOf<"email">> = {}): FieldOf<"email"> => ({
	id: "femail001",
	type: "email",
	label: "Email",
	...base,
	...patch,
});
const consent = (patch: Partial<FieldOf<"consent">> = {}): FieldOf<"consent"> => ({
	id: "fconsent1",
	type: "consent",
	label: "I agree",
	...base,
	...patch,
});

/** The first problem with `answer` to `field`, or null when it passes. */
const problem = (field: FormField, answer: unknown) => {
	const result = toZodSchema([field]).safeParse(answer === undefined ? {} : { [field.id]: answer });
	return result.success ? null : (result.error.issues[0]?.message ?? "invalid");
};
const passes = (field: FormField, answer: unknown) => expect(problem(field, answer)).toBeNull();
const fails = (field: FormField, answer: unknown, message?: string | RegExp) => {
	const found = problem(field, answer);
	expect(found).not.toBeNull();
	if (message !== undefined) expect(found).toMatch(message);
};

describe("field definitions", () => {
	it("makes a valid field of every type, in the page's language", () => {
		for (const type of FIELD_TYPES) {
			const field = newField(type);
			expect(fieldSchema.safeParse(field).success, type).toBe(true);
			expect(field.id).toMatch(FIELD_ID_PATTERN);
			expect(field.label.length).toBeGreaterThan(0);
		}
		overwriteGetLocale(() => "ne");
		expect(newField("short_text").label).toBe("तपाईंको नाम के हो?");
		expect(newField("single_select")).toMatchObject({ options: [{ label: "विकल्प १" }, { label: "विकल्प २" }] });
	});

	it("starts consent as required (a box that must be ticked)", () => {
		expect(newField("consent").required).toBe(true);
	});

	it("copies a field with new ids for it and its options", () => {
		const original = newField("multi_select");
		const copy = copyField(original);
		expect(copy.id).not.toBe(original.id);
		expect(copy).toMatchObject({ type: "multi_select", label: original.label });
		if (copy.type !== "multi_select" || original.type !== "multi_select") throw new Error("type");
		expect(copy.options.map((option) => option.id)).not.toEqual(original.options.map((option) => option.id));
		expect(copy.options.every((option) => OPTION_ID_PATTERN.test(option.id))).toBe(true);
	});

	it("refuses a field without a label, with a bad id, or with a setting of another type", () => {
		expect(fieldSchema.safeParse(text({ label: "  " })).success).toBe(false);
		expect(fieldSchema.safeParse(text({ id: "x" })).success).toBe(false);
		expect(fieldSchema.safeParse({ ...text(), options: opts }).success).toBe(false);
		expect(fieldSchema.safeParse({ ...text(), type: "password" }).success).toBe(false);
	});

	it("checks each type's own settings", () => {
		expect(fieldSchema.safeParse(text({ maxLength: 0 })).success).toBe(false);
		expect(fieldSchema.safeParse(text({ maxLength: 301 })).success).toBe(false);
		expect(fieldSchema.safeParse(number({ min: 10, max: 5 })).success).toBe(false);
		expect(fieldSchema.safeParse(number({ min: 5, max: 5 })).success).toBe(true);
		expect(fieldSchema.safeParse(date({ min: "2026-12-01", max: "2026-11-01" })).success).toBe(false);
		expect(fieldSchema.safeParse(date({ min: "2026-02-30" })).success).toBe(false);
		expect(fieldSchema.safeParse(multi({ maxChoices: 4 })).success).toBe(false);
		expect(fieldSchema.safeParse(multi({ maxChoices: 3 })).success).toBe(true);
	});

	it("needs two to twenty options with labels and distinct ids", () => {
		expect(fieldSchema.safeParse(single({ options: [opts[0] ?? { id: "", label: "" }] })).success).toBe(false);
		const many = Array.from({ length: 21 }, (_, index) => ({ id: `o${String(index).padStart(6, "0")}`, label: "x" }));
		expect(fieldSchema.safeParse(single({ options: many })).success).toBe(false);
		expect(fieldSchema.safeParse(single({ options: [...opts, { id: "oaaaaaa", label: "Again" }] })).success).toBe(
			false,
		);
		expect(fieldSchema.safeParse(single({ options: [{ id: "oaaaaaa", label: "" }, ...opts.slice(1)] })).success).toBe(
			false,
		);
	});

	it("puts a problem on the setting it is about", () => {
		const result = formFieldsSchema().safeParse([text(), number({ min: 3, max: 1 })]);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([1, "max"]);
	});

	it("allows at most 40 fields, each id once", () => {
		const fields = Array.from({ length: FORM_FIELDS_MAX + 1 }, (_, index) =>
			text({ id: `f${String(index).padStart(8, "0")}` }),
		);
		expect(formFieldsSchema().safeParse(fields.slice(0, FORM_FIELDS_MAX)).success).toBe(true);
		expect(formFieldsSchema().safeParse(fields).success).toBe(false);
		expect(formFieldsSchema().safeParse([text(), text()]).success).toBe(false);
	});
});

describe("toZodSchema: text and email", () => {
	it("takes optional text empty, trims it and keeps it within the length", () => {
		passes(text(), "");
		passes(text(), "Asha");
		fails(text(), "x".repeat(21), /20/);
		expect(toZodSchema([text()]).parse({ ftext0001: "  Asha  " })).toEqual({ ftext0001: "Asha" });
	});

	it("needs required text to say something", () => {
		const field = text({ required: true });
		fails(field, "", /required/i);
		fails(field, "   ", /required/i);
		fails(field, undefined, /required/i);
		passes(field, "Asha");
	});

	it("long text has its own, larger limit", () => {
		const field: FieldOf<"long_text"> = { id: "flong0001", type: "long_text", label: "More", maxLength: 2000, ...base };
		passes(field, "x".repeat(2000));
		fails(field, "x".repeat(2001));
	});

	it("checks an email address, empty only when optional", () => {
		passes(email(), "");
		passes(email(), "asha@example.com");
		fails(email(), "asha@", /email/i);
		fails(email({ required: true }), "", /required/i);
		passes(email({ required: true }), " asha@example.com ");
	});

	it("refuses a value of the wrong kind", () => {
		fails(text(), 42);
		fails(text(), ["a"]);
		fails(email(), true);
	});
});

describe("toZodSchema: numbers and ratings", () => {
	it("takes an optional number empty (undefined) and checks the range", () => {
		const field = number({ min: 1, max: 10 });
		passes(field, undefined);
		passes(field, 1);
		passes(field, 10);
		passes(field, 2.5);
		fails(field, 0, /1/);
		fails(field, 11, /10/);
	});

	it("says Required for an empty required number, and 'number' for text that isn't one", () => {
		const field = number({ required: true });
		fails(field, undefined, /required/i);
		fails(field, Number.NaN, /number/i);
		fails(field, "5");
		passes(field, 0);
	});

	it("takes whole numbers only when asked", () => {
		fails(number({ integer: true }), 2.5, /whole/i);
		passes(number({ integer: true }), 3);
	});

	it("rates from 1 to 5, in whole stars", () => {
		passes(rating(), undefined);
		for (const score of [1, 2, 3, 4, 5]) passes(rating(), score);
		fails(rating(), 0, /1 to 5/);
		fails(rating(), 6, /1 to 5/);
		fails(rating(), 3.5);
		fails(rating({ required: true }), undefined, /required/i);
	});
});

describe("toZodSchema: choices", () => {
	it("takes one of the options by id, or nothing when optional", () => {
		passes(single(), "");
		passes(single(), "obbbbbb");
		fails(single(), "Coffee", /options/);
		fails(single(), "ozzzzzz", /options/);
		fails(single({ required: true }), "", /required/i);
		fails(single({ required: true }), undefined, /required/i);
	});

	it("takes several distinct options, at least one when required, at most maxChoices", () => {
		passes(multi(), []);
		passes(multi(), ["oaaaaaa", "occcccc"]);
		fails(multi(), ["oaaaaaa", "oaaaaaa"]);
		fails(multi(), ["onope00"]);
		fails(multi({ required: true }), [], /required/i);
		fails(multi({ maxChoices: 2 }), ["oaaaaaa", "obbbbbb", "occcccc"], /2/);
		passes(multi({ maxChoices: 2 }), ["oaaaaaa", "obbbbbb"]);
		fails(multi(), "oaaaaaa");
	});
});

describe("toZodSchema: dates and consent", () => {
	it("takes a real calendar day within the bounds", () => {
		const field = date({ min: "2026-01-01", max: "2026-12-31" });
		passes(field, "");
		passes(field, "2026-02-28");
		fails(field, "2026-02-30");
		fails(field, "2025-12-31");
		fails(field, "2027-01-01");
		fails(field, "31/12/2026");
		fails(date({ required: true }), "", /required/i);
	});

	it("requires the box ticked only when consent is required", () => {
		passes(consent(), false);
		passes(consent(), true);
		fails(consent({ required: true }), false);
		passes(consent({ required: true }), true);
		fails(consent(), "yes");
	});
});

describe("toZodSchema: the whole response", () => {
	const fields: FormField[] = [text({ required: true }), single(), rating({ required: true }), consent()];

	it("passes a complete response and reports every problem by field id", () => {
		const schema = toZodSchema(fields);
		expect(schema.safeParse({ ftext0001: "Asha", fsingle01: "", frating01: 4, fconsent1: true }).success).toBe(true);
		const result = schema.safeParse({ ftext0001: "", fsingle01: "onope00", frating01: undefined, fconsent1: false });
		expect(result.success).toBe(false);
		expect(new Set(result.error?.issues.map((issue) => issue.path[0]))).toEqual(
			new Set(["ftext0001", "fsingle01", "frating01"]),
		);
	});

	it("refuses an answer to a question the form doesn't have", () => {
		const result = toZodSchema(fields).safeParse({ ftext0001: "Asha", frating01: 3, fextra001: "hi" });
		expect(result.success).toBe(false);
	});

	it("accepts the empty answers of a form without required questions", () => {
		const optional = [text(), single(), multi(), number(), rating(), date(), email(), consent()];
		expect(toZodSchema(optional).safeParse(emptyAnswers(optional)).success).toBe(true);
	});

	it("refuses the empty answers of required questions", () => {
		const required = [text({ required: true }), multi({ required: true }), number({ required: true })];
		const result = toZodSchema(required).safeParse(emptyAnswers(required));
		expect(result.error?.issues).toHaveLength(3);
	});

	it("reports problems in the page's language", () => {
		overwriteGetLocale(() => "ne");
		expect(problem(rating({ required: true }), 9)).toBe("१ देखि ५ सम्मको मूल्याङ्कन छान्नुहोस्।");
	});

	it("stores only the answers that say something", () => {
		expect(compactAnswers({ a: "", b: [], c: undefined, d: "Hi", e: 0, f: false, g: ["oaaaaaa"] })).toEqual({
			d: "Hi",
			e: 0,
			f: false,
			g: ["oaaaaaa"],
		});
	});
});

describe("results", () => {
	const fields: FormField[] = [single(), multi(), rating(), number(), consent(), text()];
	const responses: Answers[] = [
		{
			fsingle01: "oaaaaaa",
			fmulti001: ["oaaaaaa", "obbbbbb"],
			frating01: 5,
			fnumber01: 2,
			fconsent1: true,
			ftext0001: "Newest",
		},
		{ fsingle01: "obbbbbb", fmulti001: ["obbbbbb"], frating01: 3, fnumber01: 6, fconsent1: false, ftext0001: "Older" },
		{ fsingle01: "oaaaaaa", frating01: 4 },
		// An option since removed and a value of the wrong kind are left out, not miscounted.
		{ fsingle01: "ogone00", frating01: 9, fnumber01: "7" as unknown as number },
	];

	it("counts every option of a choice, in the options' order", () => {
		const [one, many] = summarize(fields, responses);
		expect(one).toEqual({
			kind: "choice",
			fieldId: "fsingle01",
			answered: 3,
			counts: [
				{ optionId: "oaaaaaa", count: 2 },
				{ optionId: "obbbbbb", count: 1 },
				{ optionId: "occcccc", count: 0 },
			],
		});
		expect(many).toMatchObject({ answered: 2, counts: [{ count: 1 }, { count: 2 }, { count: 0 }] });
	});

	it("averages ratings and numbers, and spreads ratings over 1 to 5", () => {
		const [, , stars, numbers] = summarize(fields, responses);
		expect(stars).toEqual({ kind: "rating", fieldId: "frating01", answered: 3, average: 4, counts: [0, 0, 1, 1, 1] });
		expect(numbers).toEqual({ kind: "number", fieldId: "fnumber01", answered: 2, average: 4, min: 2, max: 6 });
	});

	it("counts agreement and keeps the newest text answers", () => {
		const [, , , , agreed, texts] = summarize(fields, responses);
		expect(agreed).toEqual({ kind: "consent", fieldId: "fconsent1", answered: 2, agreed: 1 });
		expect(texts).toEqual({ kind: "text", fieldId: "ftext0001", answered: 2, latest: ["Newest", "Older"] });
	});

	it("has nothing to average without answers", () => {
		const [, , stars, numbers] = summarize(fields, []);
		expect(stars).toMatchObject({ answered: 0, average: null });
		expect(numbers).toMatchObject({ answered: 0, average: null, min: null, max: null });
	});

	it("writes answers as text for the table and the CSV file", () => {
		expect(answerText(multi(), ["oaaaaaa", "occcccc"])).toBe("Tea, Momo");
		expect(answerText(single(), "ogone00")).toBe("");
		expect(answerText(consent(), true)).toBe("Yes");
		expect(answerText(number(), 1234.5)).toBe("1,234.5");
		expect(answerCsv(number(), 1234.5)).toBe("1234.5");
		expect(answerCsv(date(), "2026-10-30")).toBe("2026-10-30");
		expect(answerText(text(), undefined)).toBe("");
		overwriteGetLocale(() => "ne");
		expect(answerText(rating(), 4)).toBe("४");
		expect(answerText(consent(), false)).toBe("होइन");
	});
});
