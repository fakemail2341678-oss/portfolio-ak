/**
 * Starts everything the e2e suite runs against (Playwright's webServer command):
 * 1. a production build (`vite build`) with fixed public settings and no
 *    Sentry/PostHog, unless E2E_SKIP_BUILD=1 reuses the last one;
 * 2. a database: in-memory PGlite over TCP, or E2E_DATABASE_URL (a real Postgres
 *    whose database name contains "e2e" or "test"; it is emptied first);
 * 3. migrations, an admin and the demo data;
 * 4. the harness: a fake Resend API that captures emails, plus test controls;
 * 5. the production server (`.output/server/index.mjs`), with only the env below.
 *
 *   node e2e/harness/server.ts       # Playwright runs this; run it yourself to keep a server up between test runs
 */
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { FAKE_CLOUDINARY } from "./cloudinary.ts";
import { E2E } from "./config.ts";
import { prepareDatabase } from "./database.ts";
import { serveHarness } from "./inbox.ts";
import { servePglite } from "./pglite-server.ts";

const log = (message: string) => console.log(`[e2e] ${message}`);

// Saved sign-ins belong to the previous harness's database: start without them.
rmSync("e2e/.auth", { recursive: true, force: true });

/** App settings a developer's shell may export; the server under test gets only the harness's values. */
const APP_ENV =
	/^(VITE_|DATABASE_|EMAIL_|RESEND_|BETTER_AUTH_|AUTH_|TURNSTILE_|GOOGLE_|ADMIN_|DEMO_|SENTRY_|CLOUDINARY_|CRON_|TMDB_|PARDA_|LICHESS_|CHAAL_)/;
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !APP_ENV.test(key)));

const publicEnv = {
	VITE_APP_TITLE: E2E.appTitle,
	VITE_SITE_URL: E2E.baseURL,
	// Set but empty, so values from .env don't reach the bundle (real env wins over .env files).
	VITE_SENTRY_DSN: "",
	VITE_POSTHOG_KEY: "",
	VITE_POSTHOG_HOST: "",
	// The browser review covers the /dev pages too (src/lib/dev-routes.ts).
	VITE_DEV_ROUTES: "true",
	SENTRY_AUTH_TOKEN: "",
};

/** Fails fast, before the build, when a port is taken (often a server left from another run). */
const assertFree = (port: number, name: string, host?: string) =>
	new Promise<void>((resolve) => {
		const probe = createServer();
		probe.once("error", () => {
			console.error(
				`[e2e] port ${port} (${name}) is in use. Stop whatever holds it (an e2e server from another run?), or set E2E_PORT / E2E_HARNESS_PORT.`,
			);
			process.exit(1);
		});
		probe.listen(port, host, () => probe.close(() => resolve()));
	});
await assertFree(E2E.appPort, "app");
// Same address the harness binds (the app listens on all interfaces).
await assertFree(E2E.harnessPort, "harness", "127.0.0.1");

if (process.env.E2E_SKIP_BUILD === "1") {
	log("E2E_SKIP_BUILD=1: reusing .output");
} else {
	log("building (vite build)…");
	// Vite writes notes (plugin timings, chunk sizes) to stderr. Playwright shows the webServer's
	// stderr as an error in UI mode, so a successful build's stderr goes to stdout instead.
	const build = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
		stdio: ["ignore", "inherit", "pipe"],
		env: { ...inherited, ...publicEnv },
	});
	if (build.status !== 0) {
		process.stderr.write(build.stderr);
		process.exit(build.status ?? 1);
	}
	process.stdout.write(build.stderr);
}

