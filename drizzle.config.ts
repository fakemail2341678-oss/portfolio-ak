import { existsSync } from "node:fs";
import { createEnv } from "@t3-oss/env-core";
import { defineConfig } from "drizzle-kit";
import { postgresUrl, throwEnvError } from "./src/lib/env/shared.ts";
import { withVerifiedSsl } from "./src/server/db/connection-string.ts";

// drizzle-kit doesn't read .env files. Real environment variables still win.
if (existsSync(".env")) process.loadEnvFile(".env");

// Validate only what migrations need, so a CI migrate step doesn't require app secrets.
const env = createEnv({
	server: {
		DATABASE_URL: postgresUrl("Required. Set it to your Neon connection string."),
		DATABASE_URL_UNPOOLED: postgresUrl("").optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	onValidationError: throwEnvError("server"),
});

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/server/db/schema/index.ts",
	out: "./drizzle",
	casing: "snake_case",
	// Migrations use a direct connection. PgBouncer's transaction mode can break DDL and advisory locks.
	dbCredentials: { url: withVerifiedSsl(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL) },
	strict: true,
	verbose: true,
});
