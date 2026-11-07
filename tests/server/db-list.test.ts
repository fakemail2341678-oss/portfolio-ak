import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	allOf,
	countRows,
	dateRange,
	likePattern,
	numberRange,
	orderBySort,
	overlapsAny,
	paginate,
	textSearch,
} from "@/server/db/list";
import { testCrud } from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/** The shared list helpers against real Postgres (PGlite): every repository list is built on them. */
let env: Awaited<ReturnType<typeof createTestDb>>;

const ROWS = [
	{ slug: "momo", title: "Momo", summary: "Dumplings 100% handmade", price: 300, status: "published" as const },
	{ slug: "tea", title: "Tea", summary: "Himalayan_tea", price: 150, status: "draft" as const },
	{ slug: "topi", title: "Dhaka Topi", summary: "Hat", price: 900, status: "published" as const },
];

beforeAll(async () => {
	env = await createTestDb();
	await env.db.insert(testCrud).values(ROWS.map((row) => ({ ...row, createdBy: env.adminId })));
}, 60_000);
afterAll(() => env.close());

const titles = async (where: ReturnType<typeof allOf>, sort = "title") =>
	(
		await env.db
			.select({ title: testCrud.title })
			.from(testCrud)
			.where(where)
			.orderBy(
				...orderBySort(
					sort,
					{ title: testCrud.title, price: testCrud.price },
					{ tiebreaker: testCrud.id, fallback: "title" },
				),
			)
	).map((row) => row.title);

describe("textSearch", () => {
	it("matches any of the columns, case-insensitively", async () => {
		expect(await titles(textSearch("DUMPLING", [testCrud.title, testCrud.summary]))).toEqual(["Momo"]);
		expect(await titles(textSearch("t", [testCrud.title]))).toEqual(["Dhaka Topi", "Tea"]);
	});

	it("treats LIKE wildcards literally", async () => {
		expect(likePattern("100%")).toBe("%100\\%%");
		expect(await titles(textSearch("100%", [testCrud.summary]))).toEqual(["Momo"]);
		expect(await titles(textSearch("d_mpling", [testCrud.summary]))).toEqual([]);
		expect(await titles(textSearch("n_tea", [testCrud.summary]))).toEqual(["Tea"]);
	});

	it("an empty search is no filter", () => {
		expect(textSearch("", [testCrud.title])).toBeUndefined();
	});
});

describe("allOf", () => {
	it("skips absent filters", async () => {
		expect(allOf(undefined, undefined)).toBeUndefined();
		const where = allOf(undefined, eq(testCrud.status, "published"), textSearch("o", [testCrud.title]));
		expect(await titles(where)).toEqual(["Dhaka Topi", "Momo"]);
	});
});

describe("range and array filters", () => {
	it("numberRange is inclusive with optional ends", async () => {
		expect(await titles(numberRange(testCrud.price, 150, 300))).toEqual(["Momo", "Tea"]);
		expect(await titles(numberRange(testCrud.price, 301, undefined))).toEqual(["Dhaka Topi"]);
		expect(numberRange(testCrud.price, undefined, undefined)).toBeUndefined();
	});

	it("overlapsAny matches rows sharing any value; [] is no filter", async () => {
		await env.db
			.update(testCrud)
			.set({ tags: ["food"] })
			.where(eq(testCrud.slug, "momo"));
		await env.db
			.update(testCrud)
			.set({ tags: ["drink", "food"] })
			.where(eq(testCrud.slug, "tea"));
		expect(await titles(overlapsAny(testCrud.tags, ["drink", "hat"]))).toEqual(["Tea"]);
		expect(await titles(overlapsAny(testCrud.tags, ["food"]))).toEqual(["Momo", "Tea"]);
		expect(overlapsAny(testCrud.tags, [])).toBeUndefined();
	});

	it("dateRange compares calendar days in the given time zone", async () => {
		await env.db
			.update(testCrud)
			.set({ updatedAt: new Date("2026-09-01T18:20:00Z") })
			.where(eq(testCrud.slug, "momo"));
		await env.db
			.update(testCrud)
			.set({ updatedAt: new Date("2026-09-01T18:10:00Z") })
			.where(eq(testCrud.slug, "tea"));
		// 18:20 UTC is already 2 Sep in Nepal; 18:10 UTC is still 1 Sep.
		expect(await titles(dateRange(testCrud.updatedAt, "2026-09-02", "2026-09-02"))).toEqual(["Momo"]);
		expect(await titles(dateRange(testCrud.updatedAt, "2026-09-01", "2026-09-01"))).toEqual(["Tea"]);
		// The same instants are both 1 Sep in UTC.
		expect(await titles(dateRange(testCrud.updatedAt, "2026-09-01", "2026-09-01", "UTC"))).toEqual(["Momo", "Tea"]);
	});
});

describe("orderBySort", () => {
	it("sorts ascending, descending, and falls back for unknown fields", async () => {
		expect(await titles(undefined, "price")).toEqual(["Tea", "Momo", "Dhaka Topi"]);
		expect(await titles(undefined, "-price")).toEqual(["Dhaka Topi", "Momo", "Tea"]);
		expect(await titles(undefined, "-bogus")).toEqual(["Tea", "Momo", "Dhaka Topi"]);
	});
});

describe("paginate", () => {
	const page = (request: { page: number; pageSize: number }) =>
		paginate(
			request,
			{
				count: () => countRows(env.db, testCrud, undefined),
				rows: ({ limit, offset }) => env.db.select().from(testCrud).orderBy(testCrud.price).limit(limit).offset(offset),
			},
			(row) => row.slug,
		);

	it("returns one page with totals", async () => {
		expect(await page({ page: 2, pageSize: 2 })).toEqual({ items: ["topi"], total: 3, page: 2, pageCount: 2 });
	});

	it("clamps a page past the end", async () => {
		expect(await page({ page: 9, pageSize: 2 })).toMatchObject({ page: 2, items: ["topi"] });
	});

	it("skips the row query when nothing matches", async () => {
		let rowsQueried = false;
		const result = await paginate(
			{ page: 1, pageSize: 10 },
			{
				count: () => countRows(env.db, testCrud, eq(testCrud.slug, "none")),
				rows: async () => {
					rowsQueried = true;
					return [];
				},
			},
			(row: unknown) => row,
		);
		expect(result).toEqual({ items: [], total: 0, page: 1, pageCount: 1 });
		expect(rowsQueried).toBe(false);
	});
});
