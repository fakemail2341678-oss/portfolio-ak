import { count, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestCrudInput } from "@/features/test-crud/schema";
import { AppError, FORM_ERROR_KEY } from "@/lib/errors";
import { insertUpload } from "@/server/attachments/repository";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import {
	createTestCrud,
	deleteTestCrud,
	getPublishedTestCrud,
	getTestCrud,
	isSlugFree,
	listPublishedTestCrud,
	listTestCrud,
	listTestCrudTags,
	setTestCrudStatus,
	updateTestCrud,
} from "@/server/test-crud/repository";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * Runs the repository against a real (in-process) Postgres with the committed
 * migrations applied, so SQL, constraints and transactions are what production sees.
 */
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
const USER_ID = "admin-1";

beforeAll(async () => {
	testDb = await createTestDb(USER_ID);
	db = testDb.db;
}, 60_000);
afterAll(() => testDb.close());
beforeEach(() => testDb.reset());

const input = (overrides: Partial<TestCrudInput> = {}): TestCrudInput => ({
	title: "First item",
	slug: "first-item",
	summary: "Short summary",
	body: "<p>Hello</p>",
	status: "draft",
	price: 1250.5,
	phone: "+9779812345678",
	tags: ["nepal", "demo"],
	images: [],
	...overrides,
});
const cloud = createFakeCloudinary();
const store = cloud.store;
/** `version` is only checked by updates (any value for the others). */
const opts = (extra: { now?: Date; userId?: string; version?: string } = {}) => ({
	userId: USER_ID,
	store,
	version: "",
	...extra,
});
/** The writes run inside the service's transaction (withAudit). */
const create = (data: TestCrudInput, options: Parameters<typeof createTestCrud>[2]) =>
	db.transaction((tx) => createTestCrud(tx, data, options));
const update = (id: string, data: TestCrudInput, options: Parameters<typeof updateTestCrud>[3]) =>
	db.transaction((tx) => updateTestCrud(tx, id, data, options));
const status = (id: string, value: TestCrudInput["status"], now?: Date) =>
	db.transaction((tx) => setTestCrudStatus(tx, id, value, store, now));
const remove = (ids: string[]) => db.transaction((tx) => deleteTestCrud(tx, ids));
let uploads = 0;
/** A verified pending upload by `ownerId` (what confirmUpload records). */
const pending = async (ownerId = USER_ID) => {
	uploads++;
	const row = await insertUpload(
		db,
		{
			publicId: `portfolio/test-crud/u${uploads}`,
			version: 1700000000 + uploads,
			resourceType: "image",
			format: "png",
			bytes: 1000,
			width: 1600,
			height: 900,
		},
		ownerId,
	);
	return { id: row.id, alt: { en: "", ne: "" } };
};
const liveAttachments = async () =>
	(await db.select({ total: count() }).from(schema.attachment).where(isNull(schema.attachment.deletedAt)))[0]?.total;

describe("isSlugFree", () => {
	it("is free when no item has the slug, or only the item being edited", async () => {
		expect(await isSlugFree(db, "first-item")).toBe(true);
		const created = await create(input(), opts());
		expect(await isSlugFree(db, "first-item")).toBe(false);
		expect(await isSlugFree(db, "first-item", created.id)).toBe(true);
		expect(await isSlugFree(db, "another-item")).toBe(true);
	});
});

