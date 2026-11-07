import { z } from "zod";
import { PAGE_SIZES } from "@/lib/stores/preferences";

/**
 * URL search and path params: the schemas every list page's URL is built from.
 *
 * A list page's search schema combines these, the same schema validates the
 * server function's input, and the server answers with a `Paged<T>` (./paging.ts).
 * The frontend pieces (<DataTable sort>, <Pagination>, <SearchLink>, <FilterBar>)
 * read and write exactly these params. Shape of a filter URL (identical with and
 * without JavaScript, because a plain GET <form> produces exactly this):
 *
 *   /admin/test-crud?q=momo&status=draft&tags=food&tags=nepal&priceMin=100&from=2026-01-01&sort=-price&page=2
 *
 * - arrays are repeated keys, never JSON;
 * - empty values (an unfilled form field) mean "not set";
 * - every param is forgiving (`.catch`): a hand-edited or stale URL is corrected
 *   to the default instead of failing the page.
 */

/** `?q=` free-text search (trimmed, at most `max` characters, "" when absent). */
export const searchParam = (max = 80) => z.string().trim().max(max).default("").catch("");

/** `?page=` 1-based page number. */
export const pageParam = (max = 10_000) => z.coerce.number().int().min(1).max(max).default(1).catch(1);

/** `?pageSize=` one of PAGE_SIZES; optional, so the route can fall back to the saved table preference. */
export const pageSizeParam = () =>
	z.coerce
		.number()
		.refine((value) => (PAGE_SIZES as ReadonlyArray<number>).includes(value))
		.optional()
		.catch(undefined);

/** A page size the server accepts (the resolved value sent to list server functions). */
export const resolvedPageSize = () =>
	z.coerce.number().refine((value) => (PAGE_SIZES as ReadonlyArray<number>).includes(value));

/**
 * `?sort=` or any enum param: one of `values`, `fallback` when absent or invalid.
 * Sort values are a field name for ascending and `-field` for descending
 * (what <DataTable> columns' `sort` produce).
 */
export const enumParam = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
	z.enum(values).default(fallback).catch(fallback);

/** "" / null from a submitted-but-empty form field means "not set". */
const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

/**
 * A multi-value param (`?tags=a&tags=b`): always an array, de-duplicated, at most
 * `max` items. Accepts one value, repeated keys, or a JSON array (old links).
 * Invalid items are dropped; the rest are kept.
 */
export const arrayParam = <T extends z.ZodType<string>>(item: T, { max = 20 }: { max?: number } = {}) =>
	z
		.preprocess((value) => {
			const raw = value === undefined || value === "" ? [] : Array.isArray(value) ? value : [value];
			const valid = raw.map(String).filter((entry) => item.safeParse(entry).success);
			return [...new Set(valid)].slice(0, max);
		}, z.array(item))
		// Optional in links (absent = []), always an array once parsed.
		.default(() => [])
		.catch(() => []);

/** An optional number (`?priceMin=100`), within [min, max]; anything else is "not set". */
export const numberParam = ({ min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}) =>
	z.preprocess(blankToUndefined, z.coerce.number().finite().min(min).max(max).optional()).catch(undefined);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** An optional calendar date (`?from=2026-09-01`, what <input type="date"> submits). */
export const dateParam = () =>
	z
		.preprocess(
			blankToUndefined,
			z
				.string()
				.regex(DATE_ONLY)
				.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
				.optional(),
		)
		.catch(undefined);

/** An optional yes/no filter (`?hasImage=true|false`); absent means "any". */
export const booleanParam = () =>
	z
		.preprocess(
			(value) => (value === "true" || value === true ? true : value === "false" || value === false ? false : undefined),
			z.boolean().optional(),
		)
		.catch(undefined);

/**
 * Route `params.parse` with a Zod schema: the parsed params, or `false` so the
 * route doesn't match (the request then gets the localized 404, with status 404).
 *
 *   params: { parse: (raw) => parseParams(z.object({ id: z.uuid() }), raw) },
 */
export function parseParams<T extends z.ZodType<Record<string, unknown>>>(
	schema: T,
	raw: Record<string, string>,
): z.output<T> | false {
	const result = schema.safeParse(raw);
	return result.success ? result.data : false;
}
