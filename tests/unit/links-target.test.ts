import { describe, expect, it } from "vitest";
import { targetProblem } from "@/features/apps/links/schema";

// VITE_SITE_URL is http://localhost:3000 in tests (tests/setup/env.ts).
describe("targetProblem", () => {
	it("accepts an http(s) address elsewhere", () => {
		expect(targetProblem("https://example.com/landing?utm=1")).toBeNull();
		expect(targetProblem("http://example.org")).toBeNull();
	});

	it("refuses other schemes, credentials and long addresses", () => {
		expect(targetProblem("javascript:alert(1)")).not.toBeNull();
		expect(targetProblem("ftp://example.com")).not.toBeNull();
		expect(targetProblem("https://user:secret@example.com")).not.toBeNull();
		expect(targetProblem("not a url")).not.toBeNull();
		expect(targetProblem(`https://example.com/${"a".repeat(2048)}`)).not.toBeNull();
	});

	it("refuses this site in any spelling: port, case, trailing dot, www", () => {
		for (const target of [
			"http://localhost:3000/l/abc",
			"https://LOCALHOST/l/abc",
			"http://localhost.:3000/",
			"http://www.localhost:8080/",
		]) {
			expect(targetProblem(target), target).not.toBeNull();
		}
	});
});
