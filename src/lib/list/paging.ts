import { z } from "zod";

/**
 * What a list server function answers (`Paged<T>`) and the page maths behind it.
 * The params that ask for a page are in ./params.ts.
 */

/** One page of results. `page` is the page actually returned (out-of-range requests are clamped). */
export type Paged<T> = { items: T[]; total: number; page: number; pageCount: number };

/** "-price" -> { field: "price", direction: "desc" }. */
export const parseSort = (sort: string): { field: string; direction: "asc" | "desc" } =>
	sort.startsWith("-") ? { field: sort.slice(1), direction: "desc" } : { field: sort, direction: "asc" };

/**
 * Page maths for any list: clamps the requested page into range (e.g. after the
 * last row of the last page was deleted) and gives the offset to read from.
 */
export function pageWindow({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const current = Math.min(Math.max(1, page), pageCount);
	return { page: current, pageCount, offset: (current - 1) * pageSize, limit: pageSize };
}

/** Paginates an in-memory array (static data, small lookups). */
export function paginateArray<T>(items: ReadonlyArray<T>, page: number, pageSize: number): Paged<T> {
	const window = pageWindow({ page, pageSize, total: items.length });
	return {
		items: items.slice(window.offset, window.offset + window.limit),
		total: items.length,
		page: window.page,
		pageCount: window.pageCount,
	};
}

/** Input of bulk actions (delete selected, publish selected…): 1–`max` UUIDs, nothing else. */
export const bulkIdsSchema = (max = 100) => z.strictObject({ ids: z.array(z.uuid()).min(1).max(max) });
