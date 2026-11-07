import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `import … from "zod"` resolves to src/lib/zod.ts, which turns on jitless mode
 * before re-exporting Zod (no eval, so the CSP holds). Only the bare specifier
 * is aliased; that module itself imports "zod/v4", so there is no loop.
 * Used by vite.config.ts, .storybook/vite.config.ts and vitest.config.ts.
 */
export const zodAlias = {
	find: /^zod$/,
	replacement: path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/zod.ts"),
};
