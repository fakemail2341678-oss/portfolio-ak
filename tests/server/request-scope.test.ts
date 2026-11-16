import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { tagRequestId } from "@/lib/observability/sentry";
import { normalizeServerError } from "@/server/http/errors";
import {
	currentRequest,
	currentRequestId,
	forgetRequestMemo,
	REQUEST_ID_HEADER,
	recordTiming,
	requestMemo,
	runInRequestScope,
	SERVER_TIMING_HEADER,
	setRequestLocale,
	setRequestUser,
	timed,
} from "@/server/http/request-scope";
import { log } from "@/server/log";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/tanstackstart-react", () => ({ captureException }));

beforeEach(() => captureException.mockClear());

describe("runInRequestScope", () => {
	it("gives the request an id, readable while it runs and returned as x-request-id", async () => {
		let seen: string | undefined;
		const response = await runInRequestScope(async (id) => {
			seen = currentRequestId();
			expect(id).toBe(seen);
			return new Response("ok");
		});
		expect(seen).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers.get(REQUEST_ID_HEADER)).toBe(seen);
		expect(currentRequestId()).toBeUndefined();
	});

	it("sets the header on responses with immutable headers too", async () => {
		const response = await runInRequestScope(async () => Response.redirect("https://example.com/login", 307), {
			createId: () => "r-1",
		});
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://example.com/login");
		expect(response.headers.get(REQUEST_ID_HEADER)).toBe("r-1");
	});

	it("never trusts an incoming id and keeps concurrent requests apart", async () => {
		const ids = ["a", "b"];
		const seen = await Promise.all(
			ids.map((id, index) =>
				runInRequestScope(
					async () => {
						await new Promise((resolve) => setTimeout(resolve, (1 - index) * 10));
						return new Response(currentRequestId());
					},
					{ createId: () => id },
				).then((response) => response.text()),
			),
		);
		expect(seen).toEqual(ids);
	});
});

describe("what a request's scope knows", () => {
	it("says who asked and in which language in every log line, once they are known", async () => {
		const lines: Array<Record<string, unknown>> = [];
		vi.spyOn(console, "info").mockImplementation((line: string) => lines.push(JSON.parse(line)));
		await runInRequestScope(
			async () => {
				log("info", "before the session");
				setRequestUser("user-7");
				setRequestLocale("ne");
				log("info", "after the session");
				expect(currentRequest()).toEqual({ id: "r-9", userId: "user-7", locale: "ne", method: "POST", path: "/x" });
				return new Response();
			},
			{ createId: () => "r-9", request: new Request("https://app.test/x?token=abc", { method: "POST" }) },
		);
		expect(lines[0]).toMatchObject({ msg: "before the session", requestId: "r-9" });
		expect(lines[0]).not.toHaveProperty("userId");
		expect(lines[1]).toMatchObject({ msg: "after the session", requestId: "r-9", userId: "user-7" });
		expect(currentRequest()).toBeUndefined();
	});

	it("names the total and each timed part in Server-Timing", async () => {
		const response = await runInRequestScope(async () => {
			recordTiming("session", 3.4);
			recordTiming("fn", 12, 'list"Test\nCrud');
			await timed("tmdb", async () => "x");
			return new Response();
		});
		const header = response.headers.get(SERVER_TIMING_HEADER) ?? "";
		expect(header).toMatch(/^total;dur=\d+, session;dur=3, fn;dur=12;desc="list_Test_Crud", tmdb;dur=\d+$/);
	});

	it("joins the scope that is already open: one request, one id", async () => {
		const response = await runInRequestScope(
			async (outer) =>
				runInRequestScope(async (inner) => {
					expect(inner).toBe(outer);
					return new Response(inner);
				}),
			{ createId: () => "outer" },
		);
		expect(await response.text()).toBe("outer");
		expect(response.headers.get(REQUEST_ID_HEADER)).toBe("outer");
	});

	it("leaves a slow request line with its path (never its query) and its parts", async () => {
		vi.stubEnv("SLOW_REQUEST_MS", "1");
		vi.resetModules();
		const scope = await import("@/server/http/request-scope");
		const lines: Array<Record<string, unknown>> = [];
		vi.spyOn(console, "warn").mockImplementation((line: string) => lines.push(JSON.parse(line)));
		await scope.runInRequestScope(
			async () => {
				scope.recordTiming("db", 20);
				// timer: makes the request slower than the 1 ms threshold.
				await new Promise((resolve) => setTimeout(resolve, 15));
				return new Response(null, { status: 201 });
			},
			{ createId: () => "slow-1", request: new Request("https://app.test/admin/users?email=a@b.co") },
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			level: "warn",
			msg: "slow request",
			requestId: "slow-1",
			method: "GET",
			path: "/admin/users",
			status: 201,
			timings: [{ name: "db", ms: 20 }],
		});
		expect(JSON.stringify(lines[0])).not.toContain("a@b.co");
	});
});

