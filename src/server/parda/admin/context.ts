import "@tanstack/react-start/server-only";
import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { staleError } from "@/lib/concurrency";
import { notFound } from "@/server/db/crud";
import type { Tx } from "@/server/db/types";
import type { Services } from "@/server/services";
import type { CatalogServices } from "../catalog/service";
import type { PardaControls } from "../controls";
import { pardaCache, pardaControls, pardaTmdb } from "../tmdb/store";

/**
 * What Parda's admin services work with (decision 0237): the call's services and the
 * controls' cache, cleared after every write so this process sees the change at once.
 * Tests pass their own controls.
 */
export type PardaAdminServices = Services & { controls: Pick<PardaControls, "invalidate"> };

export const pardaAdmin = (services: Services): PardaAdminServices => ({ ...services, controls: pardaControls });

/** What curation works with (decision 0242): the same, and the catalogue a title is picked and read through. */
export type PardaCurator = PardaAdminServices & { catalog: CatalogServices | null };

export const pardaCurator = (services: Services): PardaCurator => ({
	...pardaAdmin(services),
	catalog: pardaTmdb ? { tmdb: pardaTmdb, cache: pardaCache, controls: pardaControls } : null,
});

type WithVersion = PgTable & { id: AnyPgColumn; version: AnyPgColumn };

/**
 * Saves `set` only while the row still has `version`, and bumps it, in one UPDATE. Zero
 * rows: gone (NOT_FOUND) or saved by someone else since (a stale CONFLICT, which forms
 * turn into "reload").
 */
export async function saveVersioned<T extends WithVersion>(
	tx: Tx,
	table: T,
	{ id, version, set, what }: { id: string | number; version: number; set: PgUpdateSetSource<T>; what: string },
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
