import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { LOCALE_HEADER } from "@/lib/i18n/locale-header";
import { csrfMiddleware } from "@/middleware/csrf";
import { errorNormalizationMiddleware } from "@/middleware/errors";
import { localeFunctionMiddleware } from "@/middleware/locale";
import { logServerFn, requestLoggingMiddleware } from "@/middleware/logging";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * The global guards from src/start.ts, exercised through their own server/client
 * steps (the Start runtime that chains them isn't available under Vitest).
 */
type Step = (ctx: Record<string, unknown>) => unknown;
const stepOf = (middleware: unknown, side: "server" | "client") =>
	(middleware as { options: Record<string, Step> }).options[side] as Step;

afterEach(() => {
	overwriteGetLocale(() => "en");
});

describe("CSRF (server functions only)", () => {
	const run = async (headers: Record<string, string>, handlerType: "serverFn" | "router" = "serverFn") => {
		const next = vi.fn(async () => "passed");
		const request = new Request("https://app.example.com/_serverFn/abc", { method: "POST", headers });
		const result = await stepOf(csrfMiddleware, "server")({ request, handlerType, next });
		return { next, result };
	};

	it("lets same-origin calls through (Sec-Fetch-Site, else Origin, else Referer)", async () => {
		expect((await run({ "sec-fetch-site": "same-origin" })).result).toBe("passed");
		expect((await run({ origin: "https://app.example.com" })).result).toBe("passed");
		expect((await run({ referer: "https://app.example.com/admin/test-crud" })).result).toBe("passed");
	});

	it("rejects cross-site calls with 403 without running the function", async () => {
		const crossSite: Array<Record<string, string>> = [
			{ "sec-fetch-site": "cross-site" },
			{ origin: "https://evil.example" },
			{ referer: "https://app.example.com.evil.example/" },
		];
		for (const headers of crossSite) {
			const { next, result } = await run(headers);
			expect(next).not.toHaveBeenCalled();
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(403);
		}
	});

	it("doesn't interfere with page requests", async () => {
		expect((await run({ "sec-fetch-site": "cross-site" }, "router")).result).toBe("passed");
	});
});

describe("request logging", () => {
	const call = async (outcome: () => Promise<unknown>) => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const next = vi.fn(async (options: { context: { requestId: string } }) => {
			expect(options.context.requestId).toMatch(/^[0-9a-f-]{36}$/);
			return outcome();
		});
		const result = await Promise.resolve(
			stepOf(requestLoggingMiddleware, "server")({ next, serverFnMeta: { name: "listTestCrud" }, method: "GET" }),
		).catch((caught: unknown) => caught);
		const lines = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].map(([line]) =>
			JSON.parse(String(line)),
		);
		return { result, lines, info, warn, error };
	};

	it("logs one info line with name, method, duration and request id on success", async () => {
		const { result, lines, info } = await call(async () => "ok");
		expect(result).toBe("ok");
		expect(info).toHaveBeenCalledOnce();
		expect(lines[0]).toMatchObject({
			level: "info",
			msg: "server-fn",
			fn: "listTestCrud",
			method: "GET",
			outcome: "ok",
		});
		expect(typeof lines[0].ms).toBe("number");
	});

	it("logs expected failures (4xx AppErrors) as warnings and rethrows", async () => {
		const { result, lines, warn } = await call(async () => {
			throw new AppError("FORBIDDEN");
		});
		expect(result).toBeInstanceOf(AppError);
		expect(warn).toHaveBeenCalledOnce();
		expect(lines[0]).toMatchObject({ level: "warn", outcome: "FORBIDDEN" });
	});

	it("logs unexpected failures as errors", async () => {
		const { lines, error } = await call(async () => {
			throw new TypeError("boom");
		});
		expect(error).toHaveBeenCalledOnce();
		expect(lines[0]).toMatchObject({ level: "error", outcome: "TypeError" });
	});

	it("writes single-line JSON at the right level", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		logServerFn("warn", { requestId: "r1" });
		expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({ level: "warn", msg: "server-fn", requestId: "r1" });
	});
});

describe("locale header for server functions", () => {
	it("sends the page locale with every server function call", async () => {
		overwriteGetLocale(() => "ne");
		const next = vi.fn((options: unknown) => options);
		const passed = await stepOf(localeFunctionMiddleware, "client")({ next });
		expect(passed).toEqual({ headers: { [LOCALE_HEADER]: "ne" } });
	});
});

describe("error normalisation middleware", () => {
	it("passes results through and turns thrown errors into AppErrors carrying the request id", async () => {
		const step = stepOf(errorNormalizationMiddleware, "server");
		const ok = await step({ next: async () => "ok", context: { requestId: "req-1" } });
		expect(ok).toBe("ok");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = await Promise.resolve(
			step({
				next: async () => {
					throw new Error("db password=hunter2");
				},
				context: { requestId: "req-2" },
			}),
		).catch((caught: unknown) => caught);
		expect(failure).toBeInstanceOf(AppError);
		expect(failure).toMatchObject({ code: "INTERNAL", requestId: "req-2", message: "Internal error" });
	});
});

describe("security headers middleware", () => {
	const run = async (contentType: string) => {
		const { securityHeadersMiddleware } = await import("@/middleware/security-headers");
		let nonce = "";
		const result = (await stepOf(
			securityHeadersMiddleware,
			"server",
		)({
			request: new Request("https://app.example/admin?tab=1"),
			next: async (options: { context: { nonce: string } }) => {
				nonce = options.context.nonce;
				return { response: new Response("<html></html>", { headers: { "content-type": contentType } }) };
			},
		})) as { response: Response };
		const headers = result.response.headers;
		return {
			nonce,
			csp: headers.get("content-security-policy"),
			reportingEndpoints: headers.get("reporting-endpoints"),
		};
	};

	it("gives every request a fresh 128-bit nonce for the router", async () => {
		const first = await run("text/html");
		const second = await run("text/html");
		expect(atob(first.nonce)).toHaveLength(16);
		expect(first.nonce).not.toBe(second.nonce);
	});

	it("sends the CSP with that nonce on HTML responses in production only", async () => {
		expect((await run("text/html; charset=utf-8")).csp).toBeNull(); // dev/test: Vite injects unsigned scripts
		vi.stubEnv("PROD", true);
		const html = await run("text/html; charset=utf-8");
		expect(html.csp).toContain(`'nonce-${html.nonce}'`);
		expect(html.csp).toContain("frame-ancestors 'none'");
		expect((await run("application/json")).csp).toBeNull();
	});

	it("reports violations to this origin's /api/csp-report (production only)", async () => {
		expect((await run("text/html")).reportingEndpoints).toBeNull();
		vi.stubEnv("PROD", true);
		const html = await run("text/html");
		expect(html.reportingEndpoints).toBe('csp="https://app.example/api/csp-report"');
		expect(html.csp).toContain("report-uri https://app.example/api/csp-report; report-to csp");
	});
});
