import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { storybookAliases, storybookEnv } from "./.storybook/aliases.ts";
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

/** Storybook env for story tests; `variant` selects the locale/theme pass (see .storybook/preview.tsx). */
const storybookDefines = (variant: "default" | "dark-ne") =>
	Object.fromEntries([
		...Object.entries(storybookEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
		["import.meta.env.STORYBOOK_VARIANT", JSON.stringify(variant)],
	]);

// Separate from vite.config.ts so tests don't run the app's env validation,
// Nitro or TanStack Start plugins. Each test supplies the env it needs.
export default defineConfig({
	// Compiles messages before tests run (options from project.inlang/paraglide.config.ts).
	plugins: [paraglideVitePlugin({ project: "./project.inlang" })],
	resolve: { tsconfigPaths: true, alias: [zodAlias] },
	test: {
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
		projects: [
			{
				// `pnpm test`: unit, component (jsdom) and server tests.
				extends: true,
				test: {
					name: "unit",
					include: ["tests/**/*.test.{ts,tsx}"],
					environment: "node",
					setupFiles: ["tests/setup/env.ts", "tests/setup/dom.ts"],
					// One migrated PGlite database per run, loaded by createTestDb (tests/utils/test-db.ts).
					globalSetup: ["tests/setup/pglite.ts"],
					restoreMocks: true,
					unstubEnvs: true,
					// jsdom interaction tests (calendar and country pickers via userEvent) can take
					// several seconds on a busy machine; 5 s made them flaky, not wrong.
					testTimeout: 15_000,
				},
			},
			{
				// `pnpm test:storybook`: every story renders in real Chrome; play functions
				// run and the a11y addon fails the story on any violation. English, light theme.
				// addon-vitest applies the preview and addon annotations itself (no setup file).
				extends: true,
				plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") }), tailwindcss()],
				resolve: { alias: storybookAliases },
				// Pre-bundled: found mid-run (charts and sortables load on demand), Vite would
				// re-optimize and reload the page under a running story.
				optimizeDeps: { include: STORY_DEPS },
				define: storybookDefines("default"),
				test: {
					name: "storybook",
					// Rendering in a real browser is slower than jsdom; give stories (Tiptap, axe) room.
					testTimeout: 30_000,
					browser: {
						enabled: true,
						headless: true,
						// The installed Chrome: no Playwright browser download needed.
						provider: playwright({ launchOptions: { channel: "chrome" } }),
						instances: [{ browser: "chromium" }],
					},
				},
			},
			{
				// The same stories again in Nepali with the dark theme.
				extends: true,
				plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") }), tailwindcss()],
				resolve: { alias: storybookAliases },
				// Pre-bundled: found mid-run (charts and sortables load on demand), Vite would
				// re-optimize and reload the page under a running story.
				optimizeDeps: { include: STORY_DEPS },
				define: storybookDefines("dark-ne"),
				test: {
					name: "storybook-dark-ne",
					// Rendering in a real browser is slower than jsdom; give stories (Tiptap, axe) room.
					testTimeout: 30_000,
					browser: {
						enabled: true,
						headless: true,
						// The installed Chrome: no Playwright browser download needed.
						provider: playwright({ launchOptions: { channel: "chrome" } }),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
