import { notFound, redirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zodInput } from "@/functions/_lib/validator";
import { isStaleError } from "@/lib/concurrency";
import { APP_ERROR_CODES, AppError, appErrorSerializationAdapter, HTTP_STATUS, isAppError } from "@/lib/errors";
import { normalizeServerError } from "@/middleware/errors";

describe("AppError", () => {
	it("maps every code to an HTTP status", () => {
		for (const code of APP_ERROR_CODES) expect(new AppError(code).status).toBe(HTTP_STATUS[code]);
	});

	it("round-trips through the serialization adapter as a real AppError", () => {
		const original = new AppError("BAD_REQUEST", "Invalid input", {
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
			code: "BAD_REQUEST",
			status: 400,
			message: "Invalid input",
			fieldErrors: { email: ["Invalid email"] },
			requestId: "req-1",
		});
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
		expect(result).toMatchObject({ code: "FORBIDDEN", status: 403, requestId: "req-9" });
	});

	it("turns a ZodError into BAD_REQUEST with field errors", () => {
		const parsed = z.object({ email: z.email() }).safeParse({ email: "x" });
		if (parsed.success) throw new Error("expected failure");
		const result = normalizeServerError(parsed.error, "req-2");
		expect(result).toMatchObject({ code: "BAD_REQUEST", requestId: "req-2" });
		expect((result as AppError).fieldErrors?.email).toHaveLength(1);
	});

	it("hides unknown errors behind INTERNAL and logs the original on the server", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = normalizeServerError(new Error("db password=hunter2 at 10.0.0.5"), "req-3");

		expect(result).toBeInstanceOf(AppError);
		expect((result as AppError).toShape()).toEqual({
			code: "INTERNAL",
			status: 500,
			message: "Internal error",
			requestId: "req-3",
		});
		expect(JSON.stringify((result as AppError).toShape())).not.toContain("hunter2");
		expect(log).toHaveBeenCalledOnce();
		expect(String(log.mock.calls[0]?.[0])).toContain("hunter2");
	});

	it("handles non-Error throwables", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(normalizeServerError("a string", "req-4")).toMatchObject({ code: "INTERNAL", requestId: "req-4" });
	});
});

describe("zodInput", () => {
	const validator = zodInput(z.object({ name: z.string().min(2), tags: z.array(z.string().min(1)) }));

	it("returns parsed data for valid input", () => {
		expect(validator.parse({ name: "Ada", tags: ["x"] })).toEqual({ name: "Ada", tags: ["x"] });
	});

	it("throws BAD_REQUEST with dotted field paths for invalid input", () => {
		try {
			validator.parse({ name: "A", tags: [""] });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect((error as AppError).code).toBe("BAD_REQUEST");
			expect(Object.keys((error as AppError).fieldErrors ?? {}).sort()).toEqual(["name", "tags.0"]);
		}
	});
});
