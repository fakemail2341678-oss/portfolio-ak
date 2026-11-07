import { z } from "zod";
import { getLocale, type Locale, locales } from "@/paraglide/runtime";

/**
 * Content typed in both languages (decisions 0107, 0176, 0178): `{ en, ne }`, English
 * required, Nepali optional. Admin forms edit it with LocalizedField and
 * `localizedText()` (src/lib/validation.ts); the database stores it as jsonb
 * (`localizedText()` in src/server/db/schema/columns.ts).
 */
export type Localized = { en: string; ne: string };

/**
 * A localized string in a content record: English as `value` requires, Nepali may be empty (it falls back).
 *
 * @public
 */
export const localized = <T extends z.ZodString>(value: T) => z.object({ en: value, ne: z.string().trim() });

/**
 * The value in `locale` (default: the current one), English when there is no
 * Nepali. Call it at render time. Generated features with `--localized` use it.
 *
 * @public
 */
export const localizedValue = (value: Localized, locale: Locale = getLocale()) =>
	locale === "ne" && value.ne.trim() ? value.ne : value.en;

/** Whether `value` shows its English text in `locale` (no Nepali yet): render it with `lang="en"`. */
export const isFallback = (value: Localized, locale: Locale) => locale !== "en" && !value.ne.trim();

/**
 * The type of `value` once every Localized field in it is resolved to one
 * language: `{ title: { en, ne } }` becomes `{ title: string }`, deeply. Objects
 * that contain localized text may also carry `lang: "en"` (see resolveLocalized).
 *
 * @public
 */
export type Resolved<T> = T extends Localized
	? string
	: T extends ReadonlyArray<unknown>
		? // A mapped type over an array keeps tuples as tuples ([from, to] stays a pair).
			{ -readonly [K in keyof T]: Resolved<T[K]> }
		: T extends object
			? { [K in keyof T]: Resolved<T[K]> } & { lang?: "en" }
			: T;

const LOCALE_KEYS = [...locales].sort().join("|");

/**
 * True for an object whose keys are exactly the app's locales, each a string.
 *
 * @public
 */
export const isLocalized = (value: unknown): value is Localized =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.keys(value).sort().join("|") === LOCALE_KEYS &&
	Object.values(value).every((text) => typeof text === "string");

/**
 * Resolves every Localized field of a content record to `locale`, deeply. Pure
 * and synchronous, so server and client render identical text.
 *
 * A missing Nepali text falls back to English. An object none of whose own
 * localized texts is in `locale` (a record or block not translated yet) gets
 * `lang: "en"`, so the component rendering it can mark it for screen readers
 * and hyphenation: `<article lang={project.lang}>`. A partly translated object
 * stays unmarked: its translated texts are the majority case it is read in.
 *
 * @public
 */
export function resolveLocalized<T>(value: T, locale: Locale): Resolved<T> {
	if (isLocalized(value)) return (locale === "ne" && value.ne.trim() ? value.ne : value.en) as Resolved<T>;
	if (Array.isArray(value)) return value.map((item) => resolveLocalized(item, locale)) as Resolved<T>;
	if (typeof value !== "object" || value === null) return value as Resolved<T>;
	let texts = 0;
	let fallbacks = 0;
	const count = (item: unknown) => {
		if (!isLocalized(item) || !item.en.trim()) return;
		texts++;
		if (isFallback(item, locale)) fallbacks++;
	};
	const resolved = Object.fromEntries(
		Object.entries(value).map(([key, item]) => {
			if (Array.isArray(item)) item.forEach(count);
			else count(item);
			return [key, resolveLocalized(item, locale)];
		}),
	);
	if (texts > 0 && fallbacks === texts) resolved.lang = "en";
	return resolved as Resolved<T>;
}
