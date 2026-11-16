import { notFound, redirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zodInput } from "@/functions/_lib/validator";
import { isStaleError } from "@/lib/concurrency";
import {
	APP_ERROR_CODES,
	AppError,
	appErrorSerializationAdapter,
	HTTP_STATUS,
	internalError,
	isAppError,
	isRefusal,
} from "@/lib/errors";
import { normalizeServerError, problemResponse, toAppError, toEnvelope, withDeadline } from "@/server/http/errors";
import { UpstreamError } from "@/server/http/outbound";

/** What the server wrote while `run` ran: its log lines, parsed. */
const logged = (run: () => unknown) => {
	const lines: Array<Record<string, unknown>> = [];
	const collect = (line: string) => lines.push(JSON.parse(line));
	vi.spyOn(console, "error").mockImplementation(collect);
	vi.spyOn(console, "warn").mockImplementation(collect);
	const result = run();
	return { result, lines };
};

/** A node-postgres error as Drizzle hands it on: the driver's error is the cause. */
const pgError = (code: string, constraint?: string) =>
	new Error("Failed query: insert into …", {
		cause: Object.assign(new Error("the driver said no"), {
			code,
			severity: "ERROR",
			...(constraint ? { constraint } : {}),
		}),
	});

describe("AppError", () => {
	it("maps every code to an HTTP status", () => {
		for (const code of APP_ERROR_CODES) expect(new AppError(code).status).toBe(HTTP_STATUS[code]);
	});

	it("round-trips through the serialization adapter as a real AppError", () => {
		const original = new AppError("VALIDATION", "Invalid input", {
			fieldErrors: { email: ["Invalid email"] },
			requestId: "req-1",
		});
		expect(appErrorSerializationAdapter.test(original)).toBe(true);
		expect(appErrorSerializationAdapter.test(new Error("plain"))).toBe(false);

		const wire = JSON.parse(JSON.stringify(appErrorSerializationAdapter.toSerializable(original)));
		const rebuilt = appErrorSerializationAdapter.fromSerializable(wire);

		expect(rebuilt).toBeInstanceOf(AppError);
		expect(isAppError(rebuilt)).toBe(true);
		expect(rebuilt.toShape()).toEqual({
			code: "VALIDATION",
			status: 422,
			message: "Invalid input",
			fieldErrors: { email: ["Invalid email"] },
			requestId: "req-1",
		});
	});

	it("tells a refusal (below 500) from an unknown outcome", () => {
		expect(isRefusal(new AppError("FORBIDDEN"))).toBe(true);
		expect(isRefusal(new AppError("VALIDATION"))).toBe(true);
		for (const code of ["INTERNAL", "UPSTREAM_UNAVAILABLE", "TIMEOUT"] as const) {
			expect(isRefusal(new AppError(code))).toBe(false);
		}
		expect(isRefusal(new TypeError("Failed to fetch"))).toBe(false);
	});
});

describe("AppError reason", () => {
	it("survives the wire and withRequestId", () => {
		const stale = new AppError("CONFLICT", "changed", { reason: "stale" });
		const wire = JSON.parse(JSON.stringify(appErrorSerializationAdapter.toSerializable(stale)));
		expect(appErrorSerializationAdapter.fromSerializable(wire)).toMatchObject({ code: "CONFLICT", reason: "stale" });
		expect(stale.withRequestId("req-5")).toMatchObject({ code: "CONFLICT", reason: "stale", requestId: "req-5" });
		expect(isStaleError(stale)).toBe(true);
		expect(isStaleError(new AppError("CONFLICT"))).toBe(false);
	});
});

