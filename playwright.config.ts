import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/harness/config.ts";

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
	// GitHub runners have 4 vCPUs; locally Playwright uses half the cores.
	workers: process.env.CI ? 4 : undefined,
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
