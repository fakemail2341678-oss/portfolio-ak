import { z } from "zod";
import { type CsvDateFormat, parseCsvDay } from "@/lib/csv";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import { FIELD_FILTER_PATTERN } from "./search";
import {
	FIELD_OPTIONS_MAX,
	type FieldType,
	type FieldValue,
	TASKLINE_COLORS,
	type TaskField,
	type TaskFieldValues,
	type TasklineMember,
	type TaskSummary,
} from "./types";

/**
 * Custom fields (Task 55, decision 0220): what a field is (a Zod union over its type,
 * as Forms' definitions, 0195), what its values must be (`toTaskFieldsSchema`, the
 * same check in the browser and on the server), how a value reads, how the views
 * filter by it (`?cf=<field id>:<value>`), and how a CSV cell becomes one. Pure and
 * isomorphic: the server, the pages and the tests share it.
 */

export const FIELD_NAME_MAX = 40;
export const OPTION_NAME_MAX = 40;
export const FIELD_TEXT_MAX = 500;
export const FIELD_URL_MAX = 2000;
/** Numbers are within ± a trillion (what a jsonb number and a person both read well). */
export const FIELD_NUMBER_MAX = 1_000_000_000_000;

export const OPTION_ID_PATTERN = /^o[a-z0-9]{6}$/;

