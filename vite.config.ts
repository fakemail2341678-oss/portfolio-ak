import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import { chaalEngine } from "./scripts/engine-copy.ts"; // @chaal
import { STATIC_SECURITY_HEADERS } from "./src/lib/http/csp.ts";
import { emailPreviewPlugin } from "./vite/email-preview-plugin.ts";
import { zodAlias } from "./vite/zod-alias.ts";

/**
 * Nitro bundles the server output in its own Rolldown pass, where
 * @vitejs/plugin-react's handling of "use client" does not apply. Libraries such
 * as @tanstack/react-router and sonner ship "use client" for RSC frameworks; it
 * is meaningless here (no RSC), so only that exact warning from node_modules is
 * dropped. Nitro's own ignore list is kept because this handler replaces its default.
 */
// chaal:start
/** The engine's files: immutable, and the worker's own CSP allows its WebAssembly (decision 0257). */
const ENGINE_HEADERS = {
	"cache-control": "public, max-age=31536000, immutable",
	"content-security-policy": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
} as const;
// chaal:end

const NITRO_IGNORED_CODES = new Set(["EVAL", "CIRCULAR_DEPENDENCY", "THIS_IS_UNDEFINED", "EMPTY_BUNDLE"]);

const isDependencyUseClientWarning = (code: string | undefined, message: string) =>
	code === "MODULE_LEVEL_DIRECTIVE" && message.includes('"use client"') && message.includes("node_modules");

/**
 * Fail fast on bad env, before Vite starts serving or building.
 * - Client (VITE_*) vars are inlined at build time, so they are checked for dev and build.
 * - Server vars are runtime config. They are checked for dev here, and for production
 *   when the server boots (src/server/plugins/validate-env.ts), so builds don't need production secrets.
 */
const validateEnv = async (command: "serve" | "build", mode: string) => {
	const fileEnv = loadEnv(mode, process.cwd(), "");
	// Real environment variables win over .env files, matching Vite's own precedence.
	for (const [key, value] of Object.entries(fileEnv)) process.env[key] ??= value;

	const { createClientEnv, devRoutesInProduction, DEV_ROUTES_IN_PRODUCTION } = await import(
		"./src/lib/env/client.schema.ts"
	);
	createClientEnv({ ...process.env });
	if (devRoutesInProduction(process.env)) throw new Error(DEV_ROUTES_IN_PRODUCTION);

	if (command === "serve") {
		const { createServerEnv } = await import("./src/server/env.ts");
		createServerEnv({ ...process.env });
	}
};

