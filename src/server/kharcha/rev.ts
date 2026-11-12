import "@tanstack/react-start/server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { staleError } from "@/lib/concurrency";
import { notFound } from "@/server/db/crud";
import { khProfile } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * A person's `rev` and the rows' `version`s (docs/guides/kharcha.md "Freshness").
 *
 * - `rev` (`kh_profile.rev`) goes up for everyone a change touches, in the change's
 *   transaction: open pages poll it and refetch when it moved. People without an account
 *   have no profile and nothing to refresh.
 * - `version` goes up when a form saves (an expense, a payment, a group): a save from an
 *   older version is refused as stale, so two people editing one expense don't overwrite
 *   each other unseen.
 */

/** Bumps the `rev` of each of these people who has an account. Bookkeeping: `updated_at` stays. */
export async function bumpRevs(tx: Tx, personIds: Iterable<string>): Promise<void> {
	const ids = [...new Set(personIds)];
	if (ids.length === 0) return;
	// Row locks in one order, so two changes touching the same people can't deadlock on their profiles.
	await tx
		.select({ userId: khProfile.userId })
		.from(khProfile)
		.where(inArray(khProfile.personId, ids))
		.orderBy(khProfile.userId)
		.for("update");
	await tx
		.update(khProfile)
		.set({ rev: sql`${khProfile.rev} + 1`, updatedAt: sql`${khProfile.updatedAt}` })
		.where(inArray(khProfile.personId, ids));
}

/** The caller's `rev`; 0 before their first use. */
export async function revOf(db: Db | Tx, userId: string): Promise<number> {
	const [row] = await db.select({ rev: khProfile.rev }).from(khProfile).where(eq(khProfile.userId, userId));
	return row?.rev ?? 0;
}

type WithVersion = PgTable & { id: AnyPgColumn; version: AnyPgColumn };

/**
 * Saves `set` only while the row still has `version`, and bumps it, in one UPDATE.
 * Zero rows: deleted (NOT_FOUND) or saved by someone else since (a stale CONFLICT,
 * which forms turn into "reload").
 */
export async function saveVersioned<T extends WithVersion>(
	tx: Tx,
	table: T,
	{ id, version, set, what }: { id: string; version: number; set: PgUpdateSetSource<T>; what: string },
): Promise<T["$inferSelect"]> {
	const [row] = (await tx
		.update(table as PgTable)
		.set({ ...set, version: sql`${table.version} + 1` } as PgUpdateSetSource<PgTable>)
		.where(and(eq(table.id, id), eq(table.version, version)))
		.returning()) as T["$inferSelect"][];
	if (row) return row;
	const [exists] = await tx
		.select({ id: table.id })
		.from(table as PgTable)
		.where(eq(table.id, id));
	throw exists ? staleError(what) : notFound(what);
}
