import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/harness/config.ts";
import { workersFor } from "./scripts/lib/workers.ts";

/**
 * The e2e suite (`pnpm test:e2e`): flows and the browser review, against a
 * production build started by e2e/harness/server.ts. See docs/guides/testing.md.
 */
export default defineConfig({
	testDir: "e2e",
	outputDir: "test-results",
	forbidOnly: Boolean(process.env.CI),
	// One retry everywhere: a rare load-related layout shift shouldn't fail a 350-test run. A test that
	// passes only on its retry is still reported as flaky (and records a trace on that retry).
	retries: 1,
	// From the machine's free memory (scripts/lib/workers.ts): Playwright's own default, half the
	// processors, started 6 workers and some 57 Chromes on an 11.7 GB laptop and ran it out of memory.
	workers: workersFor("e2e"),
	// A runner that stops answering ends by itself: when Chrome drew no frame (a locked, hot laptop),
	// the run printed nothing for 16 minutes and left its Chromes behind (decision 0295). The whole
	// suite takes about an hour on two workers; a CI shard takes a fifth of that.
	globalTimeout: 2 * 60 * 60_000,
	// The slowest tests are named at the end of every run, so a slow one isn't hidden by its retry.
	reportSlowTests: { max: 10, threshold: 20_000 },
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
	timeout: 60_000,
	expect: { timeout: 10_000 },
	use: {
		...devices["Desktop Chrome"],
		// The installed Chrome, as in the Storybook tests: no browser download (GitHub's runners ship it).
		channel: "chrome",
		baseURL: E2E.baseURL,
		locale: "en-US",
		timezoneId: "Asia/Kathmandu",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	// No setup project: tests sign in on demand (signInState in e2e/support/fixtures.ts), which also works
	// in UI mode, where a setup project only runs when it's ticked. UI mode starts with the first project.
	projects: [
		// Flows run their tests in order within a file (they share rate limits and data).
		{ name: "flows", testMatch: /flows\/.*\.spec\.ts/ },
		{ name: "review", testMatch: /review\.spec\.ts/, fullyParallel: true },
	],
	webServer: {
		command: "node e2e/harness/server.ts",
		url: `${E2E.baseURL}/health`,
		// Includes the production build.
		timeout: 300_000,
		reuseExistingServer: !process.env.CI,
		// Build and harness progress stay quiet; server errors (stderr) are shown.
		stdout: "ignore",
		stderr: "pipe",
	},
});
