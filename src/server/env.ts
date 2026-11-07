/**
 * Server-only environment. Never import this from client code.
 *
 * Three layers keep it off the client:
 * 1. The marker import below, plus the `src/server/**` rule in vite.config.ts,
 *    makes TanStack Start's import protection fail the build on a client import.
 * 2. The guard below throws if this module is ever evaluated in a browser.
 * 3. tests/server/env-boundary.test.ts scans the source for forbidden imports.
 */
import "@tanstack/react-start/server-only";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { postgresUrl, throwEnvError } from "../lib/env/shared.ts";

if (typeof window !== "undefined") {
	throw new Error("src/server/env.ts is server-only and was loaded in a browser. Call a server function instead.");
}

const isEmail = (value: string) => z.email().safeParse(value).success;

/** An on/off setting written as "true" or "false", with its default when unset. */
const flag = (fallback: boolean) =>
	z
		.enum(["true", "false"], "Use true or false.")
		.default(fallback ? "true" : "false")
		.transform((value) => value === "true");

/** Accepts `hello@example.com` or `Portfolio <hello@example.com>`. */
const emailFrom = z
	.string({ error: (issue) => (issue.input === undefined ? "Required." : undefined) })
	.trim()
	.refine((value) => {
		const named = /^(.+?)\s*<([^<>]+)>$/.exec(value);
		return named?.[2] ? isEmail(named[2]) : isEmail(value);
	}, "Must be an email address, optionally with a name: 'Portfolio <hello@example.com>'.");

export const serverEnvSchema = {
	// Pooled Neon URL (host contains "-pooler"), used by the app at runtime.
	DATABASE_URL: postgresUrl("Required. Set it to your Neon connection string."),
	// Direct (unpooled) Neon URL for migrations. Optional; falls back to DATABASE_URL.
	DATABASE_URL_UNPOOLED: postgresUrl("").optional(),
	EMAIL_PROVIDER: z.enum(["console", "resend"]).optional(),
	RESEND_API_KEY: z.string().trim().startsWith("re_", "Resend API keys start with 're_'.").optional(),
	EMAIL_FROM: emailFrom,

	// Better Auth. The secret signs sessions and tokens: 32+ random characters,
	// e.g. `openssl rand -base64 32`. Rotating it signs everyone out.
	BETTER_AUTH_SECRET: z
		.string({
			error: (issue) =>
				issue.input === undefined ? "Required. Generate one with: openssl rand -base64 32" : undefined,
		})
		.min(32, "Must be at least 32 characters. Generate one with: openssl rand -base64 32"),
	// Public origin of the app, used for links in emails and OAuth callbacks.
	BETTER_AUTH_URL: z.url({
		protocol: /^https?$/,
		error: (issue) => (issue.input === undefined ? "Required, e.g. http://localhost:3000" : "Must be an http(s) URL."),
	}),
	// Optional Google sign-in. Set both or neither; the button only appears when both are set.
	GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
	GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
	// Users with any admin permission must turn on two-factor authentication before
	// they can use the admin area (decisions.md 0126). Off by default.
	AUTH_REQUIRE_ADMIN_2FA: flag(false),
	// Refuse passwords found in Have I Been Pwned's breach corpus on sign-up, reset and
	// change (only 5 characters of the SHA-1 hash leave the server). On by default (0127).
	AUTH_BREACHED_PASSWORD_CHECK: flag(true),
	// Optional Cloudflare Turnstile on register, forgot-password and sign-in-code (0128).
	// Set both or neither; unset, there's no captcha (the honeypot field still applies).
	TURNSTILE_SITE_KEY: z.string().trim().min(1).optional(),
	TURNSTILE_SECRET_KEY: z.string().trim().min(1).optional(),
	// Optional defaults for `pnpm db:seed-admin` (CLI flags override them).
	ADMIN_EMAIL: z.email().optional(),
	ADMIN_PASSWORD: z.string().min(12, "Use at least 12 characters for the admin password.").optional(),
	ADMIN_NAME: z.string().trim().min(1).optional(),
	// Optional default password for `pnpm db:seed-demo`'s users (development data).
	DEMO_PASSWORD: z.string().min(12, "Use at least 12 characters for the demo password.").optional(),
	// PostHog feature flags evaluated on this server instead of one request per page render
	// (decision 0154): a Project Secret API Key (phs_...) or Personal API Key (phx_...).
	// Unset: flags are fetched with a 300 ms timeout and cached for 30 s.
	POSTHOG_SECRET_KEY: z
		.string()
		.trim()
		.regex(/^ph[sx]_/, "Use a PostHog Project Secret API Key (phs_...) or Personal API Key (phx_...).")
		.optional(),
	// Sentry source map upload during `pnpm build` (all three or none). Never needed at runtime.
	SENTRY_AUTH_TOKEN: z.string().trim().min(1).optional(),
	SENTRY_ORG: z.string().trim().min(1).optional(),
	SENTRY_PROJECT: z.string().trim().min(1).optional(),
	// Cloudinary (attachments). All three or none; without them uploads are disabled.
	CLOUDINARY_CLOUD_NAME: z
		.string()
		.trim()
		.regex(/^[a-z0-9_-]+$/i, "Use the cloud name from the Cloudinary console.")
		.optional(),
	CLOUDINARY_API_KEY: z.string().trim().regex(/^\d+$/, "Cloudinary API keys are numeric.").optional(),
	CLOUDINARY_API_SECRET: z.string().trim().min(10).optional(),
	/** Top-level folder (public_id prefix) for this app's uploads. */
	CLOUDINARY_FOLDER: z
		.string()
		.trim()
		.regex(/^[a-z0-9_-]+$/i)
		.default("portfolio"),
	/** API and delivery hosts; override only for a proxy or a local stand-in. */
	CLOUDINARY_API_BASE: z.url().default("https://api.cloudinary.com"),
	CLOUDINARY_DELIVERY_BASE: z.url().default("https://res.cloudinary.com"),
	/** Bearer token for scheduled jobs (/api/cron/*); Vercel Cron sends it. Unset: the routes answer 404. */
	CRON_SECRET: z.string().trim().min(16).optional(),
	// parda:start
	// TMDB's API read token: Parda's catalogue. Without it the catalogue is "not configured".
	TMDB_READ_TOKEN: z.string().trim().min(20, "Use the API read access token from your TMDB settings.").optional(),
	/** API and image hosts; override only for a proxy or a local stand-in. */
	TMDB_API_BASE: z.url().default("https://api.themoviedb.org/3"),
	TMDB_IMAGE_BASE: z.url().default("https://image.tmdb.org/t/p"),
	/** Where Parda's relative source templates live, when the player isn't served by this app. */
	PARDA_PLAYER_BASE: z.url({ protocol: /^https?$/ }).optional(),
	/** Bearer token for the daily source probe (/api/parda/probe). Unset: the route answers 404. */
	PARDA_PROBE_SECRET: z.string().trim().min(16).optional(),
	/** The realtime service's API key for watch parties (`appId.keyId:secret`). Unset: the party's UI is hidden. */
	PARDA_REALTIME_KEY: z
		.string()
		.trim()
		.regex(/^[^:\s]+:\S+$/, "Use the whole key, name and secret, from Ably's dashboard.")
		.optional(),
	/** The e2e suite's stand-in for the realtime service (ws://). Leave unset everywhere else. */
	PARDA_REALTIME_URL: z.url({ protocol: /^wss?$/ }).optional(),
	// parda:end
};

