import { z } from "zod";
import type { Paged } from "@/lib/list/paging";
import { enumParam, pageParam, searchParam } from "@/lib/list/params";

export const STACK_SORTS = ["name", "-name", "category"] as const;
export type StackSort = (typeof STACK_SORTS)[number];

export const STACK_CATEGORIES = ["framework", "data", "ui", "i18n", "auth", "observability", "quality"] as const;
export type StackCategory = (typeof STACK_CATEGORIES)[number];

export const STACK_PAGE_SIZE = 6;

export const STACK_SEARCH_DEFAULTS = { q: "", sort: "name", page: 1 } as const satisfies {
	q: string;
	sort: StackSort;
	page: number;
};

/**
 * One schema for the /stack URL (validateSearch) and the listStack server
 * function input. `.default()` keeps params optional in links; `.catch()`
 * silently corrects invalid values (e.g. ?page=abc -> 1, ?sort=bogus -> "name").
 */
export const stackSearchSchema = z.object({
	q: searchParam(),
	sort: enumParam(STACK_SORTS, STACK_SEARCH_DEFAULTS.sort),
	page: pageParam(1000),
	/** `?simulate=error` makes the server function throw, to exercise error handling. */
	simulate: z.enum(["error"]).optional().catch(undefined),
});

export type StackSearch = z.output<typeof stackSearchSchema>;

export type StackItem = {
	id: string;
	name: string;
	category: StackCategory;
	categoryLabel: string;
	description: string;
	url: string;
};

export type StackPage = Paged<StackItem>;

export type StackStats = { tools: number; categories: number };
