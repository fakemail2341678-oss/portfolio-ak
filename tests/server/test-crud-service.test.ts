import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/features/rbac/types";
import type { TestCrudInput } from "@/features/test-crud/schema";
import { isStaleError } from "@/lib/concurrency";
import { confirmUpload } from "@/server/attachments/service";
import * as schema from "@/server/db/schema";
import * as testCrud from "@/server/test-crud/service";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * The Test CRUD server functions' work (src/server/test-crud/service.ts) against
 * a real Postgres (PGlite) and the real Cloudinary client over a fake API. Auth
 * is the middleware's job (auth-middleware.test.ts) and every function is checked
 * to use it (guarded-functions.test.ts).
 */
const captureServerEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/analytics/posthog", () => ({ captureServerEvent }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let cloud: ReturnType<typeof createFakeCloudinary>;
beforeAll(async () => {
	testDb = await createTestDb();
}, 60_000);
afterAll(() => testDb.close());
beforeEach(async () => {
	await testDb.reset();
	cloud = createFakeCloudinary();
	captureServerEvent.mockClear();
});

/** Who acts in the calls below: the test database's admin (createTestDb's default id). */
const ADMIN: Actor = { id: "admin-1", isAdmin: true, permissions: [] };
/** A call's services (src/server/services.ts), with this test's fake Cloudinary. */
const services = (actor: Actor = ADMIN) => ({ db: testDb.db, actor, imageStore: cloud.store });

const input = (overrides: Partial<TestCrudInput> = {}): TestCrudInput => ({
	title: "Momo Kitchen",
	slug: "momo-kitchen",
	summary: "",
	body: "<p>Hi</p>",
	status: "draft",
	price: 100,
	phone: "",
	tags: [],
	images: [],
	...overrides,
});
/** The whole upload: sign, the browser's upload (fake), confirm. */
const upload = async () => {
	const ticket = cloud.store.signUpload("test-crud");
	cloud.put(ticket.publicId);
	const image = await confirmUpload(
		testDb.db,
		cloud.store,
		{ publicId: ticket.publicId, scope: "test-crud" },
		{ id: testDb.adminId, permissions: [] },
	);
	return { id: image.id, alt: { en: "", ne: "" }, publicId: ticket.publicId };
};
const MISSING = "00000000-0000-4000-8000-000000000000";
/** Any version: the row doesn't exist, so it's never compared. */
const VERSION = "2026-01-01T00:00:00.000Z";