describe("a server error's request id", () => {
	it("is the same in the response header, the error, the log line and the Sentry event", async () => {
		const lines: string[] = [];
		vi.spyOn(console, "error").mockImplementation((line: string) => lines.push(line));
		let error: unknown;
		const response = await runInRequestScope(async () => {
			const requestId = currentRequestId() ?? "";
			error = normalizeServerError(new Error("db password=hunter2"), requestId);
			log("error", "something else failed");
			return new Response();
		});
		const requestId = response.headers.get(REQUEST_ID_HEADER);
		expect(requestId).toBeTruthy();
		expect(error).toMatchObject({ code: "INTERNAL", requestId });
		expect(lines.map((line) => JSON.parse(line).requestId)).toEqual([requestId, requestId]);
		await vi.waitFor(() => expect(captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { requestId } }));
	});

	it("keeps an AppError's reason and field errors when it's tagged", () => {
		const stale = new AppError("CONFLICT", "changed", { reason: "stale", fieldErrors: { a: ["b"] } });
		expect(normalizeServerError(stale, "r-2")).toMatchObject({
			code: "CONFLICT",
			reason: "stale",
			fieldErrors: { a: ["b"] },
			requestId: "r-2",
		});
	});
});

describe("tagRequestId (server Sentry events)", () => {
	it("adds the request id as a tag, and keeps one the event already has", () => {
		expect(tagRequestId({ type: undefined, tags: { a: "1" } }, "r-3").tags).toEqual({ a: "1", requestId: "r-3" });
		expect(tagRequestId({ type: undefined, tags: { requestId: "r-0" } }, "r-3").tags).toEqual({ requestId: "r-0" });
		expect(tagRequestId({ type: undefined }, undefined).tags).toBeUndefined();
	});
});

describe("requestMemo", () => {
	it("computes once per request and shares the promise", async () => {
		const compute = vi.fn(async () => ({ user: "u-1" }));
		await runInRequestScope(async () => {
			const [a, b] = await Promise.all([requestMemo("session", compute), requestMemo("session", compute)]);
			expect(a).toBe(b);
			return new Response();
		});
		expect(compute).toHaveBeenCalledTimes(1);
	});

	it("never shares a value between requests", async () => {
		let calls = 0;
		const read = () => requestMemo("session", async () => ++calls);
		const seen = await Promise.all(
			[1, 2].map((index) =>
				runInRequestScope(async () => new Response(String(await read())), { createId: () => `r-${index}` }).then(
					(response) => response.text(),
				),
			),
		);
		expect(seen.sort()).toEqual(["1", "2"]);
	});

	it("computes again after a failure or when forgotten", async () => {
		const compute = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue("ok");
		await runInRequestScope(async () => {
			await expect(requestMemo("session", compute)).rejects.toThrow("db down");
			expect(await requestMemo("session", compute)).toBe("ok");
			forgetRequestMemo("session");
			expect(await requestMemo("session", compute)).toBe("ok");
			return new Response();
		});
		expect(compute).toHaveBeenCalledTimes(3);
	});

	it("just computes outside a request (scripts, tests, Nitro routes)", async () => {
		const compute = vi.fn(async () => 1);
		await requestMemo("session", compute);
		await requestMemo("session", compute);
		expect(compute).toHaveBeenCalledTimes(2);
	});
});
