import "@tanstack/react-start/server-only";
import {
	type AnyColumn,
	and,
	arrayOverlaps,
	asc,
	count,
	desc,
	gte,
	ilike,
	lt,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { dayRangeInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import { type Paged, pageWindow, parseSort } from "@/lib/list/paging";
import type { Db } from "./types";

/**
 * Server half of the list contract (src/lib/list.ts): Drizzle helpers that turn
 * the shared `q` / `sort` / `page` / `pageSize` params into SQL and a Paged<T>.
 * Every repository list function is built from these, so all lists search,
 * sort and paginate the same way.
 */

/** Escapes LIKE wildcards so a search for "100%" means the literal text. */
export const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/**
 * Case-insensitive "contains" over any of `columns`; undefined (no filter) for an
 * empty search. A column can be an expression too: one language of a localized
 * jsonb column (`sql`${table.title}->>'en'``).
 */
export function textSearch(q: string, columns: ReadonlyArray<AnyColumn | SQL>): SQL | undefined {
	if (!q || columns.length === 0) return undefined;
	const pattern = likePattern(q);
	return or(...columns.map((column) => ilike(column, pattern)));
}

/** AND of the given filters, skipping the absent ones; undefined when there are none. */
export const allOf = (...filters: ReadonlyArray<SQL | undefined>): SQL | undefined => {
	const present = filters.filter((filter): filter is SQL => filter !== undefined);
	return present.length > 0 ? and(...present) : undefined;
};

/** `min <= column <= max`, either side optional; undefined when both are absent. */
export const numberRange = (column: AnyColumn, min: number | undefined, max: number | undefined) =>
	allOf(min === undefined ? undefined : gte(column, min), max === undefined ? undefined : lte(column, max));

/**
 * Calendar days `from`..`to` (inclusive, "YYYY-MM-DD") on a timestamp column, in the
 * app's time zone. Compared as instants, so an index on the column still applies.
 */
export const dateRange = (
	column: AnyColumn,
	from: string | undefined,
	to: string | undefined,
	timeZone = APP_TIME_ZONE,
) => {
	const { start, end } = dayRangeInZone(from, to, timeZone);
	return allOf(start ? gte(column, start) : undefined, end ? lt(column, end) : undefined);
};

/** An array column sharing at least one value with `values` (`&&`, GIN-indexable); undefined for []. */
export const overlapsAny = (column: AnyColumn, values: ReadonlyArray<string>) =>
	values.length === 0 ? undefined : arrayOverlaps(column, [...values]);

/**
 * ORDER BY for a sort value ("price" or "-price") over a whitelist of sortable
 * columns, always ending with a unique tiebreaker so pages never overlap.
 * Unknown fields fall back to `fallback` (the URL schema already rejects them).
 */
export function orderBySort<Field extends string>(
	sort: string,
	columns: Readonly<Record<Field, AnyColumn | SQL>>,
	options: { tiebreaker: AnyColumn; fallback: NoInfer<Field> },
): SQL[] {
	const { field, direction } = parseSort(sort);
	const isField = (key: string): key is Field => Object.hasOwn(columns, key);
	const column = columns[isField(field) ? field : options.fallback];
	return [direction === "desc" ? desc(column) : asc(column), asc(options.tiebreaker)];
}

/** Rows in `table` matching `where`. */
export async function countRows(db: Db, table: PgTable, where: SQL | undefined): Promise<number> {
	const [result] = await db.select({ total: count() }).from(table).where(where);
	return result?.total ?? 0;
}

/**
 * Runs a paginated query: counts first, clamps the page, then reads that page.
 *
 *   return paginate({ page, pageSize }, {
 *     count: () => countRows(db, items, where),
 *     rows: ({ limit, offset }) => db.select().from(items).where(where).orderBy(...order).limit(limit).offset(offset),
 *   }, toListItem);
 */
export async function paginate<Row, Item>(
	request: { page: number; pageSize: number },
	query: { count: () => Promise<number>; rows: (window: { limit: number; offset: number }) => Promise<Row[]> },
	map: (row: Row) => Item,
): Promise<Paged<Item>> {
	const total = await query.count();
	const window = pageWindow({ page: request.page, pageSize: request.pageSize, total });
	const rows = total === 0 ? [] : await query.rows({ limit: window.limit, offset: window.offset });
	return { items: rows.map(map), total, page: window.page, pageCount: window.pageCount };
}

// ---------------------------------------------------------------------------
// Cursor (keyset) pagination: a recipe for large tables and feeds (decision 0145)
// ---------------------------------------------------------------------------

/** A page of a feed: no total and no page numbers, just "more after this". */
export type CursorPage<T> = { items: T[]; nextCursor: string | null };

/** An opaque cursor: the last row's sort value and id, base64url JSON. */
export const encodeCursor = (value: string | number, id: string) =>
	Buffer.from(JSON.stringify([value, id])).toString("base64url");

/** The sort value and id in a cursor, or null for anything that isn't one (a tampered or stale URL). */
export function decodeCursor(cursor: string | undefined): [value: string | number, id: string] | null {
	if (!cursor) return null;
	try {
		const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
		if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") {
			const [value, id] = parsed;
			if (typeof value === "string" || typeof value === "number") return [value, id];
		}
	} catch {
		// Not base64url JSON: treated as the first page.
	}
	return null;
}

/**
 * Keyset pagination over `(column, id)`: each page starts after the previous
 * page's last row, so it costs the same on page 1 and page 10,000 (with an
 * index on those columns) and rows added meanwhile don't shift it. Use it for
 * feeds and very large tables; the offset `paginate()` stays the default for
 * admin lists, which need totals and page numbers.
 *
 *   const page = await cursorPaginate({
 *     cursor: input.cursor, limit: 20, column: posts.publishedAt, id: posts.id, direction: "desc",
 *     rows: (after, limit) => db.select({ ...cols, key: sql<string>`${posts.publishedAt}::text` })
 *       .from(posts).where(allOf(isPublished, after)).orderBy(...order).limit(limit),
 *     key: (row) => row.key,
 *   }, toCard);
 *
 * `key` must return the sort value exactly as Postgres compares it: for a
 * timestamp select it as text (`::text`), since a JS Date drops microseconds
 * and rows could be skipped. `rows` must order by `cursorOrder(column, id, direction)`.
 */
export async function cursorPaginate<Row extends { id: string }, Item>(
	options: {
		cursor: string | undefined;
		limit: number;
		column: AnyColumn;
		id: AnyColumn;
		direction: "asc" | "desc";
		rows: (after: SQL | undefined, limit: number) => Promise<Row[]>;
		key: (row: Row) => string | number;
	},
	map: (row: Row) => Item,
): Promise<CursorPage<Item>> {
	const decoded = decodeCursor(options.cursor);
	const after = decoded
		? options.direction === "desc"
			? sql`(${options.column}, ${options.id}) < (${decoded[0]}, ${decoded[1]})`
			: sql`(${options.column}, ${options.id}) > (${decoded[0]}, ${decoded[1]})`
		: undefined;
	// One extra row says whether there is a next page.
	const rows = await options.rows(after, options.limit + 1);
	const page = rows.slice(0, options.limit);
	const last = page.at(-1);
	return {
		items: page.map(map),
		nextCursor: rows.length > options.limit && last ? encodeCursor(options.key(last), last.id) : null,
	};
}

/** ORDER BY for cursorPaginate: the column, then the id, both in `direction`. */
export const cursorOrder = (column: AnyColumn, id: AnyColumn, direction: "asc" | "desc"): SQL[] =>
	direction === "desc" ? [desc(column), desc(id)] : [asc(column), asc(id)];
