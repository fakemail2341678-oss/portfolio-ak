import { defineConfig } from "@inlang/paraglide-js";

/**
 * Paraglide compiler options, read by both the Vite plugin and the
 * `paraglide-js compile` CLI (used by `pnpm typecheck` on a fresh clone).
 *
 * Output structure: one module per locale here, so Vitest and `pnpm dev` produce the
 * same files. The CLI ignores this option (it uses one module per message unless told
 * otherwise), so every CLI call passes `--output-structure locale-modules`: without it,
 * `pnpm typecheck` rewrote a running dev server's messages and a fresh clone's first
 * `pnpm dev:local` failed to load one (Task 45).
 * With one module per message, dev loaded about a thousand modules on the first page.
 * Production builds override it to "message-modules" in vite.config.ts, which
 * tree-shakes unused messages per page (decision 0155).
 *
 * URL strategy: English (base locale) is unprefixed, Nepali lives under /ne.
 * Paraglide matches `localized` entries in order, so the prefixed pattern comes first.
 * See docs/decisions.md for why cookie/Accept-Language are not page strategies.
 *
 * Server function RPCs (/_serverFn/...) carry no locale prefix, so they read the
 * page locale from a header set by src/middleware/locale.ts instead.
 * Better Auth API calls (/api/auth/...) do the same via the auth client.
 */
export default defineConfig({
	outdir: "./src/paraglide",
	outputStructure: "locale-modules",
	emitTsDeclarations: true,
	strategy: ["url", "baseLocale"],
	routeStrategies: [
		{ match: "/_serverFn/:path(.*)?", strategy: ["custom-header", "baseLocale"] },
		// Better Auth API: the auth client sends the same header (src/lib/auth-client.ts).
		{ match: "/api/auth/:path(.*)?", strategy: ["custom-header", "baseLocale"] },
	],
	urlPatterns: [
		{
			pattern: "/:path(.*)?",
			localized: [
				["ne", "/ne/:path(.*)?"],
				["en", "/:path(.*)?"],
			],
		},
	],
});
