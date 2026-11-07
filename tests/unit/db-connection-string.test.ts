import { describe, expect, it } from "vitest";
import { withVerifiedSsl } from "@/server/db/connection-string";

const base = "postgresql://user:pw@ep-x-pooler.us-east-2.aws.neon.tech/neondb";

describe("withVerifiedSsl", () => {
	it.each(["prefer", "require", "verify-ca"])("upgrades sslmode=%s to verify-full", (mode) => {
		const url = new URL(withVerifiedSsl(`${base}?sslmode=${mode}&channel_binding=require`));
		expect(url.searchParams.get("sslmode")).toBe("verify-full");
		expect(url.searchParams.get("channel_binding")).toBe("require");
	});

	it("leaves verify-full, disable and missing sslmode untouched", () => {
		expect(new URL(withVerifiedSsl(`${base}?sslmode=verify-full`)).searchParams.get("sslmode")).toBe("verify-full");
		expect(new URL(withVerifiedSsl(`${base}?sslmode=disable`)).searchParams.get("sslmode")).toBe("disable");
		expect(new URL(withVerifiedSsl("postgres://u:p@localhost:5432/db")).searchParams.has("sslmode")).toBe(false);
	});

	it("respects an explicit libpq-compat opt-in", () => {
		const url = new URL(withVerifiedSsl(`${base}?uselibpqcompat=true&sslmode=require`));
		expect(url.searchParams.get("sslmode")).toBe("require");
	});

	it("preserves credentials, host and database", () => {
		const url = new URL(withVerifiedSsl(`${base}?sslmode=require`));
		expect([url.username, url.password, url.host, url.pathname]).toEqual([
			"user",
			"pw",
			"ep-x-pooler.us-east-2.aws.neon.tech",
			"/neondb",
		]);
	});
});
