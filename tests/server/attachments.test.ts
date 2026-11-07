import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, FORM_ERROR_KEY } from "@/lib/errors";
import { signParams } from "@/server/attachments/cloudinary";
import { cleanup, confirmUpload, discardUpload, ORPHAN_AFTER_MS, signUpload } from "@/server/attachments/service";
import * as schema from "@/server/db/schema";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * The upload flow (sign -> direct upload -> verify -> pending -> linked/removed
 * -> cleanup) against PGlite and the real Cloudinary client over a fake API.
 */
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let cloud: ReturnType<typeof createFakeCloudinary>;
beforeAll(async () => {
	testDb = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values({ id: "other", name: "O", email: "o@example.com" }),
	);
}, 60_000);
afterAll(() => testDb.close());
beforeEach(async () => {
	await testDb.reset();
	cloud = createFakeCloudinary();
});

const userMessage = (error: unknown) => (error as AppError).fieldErrors?.[FORM_ERROR_KEY]?.[0];
const rejection = (run: () => Promise<unknown>) => run().catch((caught: unknown) => caught);

/** Who uploads: an id and their permissions (a library scope needs its own). */
const uploader = (id = testDb.adminId, permissions: string[] = []) => ({ id, permissions });

describe("signatures (Cloudinary's documented examples)", () => {
	it("signs sorted params with the secret appended (SHA-1 hex)", () => {
		expect(signParams({ timestamp: 1315060510 }, "abcd")).toBe("a21ad0f63beb4de2e5575204b79ab90bffb02c10");
		expect(
			signParams(
				{ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 },
				"abcd",
			),
		).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
	});

	it("an upload ticket fixes the public_id and formats, and is signed over exactly what is sent", () => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		expect(ticket.url).toBe("https://api.cloudinary.test/v1_1/demo/image/upload");
		expect(ticket.publicId).toMatch(/^portfolio\/test-crud\/[0-9a-f-]{36}$/);
		const { signature, api_key, ...signed } = ticket.fields;
		expect(api_key).toBe(cloud.config.apiKey);
		expect(signed).toMatchObject({
			public_id: ticket.publicId,
			overwrite: "false",
			allowed_formats: "jpg,jpeg,png,webp,avif,gif",
		});
		expect(signature).toBe(signParams(signed, cloud.config.apiSecret));
		// The secret itself never appears in what the browser receives.
		expect(JSON.stringify(ticket)).not.toContain(cloud.config.apiSecret);
	});

	it("without Cloudinary configured, uploads are refused with a clear message", async () => {
		const error = await rejection(async () => signUpload(null, "test-crud", uploader()));
		expect(error).toBeInstanceOf(AppError);
		expect(userMessage(error)).toBe("Image uploads aren't set up on this site.");
	});
});

describe("confirmUpload (server-side verification)", () => {
	const confirm = (publicId: string, owner = testDb.adminId) =>
		confirmUpload(testDb.db, cloud.store, { publicId, scope: "test-crud" }, uploader(owner));

	it("records a verified upload as pending, with Cloudinary's real details", async () => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		cloud.put(ticket.publicId, { format: "webp", bytes: 5000, width: 800, height: 600 });
		const image = await confirm(ticket.publicId);
		expect(image).toMatchObject({ width: 800, height: 600, alt: { en: "", ne: "" }, format: "webp" });
		const [row] = await testDb.db.select().from(schema.attachment).where(eq(schema.attachment.id, image.id));
		expect(row).toMatchObject({ format: "webp", bytes: 5000, ownerId: testDb.adminId, entityType: null });
		// Confirming again (a retried request) returns the same attachment.
		expect((await confirm(ticket.publicId)).id).toBe(image.id);
		// ...but never to someone else.
		expect((await rejection(() => confirm(ticket.publicId, "other"))) as AppError).toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("refuses an upload that never arrived, or a public_id outside this app's folder", async () => {
		expect(userMessage(await rejection(() => confirm("portfolio/test-crud/never-uploaded")))).toBe(
			"The upload didn't arrive. Try again.",
		);
		cloud.put("someone/else/file");
		expect(await rejection(() => confirm("someone/else/file"))).toMatchObject({ code: "BAD_REQUEST" });
		expect(cloud.calls.filter((call) => call.includes("resources/"))).toHaveLength(1);
	});

	it("deletes and refuses a file that is too large (Cloudinary can't enforce size for signed uploads)", async () => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		cloud.put(ticket.publicId, { bytes: 11 * 1024 * 1024 });
		expect(userMessage(await rejection(() => confirm(ticket.publicId)))).toBe("The image is larger than 10 MB.");
		expect(cloud.destroyed).toEqual([ticket.publicId]);
		expect(await testDb.db.select().from(schema.attachment)).toEqual([]);
	});

	it("deletes and refuses a format outside the allowed list", async () => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		cloud.put(ticket.publicId, { format: "svg" });
		expect(userMessage(await rejection(() => confirm(ticket.publicId)))).toMatch(/isn't accepted/);
		expect(cloud.destroyed).toEqual([ticket.publicId]);
	});
});

