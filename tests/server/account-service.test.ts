import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportAccountData, prepareAccountDeletion } from "@/server/account/service";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/** Account deletion's checks and cleanup, and the data export, against PGlite. */
let testDb: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
	testDb = await createTestDb();
}, 60_000);
afterAll(() => testDb.close());
beforeEach(async () => {
	await testDb.reset();
	await testDb.db.delete(schema.user).where(eq(schema.user.email, "sita@example.com"));
	await testDb.db.update(schema.user).set({ role: "admin", banned: false }).where(eq(schema.user.id, testDb.adminId));
	await testDb.db.delete(schema.user).where(eq(schema.user.id, "admin-2"));
	await testDb.db.insert(schema.user).values({ id: "sita", name: "Sita", email: "sita@example.com" });
});

const upload = (id: string, values: Partial<typeof schema.attachment.$inferInsert> = {}) => ({
	publicId: `portfolio/test-crud/${id}`,
	version: 1,
	format: "png",
	bytes: 100,
	ownerId: "sita",
	...values,
});

describe("prepareAccountDeletion", () => {
	it("queues the user's unsaved uploads for cleanup, leaving linked and other users' images", async () => {
		const { db } = testDb;
		await db
			.insert(schema.attachment)
			.values([
				upload("pending"),
				upload("linked", { entityType: "test-crud", entityId: "item-1" }),
				upload("someone-else", { ownerId: testDb.adminId }),
			]);
		const now = new Date("2026-10-19T00:00:00Z");
		expect(await prepareAccountDeletion(db, "sita", now)).toEqual({ ok: true, queuedAttachments: 1 });
		const rows = await db.select().from(schema.attachment);
		const removed = rows.filter((row) => row.deletedAt !== null).map((row) => row.publicId);
		expect(removed).toEqual(["portfolio/test-crud/pending"]);
	});

	it("refuses to delete the last active admin, and allows it once another admin exists", async () => {
		const { db, adminId } = testDb;
		expect(await prepareAccountDeletion(db, adminId)).toEqual({ ok: false, reason: "LAST_ADMIN" });
		// A banned admin can't sign in, so it doesn't count.
		await db
			.insert(schema.user)
			.values({ id: "admin-2", name: "B", email: "b@example.com", role: "admin", banned: true });
		expect(await prepareAccountDeletion(db, adminId)).toEqual({ ok: false, reason: "LAST_ADMIN" });
		await db.update(schema.user).set({ banned: false }).where(eq(schema.user.id, "admin-2"));
		expect(await prepareAccountDeletion(db, adminId)).toMatchObject({ ok: true });
	});

	it("lets an ordinary user go even when there's one admin", async () => {
		expect(await prepareAccountDeletion(testDb.db, "sita")).toMatchObject({ ok: true });
	});
});

describe("exportAccountData", () => {
	it("contains the user's own data and no secrets", async () => {
		const { db } = testDb;
		const created = new Date("2026-10-01T00:00:00Z");
		await db.insert(schema.account).values({
			id: "acc-1",
			accountId: "sita",
			providerId: "credential",
			userId: "sita",
			password: "hash-that-must-not-leak",
			updatedAt: created,
		});
		await db.insert(schema.session).values({
			id: "ses-1",
			token: "token-that-must-not-leak",
			userId: "sita",
			expiresAt: new Date("2026-11-01T00:00:00Z"),
			updatedAt: created,
			userAgent: "Firefox",
		});
		await db.insert(schema.twoFactor).values({
			id: "2fa-1",
			userId: "sita",
			secret: "secret-that-must-not-leak",
			backupCodes: "codes-that-must-not-leak",
		});
		await db.insert(schema.attachment).values(upload("photo"));

		const data = await exportAccountData(db, "sita", new Date("2026-10-19T12:00:00Z"));
		expect(data).toMatchObject({
			format: 1,
			exportedAt: "2026-10-19T12:00:00.000Z",
			profile: { id: "sita", email: "sita@example.com", name: "Sita" },
			signInMethods: [{ providerId: "credential" }],
			sessions: [{ userAgent: "Firefox" }],
			uploads: [{ publicId: "portfolio/test-crud/photo" }],
			roles: [],
			items: [],
		});
		expect(JSON.stringify(data)).not.toMatch(/must-not-leak/);
		expect(await exportAccountData(db, "nobody")).toBeNull();
		await db.delete(schema.twoFactor);
	});
});
