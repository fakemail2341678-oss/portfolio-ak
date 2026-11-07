/**
 * Shared, localized Zod helpers for forms and server functions.
 *
 * Messages are Paraglide functions evaluated when validation runs (Zod's `error`
 * callback), so the same schema reports errors in whichever language the user
 * is using, on the client and on the server. Numbers inside messages are
 * formatted for that language too (e.g. "कम्तीमा ८ ...").
 */
import { z } from "zod";
import { m } from "@/paraglide/messages";
import { type IsoDate, isIsoDate, isoDateInstant } from "./i18n/date-only";
import { formatBytes, formatDate, formatNumber } from "./i18n/intl";
import { SLUG_MAX, SLUG_PATTERN } from "./slug";

const n = (value: number) => formatNumber(value);

/** Non-empty trimmed string. */
export const required = (options: { max?: number } = {}) => {
	const base = z
		.string({ error: () => m.validation_required() })
		.trim()
		.min(1, { error: () => m.validation_required() });
	return options.max === undefined
		? base
		: base.max(options.max, { error: () => m.validation_text_max({ max: n(options.max ?? 0) }) });
};

/** Optional text: empty string allowed, trimmed. */
export const optionalText = (options: { max?: number } = {}) => {
	const base = z.string().trim();
	return options.max === undefined
		? base
		: base.max(options.max, { error: () => m.validation_text_max({ max: n(options.max ?? 0) }) });
};

export const email = () =>
	z
		.string({ error: () => m.validation_required() })
		.trim()
		.min(1, { error: () => m.validation_required() })
		.pipe(z.email({ error: () => m.validation_email() }));

/**
 * Text typed in both languages, `{ en, ne }` (LocalizedField): English required
 * unless `optional`, Nepali always optional (pages fall back to English).
 * Generated features with `--localized` use it.
 *
 * @public
 */
export const localizedText = ({ max, optional = false }: { max?: number; optional?: boolean } = {}) =>
	z.strictObject({ en: optional ? optionalText({ max }) : required({ max }), ne: optionalText({ max }) });

/**
 * Rich-text HTML in both languages (LocalizedRichTextField): English required unless `optional`.
 *
 * @public
 */
export const localizedRichText = ({ max, optional = false }: { max?: number; optional?: boolean } = {}) =>
	z.strictObject({ en: richText({ required: !optional, max }), ne: richText({ required: false, max }) });

/**
 * A list of `item`s (a SortableListField, BlocksField): at least `min`, at most `max`.
 *
 * @public
 */
export const list = <T extends z.ZodType>(item: T, { min = 0, max }: { min?: number; max: number }) =>
	z
		.array(item)
		.min(min, { error: () => m.validation_list_min({ min: n(min) }) })
		.max(max, { error: () => m.validation_list_max({ max: n(max) }) });

/** A URL slug ("hello-world", ./slug.ts): required, lowercase words joined by hyphens. */
export const slug = ({ max = SLUG_MAX }: { max?: number } = {}) =>
	z
		.string()
		.trim()
		.min(1, { error: () => m.validation_required() })
		.max(max, { error: () => m.validation_text_max({ max: n(max) }) })
		.regex(SLUG_PATTERN, { error: () => m.validation_slug() });

/** http(s) URL. Pass `{ optional: true }` to also accept an empty string. */
export const url = (options: { optional?: boolean } = {}) => {
	const valid = z.url({ protocol: /^https?$/, error: () => m.validation_url() });
	const text = z.string({ error: () => m.validation_required() }).trim();
	return options.optional
		? text.pipe(z.union([z.literal(""), valid]))
		: text.min(1, { error: () => m.validation_required() }).pipe(valid);
};

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * 0 (very weak) to 4 (very strong): one point each for length >= 12, mixed
 * case, digits and symbols, with anything under the minimum length scoring 0.
 * Deliberately simple and dependency-free; the server (Better Auth) enforces length.
 */
export const passwordStrength = (value: string): PasswordStrength => {
	if (value.length < PASSWORD_MIN_LENGTH) return 0;
	const points =
		Number(value.length >= 12) +
		Number(/[a-z]/.test(value) && /[A-Z]/.test(value)) +
		Number(/\d/.test(value)) +
		Number(/[^A-Za-z0-9]/.test(value));
	return Math.min(4, Math.max(1, points)) as PasswordStrength;
};

/** Minimum length plus a minimum strength score (default 2, "fair"). */
export const password = (options: { minStrength?: PasswordStrength } = {}) => {
	const minStrength = options.minStrength ?? 2;
	return z
		.string({ error: () => m.validation_required() })
		.min(1, { error: () => m.validation_required() })
		.min(PASSWORD_MIN_LENGTH, { error: () => m.validation_password_min({ min: n(PASSWORD_MIN_LENGTH) }) })
		.max(PASSWORD_MAX_LENGTH, { error: () => m.validation_text_max({ max: n(PASSWORD_MAX_LENGTH) }) })
		.refine((value) => passwordStrength(value) >= minStrength, { error: () => m.validation_password_weak() });
};

// ---------------------------------------------------------------------------
// Numbers and money
// ---------------------------------------------------------------------------

type RangeOptions = { min?: number; max?: number; integer?: boolean };

/** A finite number within an optional range. Fields store `undefined` when empty. */
export const numberRange = ({ min, max, integer }: RangeOptions = {}) => {
	let schema = z.number({ error: () => m.validation_number() }).finite({ error: () => m.validation_number() });
	if (integer) schema = schema.int({ error: () => m.validation_integer() });
	if (min !== undefined) schema = schema.min(min, { error: () => m.validation_number_min({ min: n(min) }) });
	if (max !== undefined) schema = schema.max(max, { error: () => m.validation_number_max({ max: n(max) }) });
	return schema;
};

