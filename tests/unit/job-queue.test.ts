import { describe, expect, it } from "vitest";
import { createJobQueue } from "@/lib/job-queue";

/** A job that finishes when the test says so. */
const gate = <T>(value: T) => {
	let open: () => void = () => {};
	const promise = new Promise<T>((resolve) => {
		open = () => resolve(value);
	});
	return { promise, open };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("createJobQueue", () => {
	it("runs at most `concurrency` jobs at a time, in the order they were added", async () => {
		const queued = createJobQueue(2);
		const started: number[] = [];
		const gates = [gate("a"), gate("b"), gate("c"), gate("d")];
		const results = gates.map((entry, index) =>
			queued(() => {
				started.push(index);
				return entry.promise;
			}),
		);
		await settle();
		expect(started).toEqual([0, 1]);
		gates[1]?.open();
		await expect(results[1]).resolves.toBe("b");
		await settle();
		// One slot was free: the third started, the fourth still waits.
		expect(started).toEqual([0, 1, 2]);
		gates[0]?.open();
		gates[2]?.open();
		gates[3]?.open();
		await expect(Promise.all(results)).resolves.toEqual(["a", "b", "c", "d"]);
		expect(started).toEqual([0, 1, 2, 3]);
	});

	it("a job that fails rejects its own promise, and the next one still runs", async () => {
		const queued = createJobQueue(1);
		const failed = queued(() => Promise.reject(new Error("no")));
		const thrown = queued<string>(() => {
			throw new Error("thrown");
		});
		const after = queued(async () => "after");
		await expect(failed).rejects.toThrow("no");
		await expect(thrown).rejects.toThrow("thrown");
		await expect(after).resolves.toBe("after");
	});
});
