import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workersFor } from "../../scripts/lib/workers";

const GB = 1024 ** 3;
const machine = (freeGb: number, processors: number) => {
	vi.spyOn(os, "freemem").mockReturnValue(freeGb * GB);
	vi.spyOn(os, "availableParallelism").mockReturnValue(processors);
};

describe("workersFor: how many workers a suite may start (decision 0296)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("gives what the free memory allows, never more than the suite gains from", () => {
		machine(4.5, 12);
		expect(workersFor("server")).toBe(5);
		expect(workersFor("storybook")).toBe(1);
		expect(workersFor("e2e")).toBe(2);
		machine(6, 12);
		expect(workersFor("storybook")).toBe(2);
		machine(32, 12);
		expect(workersFor("unit")).toBe(4);
		expect(workersFor("e2e")).toBe(4);
	});

	it("starts one worker when memory is short, rather than none", () => {
		machine(1, 12);
		for (const suite of ["unit", "components", "server", "storybook", "e2e"] as const) {
			expect(workersFor(suite)).toBe(1);
		}
	});

	it("keeps one processor for Vitest's main thread, and gives e2e all of them (CI's four)", () => {
		machine(16, 4);
		expect(workersFor("server")).toBe(3);
		expect(workersFor("e2e")).toBe(4);
	});

	it("takes GATE_WORKERS over everything", () => {
		machine(1, 2);
		vi.stubEnv("GATE_WORKERS", "5");
		expect(workersFor("e2e")).toBe(5);
		vi.stubEnv("GATE_WORKERS", "0");
		expect(workersFor("e2e")).toBe(1);
	});
});
