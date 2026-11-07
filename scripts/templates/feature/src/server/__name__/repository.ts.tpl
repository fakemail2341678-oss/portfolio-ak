import "@tanstack/react-start/server-only";
import { {{#public}}and, asc, desc, eq, {{/public}}inArray{{#localized}}, sql{{/localized}} } from "drizzle-orm";
import {
	type __Pascal__Detail,
	type __Pascal__ListItem,
	type __Pascal__Page,
{{#public}}
	type __Pascal__PublicItem,
	type __Pascal__PublicPage,
	__camel__PublicItem,
{{/public}}
	__camel__Detail,
	__camel__ListItem,
	type __Pascal__Input,
} from "@/features/__name__/schema";
import type { __Pascal__ListInput } from "@/features/__name__/search";
{{#public}}
import { m } from "@/paraglide/messages";
import { findOrThrow, isValueFree, listPage, notFound, uniqueViolation, updateVersioned } from "@/server/db/crud";
import { allOf, countRows, paginate, textSearch } from "@/server/db/list";
{{/public}}
{{^public}}
import { findOrThrow, listPage, notFound, updateVersioned } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
{{/public}}
import { __camel__ } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * __Title__ data access: plain functions over an injected Drizzle database (Neon
 * in the app, PGlite in tests), built from the CRUD helpers (src/server/db/crud.ts).
 * Writes take the service's transaction.
 */

const WHAT = "__Title__ row";

{{#localized}}
/** Sortable fields (__camel__List's sorts): the English title of the localized column. */
const SORT_COLUMNS = { updated: __camel__.updatedAt, title: sql`${__camel__.title}->>'en'` };
/** Searched in both languages. */
const SEARCHED = [
	sql`${__camel__.title}->>'en'`,
	sql`${__camel__.title}->>'ne'`,
	sql`${__camel__.notes}->>'en'`,
	sql`${__camel__.notes}->>'ne'`,
];
{{/localized}}
{{^localized}}
/** Sortable fields (__camel__List's sorts). */
const SORT_COLUMNS = { updated: __camel__.updatedAt, title: __camel__.title };
const SEARCHED = [__camel__.title, __camel__.notes];
{{/localized}}

export function list__Pascal__(db: Db, input: __Pascal__ListInput): Promise<__Pascal__Page> {
	return listPage(db, __camel__, {
		input,
		where: allOf(textSearch(input.q, SEARCHED)),
		sort: { columns: SORT_COLUMNS, fallback: "updated" },
		map: (rows) => rows.map((row): __Pascal__ListItem => __camel__ListItem.parse(row)),
	});
}

export async function get__Pascal__(db: Db, id: string): Promise<__Pascal__Detail> {
	return __camel__Detail.parse(await findOrThrow(db, __camel__, id, WHAT));
}
{{#public}}

/** Whether no row but `exceptId` (the one being edited) uses `slug`: the form's check while typing. */
export const isSlugFree = (db: Db, slug: string, exceptId?: string) =>
	isValueFree(db, __camel__, __camel__.slug, slug, exceptId);

/** A taken slug is a CONFLICT on the slug field (the unique constraint decides); anything else propagates. */
const saveError = (error: unknown) =>
	uniqueViolation(error, { __snake___slug_unique: { field: "slug", message: m.validation_slug_taken } });

export async function create__Pascal__(tx: Tx, input: __Pascal__Input, userId: string): Promise<__Pascal__Detail> {
	try {
		const [row] = await tx
			.insert(__camel__)
			.values({ ...input, createdBy: userId })
			.returning();
		if (!row) throw notFound(WHAT);
		return __camel__Detail.parse(row);
	} catch (error) {
		throw saveError(error);
	}
}

/** Saves the row if it still has `version` (its `updatedAt` when the edit started); else NOT_FOUND or a stale CONFLICT. */
export async function update__Pascal__(
	tx: Tx,
	id: string,
	input: __Pascal__Input,
	version: string,
): Promise<{ row: __Pascal__Detail; before: __Pascal__Detail }> {
	try {
		const before = __camel__Detail.parse(await findOrThrow(tx, __camel__, id, WHAT));
		const row = await updateVersioned(tx, __camel__, { id, version, set: input, what: WHAT });
		return { row: __camel__Detail.parse(row), before };
	} catch (error) {
		throw saveError(error);
	}
}
{{/public}}
{{^public}}

export async function create__Pascal__(tx: Tx, input: __Pascal__Input, userId: string): Promise<__Pascal__Detail> {
	const [row] = await tx
		.insert(__camel__)
		.values({ ...input, createdBy: userId })
		.returning();
	if (!row) throw notFound(WHAT);
	return __camel__Detail.parse(row);
}

/** Saves the row if it still has `version` (its `updatedAt` when the edit started); else NOT_FOUND or a stale CONFLICT. */
export async function update__Pascal__(
	tx: Tx,
	id: string,
	input: __Pascal__Input,
	version: string,
): Promise<{ row: __Pascal__Detail; before: __Pascal__Detail }> {
	const before = __camel__Detail.parse(await findOrThrow(tx, __camel__, id, WHAT));
	const row = await updateVersioned(tx, __camel__, { id, version, set: input, what: WHAT });
	return { row: __camel__Detail.parse(row), before };
}
{{/public}}

/** Deletes rows (missing ids are ignored); returns the rows deleted, for the audit log. */
export function delete__Pascal__(tx: Tx, ids: ReadonlyArray<string>): Promise<__Pascal__Detail[]> {
	return tx
		.delete(__camel__)
		.where(inArray(__camel__.id, [...ids]))
		.returning()
		.then((rows) => rows.map((row) => __camel__Detail.parse(row)));
}
{{#public}}

// ---------------------------------------------------------------------------
// Public queries: ONLY published rows ever leave these functions.
// ---------------------------------------------------------------------------

const isPublished = eq(__camel__.published, true);

export async function listPublished__Pascal__(
	db: Db,
	input: { q: string; page: number },
	pageSize: number,
): Promise<__Pascal__PublicPage> {
	const where = allOf(isPublished, textSearch(input.q, SEARCHED));
	return paginate(
		{ page: input.page, pageSize },
		{
			count: () => countRows(db, __camel__, where),
			rows: ({ limit, offset }) =>
				db
					.select()
					.from(__camel__)
					.where(where)
					.orderBy(desc(__camel__.updatedAt), asc(__camel__.id))
					.limit(limit)
					.offset(offset),
		},
		(row): __Pascal__PublicItem => __camel__PublicItem.parse(row),
	);
}

/** A published row by slug, or null (missing and draft look the same to the public). */
export async function getPublished__Pascal__(db: Db, slug: string): Promise<__Pascal__PublicItem | null> {
	const [row] = await db
		.select()
		.from(__camel__)
		.where(and(eq(__camel__.slug, slug), isPublished));
	return row ? __camel__PublicItem.parse(row) : null;
}

/** Every published page's slug and last change (the sitemap). */
export function published__Pascal__Slugs(db: Db): Promise<Array<{ slug: string; updatedAt: Date }>> {
	return db.select({ slug: __camel__.slug, updatedAt: __camel__.updatedAt }).from(__camel__).where(isPublished);
}
{{/public}}
