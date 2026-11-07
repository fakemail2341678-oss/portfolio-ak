import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { TestProject } from "vitest/node";

/**
 * Global setup of the unit project: one migrated PGlite data directory for the
 * whole run, which every createTestDb() loads (tests/utils/test-db.ts).
 *
 * Starting PGlite runs Postgres' initdb (about 1.5 s); loading a ready data
 * directory takes about 0.4 s, and no file has to migrate. The snapshot is kept in
 * node_modules/.cache and rebuilt only when drizzle/ changes.
 */
declare module "vitest" {
	interface ProvidedContext {
		/** Path of the migrated PGlite data directory (a tarball), for loadDataDir. */
		pgliteSnapshot: string;
	}
}

const MIGRATIONS = "./drizzle";
const CACHE_DIR = "node_modules/.cache/vitest-pglite";

const migrationsHash = () => {
	const hash = createHash("sha256");
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else hash.update(path).update(readFileSync(path));
		}
	};
	walk(MIGRATIONS);
	return hash.digest("hex").slice(0, 16);
};

export default async function setup(project: TestProject) {
	const snapshot = join(CACHE_DIR, `migrated-${migrationsHash()}.tar.gz`);
	if (!existsSync(snapshot)) {
		const client = new PGlite();
		await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS });
		const dump = await client.dumpDataDir("gzip");
		await client.close();
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(snapshot, Buffer.from(await dump.arrayBuffer()));
	}
	project.provide("pgliteSnapshot", snapshot);
}
