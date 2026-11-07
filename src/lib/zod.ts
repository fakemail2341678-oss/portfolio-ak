/**
 * Zod, configured. Every `import … from "zod"` (ours and libraries') resolves
 * here through a Vite alias (vite.config.ts, .storybook/vite.config.ts,
 * vitest.config.ts), so the config below runs before any schema exists.
 *
 * Why: Zod 4 compiles object schemas with `new Function` when eval is allowed,
 * and it probes for that with an eval as soon as a `z.object` is CREATED. Our
 * Content-Security-Policy forbids eval, so the probe is a CSP violation on
 * every page. Jitless mode skips both; validation is just as correct.
 *
 * A side-effect import "first" in the entry files is not enough: the bundler
 * may evaluate a chunk with module-level schemas before the entry's first
 * import. Being the module `zod` resolves to makes the ordering an ES-module
 * guarantee instead. Import from "zod" as usual; never from this file.
 */
import { z } from "zod/v4";

z.config({ jitless: true });

export * from "zod/v4";
export { z, z as default };
