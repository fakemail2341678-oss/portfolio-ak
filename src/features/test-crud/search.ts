import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { arrayParam, booleanParam, dateParam, enumParam, numberParam, pageParam, searchParam } from "@/lib/list/params";
import { SLUG_PATTERN } from "@/lib/slug";
import { TEST_CRUD_STATUSES } from "./constants";

/**
 * The URL contract of Test CRUD's pages: search params, path params and the list
 * input they become. Route files import from here, never from ./schema.ts: route
 * options (validateSearch, params, loader) stay in the entry chunk, and the form
 * schemas there pull in rich-text and phone validation (decision 0151).
 */

export const TEST_CRUD_STATUS_FILTERS = ["all", ...TEST_CRUD_STATUSES] as const;
export type TestCrudStatusFilter = (typeof TEST_CRUD_STATUS_FILTERS)[number];

export const TEST_CRUD_PRICE_MAX = 10_000_000;

/** A tag in a filter: same limits as stored tags. */
const tagValue = z.string().trim().min(1).max(32);

/**
 * /admin/test-crud: the search params, the list function's input, their defaults
 * and the filter keys. Filters: status, tags (any of), price range, published
 * date range (calendar days in the app time zone) and has-image.
 */
export const testCrudList = listSchema({
	sorts: ["-updated", "updated", "title", "-title", "price", "-price"],
	filters: {
		status: enumParam(TEST_CRUD_STATUS_FILTERS, "all"),
		tags: arrayParam(tagValue, { max: 10 }),
		priceMin: numberParam({ max: TEST_CRUD_PRICE_MAX }),
		priceMax: numberParam({ max: TEST_CRUD_PRICE_MAX }),
		from: dateParam(),
		to: dateParam(),
		hasImage: booleanParam(),
	},
});
export type TestCrudSearch = z.output<typeof testCrudList.search>;
export type TestCrudListInput = z.output<typeof testCrudList.input>;

/**
 * The admin list ROUTE's search: the list params plus `edit`, the item open in the
 * edit dialog (a masked route: the address bar shows /admin/test-crud/$id).
 * `edit` is UI state only; it is not part of the server function input.
 */
export const testCrudAdminRouteSearchSchema = testCrudList.search.extend({
	edit: z.uuid().optional().catch(undefined),
});

// ---------------------------------------------------------------------------
// Public side (/dev/test-crud)
// ---------------------------------------------------------------------------

export const TEST_CRUD_PUBLIC_PAGE_SIZE = 12;

/** /dev/test-crud search params and the public list input. Invalid values are corrected. */
export const testCrudPublicSearchSchema = z.object({ q: searchParam(), page: pageParam() });
export type TestCrudPublicSearch = z.output<typeof testCrudPublicSearchSchema>;
export const TEST_CRUD_PUBLIC_SEARCH_DEFAULTS = testCrudPublicSearchSchema.parse({});

/** The public list ROUTE's search: plus `view`, the item in the quick-view dialog (masked to /dev/test-crud/$slug). */
export const testCrudPublicRouteSearchSchema = testCrudPublicSearchSchema.extend({
	view: z.string().max(80).regex(SLUG_PATTERN).optional().catch(undefined),
});

/** Slug route param; anything that isn't a valid slug can't exist. */
export const testCrudSlugParamSchema = z.object({ slug: z.string().max(80).regex(SLUG_PATTERN) });
