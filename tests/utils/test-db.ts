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
	const sequences = await client.query<{ name: string }>(
		"select quote_ident(schemaname) || '.' || quote_ident(sequencename) as name from pg_sequences where schemaname = 'public'",
	);
	/**
	 * Empties every table and restarts the counters. Deletes as a replica (no foreign-key check, no
	 * trigger), not `truncate … cascade`: truncating the 123 tables took 80 to 100 ms a time and this
	 * takes 4 to 5 ms, before every test of every server file (Part 9 Task 99, decision 0296).
	 */
	const wipe = [
		...rows.map((row) => `delete from public.${row.name};`),
		...sequences.rows.map((sequence) => `alter sequence ${sequence.name} restart;`),
	].join("\n");
	const asReplica = (sql: string) =>
		client.exec(`set session_replication_role = replica;\n${sql}\nset session_replication_role = origin;`);
	/** Puts the rows of the last snapshot() back; set by snapshot(). */
	let restoreSql: string | undefined;
	return {
		/**
		 * Keeps a copy of every row as it is now, for restore(). A file whose fixtures take many service
		 * calls builds them once, snapshots, and restores between tests: Kharcha's access matrix rebuilt
		 * its world some 400 times, 42% of the whole suite's time (Part 9 Task 99, decision 0296).
		 */
		snapshot: async () => {
			await client.exec("drop schema if exists snapshot cascade; create schema snapshot");
			// Generated columns (the search vectors) can't be written; they are computed again on insert.
			const columns = await client.query<{ name: string; columns: string }>(
				`select quote_ident(table_name) as name, string_agg(quote_ident(column_name), ', ' order by ordinal_position) as columns
				 from information_schema.columns where table_schema = 'public' and is_generated = 'NEVER' group by table_name`,
			);
			const inserts: string[] = [];
			for (const { name, columns: list } of columns.rows) {
				const filled = await client.query(`select 1 from public.${name} limit 1`);
				if (filled.rows.length === 0) continue;
				await client.exec(`create table snapshot.${name} as select ${list} from public.${name}`);
				inserts.push(`insert into public.${name} (${list}) select ${list} from snapshot.${name};`);
			}
			const counters = await client.query<{ name: string; value: string | null }>(
				`select quote_ident(schemaname) || '.' || quote_ident(sequencename) as name, last_value::text as value
				 from pg_sequences where schemaname = 'public'`,
			);
			const values = counters.rows
				.filter((counter) => counter.value !== null)
				.map((counter) => `select setval('${counter.name}', ${counter.value});`);
			restoreSql = [wipe, ...inserts, ...values].join("\n");
		},
		/** Every table as it was at snapshot(): the same rows with the same ids. */
		restore: async () => {
			if (!restoreSql) throw new Error("restore() needs a snapshot() first");
			await asReplica(restoreSql);
		},
		db,
		/** The raw PGlite client, for code that runs plain SQL (scripts/). */
		client,
		adminId,
		/** Empties every table, then adds the admin and `seed` back: each test starts from the same database. */
		reset: async () => {
			await asReplica(wipe);
			await insertFixtures();
		},
		close: () => client.close(),
	};
}