describe("normalizeServerError", () => {
	it("passes router redirects and notFound through untouched", () => {
		const redirectError = redirect({ to: "/login" });
		const notFoundError = notFound();
		expect(normalizeServerError(redirectError, "r")).toBe(redirectError);
		expect(normalizeServerError(notFoundError, "r")).toBe(notFoundError);
	});

	it("keeps an AppError's code and attaches the request id", () => {
		const result = normalizeServerError(new AppError("FORBIDDEN", "nope"), "req-9");
		expect(result).toBeInstanceOf(AppError);
		expect(result).toMatchObject({ code: "FORBIDDEN", status: 403, message: "nope", requestId: "req-9" });
	});

	it("turns a ZodError into VALIDATION with field errors", () => {
		const parsed = z.object({ email: z.email() }).safeParse({ email: "x" });
		if (parsed.success) throw new Error("expected failure");
		const { result } = logged(() => normalizeServerError(parsed.error, "req-2"));
		expect(result).toMatchObject({ code: "VALIDATION", status: 422, requestId: "req-2" });
		expect((result as AppError).fieldErrors?.email).toHaveLength(1);
	});

	// That it reaches Sentry with the request's id is tests/server/request-scope.test.ts.
	it("hides unknown errors behind INTERNAL and logs the original, redacted, with its stack", () => {
		const { result, lines } = logged(() => normalizeServerError(new Error("db password=hunter2 at 10.0.0.5"), "req-3"));

		expect(result).toBeInstanceOf(AppError);
		expect((result as AppError).toShape()).toEqual({
			code: "INTERNAL",
			status: 500,
			message: "Internal error",
			requestId: "req-3",
		});
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			level: "error",
			msg: "unexpected error",
			error: "db password=[redacted] at 10.0.0.5",
			stack: expect.stringContaining("errors.test.ts"),
		});
		expect(JSON.stringify(lines)).not.toContain("hunter2");
	});

	it("handles non-Error throwables", () => {
		const { result } = logged(() => normalizeServerError("a string", "req-4"));
		expect(result).toMatchObject({ code: "INTERNAL", requestId: "req-4" });
	});
});

describe("the one mapping of what was thrown (toAppError)", () => {
	const codeOf = (error: unknown) => toAppError(error).error.code;

	it("maps the database's errors, wherever they are in the cause chain", () => {
		expect(toAppError(pgError("23505", "user_email_unique")).error).toMatchObject({
			code: "CONFLICT",
			message: "A row with this value exists (user_email_unique)",
		});
		expect(codeOf(pgError("23503", "tl_task_project_id_fk"))).toBe("CONFLICT");
		expect(codeOf(pgError("23514", "kh_expense_amount_check"))).toBe("BAD_REQUEST");
		expect(codeOf(pgError("22P02"))).toBe("BAD_REQUEST");
		expect(codeOf(pgError("57014"))).toBe("TIMEOUT");
		expect(codeOf(pgError("08006"))).toBe("UPSTREAM_UNAVAILABLE");
		expect(codeOf(pgError("53300"))).toBe("UPSTREAM_UNAVAILABLE");
		// A SQLSTATE nobody planned for is a bug, not the caller's fault.
		expect(codeOf(pgError("42P01"))).toBe("INTERNAL");
	});

	it("says a lost race can be sent again", () => {
		for (const code of ["40001", "40P01"]) {
			expect(toAppError(pgError(code)).error).toMatchObject({ code: "CONFLICT", reason: "retry" });
		}
	});

	it("maps a connection that failed, a timeout and another service's failure", () => {
		const refused = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), { code: "ECONNREFUSED" });
		expect(codeOf(new Error("Failed query: select 1", { cause: refused }))).toBe("UPSTREAM_UNAVAILABLE");
		expect(codeOf(new Error("Connection terminated unexpectedly"))).toBe("UPSTREAM_UNAVAILABLE");
		expect(codeOf(new DOMException("timed out", "TimeoutError"))).toBe("TIMEOUT");
		expect(codeOf(new UpstreamError("tmdb", "timeout", "no answer in 8000 ms"))).toBe("UPSTREAM_UNAVAILABLE");
		expect(codeOf(new UpstreamError("tmdb", "too-large", "an answer over 5 bytes"))).toBe("UPSTREAM_UNAVAILABLE");
		// A call to a host that isn't the service's is our bug.
		expect(codeOf(new UpstreamError("tmdb", "blocked", "https://evil.test is not one of its hosts"))).toBe("INTERNAL");
	});

	it("maps Better Auth's API errors by their status", () => {
		const apiError = (statusCode: number) => Object.assign(new Error("nope"), { name: "APIError", statusCode });
		expect(codeOf(apiError(401))).toBe("UNAUTHORIZED");
		expect(codeOf(apiError(403))).toBe("FORBIDDEN");
		expect(codeOf(apiError(429))).toBe("RATE_LIMITED");
		expect(codeOf(apiError(500))).toBe("INTERNAL");
	});

	it("keeps an AppError as it is, and says what was mapped", () => {
		const refusal = new AppError("NOT_FOUND", "gone");
		expect(toAppError(refusal)).toEqual({ error: refusal, foreign: false });
		expect(toAppError(pgError("23505")).foreign).toBe(true);
	});
});

