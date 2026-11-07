/**
 * pnpm setup:local: from a fresh clone to a running app (decision 0156).
 *
 * 1. Checks the Node version.
 * 2. Creates .env from .env.example if it's missing, and fills BETTER_AUTH_SECRET
 *    if it's empty. Values you set are never overwritten.
 * 3. Compiles the Paraglide messages (types for your editor and tsc).
 * 4. Creates the local database in .data/pglite: migrations, an admin and the
 *    demo data (scripts/lib/local-db.ts).
 *
 * Then: pnpm dev:local. Safe to run again. (Named `setup:local` because
 * `pnpm setup` is pnpm's own command.)
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { LOCAL_ADMIN, LOCAL_DB_DIR, startLocalDatabase } from "./lib/local-db.ts";

const step = (message: string) => console.log(`\n▸ ${message}`);

step("Node");
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
	console.error(`  Node ${process.versions.node} is too old: install Node 24 (see .nvmrc), then run this again.`);
	process.exit(1);
}
console.log(`  Node ${process.versions.node}`);

step(".env");
if (existsSync(".env")) console.log("  .env exists: kept as it is");
else {
	copyFileSync(".env.example", ".env");
	console.log("  created .env from .env.example");
}
const env = readFileSync(".env", "utf8");
if (/^BETTER_AUTH_SECRET=("")?\s*$/m.test(env)) {
	const secret = randomBytes(32).toString("base64");
	writeFileSync(
		".env",
		env.replace(/^BETTER_AUTH_SECRET=("")?\s*$/m, () => `BETTER_AUTH_SECRET="${secret}"`),
	);
	console.log("  generated BETTER_AUTH_SECRET");
} else console.log("  BETTER_AUTH_SECRET is set");

step("Messages");
const compile = spawnSync(
	process.execPath,
	[
		"node_modules/@inlang/paraglide-js/bin/run.js",
		"compile",
		"--project",
		"./project.inlang",
		// The CLI ignores the config's outputStructure (see project.inlang/paraglide.config.ts).
		"--output-structure",
		"locale-modules",
		"--silent",
	],
	{ stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status ?? 1);
console.log("  compiled into src/paraglide");

step("Local database");
const database = await startLocalDatabase();
await database.stop();
console.log(
	database.fresh
		? `  created ${LOCAL_DB_DIR}: migrated, with an admin and demo data`
		: `  ${LOCAL_DB_DIR} exists: new migrations applied, data kept`,
);

console.log(`
Ready. Start the app on the local database:

  pnpm dev:local          http://localhost:3000
                          sign in at /login as ${LOCAL_ADMIN.email} / ${LOCAL_ADMIN.password}

Later: pnpm diagnose checks your setup; pnpm dev uses DATABASE_URL from .env (e.g. Neon).`);
