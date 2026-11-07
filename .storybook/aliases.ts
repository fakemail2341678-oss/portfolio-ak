import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";
import { zodAlias } from "../vite/zod-alias.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Module swaps for Storybook and its Vitest project. Whole modules are replaced
 * (not spied), so server code behind server functions (database, Better Auth,
 * PostHog) is never bundled into the browser workshop.
 */
export const storybookAliases: AliasOptions = [
	{ find: /^@\/functions\/(.+)$/, replacement: path.join(here, "mocks/functions/$1") },
	{ find: /^@\/lib\/auth-client$/, replacement: path.join(here, "mocks/auth-client.ts") },
	zodAlias,
];

/** Public env for stories. Observability keys are deliberately absent (no Sentry/PostHog in Storybook). */
export const storybookEnv = {
	VITE_APP_TITLE: "Portfolio",
	VITE_SITE_URL: "http://localhost:6006",
} as const;
