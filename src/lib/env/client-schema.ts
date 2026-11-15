import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { throwEnvError } from "./shared.ts";

/**
 * Client (public) environment schema. Every key must start with VITE_,
 * because Vite inlines these values into the browser bundle at build time.
 *
 * Kept separate from client-env.ts so vite.config.ts can validate the same
 * schema at startup, where `import.meta.env` does not exist yet.
 */
export const clientEnvSchema = {
	VITE_APP_TITLE: z
		.string({ error: (issue) => (issue.input === undefined ? "Required. Used in the header and <title>." : undefined) })
		.trim()
		.min(1, "Required. Used in the header and <title>.")
		.max(60),
	VITE_SITE_URL: z
		.url({
			error: (issue) =>
				issue.input === undefined
					? "Required. The public origin, e.g. https://example.com."
					: "Must be an absolute URL, e.g. https://example.com.",
		})
		// Zod runs refinements even after .url() fails, so parse defensively.
		.refine(
			(value) => !URL.canParse(value) || (new URL(value).pathname === "/" && !value.endsWith("/")),
			"Origin only: no path and no trailing slash, e.g. https://example.com.",
		)
		.refine(
			(value) => !URL.canParse(value) || /^https?:$/.test(new URL(value).protocol),
			"Must start with http:// or https://.",
		),

	// Observability (all optional). Unset = that service is off and makes no network calls.
	// Sentry DSNs and PostHog project keys are public by design (they only allow sending data).
	VITE_SENTRY_DSN: z.url("Must be the DSN URL from Sentry project settings.").optional(),
	// Development only: trace every request and navigation (off by default, it slows `pnpm dev`).
	VITE_SENTRY_DEV_TRACING: z.enum(["true", "false"], "Must be true or false.").optional(),
	VITE_POSTHOG_KEY: z.string().trim().startsWith("phc_", "PostHog project API keys start with 'phc_'.").optional(),
	VITE_POSTHOG_HOST: z.url("Must be your PostHog ingest host, e.g. https://eu.i.posthog.com.").optional(),

	// For the e2e harness only: keep the /dev pages in a build (src/lib/dev-routes.ts). Never in production:
	// the build and the server refuse it when VERCEL_ENV is "production" (devRoutesInProduction).
	VITE_DEV_ROUTES: z.enum(["true", "false"], "Must be true or false.").optional(),
};

/** True when a production deploy would ship the /dev pages; vite.config.ts and the server boot refuse it. */
export const devRoutesInProduction = (env: Record<string, string | boolean | number | undefined>) =>
	env.VITE_DEV_ROUTES === "true" && env.VERCEL_ENV === "production";

export const DEV_ROUTES_IN_PRODUCTION =
	"VITE_DEV_ROUTES=true is for the e2e harness only: it would publish the /dev pages in production. Unset it.";

export const createClientEnv = (runtimeEnv: Record<string, string | boolean | number | undefined>) =>
	createEnv({
		clientPrefix: "VITE_",
		client: clientEnvSchema,
		runtimeEnv,
		emptyStringAsUndefined: true,
		onValidationError: throwEnvError("client"),
	});
