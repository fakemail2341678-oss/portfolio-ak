import { describe, expect, it, vi } from "vitest";
import { errorFields, log, redact } from "@/server/log";

/** The lines `run` wrote, parsed, by level. */
const lines = (run: () => void) => {
	const out: Array<Record<string, unknown>> = [];
	const collect = (line: string) => out.push(JSON.parse(line));
	vi.spyOn(console, "info").mockImplementation(collect);
	vi.spyOn(console, "warn").mockImplementation(collect);
	vi.spyOn(console, "error").mockImplementation(collect);
	run();
	return out;
};

describe("log", () => {
	it("writes one JSON line with the standard fields first, at its level", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		log("error", "something failed", { count: 2 });
		const line = String(error.mock.calls[0]?.[0]);
		expect(line).not.toContain("\n");
		expect(Object.keys(JSON.parse(line))).toEqual(["time", "level", "msg", "count"]);
		expect(JSON.parse(line)).toMatchObject({ level: "error", msg: "something failed", count: 2 });
	});

	it("never fails on a value JSON can't hold", () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const [line] = lines(() => log("warn", "odd value", { cycle, big: 10n }));
		expect(line).toMatchObject({ level: "warn", msg: "odd value" });
	});
});

describe("redact", () => {
	it("drops every field named like a secret, at any depth", () => {
		expect(
			redact({
				password: "hunter2",
				newPassword: "x",
				token: "t",
				accessToken: "a",
				authorization: "Bearer abc",
				cookie: "s=1",
				apiKey: "k",
				client_secret: "c",
				otp: "123456",
				nested: { refreshToken: "r", ok: 1, list: [{ secret: "s" }] },
				tokenCount: 3,
			}),
		).toEqual({
			password: "[redacted]",
			newPassword: "[redacted]",
			token: "[redacted]",
			accessToken: "[redacted]",
			authorization: "[redacted]",
			cookie: "[redacted]",
			apiKey: "[redacted]",
			client_secret: "[redacted]",
			otp: "[redacted]",
			nested: { refreshToken: "[redacted]", ok: 1, list: [{ secret: "[redacted]" }] },
			// Named after a count, not a secret.
			tokenCount: 3,
		});
	});

	it("scrubs secrets and addresses out of strings", () => {
		expect(redact("postgres://app:s3cret@db.example.com/main")).toBe("postgres://[redacted]@db.example.com/main");
		expect(redact("sent Bearer abcdefghijkl to the API")).toBe("sent Bearer [redacted] to the API");
		expect(redact("GET /cb?code_verifier=xyz&state=1&token=abc")).toBe(
			"GET /cb?code_verifier=[redacted]&state=1&token=[redacted]",
		);
		expect(redact("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N")).toBe(
			"jwt [redacted]",
		);
		expect(redact("invited aarav.shrestha@example.com.np")).toBe("invited a***@example.com.np");
	});

	it("keeps what isn't a secret, and leaves the value it was given alone", () => {
		const fields = { status: 200, ok: true, at: new Date("2026-11-16T00:00:00Z"), none: null, path: "/admin" };
		expect(redact(fields)).toEqual({ ...fields, at: "2026-11-16T00:00:00.000Z" });
		const given = { password: "hunter2" };
		redact(given);
		expect(given.password).toBe("hunter2");
	});

	it("cuts long and deep values", () => {
		expect(String(redact("x".repeat(5000))).length).toBe(4001);
		expect((redact(Array.from({ length: 80 }, (_, i) => i)) as unknown[]).length).toBe(50);
		let deep: Record<string, unknown> = { leaf: 1 };
		for (let i = 0; i < 10; i++) deep = { deep };
		expect(JSON.stringify(redact(deep))).toContain("[deep]");
	});
});

describe("errorFields", () => {
	it("keeps the message, its own name and the cause chain, not the stack of an expected failure", () => {
		const driver = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
		const fields = errorFields(new TypeError("Failed query: insert", { cause: driver }));
		expect(fields).toEqual({
			error: "Failed query: insert",
			errorName: "TypeError",
			causes: ["Error: duplicate key value violates unique constraint [23505]"],
		});
	});

	it("adds the stack for a failure nobody expected", () => {
		expect(errorFields(new Error("boom"), { stack: true }).stack).toContain("log.test.ts");
		expect(errorFields("a string")).toEqual({ error: "a string" });
	});

	it("is redacted on the way out", () => {
		const [line] = lines(() =>
			log("error", "db down", errorFields(new Error("connect failed", { cause: new Error("password=hunter2") }))),
		);
		expect(line?.causes).toEqual(["Error: password=[redacted]"]);
	});
});
