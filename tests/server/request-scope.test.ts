import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { tagRequestId } from "@/lib/observability/sentry";
import { normalizeServerError } from "@/middleware/errors";
import {
	currentRequestId,
	forgetRequestMemo,
	REQUEST_ID_HEADER,
	requestMemo,
	runInRequestScope,
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
		const response = await runInRequestScope(
			async () => Response.redirect("https://example.com/login", 307),
			() => "r-1",
		);
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
					() => id,
				).then((response) => response.text()),
			),
		);
		expect(seen).toEqual(ids);
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
				runInRequestScope(
					async () => new Response(String(await read())),
					() => `r-${index}`,
				).then((response) => response.text()),
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
