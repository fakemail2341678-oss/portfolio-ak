{{#public}}
import { z } from "zod";
{{/public}}
{{^public}}
import type { z } from "zod";
{{/public}}
import { listSchema } from "@/lib/crud/schema";
{{#public}}
import { pageParam, searchParam } from "@/lib/list/params";
import { SLUG_PATTERN } from "@/lib/slug";
{{/public}}

/**
 * The URL contract of __Title__'s pages (docs/guides/crud.md). Route files import
 * from here, never from ./schema.ts (decision 0151).
 */

/** The admin list's preferences key (page size, hidden columns, saved views). */
export const __UPPER___TABLE_ID = "__name__";

/** /admin/__name__: search, sort and page, the list function's input, their defaults. Add filters here. */
export const __camel__List = listSchema({
	sorts: ["-updated", "updated", "title", "-title"],
	filters: {},
});
export type __Pascal__Search = z.output<typeof __camel__List.search>;
export type __Pascal__ListInput = z.output<typeof __camel__List.input>;
{{#public}}

// Public pages (/__name__): published rows only.

export const __UPPER___PUBLIC_PAGE_SIZE = 12;

/** /__name__ search params and the public list input. Invalid values are corrected. */
export const __camel__PublicSearchSchema = z.object({ q: searchParam(), page: pageParam() });
export type __Pascal__PublicSearch = z.output<typeof __camel__PublicSearchSchema>;
export const __UPPER___PUBLIC_SEARCH_DEFAULTS = __camel__PublicSearchSchema.parse({});

/** /__name__/$slug: anything that isn't a slug can't exist. */
export const __camel__SlugSchema = z.object({ slug: z.string().max(80).regex(SLUG_PATTERN) });
{{/public}}
