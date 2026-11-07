#!/usr/bin/env node
/**
 * Creates the first admin user.
 *
 *   pnpm db:seed-admin --email admin@example.com --password "a-long-password" --name "Site Admin"
 *
 * Values come from CLI flags, falling back to ADMIN_EMAIL / ADMIN_PASSWORD /
 * ADMIN_NAME in the environment (.env is loaded if present). It delegates to
 * Better Auth's official `create-admin` command, which hashes the password,
 * marks the email as verified and assigns the "admin" role, using the app's
 * own auth config (src/server/auth/auth.ts) and database.
 *
 * Run migrations first (`pnpm db:migrate`).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

if (existsSync(".env")) process.loadEnvFile(".env");

const { values } = parseArgs({
	options: {
		email: { type: "string" },
		password: { type: "string" },
		name: { type: "string" },
		force: { type: "boolean", default: false },
		help: { type: "boolean", short: "h", default: false },
	},
	strict: true,
});

if (values.help) {
	console.log(
		"Usage: pnpm db:seed-admin [--email <email>] [--password <password>] [--name <name>] [--force]\n" +
			"Defaults: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME from the environment.\n" +
			"--force  create the admin even if other users already exist.",
	);
	process.exit(0);
}

const email = (values.email ?? process.env.ADMIN_EMAIL ?? "").trim();
const password = values.password ?? process.env.ADMIN_PASSWORD ?? "";
const name = (values.name ?? process.env.ADMIN_NAME ?? "Admin").trim();

const problems: string[] = [];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("a valid --email (or ADMIN_EMAIL)");
if (password.length < 12) problems.push("a --password (or ADMIN_PASSWORD) of at least 12 characters");
if (!name) problems.push("a non-empty --name (or ADMIN_NAME)");
if (problems.length) {
	console.error(`seed-admin: provide ${problems.join(", ")}.`);
	process.exit(1);
}

// Resolve the CLI entry and run it with this Node binary: no shell, so values are never interpreted.
// The package only exports "./api", which sits next to the CLI entry in dist/.
const cli = join(dirname(fileURLToPath(import.meta.resolve("auth/api"))), "index.mjs");

const args = [
	cli,
	"create-admin",
	"--config",
	"src/server/auth/auth.ts",
	"--email",
	email,
	"--password",
	password,
	"--name",
	name,
	"--yes",
	...(values.force ? ["--force"] : []),
];

const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