/** A new option's id, made in the browser (as Forms' option ids): values keep it through renames. */
export const newOptionId = () => {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	return `o${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
};

export const fieldOption = z.strictObject({
	id: z.string().regex(OPTION_ID_PATTERN),
	name: required({ max: OPTION_NAME_MAX }),
	color: z.enum(TASKLINE_COLORS),
});

/** A select's choices: at least one, each id once and each name once (any case). */
export const fieldOptions = () =>
	z
		.array(fieldOption)
		.min(1, { error: () => m.taskline_field_error_options() })
		.max(FIELD_OPTIONS_MAX)
		.superRefine((options, context) => {
			const ids = new Set<string>();
			const names = new Set<string>();
			options.forEach((option, index) => {
				if (ids.has(option.id))
					context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate option id" });
				if (names.has(option.name.toLowerCase())) {
					context.addIssue({ code: "custom", path: [index, "name"], message: m.taskline_field_error_option_taken() });
				}
				ids.add(option.id);
				names.add(option.name.toLowerCase());
			});
		});

const base = { name: required({ max: FIELD_NAME_MAX }), required: z.boolean() };
const plain = <T extends Exclude<FieldType, "select" | "multi_select">>(type: T) =>
	z.strictObject({ type: z.literal(type), ...base });

/** A field as it's defined: a select's choices come with it; the other types have none. */
export const fieldDefinition = z.discriminatedUnion("type", [
	plain("text"),
	plain("number"),
	z.strictObject({ type: z.literal("select"), ...base, options: fieldOptions() }),
	z.strictObject({ type: z.literal("multi_select"), ...base, options: fieldOptions() }),
	plain("date"),
	plain("member"),
	plain("checkbox"),
	plain("url"),
]);
export type FieldDefinition = z.infer<typeof fieldDefinition>;

/** The fields offered on tasks: not archived, in order (the workspace's first, then the project's). */
export const activeFields = (fields: ReadonlyArray<TaskField>) => fields.filter((field) => !field.archived);

// ---- Values -----------------------------------------------------------------------------------

/** One field's value: what its type holds, never empty (empty is "no value", stored as nothing). */
export function fieldValueSchema(field: Pick<TaskField, "type" | "options">): z.ZodType<FieldValue> {
	const ids = new Set(field.options.map((option) => option.id));
	const option = z.string().refine((id) => ids.has(id), { error: () => m.taskline_field_error_option() });
	switch (field.type) {
		case "text":
			return required({ max: FIELD_TEXT_MAX });
		case "url":
			return z
				.string()
				.trim()
				.max(FIELD_URL_MAX, { error: () => m.validation_text_max({ max: formatNumber(FIELD_URL_MAX) }) })
				.pipe(z.url({ protocol: /^https?$/, error: () => m.validation_url() }));
		case "number":
			return z
				.number({ error: () => m.validation_number() })
				.finite({ error: () => m.validation_number() })
				.min(-FIELD_NUMBER_MAX, { error: () => m.validation_number_min({ min: formatNumber(-FIELD_NUMBER_MAX) }) })
				.max(FIELD_NUMBER_MAX, { error: () => m.validation_number_max({ max: formatNumber(FIELD_NUMBER_MAX) }) });
		case "select":
			return option;
		case "multi_select":
			return z
				.array(option)
				.min(1)
				.max(FIELD_OPTIONS_MAX)
				.refine((values) => new Set(values).size === values.length, { error: () => m.taskline_field_error_option() });
		case "date":
			return isoDate();
		case "member":
			return z.uuid();
		case "checkbox":
			return z.literal(true);
	}
}

/**
 * What a change to a task's values must pass: each key a field offered on the task
 * (archived and unknown ones are refused: a strict object), each value its type's,
 * null to clear it. The server checks members and the rest of the task itself.
 */
export const toTaskFieldsSchema = (fields: ReadonlyArray<TaskField>) =>
	z.strictObject(
		Object.fromEntries(activeFields(fields).map((field) => [field.id, fieldValueSchema(field).nullable().optional()])),
	);

/** A patch's values, as the inputs carry them before the server knows the fields: checked by `toTaskFieldsSchema`. */
export const fieldValuesPatch = () =>
	z
		.record(z.uuid(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]))
		.refine((values) => Object.keys(values).length <= 50);

/** False, "" and [] say nothing: a field without a value. */
export const isEmptyFieldValue = (value: FieldValue | null | undefined): value is null | undefined =>
	value === undefined ||
	value === null ||
	value === false ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/** Values after a patch: set ones replace, null (or an empty value) removes. */
export function applyFieldPatch(
	values: TaskFieldValues,
	patch: Readonly<Record<string, FieldValue | null | undefined>>,
): TaskFieldValues {
	const next: TaskFieldValues = { ...values };
	for (const [id, value] of Object.entries(patch)) {
		if (value === undefined) continue;
		if (isEmptyFieldValue(value)) delete next[id];
		else next[id] = value;
	}
	return next;
}

const optionName = (field: Pick<TaskField, "options">, id: unknown) =>
	field.options.find((option) => option.id === id)?.name ?? m.taskline_field_removed_option();

/**
 * A value as words: option names, a member's name, a formatted number or day, "Yes"
 * for a ticked box. `csv` keeps days as `YYYY-MM-DD` and numbers unformatted, for files.
 */
export function fieldValueText(
	field: Pick<TaskField, "type" | "options">,
	value: FieldValue | null | undefined,
	members: ReadonlyArray<Pick<TasklineMember, "id" | "name">>,
	{ csv = false }: { csv?: boolean } = {},
): string {
	if (isEmptyFieldValue(value)) return "";
	switch (field.type) {
		case "text":
		case "url":
			return String(value);
		case "number":
			return csv ? String(value) : formatNumber(Number(value));
		case "select":
			return optionName(field, value);
		case "multi_select":
			return (Array.isArray(value) ? value : [value]).map((id) => optionName(field, id)).join(", ");
		case "date":
			return csv || typeof value !== "string"
				? String(value)
				: formatDate(isoDateInstant(value), { dateStyle: "medium" });
		case "member":
			return members.find((member) => member.id === value)?.name ?? m.taskline_activity_someone();
		case "checkbox":
			return m.filters_yes();
	}
}

/** The fields a task is missing that it needs before it's completed. */
export const missingRequired = (fields: ReadonlyArray<TaskField>, values: TaskFieldValues) =>
	activeFields(fields).filter((field) => field.required && isEmptyFieldValue(values[field.id]));

// ---- Filters (`?cf=<field id>:<value>`) ------------------------------------------------------

/**
 * What a field filter can ask, by type: an option, a member (or `me`), a ticked box
 * (`yes`/`no`), a day before today or from today (`past`/`future`); and for every type,
 * a value (`any`) or none (`none`).
 */

export type FieldFilter = { fieldId: string; value: string };

/** The `cf` params as filters, the first per field (a URL may repeat one). */
export function parseFieldFilters(params: ReadonlyArray<string>): FieldFilter[] {
	const seen = new Set<string>();
	const filters: FieldFilter[] = [];
	for (const param of params) {
		const match = FIELD_FILTER_PATTERN.exec(param);
		if (!match?.[1] || !match[2] || seen.has(match[1])) continue;
		seen.add(match[1]);
		filters.push({ fieldId: match[1], value: match[2] });
	}
	return filters;
}

export const fieldFilterParam = (fieldId: string, value: string) => `${fieldId}:${value}`;

/** A filter's choices for a field (the select's options), without "Any" (the form adds it). */
export function fieldFilterChoices(
	field: TaskField,
	members: ReadonlyArray<TasklineMember>,
	{ member }: { member: boolean },
): Array<{ value: string; label: string }> {
	const any = { value: "any", label: m.taskline_field_filter_any() };
	const none = { value: "none", label: m.taskline_field_filter_none() };
	switch (field.type) {
		case "select":
		case "multi_select":
			return [...field.options.map((option) => ({ value: option.id, label: option.name })), any, none];
		case "member":
			return [
				...(member ? [{ value: "me", label: m.taskline_field_filter_me() }] : []),
				...members.filter((each) => !each.deactivated).map((each) => ({ value: each.id, label: each.name })),
				any,
				none,
			];
		case "checkbox":
			return [
				{ value: "yes", label: m.taskline_field_filter_yes() },
				{ value: "no", label: m.taskline_field_filter_no() },
			];
		case "date":
			return [
				{ value: "past", label: m.taskline_field_filter_past() },
				{ value: "future", label: m.taskline_field_filter_future() },
				any,
				none,
			];
		default:
			return [any, none];
	}
}

/** A filter's value as words, for its chip. */
export const fieldFilterText = (field: TaskField, value: string, members: ReadonlyArray<TasklineMember>) =>
	fieldFilterChoices(field, members, { member: true }).find((choice) => choice.value === value)?.label;

/** Whether a task's value passes one filter (as the server's SQL, `fieldsWhere`, means it). */
export function matchesFieldFilter(
	_field: Pick<TaskField, "id" | "type">,
	value: FieldValue | undefined,
	filter: string,
	{ me, today }: { me: string | null; today: string },
): boolean {
	const has = !isEmptyFieldValue(value);
	switch (filter) {
		case "any":
			return has;
		case "none":
		case "no":
			return !has;
		case "yes":
			return value === true;
		case "past":
			return typeof value === "string" && value < today;
		case "future":
			return typeof value === "string" && value >= today;
		case "me":
			return me !== null && value === me;
		default:
			return Array.isArray(value) ? value.includes(filter) : value === filter;
	}
}

/** Whether a task passes every field filter (one of a field no longer offered is ignored). */
export function matchesFieldFilters(
	task: Pick<TaskSummary, "fields">,
	filters: ReadonlyArray<FieldFilter>,
	fields: ReadonlyArray<TaskField>,
	context: { me: string | null; today: string },
): boolean {
	return filters.every((filter) => {
		const field = fields.find((each) => each.id === filter.fieldId && !each.archived);
		return field ? matchesFieldFilter(field, task.fields[field.id], filter.value, context) : true;
	});
}

// ---- The CSV import ---------------------------------------------------------------------------

const DIGITS = /[०-९]/g;
const latinDigits = (text: string) => text.replace(DIGITS, (digit) => String(digit.charCodeAt(0) - 0x966));

/** Words for a ticked box, in every language (and the usual spreadsheet ones). */
const isTicked = (text: string) => {
	const value = text.toLowerCase();
	if (["true", "yes", "y", "1", "x", "✓", "✔"].includes(value)) return true;
	return locales.some((locale) => m.filters_yes({}, { locale }).toLowerCase() === value);
};
const isUnticked = (text: string) => {
	const value = text.toLowerCase();
	if (["false", "no", "n", "0"].includes(value)) return true;
	return locales.some((locale) => m.filters_no({}, { locale }).toLowerCase() === value);
};

export type FieldCell = { value: FieldValue | null } | { problem: string };

/**
 * A CSV cell as a field's value: option and member names matched without case, several
 * options split on `,` `;` `|`, days in the import's format, "yes"/"✓"/"हो" ticked. An
 * empty cell is no value; a cell that can't be one is a problem the preview shows.
 */
export function parseFieldCell(
	field: TaskField,
	raw: string,
	{ dateFormat, members }: { dateFormat: CsvDateFormat; members: ReadonlyArray<Pick<TasklineMember, "id" | "name">> },
): FieldCell {
	const text = raw.trim();
	if (text === "") return { value: null };
	const byName = (name: string) => field.options.find((option) => option.name.toLowerCase() === name.toLowerCase());
	let value: FieldValue | null;
	switch (field.type) {
		case "text":
		case "url":
			value = text;
			break;
		case "number": {
			const number = Number(latinDigits(text).replace(/,/g, ""));
			if (!Number.isFinite(number)) return { problem: m.validation_number() };
			value = number;
			break;
		}
		case "select": {
			const option = byName(text);
			if (!option) return { problem: m.taskline_field_error_option() };
			value = option.id;
			break;
		}
		case "multi_select": {
			const ids: string[] = [];
			for (const name of text.split(/[,;|]/).map((part) => part.trim())) {
				if (!name) continue;
				const option = byName(name);
				if (!option) return { problem: m.taskline_field_error_option() };
				if (!ids.includes(option.id)) ids.push(option.id);
			}
			value = ids.length > 0 ? ids : null;
			break;
		}
		case "date": {
			const day = parseCsvDay(latinDigits(text), dateFormat);
			if (!day) return { problem: m.taskline_import_error_date() };
			value = day;
			break;
		}
		case "member": {
			const member = members.find((each) => each.name.toLowerCase() === text.toLowerCase());
			if (!member) return { problem: m.taskline_field_error_member() };
			value = member.id;
			break;
		}
		case "checkbox":
			if (isUnticked(text)) return { value: null };
			if (!isTicked(text)) return { problem: m.taskline_field_error_checkbox() };
			value = true;
			break;
	}
	if (value === null) return { value: null };
	const checked = fieldValueSchema(field).safeParse(value);
	return checked.success
		? { value: checked.data }
		: { problem: checked.error.issues[0]?.message ?? m.validation_required() };
}
