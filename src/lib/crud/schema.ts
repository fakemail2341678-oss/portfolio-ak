import { z } from "zod";
import { enumParam, pageParam, pageSizeParam, resolvedPageSize, searchParam } from "@/lib/list/params";

/**
 * Schema pieces every feature's search.ts and schema.ts use (docs/guides/crud.md).
 * Light on purpose: route files import search.ts, so this is in every page's
 * JavaScript (decision 0151).
 *
 * Server-function inputs are strict (`z.strictObject`): an unknown key is a
 * mistake, refused with BAD_REQUEST. URL search schemas never are: links carry
 * keys the page doesn't know (utm tags), which must still open it.
 */

/** One record by id: a server function's input, and a `$id` route's path params. */
export const idSchema = z.strictObject({ id: z.uuid() });

/**
 * A timestamp in a DTO: a Date in the row the repository read, an ISO string on
 * the wire. Parsing a row with the DTO schema turns one into the other, so
 * repositories don't write `toISOString()` by hand:
 *
 *   export const projectListItem = z.object({ id: z.string(), title: z.string(), updatedAt: isoDateTime() });
 *   export type ProjectListItem = z.output<typeof projectListItem>;   // updatedAt: string
 *   rows.map((row) => projectListItem.parse(row))                        // picks the fields, converts the dates
 */
export const isoDateTime = () =>
	z.codec(z.date(), z.iso.datetime(), {
		decode: (date) => date.toISOString(),
		encode: (iso) => new Date(iso),
	});

/**
 * A list page's URL contract: the search params (`q`, the feature's filters,
 * `sort`, `page`, `pageSize`), the list server function's input built from them,
 * their defaults and the filter keys. The first sort is the default.
 *
 *   export const projectList = listSchema({
 *     sorts: ["-updated", "updated", "title", "-title"],
 *     filters: { status: enumParam(["all", ...PROJECT_STATUSES], "all") },
 *   });
 *   validateSearch: projectList.search          // the route
 *   .validator(zodInput(projectList.input))     // the server function
 */
export function listSchema<const TSorts extends readonly [string, ...string[]], TFilters extends z.ZodRawShape>({
	sorts,
	filters,
}: {
	sorts: TSorts;
	filters: TFilters;
}) {
	const params = { q: searchParam(), ...filters, sort: enumParam(sorts, sorts[0]), page: pageParam() };
	const search = z.object({ ...params, pageSize: pageSizeParam() });
	return {
		search,
		/** What the list function receives: exactly the search, with the page size resolved (tableListInput). */
		input: z.strictObject({ ...params, pageSize: resolvedPageSize() }),
		/** Every param at its default: kept out of links (listSearch), and a test's starting input. */
		defaults: search.parse({}),
		/** What "Clear all" resets; sort and page size stay. */
		filterKeys: ["q", ...Object.keys(filters)] as ReadonlyArray<"q" | Extract<keyof TFilters, string>>,
	};
}
