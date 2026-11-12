import type { SpendListInput, SpendSearch } from "../search";

/** Rows per page of Spend when the URL doesn't say. */
export const SPEND_PAGE_SIZE = 20;

/** The server's input for the page the URL describes (the open panel isn't part of it). */
export const spendInput = (search: SpendSearch): SpendListInput => ({
	q: search.q,
	...(search.month ? { month: search.month } : {}),
	category: search.category,
	sort: search.sort,
	page: search.page,
	pageSize: search.pageSize ?? SPEND_PAGE_SIZE,
});
