import { z } from "zod";
import type { IsoDate } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { email, isoDate, list, mustAccept, numberRange, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";

/**
 * Forms' field definitions (decision 0195): what a form asks, as data. The builder
 * edits a list of these, the server stores it (jsonb, only after this schema), and
 * `toZodSchema` turns it into the schema a response must pass, in the browser (the
 * form's validators) and on the server (the submission) alike.
 *
 * Fields and options have ids of their own, made in the browser: a response keys its
 * answers by field id and stores choices as option ids, so renaming a question or an
 * option keeps the answers it already has.
 */

export const FIELD_TYPES = [
	"short_text",
	"long_text",
	"email",
	"number",
	"single_select",
	"multi_select",
	"rating",
	"date",
	"consent",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FORM_FIELDS_MAX = 40;
export const FIELD_LABEL_MAX = 200;
export const FIELD_HELP_MAX = 300;
export const OPTION_LABEL_MAX = 100;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 20;
export const SHORT_TEXT_MAX = 300;
export const LONG_TEXT_MAX = 5000;
export const RATING_LABEL_MAX = 40;
/** Ratings are 1 to RATING_MAX. */
export const RATING_MAX = 5;

export const FIELD_ID_PATTERN = /^f[a-z0-9]{8}$/;
export const OPTION_ID_PATTERN = /^o[a-z0-9]{6}$/;

const randomId = (prefix: string, length: number) => {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return prefix + Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};
export const newFieldId = () => randomId("f", 8);
export const newOptionId = () => randomId("o", 6);

const n = (value: number) => formatNumber(value);

const base = {
	id: z.string().regex(FIELD_ID_PATTERN),
	label: required({ max: FIELD_LABEL_MAX }),
	help: optionalText({ max: FIELD_HELP_MAX }),
	required: z.boolean(),
};

const optionSchema = z.strictObject({
	id: z.string().regex(OPTION_ID_PATTERN),
	label: required({ max: OPTION_LABEL_MAX }),
});
export type FieldOption = z.infer<typeof optionSchema>;

const optionsSchema = () =>
	list(optionSchema, { min: OPTIONS_MIN, max: OPTIONS_MAX }).superRefine((options, ctx) => {
		const seen = new Set<string>();
		options.forEach((option, index) => {
			if (seen.has(option.id)) ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate option id" });
			seen.add(option.id);
		});
	});

const maxLength = (max: number) =>
	z
		.number()
		.int({ error: () => m.validation_integer() })
		.min(1, { error: () => m.validation_number_min({ min: n(1) }) })
		.max(max, { error: () => m.validation_number_max({ max: n(max) }) });

const bound = () =>
	z
		.number({ error: () => m.validation_number() })
		.finite({ error: () => m.validation_number() })
		.nullable();
const dateBound = () => isoDate().nullable();

export const fieldSchema = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("short_text"), ...base, maxLength: maxLength(SHORT_TEXT_MAX) }),
	z.strictObject({ type: z.literal("long_text"), ...base, maxLength: maxLength(LONG_TEXT_MAX) }),
	z.strictObject({ type: z.literal("email"), ...base }),
	z
		.strictObject({ type: z.literal("number"), ...base, min: bound(), max: bound(), integer: z.boolean() })
		.refine((field) => field.min === null || field.max === null || field.min <= field.max, {
			path: ["max"],
			error: () => m.forms_error_range(),
		}),
	z.strictObject({
		type: z.literal("single_select"),
		...base,
		options: optionsSchema(),
		display: z.enum(["radio", "dropdown"]),
	}),
	z
		.strictObject({
			type: z.literal("multi_select"),
			...base,
			options: optionsSchema(),
			maxChoices: z.number().int().min(1).max(OPTIONS_MAX).nullable(),
		})
		.refine((field) => field.maxChoices === null || field.maxChoices <= field.options.length, {
			path: ["maxChoices"],
			error: () => m.forms_error_max_choices_options(),
		}),
	z.strictObject({
		type: z.literal("rating"),
		...base,
		lowLabel: optionalText({ max: RATING_LABEL_MAX }),
		highLabel: optionalText({ max: RATING_LABEL_MAX }),
	}),
	z
		.strictObject({ type: z.literal("date"), ...base, min: dateBound(), max: dateBound() })
		.refine((field) => field.min === null || field.max === null || field.min <= field.max, {
			path: ["max"],
			error: () => m.forms_error_range(),
		}),
	z.strictObject({ type: z.literal("consent"), ...base }),
]);
export type FormField = z.infer<typeof fieldSchema>;
export type FieldOf<T extends FieldType> = Extract<FormField, { type: T }>;
export type ChoiceField = FieldOf<"single_select"> | FieldOf<"multi_select">;

export const isChoiceField = (field: FormField): field is ChoiceField =>
	field.type === "single_select" || field.type === "multi_select";

/** A form's questions: at most FORM_FIELDS_MAX, each id once. */
export const formFieldsSchema = () =>
	list(fieldSchema, { max: FORM_FIELDS_MAX }).superRefine((fields, ctx) => {
		const seen = new Set<string>();
		fields.forEach((field, index) => {
			if (seen.has(field.id)) ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate field id" });
			seen.add(field.id);
		});
	});

