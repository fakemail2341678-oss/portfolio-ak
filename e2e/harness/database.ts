/**
 * The e2e database: the committed migrations, an admin, the demo data
 * (`scripts/lib/demo-data.ts`, the same rows `pnpm db:seed-demo` writes) and the
 * portfolio's content (`scripts/lib/portfolio-seed.ts`, as `pnpm db:seed-portfolio`) and
 * Taskline's demo team (`scripts/lib/taskline-seed.ts`, as `pnpm db:seed-taskline`).
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { type DemoQuery, seedDemo } from "../../scripts/lib/demo-data.ts";
import { seedPortfolio } from "../../scripts/lib/portfolio-seed.ts"; // @portfolio
import { seedTaskline } from "../../scripts/lib/taskline-seed.ts"; // @taskline
import { E2E } from "./config.ts";

/**
 * Connects, empties the database (a real Postgres may hold an earlier run), migrates and seeds.
 * `seed: false` only migrates (pnpm dev:local on a database it already seeded), and
 * writes the portfolio's content if there is none yet (so `/` is never empty).
 */
export async function prepareDatabase(
	connectionString: string,
	{ reset, seed = true }: { reset: boolean; seed?: boolean },
) {
	const client = new pg.Client({ connectionString });
	await client.connect();
	if (reset) {
		await client.query(
			"drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public",
		);
	}
	await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });

	const query: DemoQuery = (sql, params) => client.query(sql, params);
	await seedPortfolio(query); // @portfolio
	if (!seed) return { query, close: () => client.end() };
	const passwordHash = await hashPassword(E2E.password);
	await query("begin");
	const adminId = randomUUID();
	await query(
		`insert into "user" ("id", "name", "email", "email_verified", "role") values ($1, $2, $3, true, 'admin')`,
		[adminId, E2E.users.admin.name, E2E.users.admin.email],
	);
	await query(
		// updated_at has no database default (Drizzle fills it in app code).
		`insert into "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
		 values ($1, $2, 'credential', $2, $3, now(), now())`,
		[randomUUID(), adminId, passwordHash],
	);
	await seedDemo(query, { passwordHash });
	// Taskline's demo team (asha@… and the rest, with the same password; the admin joins it too).
	await seedTaskline(query, { passwordHash }); // @taskline
	await query("commit");
	return { query, close: () => client.end() };
}
