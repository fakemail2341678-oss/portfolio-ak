import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bulkIdsSchema, pageWindow, paginateArray, parseSort } from "@/lib/list/paging";
import { enumParam, pageParam, pageSizeParam, resolvedPageSize, searchParam } from "@/lib/list/params";

describe("list URL params", () => {
	const schema = z.object({
		q: searchParam(),
		sort: enumParam(["name", "-name"], "name"),
		page: pageParam(50),
		pageSize: pageSizeParam(),
	});

	it("fills defaults when params are absent", () => {
		expect(schema.parse({})).toEqual({ q: "", sort: "name", page: 1, pageSize: undefined });
	});

	it("coerces URL strings and trims the search", () => {
		expect(schema.parse({ q: "  momo ", sort: "-name", page: "3", pageSize: "50" })).toEqual({
			q: "momo",
			sort: "-name",
			page: 3,
			pageSize: 50,
		});
	});

	it("corrects invalid values instead of failing the page", () => {
		expect(schema.parse({ q: "x".repeat(200), sort: "bogus", page: "abc", pageSize: "7" })).toEqual({
			q: "",
			sort: "name",
			page: 1,
			pageSize: undefined,
		});
		expect(schema.parse({ page: "0" }).page).toBe(1);
		expect(schema.parse({ page: "51" }).page).toBe(1);
	});

	it("the server input only accepts real page sizes", () => {
		expect(resolvedPageSize().safeParse(20).success).toBe(true);
		expect(resolvedPageSize().safeParse(7).success).toBe(false);
	});
});

describe("parseSort", () => {
	it("splits the direction prefix", () => {
		expect(parseSort("price")).toEqual({ field: "price", direction: "asc" });
		expect(parseSort("-price")).toEqual({ field: "price", direction: "desc" });
	});
});

describe("pageWindow", () => {
	it("computes the offset of a page", () => {
		expect(pageWindow({ page: 3, pageSize: 20, total: 95 })).toEqual({ page: 3, pageCount: 5, offset: 40, limit: 20 });
	});

	it("clamps a page past the end to the last page", () => {
		expect(pageWindow({ page: 9, pageSize: 20, total: 41 })).toMatchObject({ page: 3, pageCount: 3, offset: 40 });
	});

	it("an empty list still has one (empty) page", () => {
		expect(pageWindow({ page: 4, pageSize: 10, total: 0 })).toMatchObject({ page: 1, pageCount: 1, offset: 0 });
	});
});

describe("paginateArray", () => {
	const letters = ["a", "b", "c", "d", "e"];

	it("returns the requested slice with totals", () => {
		expect(paginateArray(letters, 2, 2)).toEqual({ items: ["c", "d"], total: 5, page: 2, pageCount: 3 });
	});

	it("clamps like the database lists do", () => {
		expect(paginateArray(letters, 10, 2)).toEqual({ items: ["e"], total: 5, page: 3, pageCount: 3 });
	});
});

describe("bulkIdsSchema", () => {
	const id = "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001";

	it("accepts 1..max UUIDs", () => {
		expect(bulkIdsSchema(2).safeParse({ ids: [id] }).success).toBe(true);
	});

	it("rejects an empty list, too many ids or non-UUIDs", () => {
		expect(bulkIdsSchema(2).safeParse({ ids: [] }).success).toBe(false);
		expect(bulkIdsSchema(2).safeParse({ ids: [id, id, id] }).success).toBe(false);
		expect(bulkIdsSchema(2).safeParse({ ids: ["1; drop table"] }).success).toBe(false);
	});
});
