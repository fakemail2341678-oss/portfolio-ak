import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook (Vite builder). It uses its own Vite config (.storybook/vite.config.ts),
 * not the app's: TanStack Start, Nitro and env validation have no place in a
 * component workshop, and server functions are swapped for mocks there.
 */

/**
 * `STORIES_ONLY` narrows Storybook to some folders or story files, comma-separated and
 * relative to the repository root, so a task builds and tests only what it touched (0280):
 * `$env:STORIES_ONLY="src/features/kharcha"; pnpm build-storybook`. Unset, every story.
 * Not `STORYBOOK_`-prefixed: Storybook copies those variables into the preview bundle.
 */
const only = (process.env.STORIES_ONLY ?? "")
	.split(",")
	.map((entry) => entry.trim().replaceAll("\\", "/").replace(/\/+$/, ""))
	.filter(Boolean);
const stories =
	only.length > 0
		? only.map((entry) => (/\.stories\.tsx?$/.test(entry) ? `../${entry}` : `../${entry}/**/*.stories.@(ts|tsx)`))
		: ["../src/**/*.stories.@(ts|tsx)"];

const config: StorybookConfig = {
	stories,
	addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
	framework: {
		name: "@storybook/react-vite",
		options: { builder: { viteConfigPath: ".storybook/vite.config.ts" } },
	},
	staticDirs: ["../public"],
	core: { disableTelemetry: true },
	// No docgen (0280): it only infers the Controls panel's props, nothing here uses autodocs
	// or argTypes, and it took 1,048 of a narrowed build's 1,052 seconds (2,859 modules).
	typescript: { reactDocgen: false },
	viteFinal: (config) => ({
		...config,
		build: {
			...config.build,
			// The preview iframe bundles Storybook's runtime with every component (~1.5 MB).
			// It is a dev tool, never served to users, so the app's 500 kB budget doesn't apply.
			chunkSizeWarningLimit: 2000,
		},
	}),
};

export default config;
