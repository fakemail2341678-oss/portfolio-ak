#!/usr/bin/env node
/**
 * Demo data for development: custom roles, users who hold them, and enough
 * Test CRUD items to page through. Safe to run again (existing rows are kept).
 *
 *   pnpm db:seed-demo --password "a-long-password"
 *
 * Creates (emails verified, all with the given password, falling back to DEMO_PASSWORD):
 * - roles "editor" (Test CRUD read/create/update/publish + uploads) and "viewer" (read-only admin);
 * - editor@example.com (editor), viewer@example.com (viewer), member@example.com (no role:
 *   signs in, but /admin shows the forbidden page);
 * - 30 Test CRUD items, published and drafts, with tags and prices;
 * - the portfolio's demo content, when it has none (scripts/lib/portfolio-seed.ts).
 * The data itself is in ./lib/demo-data.ts.
 *
 * Run `pnpm db:migrate` first (and `pnpm db:seed-admin` for an admin). Refuses
 * NODE_ENV=production unless --force.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
// A plain TypeScript module without imports: Node strips its types.
import { withVerifiedSsl } from "../src/server/db/connection-string.ts";
import { DEMO_ROLES, DEMO_USERS, seedDemo } from "./lib/demo-data.ts";
import { seedPortfolio } from "./lib/portfolio-seed.ts"; // @portfolio

if (existsSync(".env")) process.loadEnvFile(".env");

const { values } = parseArgs({
	options: {
		password: { type: "string" },
		force: { type: "boolean", default: false },
		help: { type: "boolean", short: "h", default: false },
	},
	strict: true,
});

if (values.help) {
	console.log(
		"Usage: pnpm db:seed-demo [--password <password>] [--force]\n" +
			"Default: DEMO_PASSWORD from the environment.\n" +
			"--force  seed even with NODE_ENV=production.",
	);
	process.exit(0);
}

const password = values.password ?? process.env.DEMO_PASSWORD ?? "";
const problems: string[] = [];
if (password.length < 12) problems.push("a --password (or DEMO_PASSWORD) of at least 12 characters");
if (!process.env.DATABASE_URL) problems.push("DATABASE_URL");
if (process.env.NODE_ENV === "production" && !values.force) problems.push("--force to seed with NODE_ENV=production");
if (problems.length) {
	console.error(`seed-demo: provide ${problems.join(", ")}.`);
	process.exit(1);
}

const client = new pg.Client({ connectionString: withVerifiedSsl(process.env.DATABASE_URL ?? "") });
await client.connect();
try {
	await client.query("begin");
	const { created } = await seedDemo((sql, params) => client.query(sql, params), {
		passwordHash: await hashPassword(password),
	});
	const portfolio = await seedPortfolio((sql, params) => client.query(sql, params)); // @portfolio
	await client.query("commit");
	if (portfolio.seeded) console.log("seed-demo: the portfolio's demo content written."); // @portfolio
	console.log(
		`seed-demo: roles ${DEMO_ROLES.map((role) => role.key).join(", ")}; ` +
			`users ${DEMO_USERS.map((user) => user.email).join(", ")}; ${created} new Test CRUD items.`,
	);
} catch (error) {
	await client.query("rollback");
	console.error("seed-demo failed:", error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
