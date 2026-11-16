import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireLease, defineCron, releaseLease, runSteps } from "@/server/http/cron";
import { createTestDb } from "../utils/test-db";

/** `defineCron` (decision 0300): the secret, one run at a time, named steps, failures reported. */
const env = await createTestDb();
afterAll(() => env.close());
beforeEach(() => env.reset());

const SECRET = "cron-secret-0123456789";
const asCron = (secret = SECRET) =>
	new Request("https://app.test/api/cron/job", { headers: { authorization: `Bearer ${secret}` } });

/** A job with these steps; `secret: null` is a deployment without CRON_SECRET. */
const job = (steps: Record<string, () => Promise<object>>, secret: string | null = SECRET) =>
	defineCron({ name: "job", steps: () => steps, db: env.db, secret: () => secret ?? undefined });

const quiet = () => {
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	return vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("defineCron", () => {
	it("doesn't exist without its secret, and refuses another token", async () => {
		quiet();
		const run = vi.fn(async () => ({}));
		expect((await job({ run }, null).fetch(asCron())).status).toBe(404);
		expect((await job({ run }).fetch(asCron("wrong-secret-000000000"))).status).toBe(401);
		expect((await job({ run }).fetch(new Request("https://app.test/api/cron/job"))).status).toBe(401);
		expect(run).not.toHaveBeenCalled();
	});

	it("runs its steps in order and answers what each left, with its time", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const order: string[] = [];
		const response = await job({
			first: async () => {
				order.push("first");
				return { made: 2 };
			},
			second: async () => {
				order.push("second");
				return { sent: 1 };
			},
		}).fetch(asCron());
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(order).toEqual(["first", "second"]);
		expect(body).toMatchObject({ ok: true, first: { ok: true, made: 2 }, second: { ok: true, sent: 1 } });
		expect(Object.keys(body.timings)).toEqual(["first", "second"]);
		const line = info.mock.calls.map(([text]) => JSON.parse(String(text))).find((entry) => entry.msg === "cron");
		expect(line).toMatchObject({ job: "job", ok: true, results: { first: { made: 2 } } });
	});

	it("goes on past a failing step, reports it, and answers 500", async () => {
		const error = quiet();
		const after = vi.fn(async () => ({ done: true }));
		const response = await job({
			broken: async () => {
				throw new Error("digest provider down");
			},
			after,
		}).fetch(asCron());
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ ok: false, broken: { ok: false }, after: { ok: true, done: true } });
		expect(after).toHaveBeenCalledOnce();
		const lines = error.mock.calls.map(([text]) => JSON.parse(String(text)));
		expect(lines).toContainEqual(
			expect.objectContaining({ msg: "cron step failed", job: "job", step: "broken", error: "digest provider down" }),
		);
		expect(lines).toContainEqual(expect.objectContaining({ msg: "cron", ok: false, failed: ["broken"] }));
	});

	it("runs one at a time: a second request while one runs is skipped", async () => {
		quiet();
		let finish: () => void = () => {};
		const slow = job({
			slow: () =>
				new Promise<object>((resolve) => {
					finish = () => resolve({});
				}),
		});
		const first = slow.fetch(asCron());
		await vi.waitFor(async () => expect(await env.db.query.rateLimit.findFirst()).toBeDefined());
		const second = await slow.fetch(asCron());
		expect(await second.json()).toEqual({ ok: true, skipped: "running" });
		finish();
		expect((await first).status).toBe(200);
		// The lease is given back: the next run runs.
		expect(await (await job({ again: async () => ({}) }).fetch(asCron())).json()).toMatchObject({ ok: true });
	});
});

describe("the lease", () => {
	it("is held by one run, and taken over once it is older than its time", async () => {
		expect(await acquireLease(env.db, "x", 60_000, 1_000)).toBe(true);
		expect(await acquireLease(env.db, "x", 60_000, 30_000)).toBe(false);
		// The run that held it died without giving it back.
		expect(await acquireLease(env.db, "x", 60_000, 62_000)).toBe(true);
		await releaseLease(env.db, "x");
		expect(await acquireLease(env.db, "x", 60_000, 62_001)).toBe(true);
	});
});

describe("runSteps", () => {
	it("keeps what each step returned under its name", async () => {
		const run = await runSteps("plain", { a: async () => ({ n: 1 }), b: async () => ({}) });
		expect(run).toMatchObject({ ok: true, results: { a: { ok: true, n: 1 }, b: { ok: true } }, failed: [] });
	});
});
