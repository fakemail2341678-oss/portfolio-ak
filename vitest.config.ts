import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { storybookAliases, storybookEnv } from "./.storybook/aliases.ts";
import { workersFor } from "./scripts/lib/workers.ts";
import { zodAlias } from "./vite/zod-alias.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Libraries stories load lazily (React.lazy, dynamic imports), or that Vite's scan misses:
 * `react-dom` itself (Parda's `preloadHero` imports `preload`, decision 0245) was found only
 * mid-run, and the reload failed every story then in flight.
 */
const STORY_DEPS = [
	"react-dom",
	"@tiptap/react",
	"@tiptap/starter-kit",
	"recharts",
	"@dnd-kit/react",
	"@dnd-kit/react/sortable",
	"@dnd-kit/dom",
	"@tanstack/react-table",
];

/** Storybook's public env for story tests (the same for both passes). */
const storybookDefines = Object.fromEntries(
	Object.entries(storybookEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
);

/** What every project of `pnpm test` shares. */
const nodeTests = {
	// Worker threads, not child processes: a worker starts faster and the three projects ran 10 to 25%
	// faster on them (server 87 s to 67 s). PGlite and jsdom both run in a thread.
	pool: "threads" as const,
	restoreMocks: true,
	unstubEnvs: true,
	// jsdom interaction tests (calendar and country pickers via userEvent) can take
	// several seconds on a busy machine; 5 s made them flaky, not wrong.
	testTimeout: 15_000,
};

// Separate from vite.config.ts so tests don't run the app's env validation,
// Nitro or TanStack Start plugins. Each test supplies the env it needs.
export default defineConfig({
	// Compiles messages before tests run (options from project.inlang/paraglide.config.ts).
	plugins: [paraglideVitePlugin({ project: "./project.inlang" })],
	resolve: { tsconfigPaths: true, alias: [zodAlias] },
	test: {
		// Transformed modules are kept on disk (node_modules/.vitest-cache) and reused by the next run
		// and by every worker: a server test file imports the schema and its services again, and
		// importing was 26% of `pnpm test` (Part 9 Task 99, decision 0296).
		fsModuleCache: true,
		// The compiled messages (src/paraglide, 10 MB of plain JavaScript for 7,227 messages in two
		// locales) are loaded by Node itself, not through Vite's module runner: nearly every test file
		// imports them, and through the runner that took 0.8 s a file.
		server: { deps: { external: [/[\\/]src[\\/]paraglide[\\/]/] } },
		// `pnpm test:coverage`: v8 coverage of the app code, then a per-area table
		// (scripts/coverage-report.ts). Generated code and stories are not measured.
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/paraglide/**",
				"src/routeTree.gen.ts",
				"src/**/*.stories.tsx",
				"src/components/forms/story-harness.tsx",
				"src/**/*.d.ts",
			],
			reporter: ["text-summary", "json-summary", "html"],
			reportsDirectory: "coverage",
		},
		/*
		 * `pnpm test` is three projects, one per kind of test (Part 9 Task 99, decision 0296), so each
		 * loads only the setup it needs and takes the workers its memory allows (scripts/lib/workers.ts).
		 * Projects with different worker counts can't run together, so each has its own group, lightest
		 * first. A file's `@vitest-environment` comment still wins over its project's environment.
		 */
		projects: [
			{
				// Pure logic and the guard tests that read the source: no DOM setup, no database.
				extends: true,
				test: {
					...nodeTests,
					name: "unit",
					include: ["tests/unit/**/*.test.{ts,tsx}"],
					environment: "node",
					setupFiles: ["tests/setup/env.ts", "tests/setup/dom.ts"],
					// One module graph per worker, not per file: these tests keep no state between files (they
					// pass in any order), and importing was over half their time. The other two projects stay
					// isolated: shuffled without isolation, a components file and a server file failed.
					isolate: false,
					maxWorkers: workersFor("unit"),
					sequence: { groupOrder: 0 },
				},
			},
			{
				// Components in jsdom.
				extends: true,
				test: {
					...nodeTests,
					name: "components",
					include: ["tests/components/**/*.test.{ts,tsx}"],
					environment: "jsdom",
					setupFiles: ["tests/setup/env.ts", "tests/setup/dom.ts"],
					maxWorkers: workersFor("components"),
					sequence: { groupOrder: 1 },
				},
			},
			{
				// Services and server functions on PGlite.
				extends: true,
				test: {
					...nodeTests,
					name: "server",
					include: ["tests/server/**/*.test.{ts,tsx}"],
					environment: "node",
					setupFiles: ["tests/setup/env.ts", "tests/setup/dom.ts"],
					// One migrated PGlite database per run, loaded by createTestDb (tests/utils/test-db.ts).
					globalSetup: ["tests/setup/pglite.ts"],
					maxWorkers: workersFor("server"),
					sequence: { groupOrder: 2 },
				},
			},
			{
				// `pnpm test:storybook`: every story renders in a real browser; play functions run and
				// the a11y addon fails the story on any violation. Twice, as two instances of one project:
				// "storybook" (English, light) and "storybook-dark-ne" (Nepali, dark). The instances share
				// one Vite server and one dependency optimization; as two projects they had one each, and
				// the first run after an install failed while the second server optimized under running
				// stories (decision 0292).
				// addon-vitest applies the preview and addon annotations itself (no setup file).
				extends: true,
				plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") }), tailwindcss()],
				resolve: { alias: storybookAliases },
				// Pre-bundled: found mid-run (charts and sortables load on demand), Vite would
				// re-optimize and reload the page under a running story.
				optimizeDeps: { include: STORY_DEPS },
				define: storybookDefines,
				test: {
					name: "stories",
					// Rendering in a real browser is slower than jsdom; give stories (Tiptap, axe) room.
					testTimeout: 30_000,
					maxWorkers: workersFor("storybook"),
					sequence: { groupOrder: 3 },
					browser: {
						enabled: true,
						headless: true,
						// The installed Chrome: no Playwright browser download needed.
						provider: playwright({ launchOptions: { channel: "chrome" } }),
						// `pnpm test:storybook` runs each instance in a process of its own (scripts/test-storybook.ts):
						// a page holds about 1 GB, and in one process the first instance's pages stay open while
						// the second runs.
						instances: [
							{ browser: "chromium", name: "storybook" },
							// The variant is set by a setup file, read by .storybook/preview.tsx (.storybook/variant.ts).
							{ browser: "chromium", name: "storybook-dark-ne", setupFiles: [".storybook/variant-dark-ne.ts"] },
						],
					},
				},
			},
		],
	},
});