describe("create and read", () => {
	it("stores every column, sanitizes the body and links the creator and images in order", async () => {
		const [one, two] = [await pending(), await pending()];
		const created = await create(
			input({
				body: '<p onclick="x()">Hi<script>alert(1)</script></p>',
				images: [
					{ id: two.id, alt: { en: "Second upload, shown first", ne: "" } },
					{ id: one.id, alt: { en: "", ne: "" } },
				],
			}),
			opts(),
		);
		expect(created).toMatchObject({
			title: "First item",
			slug: "first-item",
			status: "draft",
			price: 1250.5,
			phone: "+9779812345678",
			tags: ["nepal", "demo"],
			body: "<p>Hi</p>",
			publishedAt: null,
		});
		expect(created.images.map((image) => [image.id, image.alt.en])).toEqual([
			[two.id, "Second upload, shown first"],
			[one.id, ""],
		]);
		// The cover is the first image; URLs are Cloudinary delivery URLs with transformations.
		expect(created.image?.id).toBe(two.id);
		expect(created.image?.cover.src).toMatch(
			/^https:\/\/res\.cloudinary\.test\/demo\/image\/upload\/c_fill,g_auto,ar_16:9,w_960,f_auto,q_auto\/v\d+\/portfolio\/test-crud\/u2$/,
		);
		expect(created.image?.full.srcSet.split(", ")).toHaveLength(6);
		const [row] = await db.select().from(schema.testCrud).where(eq(schema.testCrud.id, created.id));
		expect(row?.createdBy).toBe(USER_ID);
		expect(row?.body).toBe("<p>Hi</p>");
		expect(await getTestCrud(db, created.id, store)).toEqual(created);
		// Without a configured store the item still loads, with no images.
		expect((await getTestCrud(db, created.id, null))?.images).toEqual([]);
	});

	it("sets published_at when created as published", async () => {
		const now = new Date("2026-10-01T10:00:00Z");
		const created = await create(input({ status: "published" }), opts({ now }));
		expect(created.publishedAt).toBe(now.toISOString());
	});

	it("rejects a duplicate slug with a CONFLICT field error", async () => {
		await create(input(), opts());
		const upload = await pending();
		const error = await create(input({ title: "Other", images: [upload] }), opts()).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ code: "CONFLICT", fieldErrors: { slug: ["Another item already uses this slug."] } });
		// The failed transaction linked nothing: the upload is still pending.
		const [row] = await db.select().from(schema.attachment).where(eq(schema.attachment.id, upload.id));
		expect(row?.entityType).toBeNull();
	});

	it("reports NOT_FOUND for unknown ids", async () => {
		await expect(getTestCrud(db, "00000000-0000-4000-8000-000000000000", store)).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("refuses images that aren't the user's own pending uploads or already this item's", async () => {
		await db
			.insert(schema.user)
			.values({ id: "someone-else", name: "S", email: "s@example.com" })
			.onConflictDoNothing();
		const someoneElses = await pending("someone-else");
		const error = await create(input({ images: [someoneElses] }), opts()).catch((caught: unknown) => caught);
		expect(error).toMatchObject({ code: "BAD_REQUEST" });
		expect((error as AppError).fieldErrors?.[FORM_ERROR_KEY]?.[0]).toBe(
			"One of the images can't be used here. Remove it and upload it again.",
		);
		const mine = await pending();
		const first = await create(input({ slug: "first", images: [mine] }), opts());
		// Another item can't take an image that belongs to the first one.
		await expect(create(input({ slug: "second", images: [mine] }), opts())).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect((await getTestCrud(db, first.id, store))?.images).toHaveLength(1);
	});
});

describe("listTestCrud", () => {
	beforeEach(async () => {
		const items: Array<[string, TestCrudInput["status"], number]> = [
			["Alpha apples", "published", 300],
			["Beta bananas", "draft", 100],
			["Gamma grapes 100%", "published", 200],
			["Delta dates", "draft", 50],
			["Epsilon eggplant", "published", 400],
		];
		for (const [index, [title, status, price]] of items.entries()) {
			await create(input({ title, slug: `item-${index}`, status, price, summary: "" }), {
				userId: USER_ID,
				store,
				now: new Date(Date.UTC(2026, 0, index + 1)),
			});
		}
	});
	const list = (overrides: Partial<Parameters<typeof listTestCrud>[1]> = {}) =>
		listTestCrud(db, { q: "", status: "all", tags: [], sort: "title", page: 1, pageSize: 10, ...overrides }, store);

	it("paginates with totals and clamps out-of-range pages", async () => {
		const first = await list({ pageSize: 2 });
		expect(first).toMatchObject({ total: 5, page: 1, pageCount: 3 });
		expect(first.items.map((item) => item.title)).toEqual(["Alpha apples", "Beta bananas"]);
		const clamped = await list({ pageSize: 2, page: 99 });
		expect(clamped.page).toBe(3);
		expect(clamped.items.map((item) => item.title)).toEqual(["Gamma grapes 100%"]);
	});

	it("sorts by title, price and update time in both directions", async () => {
		expect((await list({ sort: "-title" })).items[0]?.title).toBe("Gamma grapes 100%");
		expect((await list({ sort: "price" })).items.map((item) => item.price)).toEqual([50, 100, 200, 300, 400]);
		expect((await list({ sort: "-price" })).items[0]?.price).toBe(400);
	});

	it("filters by status and searches case-insensitively, treating % and _ literally", async () => {
		expect((await list({ status: "draft" })).items.map((item) => item.title)).toEqual(["Beta bananas", "Delta dates"]);
		expect((await list({ q: "GRAPES" })).items.map((item) => item.title)).toEqual(["Gamma grapes 100%"]);
		expect((await list({ q: "100%" })).total).toBe(1);
		expect((await list({ q: "%" })).total).toBe(1);
		expect((await list({ q: "item-3" })).items.map((item) => item.title)).toEqual(["Delta dates"]);
		expect((await list({ q: "zzz" })).total).toBe(0);
	});
});

