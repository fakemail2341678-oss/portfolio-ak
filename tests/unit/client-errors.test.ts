import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleClientError } from "@/server/http/client-errors";
import { createReportLimiter } from "@/server/http/csp-report";

/** The browser's errors in the server log when Sentry is off (decision 0300). */
describe("handleClientError (the server's half)", () => {
	const report = {
		source: "error",
		name: "TypeError",
		message: "Cannot read properties of undefined (reading 'id')",
		stack: "TypeError: Cannot read…\n    at Board (board.tsx:12:3)",
		url: "https://app.test/app/taskline/p/1?token=abc#x",
		requestId: "req-42",
	};

	it("logs one error line: the page without its query, and the request that failed", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const limiter = createReportLimiter({ perClient: 10, total: 100 });
		const response = handleClientError(report, { client: "1.2.3.4", limiter, userAgent: "Firefox/140" });
		expect(response.status).toBe(204);
		const line = JSON.parse(String(error.mock.calls[0]?.[0]));
		expect(line).toMatchObject({
			level: "error",
			msg: "client error",
			source: "error",
			name: "TypeError",
			page: "https://app.test/app/taskline/p/1",
			failedRequestId: "req-42",
			userAgent: "Firefox/140",
		});
		expect(JSON.stringify(line)).not.toContain("token=abc");
	});

	it("refuses a report of another shape, and a client past its budget", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const limiter = createReportLimiter({ perClient: 1, total: 100 });
		expect(() => handleClientError({ message: 1 }, { client: "a", limiter, userAgent: null })).toThrow();
		expect(() =>
			handleClientError({ ...report, message: "x".repeat(501) }, { client: "a", limiter, userAgent: null }),
		).toThrow();
		handleClientError(report, { client: "a", limiter, userAgent: null });
		expect(() => handleClientError(report, { client: "a", limiter, userAgent: null })).toThrow(
			expect.objectContaining({ code: "RATE_LIMITED" }),
		);
	});
});

describe("reportClientError (the browser's half)", () => {
	const fetch = vi.fn(async () => new Response(null, { status: 204 }));

	beforeEach(() => {
		vi.stubGlobal("fetch", fetch);
		vi.stubGlobal("window", { location: { href: "https://app.test/admin" } });
		vi.resetModules();
		fetch.mockClear();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("sends each error once, five at most, and never a refusal the server already logged", async () => {
		// After resetModules: the AppError class the reporter checks against is this one.
		const [{ reportClientError, CLIENT_ERRORS_PATH }, { AppError }] = await Promise.all([
			import("@/lib/observability/client-errors"),
			import("@/lib/errors"),
		]);
		reportClientError(new AppError("FORBIDDEN"), "boundary");
		reportClientError(new AppError("INTERNAL", "Internal error", { requestId: "req-1" }), "boundary");
		reportClientError(new TypeError("boom"), "error");
		reportClientError(new TypeError("boom"), "error");
		for (let index = 0; index < 10; index++) reportClientError(new Error(`other ${index}`), "unhandledrejection");
		expect(fetch).toHaveBeenCalledTimes(5);
		const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(path).toBe(CLIENT_ERRORS_PATH);
		expect(init).toMatchObject({ method: "POST", keepalive: true });
		expect(JSON.parse(String(init.body))).toMatchObject({
			source: "boundary",
			name: "AppError",
			requestId: "req-1",
			url: "https://app.test/admin",
		});
	});
});
