/**
 * The e2e database: the committed migrations, an admin, the demo data
 * (`scripts/lib/demo-data.ts`, the same rows `pnpm db:seed-demo` writes) and the
 * portfolio's content (`scripts/lib/portfolio-seed.ts`, as `pnpm db:seed-portfolio`) and
 * Taskline's demo team (`scripts/lib/taskline-seed.ts`, as `pnpm db:seed-taskline`).
 * A fresh database also gets a user of the old Expenses app, moved into Kharcha by its migration.
 */
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"; // @kharcha
import { tmpdir } from "node:os"; // @kharcha
import { join } from "node:path"; // @kharcha
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { type DemoQuery, seedDemo } from "../../scripts/lib/demo-data.ts";
import { seedKharcha } from "../../scripts/lib/kharcha-seed.ts"; // @kharcha
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
	const passwordHash = seed ? await hashPassword(E2E.password) : "";
	const query: DemoQuery = (sql, params) => client.query(sql, params);
	if (seed) await moveExpensesUser(client, query, passwordHash); // @kharcha
	await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });

	await seedPortfolio(query); // @portfolio
	if (!seed) return { query, close: () => client.end() };
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
	// Kharcha's demo accounts (asha@kharcha… and two more, with the same password), who share a group.
	await seedKharcha(query, { passwordHash }); // @kharcha
	await query("commit");
	return { query, close: () => client.end() };
}
// kharcha:start

/** The migration that moved the Expenses app into Kharcha (Task 95, decision 0289). */
const EXPENSES_MOVED = "0056_expenses_to_kharcha";

/**
 * On a fresh database, the migrations first stop before Expenses moved into Kharcha, and an
 * Expenses user (`E2E.users.moved`) is written with a category, two expenses and a budget; the
 * rest of the migrations then move them, as they will a real one (e2e/flows/kharcha.spec.ts).
 */
async function moveExpensesUser(client: pg.Client, query: DemoQuery, passwordHash: string) {
	const { rows } = await query(`select to_regclass('drizzle.__drizzle_migrations') as "table"`);
	if (rows[0]?.table) return;
	const folder = mkdtempSync(join(tmpdir(), "e2e-migrations-"));
	try {
		cpSync("./drizzle", folder, { recursive: true });
		const journalPath = join(folder, "meta", "_journal.json");
		const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: Array<{ tag: string }> };
		journal.entries = journal.entries.slice(
			0,
			journal.entries.findIndex((entry) => entry.tag === EXPENSES_MOVED),
		);
		writeFileSync(journalPath, JSON.stringify(journal));
		await migrate(drizzle({ client }), { migrationsFolder: folder });
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
	const userId = randomUUID();
	const category = randomUUID();
	await query(`insert into "user" ("id", "name", "email", "email_verified") values ($1, $2, $3, true)`, [
		userId,
		E2E.users.moved.name,
		E2E.users.moved.email,
	]);
	await query(
		`insert into "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
		 values ($1, $2, 'credential', $2, $3, now(), now())`,
		[randomUUID(), userId, passwordHash],
	);
	await query(
		`insert into "expense_category" ("id", "owner_id", "name", "color", "icon") values ($1, $2, 'Trekking', 'slate', 'plane')`,
		[category, userId],
	);
	await query(
		`insert into "expense_transaction" ("owner_id", "category_id", "amount_minor", "currency", "occurred_on", "note") values
		 ($1, $2, 300000, 'NPR', '2026-03-05', 'Trek permit'), ($1, null, 2500, 'USD', '2026-03-06', 'Map')`,
		[userId, category],
	);
	await query(
		`insert into "expense_budget" ("owner_id", "category_id", "month", "currency", "amount_minor") values ($1, $2, '2026-03-01', 'NPR', 500000)`,
		[userId, category],
	);
}
// kharcha:end
