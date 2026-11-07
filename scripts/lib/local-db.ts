/**
 * The local development database used by `pnpm dev:local` and `pnpm setup:local`:
 * PGlite (Postgres in WebAssembly) stored in .data/pglite and served over TCP,
 * so the app, drizzle-kit and `pg` use it like any Postgres (decision 0155).
 *
 * The first start migrates and seeds an admin, the demo data and Taskline's demo team; later starts only
 * apply new migrations (and write the portfolio's content while there is none).
 * Delete .data/pglite to start over.
 */
import { existsSync, mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "better-auth/crypto"; // @taskline
import { E2E } from "../../e2e/harness/config.ts";
import { prepareDatabase } from "../../e2e/harness/database.ts";
import { servePglite } from "../../e2e/harness/pglite-server.ts";
import { seedTaskline } from "./taskline-seed.ts"; // @taskline

export const LOCAL_DB_DIR = ".data/pglite";
/** Signs in on a freshly seeded local database (the e2e harness's users). */
export const LOCAL_ADMIN = { email: E2E.users.admin.email, password: E2E.password };

export async function startLocalDatabase({ port = Number(process.env.LOCAL_DB_PORT ?? 54320) } = {}) {
	const fresh = !existsSync(LOCAL_DB_DIR);
	mkdirSync(".data", { recursive: true });
	const db = new PGlite(LOCAL_DB_DIR);
	const served = await servePglite(db, { port });
	const url = `postgresql://postgres:postgres@127.0.0.1:${served.port}/postgres`;
	const database = await prepareDatabase(url, { reset: false, seed: fresh });
	// taskline:start
	// Taskline's demo team, with the same password (pnpm db:seed-taskline on another database).
	if (fresh) await seedTaskline(database.query, { passwordHash: await hashPassword(E2E.password) });
	// taskline:end
	await database.close();
	return {
		url,
		fresh,
		/** Closes connections, then the database (which writes everything to .data/pglite). */
		stop: async () => {
			await served.stop();
			await db.close();
		},
	};
}
