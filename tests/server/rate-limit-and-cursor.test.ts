import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/errors";
import { cursorOrder, cursorPaginate, decodeCursor, encodeCursor } from "@/server/db/list";
import * as schema from "@/server/db/schema";
import { consumeRateLimit, enforceRateLimit } from "@/server/http/rate-limit";
import { createTestDb } from "../utils/test-db";

/**
 * The Task 33 recipes that are code (docs/guides/recipes.md), against PGlite:
 * cursor pagination and the database-backed rate limit.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const db = () => env.db;

beforeAll(async () => {
	env = await createTestDb();
}, 60_000);
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	await db().delete(schema.rateLimit);
});

describe("cursor pagination", () => {
	const seed = async (count: number) => {
		// Same timestamp for some rows: the id must break the tie without skipping or repeating.
		const base = Date.parse("2026-09-01T00:00:00Z");
		await db()
			.insert(schema.testCrud)
			.values(
				Array.from({ length: count }, (_, index) => ({
					slug: `item-${index}`,
					title: `Item ${index}`,
					status: "published" as const,
					publishedAt: new Date(base + Math.floor(index / 3) * 60_000 + 0.25),
				})),
			);
	};

	const page = (cursor: string | undefined) =>
		cursorPaginate(
			{
				cursor,
				limit: 4,
				column: schema.testCrud.publishedAt,
				id: schema.testCrud.id,
				direction: "desc",
				rows: (after, limit) =>
					db()
						.select({
							id: schema.testCrud.id,
							slug: schema.testCrud.slug,
							key: sql<string>`${schema.testCrud.publishedAt}::text`,
						})
						.from(schema.testCrud)
						.where(and(eq(schema.testCrud.status, "published"), after))
						.orderBy(...cursorOrder(schema.testCrud.publishedAt, schema.testCrud.id, "desc"))
						.limit(limit),
				key: (row) => row.key,
			},
			(row) => row.slug,
		);

	it("walks every row once, newest first, and ends with no cursor", async () => {
		await seed(10);
		const seen: string[] = [];
		let cursor: string | undefined;
		let pages = 0;
		do {
			const result = await page(cursor);
			seen.push(...result.items);
			cursor = result.nextCursor ?? undefined;
			pages += 1;
		} while (cursor);
		expect(pages).toBe(3);
		expect(new Set(seen).size).toBe(10);
		expect(seen.slice(0, 1)).toEqual(["item-9"]);
	});

	it("treats a broken cursor as the first page", async () => {
		await seed(2);
		expect((await page("not-a-cursor")).items).toHaveLength(2);
		expect(decodeCursor("not-a-cursor")).toBeNull();
		expect(decodeCursor(encodeCursor(5, "id-1"))).toEqual([5, "id-1"]);
	});
});

describe("rate limit (database storage)", () => {
	const rule = { max: 2, windowSeconds: 60 };
	const t0 = Date.parse("2026-10-01T00:00:00Z");

	it("allows max calls per window per key, then refuses until the window passes", async () => {
		expect((await consumeRateLimit(db(), "contact:1.2.3.4", rule, t0)).allowed).toBe(true);
		expect((await consumeRateLimit(db(), "contact:1.2.3.4", rule, t0 + 1000)).remaining).toBe(0);
		const third = await consumeRateLimit(db(), "contact:1.2.3.4", rule, t0 + 2000);
		expect(third).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 58 });
		// Another client has its own budget.
		expect((await consumeRateLimit(db(), "contact:5.6.7.8", rule, t0 + 2000)).allowed).toBe(true);
		// A new window starts over.
		expect((await consumeRateLimit(db(), "contact:1.2.3.4", rule, t0 + 61_000)).allowed).toBe(true);
	});

	it("enforceRateLimit throws a localized RATE_LIMITED error", async () => {
		await enforceRateLimit(db(), "k", { max: 1, windowSeconds: 60 }, t0);
		const error = await enforceRateLimit(db(), "k", { max: 1, windowSeconds: 60 }, t0).catch((caught) => caught);
		expect(isAppError(error) && error.code).toBe("RATE_LIMITED");
	});

	it("keeps its keys apart from Better Auth's", async () => {
		await consumeRateLimit(db(), "/sign-in/email", rule, t0);
		const [row] = await db().select().from(schema.rateLimit);
		expect(row?.key).toBe("fn:/sign-in/email");
	});
});