describe("listTestCrud filters", () => {
	// Published times are chosen around Nepal midnight (18:15 UTC) to check that date
	// filters use calendar days in the app time zone, not UTC days.
	const rows: Array<[string, string[], number, string | null, boolean]> = [
		["Momo", ["food", "nepal"], 300, "2026-09-01T18:20:00Z", true], // 2 Sep in Nepal
		["Tea", ["drink"], 150, "2026-09-01T18:10:00Z", false], // 1 Sep in Nepal
		["Topi", ["clothing", "nepal"], 900, "2026-10-15T06:00:00Z", true],
		["Draft dal", ["food"], 50, null, false],
	];
	beforeEach(async () => {
		for (const [index, [title, tags, price, publishedAt, image]] of rows.entries()) {
			const created = await create(
				input({
					title,
					slug: `row-${index}`,
					tags,
					price,
					status: publishedAt ? "published" : "draft",
					images: image ? [await pending()] : [],
				}),
				opts(),
			);
			await db
				.update(schema.testCrud)
				.set({ publishedAt: publishedAt ? new Date(publishedAt) : null })
				.where(eq(schema.testCrud.id, created.id));
		}
	});
	const titles = async (overrides: Partial<Parameters<typeof listTestCrud>[1]>) =>
		(
			await listTestCrud(
				db,
				{ q: "", status: "all", tags: [], sort: "title", page: 1, pageSize: 10, ...overrides },
				store,
			)
		).items.map((item) => item.title);

	it("tags match any of the selected tags", async () => {
		expect(await titles({ tags: ["nepal"] })).toEqual(["Momo", "Topi"]);
		expect(await titles({ tags: ["drink", "clothing"] })).toEqual(["Tea", "Topi"]);
		expect(await titles({ tags: ["unused"] })).toEqual([]);
	});

	it("price range is inclusive and either end is optional", async () => {
		expect(await titles({ priceMin: 150, priceMax: 300 })).toEqual(["Momo", "Tea"]);
		expect(await titles({ priceMin: 301 })).toEqual(["Topi"]);
		expect(await titles({ priceMax: 50 })).toEqual(["Draft dal"]);
	});

	it("published dates are whole days in Nepal time (drafts never match)", async () => {
		expect(await titles({ from: "2026-09-02", to: "2026-09-02" })).toEqual(["Momo"]);
		expect(await titles({ to: "2026-09-01" })).toEqual(["Tea"]);
		expect(await titles({ from: "2026-09-01" })).toEqual(["Momo", "Tea", "Topi"]);
	});

	it("has-image filters both ways", async () => {
		expect(await titles({ hasImage: true })).toEqual(["Momo", "Topi"]);
		expect(await titles({ hasImage: false })).toEqual(["Draft dal", "Tea"]);
	});

	it("filters combine with AND, together with search and status", async () => {
		expect(await titles({ tags: ["food"], status: "published", priceMax: 500, q: "mo" })).toEqual(["Momo"]);
		const page = await listTestCrud(
			db,
			{ q: "", status: "all", tags: ["nepal"], hasImage: true, sort: "-price", page: 1, pageSize: 10 },
			store,
		);
		expect(page).toMatchObject({ total: 2, pageCount: 1 });
		expect(page.items.map((item) => item.title)).toEqual(["Topi", "Momo"]);
		// List items carry their cover.
		expect(page.items.every((item) => item.image !== null)).toBe(true);
	});

	it("lists every tag in use, alphabetically", async () => {
		expect(await listTestCrudTags(db)).toEqual(["clothing", "drink", "food", "nepal"]);
	});
});

