import "@tanstack/react-start/server-only";
import { type AnyColumn, and, eq, ne, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { staleError } from "@/lib/concurrency";
import { AppError } from "@/lib/errors";
import type { Paged } from "@/lib/list/paging";
import { type AuditActor, type AuditEntry, recordAudit } from "@/server/audit/record";
import { sameVersion } from "./concurrency";
import { countRows, orderBySort, paginate } from "./list";
import type { Db, Tx } from "./types";

/**
 * The repository side of the CRUD standard (docs/guides/crud.md, decision 0173):
 * one helper per rule, so every feature reads, saves and audits the same way.
 * Lists build their `where` from ./list.ts and hand it to `listPage`.
 */

/** A table with a text or uuid `id` primary key. */
type WithId = PgTable & { id: AnyPgColumn };
/** …and an `updatedAt` kept by Drizzle's `$onUpdate`: the version an edit started from (0122). */
type Versioned = WithId & { updatedAt: AnyPgColumn };
type RowOf<T extends PgTable> = T["$inferSelect"];

/** The record doesn't exist (or isn't visible to this caller): a 404 for pages, NOT_FOUND for functions. */
export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);

/** The row with this id, or NOT_FOUND. */
export async function findOrThrow<T extends WithId>(db: Db, table: T, id: string, what: string): Promise<RowOf<T>> {
	const [row] = (await db
		.select()
		.from(table as PgTable)
		.where(eq(table.id, id))) as RowOf<T>[];
	if (!row) throw notFound(what);
	return row;
}

/**
 * One page of a single-table list: count, clamp the page, read it in `sort`
 * order (the id breaks ties), then `map` the page's rows to items in one go (so
 * related data is one query per page, not per row).
 *
 *   return listPage(db, projects, {
 *     input, where: allOf(textSearch(input.q, [projects.title])),
 *     sort: { columns: { title: projects.title, updated: projects.updatedAt }, fallback: "updated" },
 *     map: (rows) => rows.map((row) => projectListItem.parse(row)),
 *   });
 */
export async function listPage<T extends WithId, Field extends string, Item>(
	db: Db,
	table: T,
	options: {
		input: { page: number; pageSize: number; sort: string };
		where: SQL | undefined;
		sort: { columns: Readonly<Record<Field, AnyColumn | SQL>>; fallback: NoInfer<Field> };
		map: (rows: RowOf<T>[]) => Item[] | Promise<Item[]>;
	},
): Promise<Paged<Item>> {
	const order = orderBySort(options.input.sort, options.sort.columns, {
		tiebreaker: table.id,
		fallback: options.sort.fallback,
	});
	const page = await paginate(
		options.input,
		{
			count: () => countRows(db, table, options.where),
			rows: ({ limit, offset }) =>
				db
					.select()
					.from(table as PgTable)
					.where(options.where)
					.orderBy(...order)
					.limit(limit)
					.offset(offset) as Promise<RowOf<T>[]>,
		},
		(row) => row,
	);
	return { ...page, items: await options.map(page.items) };
}

/**
 * Saves `set` only while the row still has `version` (its `updatedAt` when the
 * edit started), checked in the UPDATE's own WHERE: no separate lock, and of two
 * saves of the same version the second finds a newer one. Zero rows means it was
 * deleted (NOT_FOUND) or changed since (a stale CONFLICT, which forms turn into
 * "reload").
 */
export async function updateVersioned<T extends Versioned>(
	db: Db,
	table: T,
	{ id, version, set, what }: { id: string; version: string; set: PgUpdateSetSource<T>; what: string },
): Promise<RowOf<T>> {
	const [row] = (await db
		.update(table as PgTable)
		.set(set as PgUpdateSetSource<PgTable>)
		.where(and(eq(table.id, id), sameVersion(table.updatedAt, version)))
		.returning()) as RowOf<T>[];
	if (row) return row;
	const [exists] = await db
		.select({ id: table.id })
		.from(table as PgTable)
		.where(eq(table.id, id));
	throw exists ? staleError(what) : notFound(what);
}

/** Postgres' unique_violation (23505) on `constraint` (or unique index), anywhere in the error's cause chain. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
	for (let current: unknown = error; typeof current === "object" && current !== null; ) {
		const pg = current as { code?: unknown; constraint?: unknown; cause?: unknown };
		if (pg.code === "23505" && pg.constraint === constraint) return true;
		current = pg.cause;
	}
	return false;
}

/**
 * Uniqueness is the database's job: insert or update, then map a violation of
 * one of `constraints` to a CONFLICT on its form field. Checking first and then
 * writing races (two saves both see "free"). Anything else is returned as it was.
 *
 *   catch (error) { throw uniqueViolation(error, { project_slug_unique: { field: "slug", message: m.validation_slug_taken } }) }
 */
export function uniqueViolation(
	error: unknown,
	constraints: Readonly<Record<string, { field: string; message: () => string }>>,
): unknown {
	for (const [constraint, { field, message }] of Object.entries(constraints)) {
		if (isUniqueViolation(error, constraint)) {
			return new AppError("CONFLICT", `${constraint}: value taken`, { fieldErrors: { [field]: [message()] } });
		}
	}
	return error;
}

/** Whether no row but `exceptId` (the one being edited) has `value` in `column`: a form's check while typing. */
export async function isValueFree<T extends WithId>(
	db: Db,
	table: T,
	column: AnyPgColumn,
	value: string,
	exceptId?: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: table.id })
		.from(table as PgTable)
		.where(exceptId ? and(eq(column, value), ne(table.id, exceptId)) : eq(column, value))
		.limit(1);
	return !row;
}

/**
 * `base`, or the first of `base-2`, `base-3`… that no row has in `column` and
 * isn't `reserved` (role keys: "editor", "editor-2"). Between this read and the
 * insert another save can take it: the unique constraint still decides.
 */
export async function uniqueSlug<T extends PgTable>(
	db: Db,
	table: T,
	column: AnyPgColumn,
	base: string,
	reserved: ReadonlyArray<string> = [],
): Promise<string> {
	const rows = await db
		.select({ value: column })
		.from(table as PgTable)
		.where(or(eq(column, base), sql`${column} like ${`${base}-%`}`));
	const taken = new Set([...reserved, ...rows.map((row) => String(row.value))]);
	if (!taken.has(base)) return base;
	for (let suffix = 2; ; suffix++) {
		if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
	}
}

/**
 * Runs `change` in a transaction and writes the audit rows it reports in the
 * same one, so a change and its record commit together or not at all (0132; since
 * 0173 creates and edits of content are audited too). Report nothing for a change
 * that changed nothing.
 *
 *   return withAudit(db, actor, async (tx, audit) => {
 *     const role = await repo.createRole(tx, input);
 *     audit({ action: "role.create", target: { type: "role", id: role.id, label: role.name }, after: { name: role.name } });
 *     return role;
 *   });
 */
export function withAudit<T>(
	db: Db,
	actor: AuditActor,
	change: (tx: Tx, audit: (...entries: AuditEntry[]) => void) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		const entries: AuditEntry[] = [];
		const result = await change(tx, (...more) => {
			entries.push(...more);
		});
		await recordAudit(tx, actor, entries);
		return result;
	});
}