// portfolio:start
describe("the media library scope (decision 0177)", () => {
	const librarian = () => uploader(testDb.adminId, ["attachments:upload", "media:write"]);

	it("needs media:write on top of attachments:upload, to sign and to confirm", async () => {
		expect(await rejection(async () => signUpload(cloud.store, "media", uploader()))).toMatchObject({
			code: "FORBIDDEN",
		});
		const ticket = signUpload(cloud.store, "media", librarian());
		cloud.put(ticket.publicId);
		expect(
			await rejection(() =>
				confirmUpload(testDb.db, cloud.store, { publicId: ticket.publicId, scope: "media" }, uploader()),
			),
		).toMatchObject({ code: "FORBIDDEN" });
	});

	it("takes PDFs too, and records uploads straight into the library (never pending)", async () => {
		const ticket = signUpload(cloud.store, "media", librarian());
		expect(ticket.fields.allowed_formats).toBe("jpg,jpeg,png,webp,avif,gif,pdf");
		cloud.put(ticket.publicId, { format: "pdf" });
		const file = await confirmUpload(
			testDb.db,
			cloud.store,
			{ publicId: ticket.publicId, scope: "media" },
			librarian(),
		);
		expect(file.format).toBe("pdf");
		expect(file.url).toMatch(/\/image\/upload\/v\d+\/portfolio\/media\/[0-9a-f-]{36}\.pdf$/);
		const [row] = await testDb.db.select().from(schema.attachment).where(eq(schema.attachment.id, file.id));
		expect(row?.entityType).toBe("media");
	});

	it("still refuses a PDF for other scopes", async () => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		cloud.put(ticket.publicId, { format: "pdf" });
		expect(
			userMessage(
				await rejection(() =>
					confirmUpload(testDb.db, cloud.store, { publicId: ticket.publicId, scope: "test-crud" }, uploader()),
				),
			),
		).toMatch(/isn't accepted/);
	});
});
// portfolio:end

describe("discard and cleanup", () => {
	const pending = async (owner = testDb.adminId) => {
		const ticket = signUpload(cloud.store, "test-crud", uploader());
		cloud.put(ticket.publicId);
		return {
			...(await confirmUpload(
				testDb.db,
				cloud.store,
				{ publicId: ticket.publicId, scope: "test-crud" },
				uploader(owner),
			)),
			publicId: ticket.publicId,
		};
	};

	it("discards one's own pending upload (asset and row), and ignores anyone else's", async () => {
		const mine = await pending();
		const theirs = await pending("other");
		await discardUpload(testDb.db, cloud.store, theirs.id, testDb.adminId);
		await discardUpload(testDb.db, cloud.store, mine.id, testDb.adminId);
		expect(cloud.destroyed).toEqual([mine.publicId]);
		const rows = await testDb.db.select({ id: schema.attachment.id }).from(schema.attachment);
		expect(rows.map((row) => row.id)).toEqual([theirs.id]);
	});

	it("cleanup deletes removed attachments and day-old orphans, keeps fresh pending ones", async () => {
		const fresh = await pending();
		const orphan = await pending();
		const removed = await pending();
		const now = new Date();
		await testDb.db
			.update(schema.attachment)
			.set({ createdAt: new Date(now.getTime() - ORPHAN_AFTER_MS - 60_000) })
			.where(eq(schema.attachment.id, orphan.id));
		await testDb.db
			.update(schema.attachment)
			.set({ entityType: "test-crud", entityId: "x", deletedAt: now })
			.where(eq(schema.attachment.id, removed.id));
		expect(await cleanup(testDb.db, cloud.store, now)).toEqual({ deleted: 2, failed: 0 });
		expect(cloud.destroyed.sort()).toEqual([orphan.publicId, removed.publicId].sort());
		const rows = await testDb.db.select({ id: schema.attachment.id }).from(schema.attachment);
		expect(rows.map((row) => row.id)).toEqual([fresh.id]);
	});

	it("cleanup keeps rows whose asset couldn't be deleted, for the next run", async () => {
		const removed = await pending();
		await testDb.db
			.update(schema.attachment)
			.set({ deletedAt: new Date() })
			.where(eq(schema.attachment.id, removed.id));
		cloud.failDestroy();
		expect(await cleanup(testDb.db, cloud.store)).toEqual({ deleted: 0, failed: 1 });
		cloud.failDestroy(false);
		expect(await cleanup(testDb.db, cloud.store)).toEqual({ deleted: 1, failed: 0 });
	});
});