export const createServerEnv = (runtimeEnv: Record<string, string | undefined>) =>
	createEnv({
		server: serverEnvSchema,
		runtimeEnv,
		emptyStringAsUndefined: true,
		// Cross-field rules: Resend needs its key; Google needs both id and secret.
		createFinalSchema: (shape) =>
			z.object(shape).superRefine((env, ctx) => {
				if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
					ctx.addIssue({
						code: "custom",
						path: [env.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
						message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.",
					});
				}
				if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
					ctx.addIssue({
						code: "custom",
						path: [env.TURNSTILE_SITE_KEY ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY"],
						message: "Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither.",
					});
				}
				const sentryUpload = [env.SENTRY_AUTH_TOKEN, env.SENTRY_ORG, env.SENTRY_PROJECT].filter(Boolean).length;
				if (sentryUpload !== 0 && sentryUpload !== 3) {
					ctx.addIssue({
						code: "custom",
						path: ["SENTRY_AUTH_TOKEN"],
						message: "Set SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT together, or none of them.",
					});
				}
				const cloudinary = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET].filter(
					Boolean,
				).length;
				if (cloudinary !== 0 && cloudinary !== 3) {
					ctx.addIssue({
						code: "custom",
						path: ["CLOUDINARY_CLOUD_NAME"],
						message:
							"Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET together, or none of them.",
					});
				}
				if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
					ctx.addIssue({
						code: "custom",
						path: ["RESEND_API_KEY"],
						message: "Required when EMAIL_PROVIDER is 'resend'.",
					});
				}
			}),
		onValidationError: throwEnvError("server"),
	});

/** Validated server environment. Validation runs once, when the server starts. */
export const serverEnv = createServerEnv(process.env);
