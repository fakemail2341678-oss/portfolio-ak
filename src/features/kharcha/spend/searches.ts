import { m } from "@/paraglide/messages";
import type { SavedSearch } from "../types";

/**
 * Spend's built-in saved searches (PLAN Task 93): always there, before the caller's own,
 * and not theirs to rename or delete. Each is a query in the search language.
 */
export const BUILT_IN_SEARCHES = [
	{ key: "this-month", query: "date:this-month", label: () => m.kharcha_search_this_month() },
	{ key: "uncategorized", query: "is:uncategorized", label: () => m.kharcha_search_uncategorized() },
	{ key: "unsettled", query: "is:unsettled", label: () => m.kharcha_search_unsettled() },
	{ key: "receipts", query: "has:receipt", label: () => m.kharcha_search_receipts() },
] as const;

/** A search as the rail and Spend list it: built-in ones first, then the caller's own. */
export type SearchLink = { key: string; name: string; query: string; own: boolean };

export const searchLinks = (own: ReadonlyArray<SavedSearch>): SearchLink[] => [
	...BUILT_IN_SEARCHES.map((each) => ({ key: each.key, name: each.label(), query: each.query, own: false })),
	...own.map((each) => ({ key: each.id, name: each.name, query: each.query, own: true })),
];

/** The search a query is, if it is one of them (the same text once trimmed). */
export const searchOf = (links: ReadonlyArray<SearchLink>, query: string): SearchLink | undefined =>
	query.trim() === "" ? undefined : links.find((each) => each.query.trim() === query.trim());
