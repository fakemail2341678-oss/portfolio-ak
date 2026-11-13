import type { SpendChartInput, SpendListInput, SpendSearch } from "../search";
import { foldControls } from "./query/edit";

/** Rows per page of Spend when the URL doesn't say. */
export const SPEND_PAGE_SIZE = 20;

/**
 * The query the address means: `q`, with the bar's controls folded in when a form sent
 * them without JavaScript (`?q=…&category=Food`).
 */
export const spendQuery = (search: Pick<SpendSearch, "q" | "type" | "category" | "date">): string =>
	search.type === undefined && search.category === undefined && search.date === undefined
		? search.q
		: foldControls(search.q, { type: search.type, category: search.category, date: search.date });

/** The server's input for the page the URL describes (the open panel isn't part of it). */
export const spendInput = (search: SpendSearch): SpendListInput => ({
	q: spendQuery(search),
	sort: search.sort,
	page: search.page,
	pageSize: search.pageSize ?? SPEND_PAGE_SIZE,
});

/** The chart's input, for the chart view. */
export const spendChartInput = (search: SpendSearch): SpendChartInput => ({
	q: spendQuery(search),
	groupBy: search.groupBy,
});
