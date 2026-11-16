import { describe, expect, it, vi } from "vitest";
import { createOutbound, outboundCall, UpstreamError } from "@/server/http/outbound";

const BASE = "https://api.service.test/v1";

/** A fetch that answers from a list, recording what it was asked. */
const scripted = (...answers: Array<Response | Error | ((init: RequestInit | undefined) => Promise<Response>)>) => {
	const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
	const fetcher = vi.fn<typeof fetch>(async (input, init) => {
		calls.push({ url: String(input instanceof Request ? input.url : input), init });
		const next = answers.shift();
		if (!next) throw new Error("no more answers");
		if (next instanceof Error) throw next;
		if (typeof next === "function") return next(init);
		return next;
	});
	return { fetcher, calls };
};

const outbound = (fetcher: typeof fetch, options: Partial<Parameters<typeof createOutbound>[0]> = {}) => {
	const sleep = vi.fn(async (_ms: number) => {});
	return { sleep, call: createOutbound({ service: "svc", bases: [BASE], fetcher, sleep, logs: "none", ...options }) };
};

const failure = async (promise: Promise<unknown>) => {
	const error = await promise.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(UpstreamError);
	return error as UpstreamError;
};

describe("createOutbound", () => {
	it("calls only the service's own hosts, and never follows a redirect", async () => {
		const { fetcher, calls } = scripted(new Response("{}"));
		const { call } = outbound(fetcher);
		await call(`${BASE}/movie/1?lang=en`);
		expect(calls[0]?.init?.redirect).toBe("error");
		// Another host, another scheme or a look-alike host: refused before anything is sent.
		for (const url of [
			"https://evil.test/v1/movie",
			"http://api.service.test/v1/x",
			"https://api.service.test.evil.test/",
			"https://api.service.test:8443/v1",
		]) {
			expect((await failure(call(url))).kind).toBe("blocked");
		}
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("retries a GET after a 429 or a 5xx, waiting what Retry-After asks (capped), then backing off", async () => {
		const { fetcher } = scripted(
			new Response("", { status: 429, headers: { "retry-after": "2" } }),
			new Response("", { status: 503 }),
			new Response("ok"),
		);
		const { call, sleep } = outbound(fetcher, { retries: 2 });
		expect(await (await call(`${BASE}/x`)).text()).toBe("ok");
		expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 400]);

		const capped = scripted(new Response("", { status: 429, headers: { "retry-after": "900" } }), new Response(""));
		const cappedCall = outbound(capped.fetcher, { retryAfterCapMs: 10_000 });
		await cappedCall.call(`${BASE}/x`);
		expect(cappedCall.sleep).toHaveBeenCalledWith(10_000);
	});

	it("returns the last answer once the retries are spent, and sends a write once", async () => {
		const { fetcher } = scripted(new Response("", { status: 502 }), new Response("", { status: 502 }));
		expect((await outbound(fetcher).call(`${BASE}/x`)).status).toBe(502);
		expect(fetcher).toHaveBeenCalledTimes(2);

		const write = scripted(new Response("", { status: 503 }));
		expect((await outbound(write.fetcher).call(`${BASE}/x`, { method: "POST", body: "{}" })).status).toBe(503);
		expect(write.fetcher).toHaveBeenCalledTimes(1);
	});

	it("gives up after its timeout, without a retry, and says so", async () => {
		const { fetcher } = scripted(
			(init) =>
				new Promise((_, reject) => {
					init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
				}),
		);
		const error = await failure(outbound(fetcher, { timeoutMs: 20, retries: 3 }).call(`${BASE}/slow`));
		expect(error.kind).toBe("timeout");
		expect(error.message).toBe("svc: no answer in 20 ms");
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("lets the caller's own signal stop a call, as the caller's error", async () => {
		const controller = new AbortController();
		const { fetcher } = scripted(
			(init) =>
				new Promise((_, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
				}),
		);
		const pending = outbound(fetcher).call(`${BASE}/x`, { signal: controller.signal });
		controller.abort();
		const error = await pending.catch((caught: unknown) => caught);
		expect(error).not.toBeInstanceOf(UpstreamError);
		expect((error as Error).name).toBe("AbortError");
	});

	it("refuses an answer over its size cap, declared or streamed", async () => {
		const declared = scripted(new Response("x".repeat(10), { headers: { "content-length": "10" } }));
		expect((await failure(outbound(declared.fetcher, { maxBytes: 5 }).call(`${BASE}/big`))).kind).toBe("too-large");

		const streamed = scripted(new Response("y".repeat(10)));
		const response = await outbound(streamed.fetcher, { maxBytes: 5 }).call(`${BASE}/big`);
		expect((await failure(response.text())).kind).toBe("too-large");

		const fits = scripted(new Response("12345"));
		expect(await (await outbound(fits.fetcher, { maxBytes: 5 }).call(`${BASE}/ok`)).text()).toBe("12345");
	});

	it("hands a stream's body on uncapped, its timeout ended once the head arrived", async () => {
		const { fetcher } = scripted(new Response("z".repeat(50)));
		const response = await outbound(fetcher, { maxBytes: 5, timeoutMs: 5 }).call(`${BASE}/stream`, {
			outbound: { stream: true },
		});
		// timer: waits past the 5 ms timeout before reading the body.
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await response.text()).toHaveLength(50);
	});

	it("logs the service, the path and the status, and never the query string or a header", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { fetcher } = scripted(new Response("{}"), new Response("", { status: 500 }));
		const call = createOutbound({ service: "tmdb", bases: [BASE], fetcher, retries: 0 });
		await call(`${BASE}/movie/1?api_key=secret123`, { headers: { authorization: "Bearer topsecret" } });
		await call(`${BASE}/movie/2`);
		const written = [...info.mock.calls, ...warn.mock.calls].map(([line]) => String(line));
		expect(written).toHaveLength(2);
		expect(JSON.parse(written[0] ?? "")).toMatchObject({
			level: "info",
			msg: "outbound",
			service: "tmdb",
			method: "GET",
			call: "/v1/movie/1",
			status: 200,
		});
		expect(JSON.parse(written[1] ?? "")).toMatchObject({ level: "warn", status: 500 });
		expect(written.join("\n")).not.toMatch(/secret123|topsecret/);
	});
});

describe("outboundCall (an SDK's own request)", () => {
	it("passes the answer through, or gives up at its deadline", async () => {
		vi.spyOn(console, "info").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(await outboundCall("resend", "email", async () => "sent", 50)).toBe("sent");
		const error = await failure(outboundCall("resend", "email", () => new Promise(() => {}), 10));
		expect(error).toMatchObject({ service: "resend", kind: "timeout" });
		expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({ service: "resend", failure: "timeout" });
	});
});
