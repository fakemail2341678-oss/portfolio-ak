#!/usr/bin/env node
/**
 * Taskline's demo team (docs/guides/taskline.md): five accounts on the team, every
 * admin as a member, three projects and sixty tasks. Safe to run again (accounts and
 * members are kept; projects are written only while the team has none).
 *
 *   pnpm db:seed-taskline --password "a-long-password"
 *
 * The accounts sign in with the given password (falling back to DEMO_PASSWORD). Run
 * `pnpm db:migrate` first. `pnpm dev:local` runs it on a fresh local database. Refuses
 * NODE_ENV=production unless --force. The data itself is in ./lib/taskline-seed.ts.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
// A plain TypeScript module without imports: Node strips its types.
import { withVerifiedSsl } from "../src/server/db/connection-string.ts";
import { seedTaskline, TASKLINE_TEAM } from "./lib/taskline-seed.ts";

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
		"Usage: pnpm db:seed-taskline [--password <password>] [--force]\n" +
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
	console.error(`seed-taskline: provide ${problems.join(", ")}.`);
	process.exit(1);
}

const client = new pg.Client({ connectionString: withVerifiedSsl(process.env.DATABASE_URL ?? "") });
await client.connect();
try {
	await client.query("begin");
	const result = await seedTaskline((sql, params) => client.query(sql, params), {
		passwordHash: await hashPassword(password),
	});
	await client.query("commit");
	console.log(
		`seed-taskline: ${result.accounts} new accounts (${TASKLINE_TEAM.map((person) => person.email).join(", ")}); ` +
			(result.projects > 0
				? `${result.projects} projects and ${result.tasks} tasks written.`
				: "the team has projects already; none written."),
	);
} catch (error) {
	await client.query("rollback");
	console.error("seed-taskline failed:", error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
