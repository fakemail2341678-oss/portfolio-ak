import { beforeAll, describe, expect, it, vi } from "vitest";
import { createClientEnv } from "@/lib/env/client.schema";
import { EnvValidationError } from "@/lib/env/shared";

const validServer = {
	DATABASE_URL: "postgresql://user:pass@ep-x-123.us-east-2.aws.neon.tech/neondb?sslmode=require",
	EMAIL_PROVIDER: "console",
	EMAIL_FROM: "Portfolio <hello@example.com>",
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
	BETTER_AUTH_URL: "http://localhost:3000",
};

// src/server/env.ts validates process.env when imported, so give it valid values first.
let createServerEnv: typeof import("@/server/env").createServerEnv;
beforeAll(async () => {
	for (const [key, value] of Object.entries(validServer)) vi.stubEnv(key, value);
	({ createServerEnv } = await import("@/server/env"));
});

const serverError = (env: Record<string, string | undefined>) => {
	try {
		createServerEnv(env);
	} catch (error) {
		return error;
	}
	throw new Error("expected validation to fail");
};

describe("server env", () => {
	it("accepts a valid configuration", () => {
		expect(createServerEnv({ ...validServer }).DATABASE_URL).toBe(validServer.DATABASE_URL);
	});

	it("accepts postgres:// and a bare EMAIL_FROM address", () => {
		const env = createServerEnv({ ...validServer, DATABASE_URL: "postgres://u:p@localhost/db", EMAIL_FROM: "a@b.co" });
		expect(env.EMAIL_FROM).toBe("a@b.co");
	});

	it("names every missing required variable", () => {
		const error = serverError({});
		expect(error).toBeInstanceOf(EnvValidationError);
		expect((error as Error).message).toMatch(/Invalid server environment variables/);
		expect((error as Error).message).toMatch(/- DATABASE_URL: Required/);
		expect((error as Error).message).toMatch(/- EMAIL_FROM: Required/);
	});

	it("rejects a non-Postgres DATABASE_URL", () => {
		const error = serverError({ ...validServer, DATABASE_URL: "mysql://u:p@localhost/db" });
		expect((error as Error).message).toMatch(/DATABASE_URL: Must be a Postgres connection URL/);
	});

	it("rejects an invalid EMAIL_FROM", () => {
		const error = serverError({ ...validServer, EMAIL_FROM: "Portfolio <not-an-email>" });
		expect((error as Error).message).toMatch(/EMAIL_FROM:/);
	});

	// parda:start
	it("Parda: TMDB's token is optional, its hosts have defaults, and a player base must be http(s)", () => {
		expect(createServerEnv({ ...validServer })).toMatchObject({
			TMDB_API_BASE: "https://api.themoviedb.org/3",
			TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p",
		});
		expect(createServerEnv({ ...validServer }).TMDB_READ_TOKEN).toBeUndefined();
		expect((serverError({ ...validServer, TMDB_READ_TOKEN: "short" }) as Error).message).toMatch(/TMDB_READ_TOKEN/);
		expect((serverError({ ...validServer, PARDA_PLAYER_BASE: "ftp://x.example.com" }) as Error).message).toMatch(
			/PARDA_PLAYER_BASE/,
		);
		expect(createServerEnv({ ...validServer }).PARDA_PROBE_SECRET).toBeUndefined();
		expect(createServerEnv({ ...validServer }).PARDA_REALTIME_KEY).toBeUndefined();
		expect(createServerEnv({ ...validServer, PARDA_REALTIME_KEY: "app.key:secret" }).PARDA_REALTIME_KEY).toBe(
			"app.key:secret",
		);
		expect((serverError({ ...validServer, PARDA_REALTIME_KEY: "no-secret" }) as Error).message).toMatch(
			/PARDA_REALTIME_KEY/,
		);
		expect((serverError({ ...validServer, PARDA_PROBE_SECRET: "short" }) as Error).message).toMatch(
			/PARDA_PROBE_SECRET/,
		);
	});
	// parda:end

	it("Cloudinary: all three or none; a numeric key; defaults for folder and hosts", () => {
		const cloudinary = {
			CLOUDINARY_CLOUD_NAME: "my-cloud",
			CLOUDINARY_API_KEY: "123456789012345",
			CLOUDINARY_API_SECRET: "a-long-enough-secret",
		};
		const env = createServerEnv({ ...validServer, ...cloudinary });
		expect(env).toMatchObject({
			CLOUDINARY_FOLDER: "portfolio",
			CLOUDINARY_API_BASE: "https://api.cloudinary.com",
			CLOUDINARY_DELIVERY_BASE: "https://res.cloudinary.com",
		});
		expect(createServerEnv({ ...validServer }).CLOUDINARY_CLOUD_NAME).toBeUndefined();
		expect((serverError({ ...validServer, CLOUDINARY_CLOUD_NAME: "my-cloud" }) as Error).message).toMatch(
			/Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET together/,
		);
		expect((serverError({ ...validServer, ...cloudinary, CLOUDINARY_API_KEY: "abc123" }) as Error).message).toMatch(
			/CLOUDINARY_API_KEY: Cloudinary API keys are numeric/,
		);
	});

	it("rejects an unknown EMAIL_PROVIDER", () => {
		const error = serverError({ ...validServer, EMAIL_PROVIDER: "smtp" });
		expect((error as Error).message).toMatch(/EMAIL_PROVIDER:/);
	});

	it("requires RESEND_API_KEY when EMAIL_PROVIDER is resend", () => {
		const error = serverError({ ...validServer, EMAIL_PROVIDER: "resend" });
		expect((error as Error).message).toMatch(/RESEND_API_KEY: Required when EMAIL_PROVIDER is 'resend'/);
		expect(createServerEnv({ ...validServer, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_123" }).RESEND_API_KEY).toBe(
			"re_123",
		);
	});

	it("treats empty strings as missing", () => {
		const error = serverError({ ...validServer, DATABASE_URL: "" });
		expect((error as Error).message).toMatch(/- DATABASE_URL:/);
	});

	it("never includes variable values in the error message", () => {
		const secret = "mysql://user:SUPER_SECRET@localhost/db";
		const error = serverError({ ...validServer, DATABASE_URL: secret });
		expect((error as Error).message).not.toContain("SUPER_SECRET");
	});
});

describe("client env", () => {
	const valid = { VITE_APP_TITLE: "Portfolio", VITE_SITE_URL: "https://example.com" };

	it("accepts a valid title and site URL", () => {
		const env = createClientEnv(valid);
		expect(env.VITE_APP_TITLE).toBe("Portfolio");
		expect(env.VITE_SITE_URL).toBe("https://example.com");
	});

	it("fails with a clear message when the title is missing or blank", () => {
		expect(() => createClientEnv({ VITE_SITE_URL: valid.VITE_SITE_URL })).toThrow(
			/Invalid client environment variables:\n {2}- VITE_APP_TITLE:/,
		);
		expect(() => createClientEnv({ ...valid, VITE_APP_TITLE: "   " })).toThrow(/VITE_APP_TITLE/);
	});

	it("requires VITE_SITE_URL to be a bare http(s) origin", () => {
		expect(() => createClientEnv({ VITE_APP_TITLE: "Portfolio" })).toThrow(/VITE_SITE_URL: Required/);
		expect(() => createClientEnv({ ...valid, VITE_SITE_URL: "example.com" })).toThrow(/VITE_SITE_URL/);
		expect(() => createClientEnv({ ...valid, VITE_SITE_URL: "https://example.com/" })).toThrow(/Origin only/);
		expect(() => createClientEnv({ ...valid, VITE_SITE_URL: "https://example.com/app" })).toThrow(/Origin only/);
		expect(() => createClientEnv({ ...valid, VITE_SITE_URL: "ftp://example.com" })).toThrow(/http/);
	});

	it("does not expose unprefixed variables", () => {
		const env = createClientEnv({ ...valid, DATABASE_URL: "postgres://x" });
		expect(Object.keys(env).every((key) => key.startsWith("VITE_"))).toBe(true);
		expect(env).not.toHaveProperty("DATABASE_URL");
	});
});

describe("server env: auth", () => {
	const base = {
		DATABASE_URL: "postgres://u:p@localhost/db",
		EMAIL_FROM: "a@b.co",
		BETTER_AUTH_SECRET: "x".repeat(32),
		BETTER_AUTH_URL: "http://localhost:3000",
	};
	let createServerEnv: typeof import("@/server/env").createServerEnv;
	beforeAll(async () => {
		({ createServerEnv } = await import("@/server/env"));
	});
	const failure = (env: Record<string, string | undefined>) => {
		try {
			createServerEnv(env);
		} catch (error) {
			return (error as Error).message;
		}
		return "";
	};

	it("requires a secret of at least 32 characters", () => {
		expect(failure({ ...base, BETTER_AUTH_SECRET: undefined })).toMatch(/BETTER_AUTH_SECRET: Required/);
		expect(failure({ ...base, BETTER_AUTH_SECRET: "short" })).toMatch(/BETTER_AUTH_SECRET: Must be at least 32/);
	});

	it("requires an http(s) BETTER_AUTH_URL", () => {
		expect(failure({ ...base, BETTER_AUTH_URL: "ftp://example.com" })).toMatch(
			/BETTER_AUTH_URL: Must be an http\(s\) URL/,
		);
	});

	it("needs both Google credentials or neither", () => {
		expect(failure({ ...base, GOOGLE_CLIENT_ID: "id" })).toMatch(/GOOGLE_CLIENT_SECRET: Set both/);
		expect(failure({ ...base, GOOGLE_CLIENT_SECRET: "secret" })).toMatch(/GOOGLE_CLIENT_ID: Set both/);
		expect(createServerEnv({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }).GOOGLE_CLIENT_ID).toBe(
			"id",
		);
	});

	it("validates optional admin seed values", () => {
		expect(failure({ ...base, ADMIN_PASSWORD: "too-short" })).toMatch(/ADMIN_PASSWORD/);
		expect(failure({ ...base, ADMIN_EMAIL: "not-an-email" })).toMatch(/ADMIN_EMAIL/);
	});
});