describe("the envelope (toEnvelope)", () => {
	it("says nothing of the server in a 5xx message, and logs a mapped error with its cause chain", () => {
		const { result, lines } = logged(() => toEnvelope(pgError("08006"), "req-6"));
		expect((result as AppError).toShape()).toEqual({
			code: "UPSTREAM_UNAVAILABLE",
			status: 503,
			message: "A service is unavailable",
			requestId: "req-6",
		});
		expect(lines).toEqual([
			expect.objectContaining({
				level: "warn",
				msg: "mapped error",
				code: "UPSTREAM_UNAVAILABLE",
				error: "Failed query: insert into …",
				causes: ["Error: the driver said no [08006]"],
			}),
		]);
		expect(lines[0]).not.toHaveProperty("stack");
	});

	it("treats a broken invariant as a bug: INTERNAL, its message only in the log", () => {
		const { result, lines } = logged(() => toEnvelope(internalError("Role insert returned no row"), "req-7"));
		expect(result).toMatchObject({ code: "INTERNAL", message: "Internal error", requestId: "req-7" });
		expect(lines[0]).toMatchObject({ level: "error", msg: "unexpected error", error: "Role insert returned no row" });
	});

	it("logs nothing for a refusal the code meant", () => {
		const { lines } = logged(() => toEnvelope(new AppError("FORBIDDEN", "Missing permission: roles:manage"), "req-8"));
		expect(lines).toEqual([]);
	});

	it("is problem JSON for a server route, with the same fields", async () => {
		const response = problemResponse(
			new AppError("VALIDATION", "Invalid input", { fieldErrors: { name: ["Too short"] }, requestId: "req-9" }),
		);
		expect(response.status).toBe(422);
		expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({
			type: "about:blank",
			title: "Invalid input",
			status: 422,
			code: "VALIDATION",
			message: "Invalid input",
			fieldErrors: { name: ["Too short"] },
			requestId: "req-9",
		});
	});
});

describe("withDeadline", () => {
	it("answers TIMEOUT when the work takes longer, and passes the work through otherwise", async () => {
		expect(await withDeadline(Promise.resolve("done"), 50, "x")).toBe("done");
		expect(await withDeadline(Promise.resolve("no limit"), 0, "x")).toBe("no limit");
		const slow = withDeadline(new Promise(() => {}), 5, "listThings").catch((error: unknown) => error);
		expect(await slow).toMatchObject({ code: "TIMEOUT", status: 504, message: "listThings took longer than 5 ms" });
	});
});

describe("zodInput", () => {
	const validator = zodInput(z.object({ name: z.string().min(2), tags: z.array(z.string().min(1)) }));

	it("returns parsed data for valid input", () => {
		expect(validator.parse({ name: "Ada", tags: ["x"] })).toEqual({ name: "Ada", tags: ["x"] });
	});

	it("throws VALIDATION with dotted field paths for invalid input", () => {
		try {
			validator.parse({ name: "A", tags: [""] });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect((error as AppError).code).toBe("VALIDATION");
			expect(Object.keys((error as AppError).fieldErrors ?? {}).sort()).toEqual(["name", "tags.0"]);
		}
	});
});
