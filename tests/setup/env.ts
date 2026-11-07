/**
 * Baseline server env for tests. Modules like src/server/env.ts validate
 * process.env when imported, so every test file starts from a valid config.
 * Individual tests still override values (vi.stubEnv) to test failures. The values
 * are set, not defaulted, so a shell or CI env (e.g. CI's VITE_APP_TITLE) can't
 * change what the tests expect.
 */
const defaults: Record<string, string> = {
	DATABASE_URL: "postgres://user:pass@localhost:5432/test",
	EMAIL_FROM: "Portfolio <hello@example.com>",
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
	BETTER_AUTH_URL: "http://localhost:3000",
	VITE_APP_TITLE: "Portfolio",
	VITE_SITE_URL: "http://localhost:3000",
};

for (const [key, value] of Object.entries(defaults)) process.env[key] = value;

/**
 * Optional services are off, as on CI, whatever a developer's .env holds: a PostHog or
 * Sentry key there made the "without a key" tests fail locally. Tests that need one
 * turn it on with vi.stubEnv.
 */
const OFF = [
	"VITE_POSTHOG_KEY",
	"VITE_POSTHOG_HOST",
	"POSTHOG_SECRET_KEY",
	"VITE_SENTRY_DSN",
	"VITE_SENTRY_DEV_TRACING",
	"TMDB_READ_TOKEN", // @parda
	"PARDA_PLAYER_BASE", // @parda
	"PARDA_PROBE_SECRET", // @parda
	"PARDA_REALTIME_KEY", // @parda
	"PARDA_REALTIME_URL", // @parda
	"CHAAL_TOKEN_KEY", // @chaal
	"LICHESS_APP_TOKEN", // @chaal
	"LICHESS_API_BASE", // @chaal
	"LICHESS_EXPLORER_BASE", // @chaal
	"LICHESS_TABLEBASE_BASE", // @chaal
	"LICHESS_CLIENT_ID", // @chaal
];
for (const key of OFF) delete process.env[key];