describe("create", () => {
	it("saves the item with its uploaded images and records the event", async () => {
		const image = await upload();
		const created = await testCrud.create(services(), input({ images: [image] }));
		expect(created.images.map((item) => item.id)).toEqual([image.id]);
		expect(captureServerEvent).toHaveBeenCalledWith("test_crud_created", testDb.adminId, {
			item_id: created.id,
			status: "draft",
		});
	});

	it("reports NOT_FOUND for unknown items", async () => {
		await expect(testCrud.get(services(), MISSING)).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("update", () => {
	it("updates fields, and deletes the assets of images it dropped from Cloudinary at once", async () => {
		const [kept, dropped] = [await upload(), await upload()];
		const created = await testCrud.create(services(), input({ images: [kept, dropped] }));
		const updated = await testCrud.update(services(), {
			...input({ title: "Renamed", images: [kept] }),
			id: created.id,
			updatedAt: created.updatedAt,
		});
		expect(updated).toMatchObject({ title: "Renamed" });
		expect(updated.images.map((image) => image.id)).toEqual([kept.id]);
		expect(cloud.destroyed).toEqual([dropped.publicId]);
		// The row is gone too, once the asset is.
		expect(await testDb.db.select().from(schema.attachment).where(eq(schema.attachment.id, dropped.id))).toEqual([]);
		expect(captureServerEvent).toHaveBeenLastCalledWith("test_crud_updated", testDb.adminId, {
			item_id: created.id,
			change: "edit",
		});
	});

	it("keeps the removed row for the scheduled cleanup when Cloudinary is unreachable", async () => {
		const image = await upload();
		const created = await testCrud.create(services(), input({ images: [image] }));
		cloud.failDestroy();
		await testCrud.update(services(), { ...input(), id: created.id, updatedAt: created.updatedAt });
		const [row] = await testDb.db.select().from(schema.attachment).where(eq(schema.attachment.id, image.id));
		expect(row?.deletedAt).toBeInstanceOf(Date);
	});

	it("reports NOT_FOUND for an unknown id and records nothing", async () => {
		await expect(testCrud.update(services(), { ...input(), id: MISSING, updatedAt: VERSION })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(captureServerEvent).not.toHaveBeenCalled();
	});

	it("records the create and each edit with the fields it changed; an unchanged save records nothing", async () => {
		const created = await testCrud.create(services(), input());
		const edited = await testCrud.update(services(), {
			...input({ title: "Momo Palace", price: 150, body: "<p>New</p>" }),
			id: created.id,
			updatedAt: created.updatedAt,
		});
		const unchanged = await testCrud.update(services(), {
			...input({ title: "Momo Palace", price: 150, body: "<p>New</p>" }),
			id: created.id,
			updatedAt: edited.updatedAt,
		});
		// The body is compared but too long for the row: an edit of it alone is recorded, without values.
		await testCrud.update(services(), {
			...input({ title: "Momo Palace", price: 150, body: "<p>Newer</p>" }),
			id: created.id,
			updatedAt: unchanged.updatedAt,
		});
		const rows = await testDb.db
			.select()
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.targetId, created.id))
			.orderBy(asc(schema.auditEvent.createdAt));
		expect(rows).toMatchObject([
			{ action: "test-crud.create", targetLabel: "Momo Kitchen", after: { title: "Momo Kitchen", status: "draft" } },
			{
				action: "test-crud.update",
				targetLabel: "Momo Palace",
				before: { title: "Momo Kitchen", price: 100 },
				after: { title: "Momo Palace", price: 150 },
			},
			{ action: "test-crud.update", before: {}, after: {} },
		]);
	});

	it("refuses a save started from an older version, keeps the other save and its images, records nothing", async () => {
		const image = await upload();
		const created = await testCrud.create(services(), input({ images: [image] }));
		// Two sessions open the same version; the first saves.
		const first = await testCrud.update(services(), {
			...input({ title: "First session", images: [image] }),
			id: created.id,
			updatedAt: created.updatedAt,
		});
		captureServerEvent.mockClear();
		// The second, still on the old version, drops the image: refused, nothing changes or is deleted.
		const error = await testCrud
			.update(services(), { ...input({ title: "Second session" }), id: created.id, updatedAt: created.updatedAt })
			.catch((caught: unknown) => caught);
		expect(isStaleError(error)).toBe(true);
		expect(error).toMatchObject({ code: "CONFLICT", status: 409 });
		const current = await testCrud.get(services(), created.id);
		expect(current).toMatchObject({ title: "First session", updatedAt: first.updatedAt });
		expect(current.images.map((each) => each.id)).toEqual([image.id]);
		expect(cloud.destroyed).toEqual([]);
		expect(captureServerEvent).not.toHaveBeenCalled();
		// Starting again from the latest version works.
		await expect(
			testCrud.update(services(), {
				...input({ title: "Second session" }),
				id: created.id,
				updatedAt: current.updatedAt,
			}),
		).resolves.toMatchObject({ title: "Second session" });
	});
});

describe("status, delete and reads", () => {
	/** The audit rows about one item, oldest first. */
	const auditOf = (id: string) =>
		testDb.db
			.select()
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.targetId, id))
			.orderBy(asc(schema.auditEvent.createdAt));

	it("publishes, records the status change and makes the item public", async () => {
		const created = await testCrud.create(services(), input());
		await expect(testCrud.getPublished(services(), "momo-kitchen")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		const published = await testCrud.setStatus(services({ ...ADMIN, requestId: "req-publish", ip: "203.0.113.7" }), {
			id: created.id,
			status: "published",
		});
		expect(published.status).toBe("published");
		expect((await auditOf(created.id)).slice(1)).toMatchObject([
			{
				action: "test-crud.publish",
				actorId: testDb.adminId,
				actorLabel: "admin@example.com",
				targetType: "test-crud",
				targetLabel: "Momo Kitchen",
				before: { status: "draft" },
				after: { status: "published" },
				requestId: "req-publish",
				ip: "203.0.113.7",
			},
		]);
		// Publishing again changes nothing, so nothing more is recorded.
		await testCrud.setStatus(services(), { id: created.id, status: "published" });
		expect(await auditOf(created.id)).toHaveLength(2);
		await testCrud.setStatus(services(), { id: created.id, status: "draft" });
		expect((await auditOf(created.id)).map((row) => row.action)).toEqual([
			"test-crud.create",
			"test-crud.publish",
			"test-crud.unpublish",
		]);
		await testCrud.setStatus(services(), { id: created.id, status: "published" });
		expect(captureServerEvent).toHaveBeenLastCalledWith("test_crud_updated", testDb.adminId, {
			item_id: created.id,
			change: "status",
			status: "published",
		});
		expect((await testCrud.getPublished(services(), "momo-kitchen")).title).toBe("Momo Kitchen");
		expect((await testCrud.get(services(), created.id)).status).toBe("published");
	});

	it("deletes items with their images' assets, records the count, and stays silent when nothing matched", async () => {
		const image = await upload();
		const a = await testCrud.create(services(), input({ slug: "a", images: [image] }));
		const b = await testCrud.create(services(), input({ slug: "b" }));
		captureServerEvent.mockClear();
		expect(await testCrud.remove(services(), [a.id, b.id, MISSING])).toEqual({ deleted: 2 });
		expect((await auditOf(a.id)).slice(1)).toMatchObject([
			{ action: "test-crud.delete", targetLabel: "Momo Kitchen", before: { title: "Momo Kitchen", status: "draft" } },
		]);
		expect(await auditOf(b.id)).toHaveLength(2);
		expect(await auditOf(MISSING)).toEqual([]);
		expect(cloud.destroyed).toEqual([image.publicId]);
		expect(captureServerEvent).toHaveBeenCalledWith("test_crud_deleted", testDb.adminId, { count: 2 });
		captureServerEvent.mockClear();
		expect(await testCrud.remove(services(), [MISSING])).toEqual({ deleted: 0 });
		expect(captureServerEvent).not.toHaveBeenCalled();
	});
});
