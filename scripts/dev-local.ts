/**
 * pnpm dev:local: the dev server on a local database that keeps its data
 * (decision 0155). Every query is a local call instead of a round trip to a
 * remote Neon database, which is what makes `pnpm dev` feel slow from far away.
 *
 * - Database: PGlite in .data/pglite (scripts/lib/local-db.ts), on
 *   127.0.0.1:LOCAL_DB_PORT (default 54320). New migrations are applied on every
 *   start; the first start also seeds an admin and the demo data, and any start
 *   writes the portfolio's demo content while there is none (0176).
 * - Everything else (email, Sentry, PostHog, Cloudinary…) comes from .env, as
 *   with `pnpm dev`. For no outside services at all, use `pnpm dev:offline`.
 */
import { spawn } from "node:child_process";
import { ensureDevMessages } from "./lib/dev-messages.ts";
import { LOCAL_ADMIN, LOCAL_DB_DIR, startLocalDatabase } from "./lib/local-db.ts";

const database = await startLocalDatabase();
console.log(
	`[local] database: ${LOCAL_DB_DIR} on ${database.url}${database.fresh ? " (new: migrated and seeded)" : ""}`,
);
if (database.fresh) console.log(`[local] sign in as ${LOCAL_ADMIN.email} / ${LOCAL_ADMIN.password}`);

ensureDevMessages();
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--port", "3000"], {
	stdio: "inherit",
	// DATABASE_URL_UNPOOLED is cleared so drizzle-kit and the app agree on the local database.
	env: { ...process.env, DATABASE_URL: database.url, DATABASE_URL_UNPOOLED: "" },
});

const stop = async (code: number) => {
	vite.kill();
	await database.stop();
	process.exit(code);
};
vite.on("exit", (code) => void stop(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void stop(0));