/** A new field of `type`, with a label in the page's language and options to start from. */
export function newField(type: FieldType): FormField {
	const common = { id: newFieldId(), help: "", required: false };
	const options = () => [
		{ id: newOptionId(), label: m.forms_default_option({ number: n(1) }) },
		{ id: newOptionId(), label: m.forms_default_option({ number: n(2) }) },
	];
	switch (type) {
		case "short_text":
			return { type, ...common, label: m.forms_default_short_text(), maxLength: SHORT_TEXT_MAX };
		case "long_text":
			return { type, ...common, label: m.forms_default_long_text(), maxLength: LONG_TEXT_MAX };
		case "email":
			return { type, ...common, label: m.forms_default_email() };
		case "number":
			return { type, ...common, label: m.forms_default_number(), min: null, max: null, integer: false };
		case "single_select":
			return { type, ...common, label: m.forms_default_single_select(), options: options(), display: "radio" };
		case "multi_select":
			return { type, ...common, label: m.forms_default_multi_select(), options: options(), maxChoices: null };
		case "rating":
			return { type, ...common, label: m.forms_default_rating(), lowLabel: "", highLabel: "" };
		case "date":
			return { type, ...common, label: m.forms_default_date(), min: null, max: null };
		case "consent":
			return { type, ...common, label: m.forms_default_consent(), required: true };
	}
}

/** A copy of `field` with new ids (its options' too), for "Duplicate". */
export function copyField(field: FormField): FormField {
	const copy = { ...field, id: newFieldId() };
	return isChoiceField(copy)
		? { ...copy, options: copy.options.map((option) => ({ ...option, id: newOptionId() })) }
		: copy;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** One answer as stored: text, a date, an option id, option ids, a number (or rating), a box ticked or not. */
export type Answer = string | string[] | number | boolean;
export type Answers = Record<string, Answer>;

/** What the form's fields hold before anything is typed (TanStack Form's default values). */
export type AnswerDraft = string | string[] | number | boolean | undefined;

export function emptyAnswers(fields: ReadonlyArray<FormField>): Record<string, AnswerDraft> {
	return Object.fromEntries(
		fields.map((field) => {
			switch (field.type) {
				case "multi_select":
					return [field.id, []];
				case "number":
				case "rating":
					return [field.id, undefined];
				case "consent":
					return [field.id, false];
				default:
					return [field.id, ""];
			}
		}),
	);
}

/** A number the field must hold, or "Required" when it is empty (the fields store undefined then). */
const requiredNumber = (schema: z.ZodNumber) =>
	z
		.number({ error: (issue) => (issue.input === undefined ? m.validation_required() : m.validation_number()) })
		.pipe(schema);

const ratingSchema = () =>
	z
		.number()
		.int()
		.min(1, { error: () => m.forms_error_rating() })
		.max(RATING_MAX, { error: () => m.forms_error_rating() });

/** One field's answer schema. Optional fields take their empty value ("", [], undefined, false). */
function answerSchema(field: FormField): z.ZodType<Answer | undefined, AnswerDraft> {
	switch (field.type) {
		case "short_text":
		case "long_text":
			return field.required ? required({ max: field.maxLength }) : optionalText({ max: field.maxLength });
		case "email":
			return field.required
				? email()
				: z
						.string()
						.trim()
						.pipe(z.union([z.literal(""), z.email({ error: () => m.validation_email() })]));
		case "number": {
			const range = numberRange({
				...(field.min === null ? {} : { min: field.min }),
				...(field.max === null ? {} : { max: field.max }),
				integer: field.integer,
			});
			return field.required ? requiredNumber(range) : range.optional();
		}
		case "single_select": {
			const ids = new Set(field.options.map((option) => option.id));
			const picked = z.string().refine((value) => ids.has(value), { error: () => m.forms_error_option() });
			return field.required
				? z
						.string({ error: () => m.validation_required() })
						.min(1, { error: () => m.validation_required() })
						.pipe(picked)
				: z.union([z.literal(""), picked]);
		}
		case "multi_select": {
			const ids = new Set(field.options.map((option) => option.id));
			let schema = z
				.array(z.string().refine((value) => ids.has(value), { error: () => m.forms_error_option() }))
				.refine((values) => new Set(values).size === values.length, { error: () => m.forms_error_option() });
			if (field.required)
				schema = schema.refine((values) => values.length > 0, { error: () => m.validation_required() });
			const most = field.maxChoices;
			if (most !== null) {
				schema = schema.refine((values) => values.length <= most, {
					error: () => m.forms_error_max_choices({ max: n(most) }),
				});
			}
			return schema;
		}
		case "rating":
			return field.required ? requiredNumber(ratingSchema()) : ratingSchema().optional();
		case "date": {
			const bounds: { min?: IsoDate; max?: IsoDate } = {
				...(field.min === null ? {} : { min: field.min }),
				...(field.max === null ? {} : { max: field.max }),
			};
			return field.required
				? z
						.string({ error: () => m.validation_required() })
						.min(1, { error: () => m.validation_required() })
						.pipe(isoDate(bounds))
				: z.union([z.literal(""), isoDate(bounds)]);
		}
		case "consent":
			return field.required ? mustAccept() : z.boolean();
	}
}

/**
 * The schema a response to `fields` must pass, keyed by field id: the form's
 * validators in the browser, the submission's check on the server. Nothing else is
 * accepted (a strict object), so a stale or forged submission can't add answers.
 */
export const toZodSchema = (fields: ReadonlyArray<FormField>) =>
	z.strictObject(Object.fromEntries(fields.map((field) => [field.id, answerSchema(field)])));

/** Whether an answer says anything (empty text, no choice and no number are "not answered"). */
export const isAnswered = (value: Answer | undefined): value is Answer =>
	value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);

/** A parsed response without its empty answers: what is stored. */
export const compactAnswers = (answers: Record<string, unknown>): Answers =>
	Object.fromEntries(
		Object.entries(answers).filter((entry): entry is [string, Answer] => isAnswered(entry[1] as Answer | undefined)),
	);