const hasAtMostTwoDecimals = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

/** A money amount: non-negative by default, at most 2 decimal places. */
export const currency = ({ min = 0, max }: { min?: number; max?: number } = {}) =>
	numberRange({ min, ...(max === undefined ? {} : { max }) }).refine(hasAtMostTwoDecimals, {
		error: () => m.validation_currency_decimals(),
	});

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/** A selected value (select, radio, combobox): must not be empty. */
export const choice = () =>
	z.string({ error: () => m.validation_required() }).min(1, { error: () => m.validation_required() });

/** Several selected values (checkbox group, multi-select). */
export const choices = ({ min = 1 }: { min?: number } = {}) =>
	z.array(z.string()).min(min, { error: () => m.validation_select_min({ min: n(min) }) });

/** A checkbox that must be ticked (terms, consent). */
export const mustAccept = () =>
	z
		.boolean({ error: () => m.validation_must_accept() })
		.refine((value) => value, { error: () => m.validation_must_accept() });

// ---------------------------------------------------------------------------
// Phase 7b fields
// ---------------------------------------------------------------------------

/** A 6-digit one-time code. */
export const otp = () => z.string().regex(/^\d{6}$/, { error: () => m.validation_otp() });

const dateLabel = (value: IsoDate) => formatDate(isoDateInstant(value), { dateStyle: "medium" });

/** "YYYY-MM-DD" within optional bounds (inclusive). */
export const isoDate = (bounds: { min?: IsoDate; max?: IsoDate } = {}) => {
	let schema = z.string({ error: () => m.validation_date() }).refine(isIsoDate, { error: () => m.validation_date() });
	if (bounds.min !== undefined) {
		const min = bounds.min;
		schema = schema.refine((value) => !isIsoDate(value) || value >= min, {
			error: () => m.validation_date_min({ date: dateLabel(min) }),
		});
	}
	if (bounds.max !== undefined) {
		const max = bounds.max;
		schema = schema.refine((value) => !isIsoDate(value) || value <= max, {
			error: () => m.validation_date_max({ date: dateLabel(max) }),
		});
	}
	return schema;
};

/** { from, to } as "YYYY-MM-DD", both required, `to` not before `from`. */
export const dateRange = () =>
	z
		.object({ from: z.string().optional(), to: z.string().optional() }, { error: () => m.validation_date_range() })
		.refine((range) => isIsoDate(range.from) && isIsoDate(range.to), { error: () => m.validation_date_range() })
		.refine((range) => !range.from || !range.to || range.from <= range.to, {
			error: () => m.validation_date_order(),
		});

/** 24-hour "HH:mm". */
export const time = () =>
	z
		.string({ error: () => m.validation_time() })
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: () => m.validation_time() });

/** Tags: unique, trimmed, each at most `maxLength`, at most `max` of them. */
export const tags = ({ max = 10, maxLength = 32, min = 0 }: { max?: number; maxLength?: number; min?: number } = {}) =>
	z
		.array(
			z
				.string()
				.trim()
				.min(1)
				.max(maxLength, { error: () => m.validation_tag_length({ max: n(maxLength) }) }),
		)
		.min(min, { error: () => m.validation_select_min({ min: n(min) }) })
		.max(max, { error: () => m.validation_tags_max({ max: n(max) }) });

/** "#rrggbb" (lower or upper case). */
export const hexColor = () => z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: () => m.validation_color() });

export type FileRules = {
	/** Maximum size per file in bytes. */
	maxBytes: number;
	/** Accepted MIME types; "image/*" style wildcards allowed. */
	accept: ReadonlyArray<string>;
};

export const acceptsType = (type: string, accept: ReadonlyArray<string>) =>
	accept.some((rule) => (rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule));

/** Files picked in a FileField/ImageField: size and type per file, count overall. */
export const files = ({ maxBytes, accept, max = 1, min = 0 }: FileRules & { max?: number; min?: number }) =>
	z
		.array(z.instanceof(File))
		.min(Math.max(min, 0), { error: () => m.validation_file_required() })
		.max(max, { error: () => m.validation_files_max({ max: n(max) }) })
		.superRefine((list, ctx) => {
			for (const file of list) {
				if (file.size > maxBytes) {
					ctx.addIssue({
						code: "custom",
						message: m.validation_file_too_large({ name: file.name, size: formatBytes(maxBytes) }),
					});
				}
				if (!acceptsType(file.type, accept)) {
					ctx.addIssue({ code: "custom", message: m.validation_file_type({ name: file.name }) });
				}
			}
		});

/** Visible text of rich-text HTML (tags and entities removed), for length rules. */
export const richTextPlainText = (html: string) =>
	html
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/g, " ")
		.replace(/&[a-z]+;|&#\d+;/gi, "x")
		.replace(/\s+/g, " ")
		.trim();

/** Rich-text HTML from RichTextField. Length limits apply to the visible text. */
export const richText = ({ required: isRequired = true, max }: { required?: boolean; max?: number } = {}) => {
	let schema = z.string();
	if (isRequired) {
		schema = schema.refine((value) => richTextPlainText(value).length > 0, { error: () => m.validation_required() });
	}
	if (max !== undefined) {
		schema = schema.refine((value) => richTextPlainText(value).length <= max, {
			error: () => m.validation_text_max({ max: n(max) }),
		});
	}
	return schema;
};
