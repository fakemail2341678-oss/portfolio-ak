import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook (Vite builder). It uses its own Vite config (.storybook/vite.config.ts),
 * not the app's: TanStack Start, Nitro and env validation have no place in a
 * component workshop, and server functions are swapped for mocks there.
 */
const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
	framework: {
		name: "@storybook/react-vite",
		options: { builder: { viteConfigPath: ".storybook/vite.config.ts" } },
	},
	staticDirs: ["../public"],
	core: { disableTelemetry: true },
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