let databaseUrl = process.env.E2E_DATABASE_URL;
let stopPglite: (() => Promise<unknown>) | undefined;
if (databaseUrl) {
	const name = new URL(databaseUrl).pathname.slice(1);
	if (!/e2e|test/i.test(name)) {
		console.error(`[e2e] E2E_DATABASE_URL's database "${name}" is emptied first; use one named *e2e* or *test*.`);
		process.exit(1);
	}
	log(`database: ${name} (Postgres)`);
} else {
	const served = await servePglite(new PGlite(), { port: E2E.pglitePort });
	stopPglite = served.stop;
	databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${served.port}/postgres`;
	log(`database: in-memory PGlite on port ${served.port}`);
}

const database = await prepareDatabase(databaseUrl, { reset: Boolean(process.env.E2E_DATABASE_URL) });
// parda:start
// The seeded Servers 1 to 4 follow the Viduki contract (decision 0248), which obeys no command. Most
// flows test the code a commandable player reaches (the click shield, a party that pauses together,
// resume by `{start}`), so here they speak the placeholder's `parda` protocol. A disabled "Viduki"
// row keeps the contract itself under test, in the player lab.
await database.query(
	`update "pd_source" set "adapter" = 'parda',
	 "movie_template" = replace("movie_template", '?color={color}', '?start={start}&lang={lang}&protocol=parda'),
	 "tv_template" = replace("tv_template", '?color={color}', '?start={start}&lang={lang}&protocol=parda')
	 where "adapter" = 'viduki'`,
);
await database.query(
	`insert into "pd_source" ("name", "movie_template", "tv_template", "adapter", "enabled", "position")
	 values ('{"en":"Viduki","ne":"Viduki"}'::jsonb, '/1/movie/{id}?color={color}', '/1/tv/{id}/{season}/{episode}?color={color}', 'viduki', false, 99)`,
);
// parda:end
const harness = await serveHarness(E2E.harnessPort, database.query);
log(`harness (fake Resend, controls): ${E2E.harnessURL}`);

const app = spawn(process.execPath, [".output/server/index.mjs"], {
	stdio: "inherit",
	env: {
		...inherited,
		...publicEnv,
		NODE_ENV: "production",
		PORT: String(E2E.appPort),
		DATABASE_URL: databaseUrl,
		BETTER_AUTH_URL: E2E.baseURL,
		BETTER_AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
		EMAIL_PROVIDER: "resend",
		RESEND_API_KEY: "re_e2e_placeholder",
		RESEND_BASE_URL: E2E.harnessURL,
		EMAIL_FROM: `${E2E.appTitle} <e2e@example.com>`,
		// No calls to Have I Been Pwned from the suite (tests/server/auth-hardening.test.ts covers it).
		AUTH_BREACHED_PASSWORD_CHECK: "false",
		// Uploads go to the harness's stand-in for Cloudinary (Task 89: a receipt in the browser).
		CLOUDINARY_CLOUD_NAME: FAKE_CLOUDINARY.cloudName,
		CLOUDINARY_API_KEY: FAKE_CLOUDINARY.apiKey,
		CLOUDINARY_API_SECRET: FAKE_CLOUDINARY.apiSecret,
		CLOUDINARY_API_BASE: `${E2E.harnessURL}/cloudinary`,
		CLOUDINARY_DELIVERY_BASE: `${E2E.harnessURL}/cloudinary-img`,
		// parda:start
		// The suite never calls TMDB: the harness serves recorded responses and placeholder images.
		TMDB_READ_TOKEN: "e2e-token-not-for-production",
		TMDB_API_BASE: `${E2E.harnessURL}/tmdb/3`,
		TMDB_IMAGE_BASE: `${E2E.harnessURL}/tmdb/img`,
		// The daily probe's route (decision 0238): the flows call it; CI never runs the probe itself.
		PARDA_PROBE_SECRET: E2E.probeSecret,
		// Watch parties (decision 0243): the relay stands in for the realtime service, with the same tokens.
		PARDA_REALTIME_KEY: E2E.realtimeKey,
		PARDA_REALTIME_URL: `${E2E.harnessURL.replace("http", "ws")}/parda-relay`,
		// parda:end
		// chaal:start
		// The suite never calls Lichess: the harness's fake answers OAuth, the account, the event
		// stream and the recorded public reads (decision 0255).
		LICHESS_API_BASE: `${E2E.harnessURL}/lichess`,
		LICHESS_EXPLORER_BASE: `${E2E.harnessURL}/lichess-explorer`,
		LICHESS_TABLEBASE_BASE: `${E2E.harnessURL}/lichess-tablebase`,
		LICHESS_CLIENT_ID: "chaal-e2e",
		// Task 75: the explorer needs a token; the fake accepts any (a visitor's calls carry this one).
		LICHESS_APP_TOKEN: "lip_e2e_app",
		CHAAL_TOKEN_KEY: E2E.chaalTokenKey,
		// chaal:end
		// kharcha:start
		// The daily jobs' bearer (Task 94): Kharcha's flows run its job the way Vercel's cron does.
		CRON_SECRET: E2E.cronSecret,
		// kharcha:end
	},
});
log(`server: ${E2E.baseURL}`);

let stopping = false;
/** Stops the server, then everything else. Never waits long: a lingering harness holds the ports. */
const shutdown = async (code: number) => {
	if (stopping) return;
	stopping = true;
	app.kill();
	setTimeout(() => process.exit(code), 2000).unref();
	await Promise.allSettled([harness.close(), database.close()]);
	await stopPglite?.();
	process.exit(code);
};
app.on("exit", (code) => void shutdown(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown(0));

// If whoever started the harness goes away without stopping it (UI mode or a terminal closed abruptly;
// on Windows the children survive), shut down rather than keep stale servers on the ports, which the
// next local run would silently reuse.
const parent = process.ppid;
setInterval(() => {
	try {
		process.kill(parent, 0);
	} catch {
		void shutdown(0);
	}
}, 2000).unref();
