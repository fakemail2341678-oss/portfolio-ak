import { describe, expect, it } from "vitest";
import { STACK_PAGE_SIZE, stackSearchSchema } from "@/features/stack/schema";
import { redirectSearchSchema, safeRedirectPath } from "@/lib/http/redirect";
import { STACK } from "@/server/stack/data";
import { queryStack } from "@/server/stack/query";

const parse = (input: Record<string, unknown>) => stackSearchSchema.parse(input);

describe("stack search params", () => {
	it("fills defaults when params are missing", () => {
		expect(parse({})).toEqual({ q: "", sort: "name", page: 1 });
	});

	it("corrects invalid values instead of failing", () => {
		expect(parse({ page: "abc", sort: "bogus", q: 42 })).toEqual({ q: "", sort: "name", page: 1 });
		expect(parse({ page: -3 })).toMatchObject({ page: 1 });
		expect(parse({ page: 2.5 })).toMatchObject({ page: 1 });
		expect(parse({ simulate: "explode" }).simulate).toBeUndefined();
	});

	it("keeps valid values and trims the query", () => {
		expect(parse({ q: "  tan  ", sort: "-name", page: "2" })).toEqual({ q: "tan", sort: "-name", page: 2 });
	});
});

describe("queryStack", () => {
	const base = { q: "", sort: "name", page: 1 } as const;

	it("paginates and reports totals", () => {
		const result = queryStack(base, "en");
		expect(result.total).toBe(STACK.length);
		expect(result.items).toHaveLength(STACK_PAGE_SIZE);
		expect(result.pageCount).toBe(Math.ceil(STACK.length / STACK_PAGE_SIZE));
	});

	it("clamps out-of-range pages to the last page", () => {
		const result = queryStack({ ...base, page: 999 }, "en");
		expect(result.page).toBe(result.pageCount);
		expect(result.items.length).toBeGreaterThan(0);
	});

	it("searches names, descriptions and categories case-insensitively", () => {
		const result = queryStack({ ...base, q: "TANSTACK" }, "en");
		expect(result.total).toBeGreaterThanOrEqual(5);
		expect(result.items.every((item) => item.name.includes("TanStack"))).toBe(true);
		expect(queryStack({ ...base, q: "zzz-no-match" }, "en").total).toBe(0);
	});

	it("sorts by name both ways", () => {
		const asc = queryStack({ ...base, page: 1 }, "en").items.map((item) => item.name);
		const desc = queryStack({ ...base, sort: "-name" }, "en").items.map((item) => item.name);
		expect(asc[0]).toBe("Better Auth");
		expect(desc[0]).toBe("Zod");
	});
});

describe("redirect search param", () => {
	it.each(["/account", "/ne/account?tab=1", "/"])("accepts same-site path %s", (value) => {
		expect(safeRedirectPath.safeParse(value).success).toBe(true);
	});

	it.each([
		"https://evil.example",
		"//evil.example",
		"/\\evil.example",
		"javascript:alert(1)",
		"",
	])("rejects %s", (value) => {
		expect(safeRedirectPath.safeParse(value).success).toBe(false);
		expect(redirectSearchSchema.parse({ redirect: value }).redirect).toBeUndefined();
	});
});