export default defineConfig(async ({ command, mode }) => {
	// Vitest has its own config (vitest.config.ts); this guard covers `vite` commands only.
	await validateEnv(command, mode);

	return {
		resolve: { tsconfigPaths: true, alias: [zodAlias] },
		// Vercel Web Analytics loads /_vercel/insights/script.js, which only Vercel serves.
		// Elsewhere (dev, local builds, e2e) it would 404 and fail the browser review's
		// console check, so the root layout renders it only in builds made on Vercel.
		define: {
			"import.meta.env.VITE_VERCEL_ANALYTICS": JSON.stringify(process.env.VERCEL ? "true" : ""),
		},
		server: {
			// Transform the entry and the layouts while the dev server starts, so the
			// first page doesn't wait for them (decision 0155).
			warmup: {
				clientFiles: ["./src/client.tsx", "./src/router.tsx", "./src/routes/__root.tsx", "./src/routes/_*.tsx"],
				ssrFiles: ["./src/server.ts", "./src/router.tsx"],
			},
		},
		build: {
			// Fonts are never inlined as data: URLs, whatever their size: the CSP allows fonts
			// from 'self' only. Small unicode-range subsets (under Vite's 4 kB limit) would
			// otherwise be blocked. Other assets keep Vite's default (decision 0108).
			assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
		},
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							// React changes rarely; a separate chunk stays cached across deploys and keeps
							// the entry chunk under Vite's 500 kB warning. See docs/decisions.md.
							codeSplitting: {
								groups: [
									{
										name: "react-vendor",
										test: /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom|scheduler)\//,
									},
									// cva's class joiner, on its own: left alone, Rolldown may put it in tailwind-merge's
									// chunk, which the entry then imports directly (decision 0211).
									{ name: "clsx", test: /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?clsx\// },
								],
							},
						},
					},
				},
			},
		},
		plugins: [
			// Options live in project.inlang/paraglide.config.ts (shared with the compile CLI), except
			// the output structure of production builds: one module per message, so each page ships
			// only the messages it uses. Dev keeps one module per locale (decision 0155).
			paraglideVitePlugin({
				project: "./project.inlang",
				...(command === "build" ? { outputStructure: "message-modules" as const } : {}),
			}),
			// Dev server only (apply: "serve"): /dev/emails. Never part of a build.
			emailPreviewPlugin(),
			// Chaal's engine: copied from the stockfish package into public/chaal/engine/ (decision 0263).
			chaalEngine(), // @chaal
			devtools(),
			nitro({
				// Validates server env at boot. See the file for why this is a Nitro plugin.
				plugins: ["./src/server/plugins/validate-env.ts"],
				// Scheduled jobs (Vercel Cron, see vercel.json): bearer CRON_SECRET, 404 when unset.
				routes: {
					"/api/cron/attachments": { handler: "./src/server/routes/cron-attachments.ts", method: "GET" },
					"/api/cron/guests": { handler: "./src/server/routes/cron-guests.ts", method: "GET" },
					"/api/cron/taskline": { handler: "./src/server/routes/cron-taskline.ts", method: "GET" }, // @taskline
					"/api/cron/parda": { handler: "./src/server/routes/cron-parda.ts", method: "GET" }, // @parda
					"/parda/api/**": { handler: "./src/server/routes/parda-player.ts", method: "GET" }, // @parda
					// Nitro routes so dev serves them to manifest fetches too (see the file). One per locale.
					"/manifest.webmanifest": { handler: "./src/server/routes/manifest.ts", method: "GET" },
					"/ne/manifest.webmanifest": { handler: "./src/server/routes/manifest.ts", method: "GET" },
					// taskline:start
					"/app/taskline/manifest.webmanifest": { handler: "./src/server/routes/taskline-manifest.ts", method: "GET" },
					"/ne/app/taskline/manifest.webmanifest": {
						handler: "./src/server/routes/taskline-manifest.ts",
						method: "GET",
					},
					// taskline:end
					// parda:start
					"/app/parda/manifest.webmanifest": { handler: "./src/server/routes/parda-manifest.ts", method: "GET" },
					"/ne/app/parda/manifest.webmanifest": { handler: "./src/server/routes/parda-manifest.ts", method: "GET" },
					// The daily source probe (decision 0238): GET what to probe, POST what it saw; 404 without its secret.
					"/api/parda/probe": { handler: "./src/server/routes/parda-probe.ts" },
					// parda:end
					// chaal:start
					// Connecting Lichess and its streams, through this server so tokens never leave it (decision 0256).
					"/api/chaal/oauth/start": { handler: "./src/server/routes/chaal-oauth.ts", method: "GET" },
					"/api/chaal/oauth/callback": { handler: "./src/server/routes/chaal-oauth.ts", method: "GET" },
					"/api/chaal/stream/events": { handler: "./src/server/routes/chaal-stream.ts", method: "GET" },
					"/app/chaal/manifest.webmanifest": { handler: "./src/server/routes/chaal-manifest.ts", method: "GET" },
					"/ne/app/chaal/manifest.webmanifest": { handler: "./src/server/routes/chaal-manifest.ts", method: "GET" },
					// chaal:end
				},
				// Security headers on every response (pages, assets, API). The CSP is per
				// request (nonce) and is added by src/middleware/security-headers.ts.
				routeRules: {
					"/**": { headers: STATIC_SECURITY_HEADERS },
					// Parda's placeholder player is framed by this app's own pages (decision 0230).
					"/parda/api/**": { headers: { "x-frame-options": "SAMEORIGIN" } }, // @parda
					// chaal:start
					// Chaal's engine (decisions 0257 and 0263): hashed names, so a year's cache; a dedicated worker
					// follows its own response's CSP, so only these files may compile WebAssembly.
					"/chaal/engine/**": { headers: ENGINE_HEADERS },
					// chaal:end
					// parda:start
					// For now the Vercel deployment is Parda alone: its home redirects there (decision 0252).
					// Vercel sets VERCEL=1 at build time; local builds, dev and e2e keep the portfolio at /.
					...(process.env.VERCEL
						? {
								"/": { redirect: { to: "/app/parda", status: 307 } },
								"/ne": { redirect: { to: "/ne/app/parda", status: 307 } },
							}
						: {}),
					// parda:end
				},
				rolldownConfig: {
					onwarn(warning, warn) {
						if (NITRO_IGNORED_CODES.has(warning.code ?? "")) return;
						if (isDependencyUseClientWarning(warning.code, warning.message)) return;
						warn(warning);
					},
				},
			}),
			tailwindcss(),
			tanstackStart({
				router: {
					// The router plugin's default splits component, errorComponent and notFoundComponent
					// only, so a route's pendingComponent (and everything it imports) landed in the entry
					// chunk of every page. Each one is its own chunk now (decision 0151). Route options
					// must stay inline object properties: the splitter skips spreads and helper returns.
					codeSplittingOptions: {
						defaultBehavior: [["component"], ["pendingComponent"], ["errorComponent"], ["notFoundComponent"]],
					},
				},
				importProtection: {
					client: {
						// `files` replaces the defaults, so the default *.server.* rule is repeated.
						files: ["**/*.server.*", "**/src/server/**"],
					},
				},
			}),
			viteReact(),
			// React Compiler: memoizes components and hooks at build time (decision 0136). Only our
			// own source: the compiled Paraglide messages (a thousand modules) and dependencies
			// have no components, and running Babel over them made `pnpm dev` slow (decision 0155).
			// `exclude` replaces the plugin's default list, so node_modules is listed again.
			babel({
				include: [/[\\/]src[\\/].+\.[jt]sx?$/],
				exclude: [/[\\/]node_modules[\\/]/, /[\\/]src[\\/]paraglide[\\/]/],
				presets: [reactCompilerPreset()],
			}),
			// Source map upload to Sentry (must be last). Only when all three build
			// variables are set, so builds without Sentry stay silent and offline.
			...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
				? sentryTanstackStart({
						org: process.env.SENTRY_ORG,
						project: process.env.SENTRY_PROJECT,
						authToken: process.env.SENTRY_AUTH_TOKEN,
						telemetry: false,
						// Server-function errors are captured in normalizeServerError; keep
						// middleware wrapping explicit (start.ts) instead of build-time magic.
						autoInstrumentMiddleware: false,
					})
				: []),
		],
	};
});
