/**
 * pnpm diagnose: checks what most often stops the app from starting or a test
 * run from passing, and prints the fix for each problem (decision 0156).
 *
 *   ✔ fine   ! worth a look (doesn't block)   ✖ blocks dev, tests or a deploy
 *
 * Exits with 1 when anything is ✖. Read-only: it changes nothing.
 * (Named `diagnose` because `pnpm doctor` is pnpm's own command.)
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import pg from "pg";

type Result = { level: "ok" | "warn" | "fail"; label: string; fix?: string };
const results: Result[] = [];
const ok = (label: string) => results.push({ level: "ok", label });
const warn = (label: string, fix?: string) => results.push({ level: "warn", label, fix });
const fail = (label: string, fix?: string) => results.push({ level: "fail", label, fix });

const version = (value: string) =>
	value
		.replace(/^[^\d]*/, "")
		.split(".")
		.map(Number);
const atLeast = (actual: number[], wanted: number[]) => {
	for (let index = 0; index < wanted.length; index++) {
		const a = actual[index] ?? 0;
		const w = wanted[index] ?? 0;
		if (a !== w) return a > w;
	}
	return true;
};

// --- Toolchain --------------------------------------------------------------
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { engines: { node: string }; packageManager: string };
const node = version(process.versions.node);
const minNode = version(pkg.engines.node);
const nvmrc = existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : "";
if (!atLeast(node, minNode)) {
	fail(
		`Node ${process.versions.node} is older than ${pkg.engines.node}`,
		`Install Node ${nvmrc || "24"} (see .nvmrc).`,
	);
} else if (nvmrc && node[0] !== Number(nvmrc)) {
	warn(`Node ${process.versions.node}; CI and Vercel use ${nvmrc} (.nvmrc)`, `Switch with: nvm use ${nvmrc}`);
} else ok(`Node ${process.versions.node}`);

const pnpmWanted = pkg.packageManager.split("@")[1] ?? "";
const pnpmUsed = process.env.npm_config_user_agent?.match(/pnpm\/([\d.]+)/)?.[1];
if (pnpmUsed && pnpmUsed !== pnpmWanted) {
	warn(`pnpm ${pnpmUsed}; the project pins ${pnpmWanted}`, "Run: corepack enable (then pnpm picks the pinned version)");
} else ok(`pnpm ${pnpmUsed ?? pnpmWanted}`);

if (!existsSync("node_modules")) fail("Dependencies aren't installed", "Run: pnpm install");

// --- Environment ------------------------------------------------------------
if (!existsSync(".env")) {
	fail(".env is missing", "Run: pnpm setup:local (creates it from .env.example)");
} else {
	process.loadEnvFile(".env");
	try {
		const { createClientEnv } = await import("../src/lib/env/client.schema.ts");
		createClientEnv({ ...process.env });
		const { createServerEnv } = await import("../src/server/env.ts");
		createServerEnv({ ...process.env });
		ok(".env is valid (client and server)");
	} catch (error) {
		fail(
			error instanceof Error ? error.message : String(error),
			"Edit .env (every variable is explained in .env.example)",
		);
	}
}

const configured = (keys: string[]) => keys.every((key) => Boolean(process.env[key]));
const services: Array<[string, string[]]> = [
	["Sentry (errors)", ["VITE_SENTRY_DSN"]],
	["PostHog (analytics, flags)", ["VITE_POSTHOG_KEY"]],
	["Resend (email)", ["RESEND_API_KEY"]],
	["Cloudinary (uploads)", ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]],
	["Turnstile (captcha)", ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]],
	["Google sign-in", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]],
	["TMDB (Parda's catalogue)", ["TMDB_READ_TOKEN"]], // @parda
	["Parda's source probe", ["PARDA_PROBE_SECRET"]], // @parda
	["Parda's watch parties", ["PARDA_REALTIME_KEY"]], // @parda
	["Chaal: connecting Lichess", ["CHAAL_TOKEN_KEY"]], // @chaal
	["Chaal: the opening explorer for visitors", ["LICHESS_APP_TOKEN"]], // @chaal
];
const on = services.filter(([, keys]) => configured(keys)).map(([name]) => name);
const off = services.filter(([, keys]) => !configured(keys)).map(([name]) => name);
ok(
	`Services on: ${on.join(", ") || "none"}${off.length ? `; off: ${off.join(", ")} (each works without its key)` : ""}`,
);

// --- Database ---------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
	const { withVerifiedSsl } = await import("../src/server/db/connection-string.ts");
	const client = new pg.Client({ connectionString: withVerifiedSsl(databaseUrl), connectionTimeoutMillis: 10_000 });
	try {
		await client.connect();
		const timings: number[] = [];
		for (let index = 0; index < 3; index++) {
			const start = performance.now();
			await client.query("select 1");
			timings.push(performance.now() - start);
		}
		const latency = Math.round(timings.sort((a, b) => a - b)[1] ?? 0);
		if (latency > 100) {
			warn(
				`Database reachable, ${latency} ms per query: every page waits for several of these`,
				"For fast local development run: pnpm dev:local (a local Postgres in .data/pglite)",
			);
		} else ok(`Database reachable (${latency} ms per query)`);

		const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
		const applied = await client
			.query<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations")
			.then((result) => result.rows[0]?.count ?? 0)
			.catch(() => 0);
		const pending = journal.entries.length - applied;
		if (pending > 0) fail(`${pending} migration(s) not applied to this database`, "Run: pnpm db:migrate");
		else ok(`Migrations applied (${applied})`);
	} catch (error) {
		const local = /127\.0\.0\.1:54320/.test(databaseUrl);
		fail(
			`Can't reach the database: ${error instanceof Error ? error.message : error}`,
			local
				? "That's the dev:local database: start it with pnpm dev:local"
				: "Check DATABASE_URL in .env (a suspended Neon database can take a few seconds to wake: run this again), or use a local database: pnpm dev:local",
		);
	} finally {
		await client.end().catch(() => {});
	}
}

// --- Generated code ---------------------------------------------------------
if (existsSync("src/paraglide/runtime.js")) ok("Paraglide messages compiled");
else fail("Paraglide messages aren't compiled (src/paraglide)", "Run: pnpm i18n:compile (pnpm dev also does it)");

// --- Ports ------------------------------------------------------------------
const inUse = (port: number) =>
	new Promise<boolean>((resolve) => {
		const probe = createServer();
		probe.once("error", () => resolve(true));
		probe.listen(port, () => probe.close(() => resolve(false)));
	});
if (await inUse(3000)) warn("Port 3000 is in use (a dev server already running?)", "pnpm dev needs it free");
else ok("Port 3000 is free");
if (await inUse(3100)) {
	warn(
		"An e2e server is running on port 3100: pnpm test:e2e reuses it as is",
		"After changing app code, stop it so the suite builds and tests the new code",
	);
}

// --- Report -----------------------------------------------------------------
const icon = { ok: "✔", warn: "!", fail: "✖" } as const;
for (const { level, label, fix } of results) {
	console.log(`${icon[level]} ${label}`);
	if (fix) console.log(`    → ${fix}`);
}
const failures = results.filter((result) => result.level === "fail").length;
console.log(failures ? `\n${failures} problem(s) to fix.` : "\nAll good.");
process.exit(failures ? 1 : 0);
