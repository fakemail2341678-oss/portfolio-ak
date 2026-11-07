/**
 * pnpm dev:offline: the dev server with no outside services (docs/guides/recipes.md,
 * "Offline development"; decision 0149).
 *
 * - Database: an in-memory PGlite served over TCP (the e2e harness's server),
 *   migrated and seeded with an admin and the demo data on every start. Data is
 *   gone when it stops.
 * - Email: the console provider (messages are printed, links included).
 * - Sentry, PostHog, Cloudinary, Turnstile, Google sign-in: off (set but empty,
 *   so .env can't turn them on). Each feature already degrades without its key.
 *
 * Sign in as admin@example.com with the e2e password (e2e/harness/config.ts).
 */
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { E2E } from "../e2e/harness/config.ts";
import { prepareDatabase } from "../e2e/harness/database.ts";
import { servePglite } from "../e2e/harness/pglite-server.ts";
import { ensureDevMessages } from "./lib/dev-messages.ts";

const served = await servePglite(new PGlite(), { port: Number(process.env.OFFLINE_DB_PORT ?? 0) });
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${served.port}/postgres`;
const database = await prepareDatabase(databaseUrl, { reset: false });
await database.close();

const OFF = [
	"VITE_SENTRY_DSN",
	"VITE_POSTHOG_KEY",
	"VITE_POSTHOG_HOST",
	"SENTRY_AUTH_TOKEN",
	"CLOUDINARY_CLOUD_NAME",
	"CLOUDINARY_API_KEY",
	"CLOUDINARY_API_SECRET",
	"TURNSTILE_SITE_KEY",
	"TURNSTILE_SECRET_KEY",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"RESEND_API_KEY",
	"DATABASE_URL_UNPOOLED",
	"TMDB_READ_TOKEN", // @parda
	"PARDA_PROBE_SECRET", // @parda
	"PARDA_REALTIME_KEY", // @parda
	"PARDA_REALTIME_URL", // @parda
	"CHAAL_TOKEN_KEY", // @chaal
	"LICHESS_APP_TOKEN", // @chaal
];

console.log(`[offline] database: in-memory PGlite on port ${served.port}`);
console.log(`[offline] sign in as ${E2E.users.admin.email} / ${E2E.password}`);

ensureDevMessages();
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--port", "3000"], {
	stdio: "inherit",
	env: {
		...process.env,
		...Object.fromEntries(OFF.map((key) => [key, ""])),
		DATABASE_URL: databaseUrl,
		EMAIL_PROVIDER: "console",
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "offline-dev-secret-not-for-production-0123456789",
		VITE_APP_TITLE: process.env.VITE_APP_TITLE || "App",
		VITE_SITE_URL: "http://localhost:3000",
		// chaal:start
		// Chaal's public reads need no key, so offline they point at a closed local port:
		// its pages show Lichess as unavailable instead of calling lichess.org.
		LICHESS_API_BASE: "http://127.0.0.1:9",
		LICHESS_EXPLORER_BASE: "http://127.0.0.1:9",
		LICHESS_TABLEBASE_BASE: "http://127.0.0.1:9",
		// chaal:end
	},
});

const stop = async (code: number) => {
	vite.kill();
	await served.stop();
	process.exit(code);
};
vite.on("exit", (code) => void stop(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void stop(0));
