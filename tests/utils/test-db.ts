import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { inject } from "vitest";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * An in-process Postgres (PGlite) with the committed migrations applied and one
 * admin user, for tests of code that takes an injected `db`.
 *
 * It starts from the migrated data directory built once per run by
 * tests/setup/pglite.ts, so a test file doesn't pay for Postgres' initdb and
 * the migrations again. `seed` adds a file's own fixtures (other users…), and
 * runs again after every reset().
 */
export async function createTestDb(adminId = "admin-1", seed?: (db: Db) => Promise<unknown>) {
	const client = new PGlite({ loadDataDir: new Blob([readFileSync(inject("pgliteSnapshot"))]) });
	const pglite = drizzle({ client, schema, casing: "snake_case" });
	const db: Db = pglite;
	const insertFixtures = async () => {
		await db.insert(schema.user).values({ id: adminId, name: "Admin", email: "admin@example.com", role: "admin" });
		await seed?.(db);
	};
	await insertFixtures();
	const { rows } = await client.query<{ name: string }>(
		"select quote_ident(tablename) as name from pg_tables where schemaname = 'public'",
	);
	const tables = rows.map((row) => row.name).join(", ");
	return {
		db,
		/** The raw PGlite client, for code that runs plain SQL (scripts/). */
		client,
		adminId,
		/** Empties every table, then adds the admin and `seed` back: each test starts from the same database. */
		reset: async () => {
			await client.exec(`truncate ${tables} restart identity cascade`);
			await insertFixtures();
		},
		close: () => client.close(),
	};
}
