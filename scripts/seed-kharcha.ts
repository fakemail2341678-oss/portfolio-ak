#!/usr/bin/env node
/**
 * Kharcha's demo accounts (docs/guides/kharcha.md): three people who share a group, a few
 * expenses and one payment. Safe to run again (accounts and people are kept; the data is
 * written only while the first account is in no group).
 *
 *   pnpm db:seed-kharcha --password "a-long-password"
 *
 * The accounts sign in with the given password (falling back to DEMO_PASSWORD). Run
 * `pnpm db:migrate` first. `pnpm dev:local` runs it on a fresh local database. Refuses
 * NODE_ENV=production unless --force. The data itself is in ./lib/kharcha-seed.ts.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
// A plain TypeScript module without imports: Node strips its types.
import { withVerifiedSsl } from "../src/server/db/connection-string.ts";
import { KHARCHA_DEMO, seedKharcha } from "./lib/kharcha-seed.ts";

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
		"Usage: pnpm db:seed-kharcha [--password <password>] [--force]\n" +
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
	console.error(`seed-kharcha: provide ${problems.join(", ")}.`);
	process.exit(1);
}

const client = new pg.Client({ connectionString: withVerifiedSsl(process.env.DATABASE_URL ?? "") });
await client.connect();
try {
	await client.query("begin");
	const result = await seedKharcha((sql, params) => client.query(sql, params), {
		passwordHash: await hashPassword(password),
	});
	await client.query("commit");
	console.log(
		`seed-kharcha: ${result.accounts} new accounts (${KHARCHA_DEMO.map((person) => person.email).join(", ")}); ` +
			(result.expenses > 0
				? `a group, ${result.expenses} expenses and a payment written.`
				: "they share a group already; nothing written."),
	);
} catch (error) {
	await client.query("rollback");
	console.error("seed-kharcha failed:", error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
