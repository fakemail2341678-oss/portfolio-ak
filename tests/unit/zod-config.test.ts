import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("zod import", () => {
	// "zod" resolves to src/lib/zod.ts (vite/zod-alias.ts), so merely importing it
	// must turn jitless on: no eval probe, nothing for the CSP to block.
	it("is configured jitless before any schema is created", () => {
		expect(z.config().jitless).toBe(true);
	});

	it("is the full Zod API", () => {
		expect(z.object({ a: z.string() }).parse({ a: "x" })).toEqual({ a: "x" });
	});
});
