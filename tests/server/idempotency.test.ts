import { describe, expect, it, vi } from "vitest";
import { createIdempotencyStore } from "@/server/examples/idempotency";

/** The idempotency recipe's store (src/server/examples/idempotency.ts). */
describe("createIdempotencyStore", () => {
	it("runs the action once for a double submit and answers the repeat with the first result", async () => {
		const store = createIdempotencyStore();
		const action = vi.fn(async () => ({ id: 1 }));
		const [first, second] = await Promise.all([
			store.run("k1", "user-1:send", "hello", action),
			store.run("k1", "user-1:send", "hello", action),
		]);
		expect(action).toHaveBeenCalledOnce();
		expect(first).toEqual({ result: { id: 1 }, replayed: false });
		expect(second).toEqual({ result: { id: 1 }, replayed: true });
		// A retry later gets the same answer.
		await expect(store.run("k1", "user-1:send", "hello", action)).resolves.toMatchObject({ replayed: true });
		expect(action).toHaveBeenCalledOnce();
	});

	it("refuses a key reused for different input or by someone else", async () => {
		const store = createIdempotencyStore();
		await store.run("k1", "user-1:send", "hello", async () => 1);
		await expect(store.run("k1", "user-1:send", "other", async () => 2)).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(store.run("k1", "user-2:send", "hello", async () => 2)).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("forgets a key whose action failed, so the retry runs it", async () => {
		const store = createIdempotencyStore();
		await expect(
			store.run("k1", "s", "x", async () => {
				throw new Error("network");
			}),
		).rejects.toThrow("network");
		await expect(store.run("k1", "s", "x", async () => "sent")).resolves.toEqual({ result: "sent", replayed: false });
	});

	it("forgets keys after their time to live", async () => {
		let time = 0;
		const store = createIdempotencyStore({ ttlMs: 1000, now: () => time });
		await store.run("k1", "s", "x", async () => 1);
		time = 1000;
		await expect(store.run("k1", "s", "x", async () => 2)).resolves.toEqual({ result: 2, replayed: false });
	});
});