describe("update, status and delete", () => {
	it("updates fields, reorders images, updates alt text and marks dropped images removed", async () => {
		const [a, b] = [await pending(), await pending()];
		const created = await create(input({ images: [a, b] }), opts());
		const c = await pending();
		const { item, removed } = await update(
			created.id,
			input({ title: "Renamed", tags: [], images: [c, { id: a.id, alt: { en: "Now described", ne: "" } }] }),
			opts({ version: created.updatedAt }),
		);
		expect(item).toMatchObject({ title: "Renamed", tags: [] });
		expect(item.images.map((image) => [image.id, image.alt.en])).toEqual([
			[c.id, ""],
			[a.id, "Now described"],
		]);
		expect(removed.map((row) => row.id)).toEqual([b.id]);
		expect(await liveAttachments()).toBe(2);
		const cleared = await update(created.id, input(), opts({ version: item.updatedAt }));
		expect(cleared.item.image).toBeNull();
		expect(await liveAttachments()).toBe(0);
	});

	it("keeps the first publish date while published and clears it on unpublish", async () => {
		const created = await create(input(), opts());
		const first = new Date("2026-02-01T00:00:00Z");
		expect((await status(created.id, "published", first)).item.publishedAt).toBe(first.toISOString());
		const published = await getTestCrud(db, created.id, store);
		const edited = await update(
			created.id,
			input({ status: "published" }),
			opts({ now: new Date("2026-03-01T00:00:00Z"), version: published?.updatedAt ?? "" }),
		);
		expect(edited.item.publishedAt).toBe(first.toISOString());
		expect((await status(created.id, "draft")).item.publishedAt).toBeNull();
	});

	it("reports NOT_FOUND for unknown ids", async () => {
		const missing = "00000000-0000-4000-8000-000000000000";
		await expect(status(missing, "published")).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(update(missing, input(), opts({ version: new Date().toISOString() }))).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("writes only while the row still has the version the edit started from", async () => {
		const created = await create(input(), opts());
		// Inserted rows carry microseconds (defaultNow()); the ISO version has milliseconds and still matches.
		const first = await update(created.id, input({ title: "One" }), opts({ version: created.updatedAt }));
		expect(first.item.updatedAt).not.toBe(created.updatedAt);
		const stale = await update(created.id, input({ title: "Two" }), opts({ version: created.updatedAt })).catch(
			(caught: unknown) => caught,
		);
		expect(stale).toMatchObject({ code: "CONFLICT", reason: "stale" });
		expect(await getTestCrud(db, created.id, store)).toMatchObject({ title: "One" });
		// A publish from the list is a change too.
		await status(created.id, "published");
		await expect(
			update(created.id, input({ title: "Three" }), opts({ version: first.item.updatedAt })),
		).rejects.toMatchObject({ reason: "stale" });
	});

	it("lets only one of two concurrent saves of the same version through", async () => {
		const created = await create(input(), opts());
		const results = await Promise.allSettled(
			["A", "B"].map((title) => update(created.id, input({ title }), opts({ version: created.updatedAt }))),
		);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const [refused] = results.filter((result) => result.status === "rejected");
		expect(refused?.reason).toMatchObject({ code: "CONFLICT", reason: "stale" });
	});

	it("deletes one or many rows, marks their images removed and returns the rows deleted", async () => {
		const a = await create(input({ slug: "a", images: [await pending()] }), opts());
		const b = await create(input({ slug: "b", images: [await pending()] }), opts());
		const c = await create(input({ slug: "c" }), opts());
		const result = await remove([a.id, b.id, "00000000-0000-4000-8000-000000000000"]);
		expect(result.items.map((item) => item.title).sort()).toEqual(["First item", "First item"]);
		expect(result.removed).toHaveLength(2);
		expect(await liveAttachments()).toBe(0);
		expect(await getTestCrud(db, c.id, store)).not.toBeNull();
	});
});

describe("public queries (published only)", () => {
	beforeEach(async () => {
		const rows: Array<[string, TestCrudInput["status"], string]> = [
			["Published old", "published", "2026-01-01T00:00:00Z"],
			["Draft secret", "draft", "2026-01-02T00:00:00Z"],
			["Published new", "published", "2026-01-03T00:00:00Z"],
		];
		for (const [index, [title, status, at]] of rows.entries()) {
			await create(
				input({ title, slug: `p-${index}`, status, summary: title, body: "<p>Body</p><script>x()</script>" }),
				opts({ now: new Date(at) }),
			);
		}
	});

	it("lists only published items, newest first, with search and paging", async () => {
		const page = await listPublishedTestCrud(db, { q: "", page: 1 }, 10, store);
		expect(page.items.map((item) => item.title)).toEqual(["Published new", "Published old"]);
		expect(page.total).toBe(2);
		expect((await listPublishedTestCrud(db, { q: "secret", page: 1 }, 10, store)).total).toBe(0);
		const paged = await listPublishedTestCrud(db, { q: "", page: 5 }, 1, store);
		expect(paged).toMatchObject({ page: 2, pageCount: 2 });
		expect(paged.items.map((item) => item.title)).toEqual(["Published old"]);
		// Public DTOs carry no admin-only fields.
		expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(
			["image", "price", "publishedAt", "slug", "summary", "tags", "title"].sort(),
		);
	});

	it("returns a published item by slug with sanitized body, and null for drafts or unknown slugs", async () => {
		const item = await getPublishedTestCrud(db, "p-0", store);
		expect(item).toMatchObject({ title: "Published old", body: "<p>Body</p>" });
		expect(await getPublishedTestCrud(db, "p-1", store)).toBeNull();
		expect(await getPublishedTestCrud(db, "nope", store)).toBeNull();
	});
});
