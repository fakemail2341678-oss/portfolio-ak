import "@tanstack/react-start/server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { ImageAsset } from "@/features/attachments/schema";
import {
	type PublicTestCrudDetail,
	type PublicTestCrudPage,
	publicTestCrudCard,
	publicTestCrudDetail,
	type TestCrudDetail,
	type TestCrudInput,
	type TestCrudListItem,
	type TestCrudPage,
	type TestCrudStatus,
	testCrudDetail,
	testCrudListItem,
} from "@/features/test-crud/schema";
import type { TestCrudListInput } from "@/features/test-crud/search";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import {
	AttachmentLinkError,
	listForEntities,
	removeForEntities,
	syncEntityAttachments,
} from "@/server/attachments/repository";
import { findOrThrow, isValueFree, listPage, notFound, uniqueViolation, updateVersioned } from "@/server/db/crud";
import { allOf, dateRange, numberRange, overlapsAny, textSearch } from "@/server/db/list";
import { type AttachmentRow, attachment, testCrud } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

/**
 * Test CRUD data access: plain functions over an injected Drizzle database (Neon
 * in the app, PGlite in tests), built from the CRUD helpers (src/server/db/crud.ts).
 * Writes take the service's transaction. Images are attachments
 * (src/server/attachments): `store` builds their URLs; without one (Cloudinary
 * not configured) items simply have no images.
 */

/** The attachments' entity type for Test CRUD items. */
export const ENTITY = "test-crud";
const WHAT = "Test CRUD item";

/** Sortable fields of the admin list (testCrudList's sorts). */
const SORT_COLUMNS = { updated: testCrud.updatedAt, title: testCrud.title, price: testCrud.price };

export type TestCrudRow = typeof testCrud.$inferSelect;

/** The rows as DTOs, with their live images (one query for the whole page; none without a store). */
async function withImages<T>(
	db: Db,
	store: ImageStore | null,
	rows: ReadonlyArray<TestCrudRow>,
	toDto: (row: TestCrudRow, images: ImageAsset[]) => T,
): Promise<T[]> {
	const images = new Map<string, ImageAsset[]>();
	if (store && rows.length > 0) {
		const linked = await listForEntities(
			db,
			ENTITY,
			rows.map((row) => row.id),
		);
		for (const [id, list] of linked) {
			images.set(
				id,
				list.map((row) => toImageAsset(store, row)),
			);
		}
	}
	return rows.map((row) => toDto(row, images.get(row.id) ?? []));
}

const listItem = (row: TestCrudRow, images: ImageAsset[]): TestCrudListItem =>
	testCrudListItem.parse({ ...row, image: images[0] ?? null });

/** The body is sanitized again on the way out: defence in depth for rows not written by this code. */
const detail = (row: TestCrudRow, images: ImageAsset[]): TestCrudDetail =>
	testCrudDetail.parse({ ...row, image: images[0] ?? null, images, body: sanitizeRichText(row.body) });

const one = async <T>(
	db: Db,
	store: ImageStore | null,
	row: TestCrudRow,
	toDto: (row: TestCrudRow, images: ImageAsset[]) => T,
) => {
	const [dto] = await withImages(db, store, [row], toDto);
	if (!dto) throw notFound(WHAT);
	return dto;
};

/** Items with (or without) at least one live image. */
const hasImages = sql`exists (select 1 from ${attachment} where ${attachment.entityType} = ${ENTITY} and ${attachment.entityId} = ${testCrud.id}::text and ${attachment.deletedAt} is null)`;

export function listTestCrud(db: Db, input: TestCrudListInput, store: ImageStore | null): Promise<TestCrudPage> {
	return listPage(db, testCrud, {
		input,
		where: allOf(
			input.status === "all" ? undefined : eq(testCrud.status, input.status),
			textSearch(input.q, [testCrud.title, testCrud.slug, testCrud.summary]),
			overlapsAny(testCrud.tags, input.tags),
			numberRange(testCrud.price, input.priceMin, input.priceMax),
			dateRange(testCrud.publishedAt, input.from, input.to),
			input.hasImage === undefined ? undefined : input.hasImage ? hasImages : sql`not ${hasImages}`,
		),
		sort: { columns: SORT_COLUMNS, fallback: "updated" },
		map: (rows) => withImages(db, store, rows, listItem),
	});
}

/** Every tag in use, alphabetical (options for the tag filter). */
export async function listTestCrudTags(db: Db): Promise<string[]> {
	const rows = await db
		.selectDistinct({ tag: sql<string>`unnest(${testCrud.tags})` })
		.from(testCrud)
		.orderBy(sql`1`)
		.limit(200);
	return rows.map((row) => row.tag);
}

export async function getTestCrud(db: Db, id: string, store: ImageStore | null): Promise<TestCrudDetail> {
	return one(db, store, await findOrThrow(db, testCrud, id, WHAT), detail);
}

/** Whether no item but `exceptId` (the one being edited) uses `slug`: the form's check while typing. */
export const isSlugFree = (db: Db, slug: string, exceptId?: string) =>
	isValueFree(db, testCrud, testCrud.slug, slug, exceptId);

/** Known save failures become user-facing errors (a taken slug on its field); anything else propagates. */
const saveError = (error: unknown) => {
	if (error instanceof AttachmentLinkError) return ruleError("BAD_REQUEST", error.message, m.attachments_error_link());
	return uniqueViolation(error, { test_crud_slug_unique: { field: "slug", message: m.validation_slug_taken } });
};

/** Published keeps its first publish date; a draft has none. */
const publishedAt = (status: TestCrudStatus, now: Date) =>
	status === "published" ? sql`coalesce(${testCrud.publishedAt}, ${now.toISOString()}::timestamptz)` : null;

const fields = (input: TestCrudInput) => ({
	title: input.title,
	slug: input.slug,
	summary: input.summary,
	body: sanitizeRichText(input.body),
	status: input.status,
	price: input.price,
	phone: input.phone || null,
	tags: input.tags,
});

type WriteOptions = { userId: string; store: ImageStore | null; now?: Date };

/** Creates an item and links its images (the creator's pending uploads). Call inside the service's transaction. */
export async function createTestCrud(tx: Tx, input: TestCrudInput, options: WriteOptions): Promise<TestCrudDetail> {
	try {
		const [row] = await tx
			.insert(testCrud)
			.values({
				...fields(input),
				createdBy: options.userId,
				publishedAt: input.status === "published" ? (options.now ?? new Date()) : null,
			})
			.returning();
		if (!row) throw notFound(WHAT);
		await syncEntityAttachments(tx, { entityType: ENTITY, entityId: row.id, ownerId: options.userId }, input.images);
		return await one(tx, options.store, row, detail);
	} catch (error) {
		throw saveError(error);
	}
}

/**
 * Updates an item and its images, if it still has `version` (the `updatedAt`
 * the edit started from; otherwise a stale CONFLICT and nothing is written).
 * Returns the item before the save (for the audit summary) and the images it no
 * longer has (marked removed), so the caller can delete their assets.
 */
export async function updateTestCrud(
	tx: Tx,
	id: string,
	input: TestCrudInput,
	options: WriteOptions & { version: string },
): Promise<{ item: TestCrudDetail; before: TestCrudDetail; removed: AttachmentRow[] }> {
	try {
		const before = await one(tx, options.store, await findOrThrow(tx, testCrud, id, WHAT), detail);
		const row = await updateVersioned(tx, testCrud, {
			id,
			version: options.version,
			set: { ...fields(input), publishedAt: publishedAt(input.status, options.now ?? new Date()) },
			what: WHAT,
		});
		const removed = await syncEntityAttachments(
			tx,
			{ entityType: ENTITY, entityId: id, ownerId: options.userId },
			input.images,
			options.now,
		);
		return { item: await one(tx, options.store, row, detail), before, removed };
	} catch (error) {
		throw saveError(error);
	}
}

/**
 * Publish / unpublish from the list: one UPDATE, which also locks the row. The
 * item as it is now, and whether its status changed (setting the status it
 * already has changes nothing).
 */
export async function setTestCrudStatus(
	tx: Tx,
	id: string,
	status: TestCrudStatus,
	store: ImageStore | null,
	now = new Date(),
): Promise<{ item: TestCrudListItem; changed: boolean }> {
	const [row] = await tx
		.update(testCrud)
		.set({ status, publishedAt: publishedAt(status, now) })
		.where(and(eq(testCrud.id, id), ne(testCrud.status, status)))
		.returning();
	if (row) return { item: await one(tx, store, row, listItem), changed: true };
	return { item: await one(tx, store, await findOrThrow(tx, testCrud, id, WHAT), listItem), changed: false };
}

/** Deletes rows; their images are marked removed (returned, for asset deletion). `items` are the rows deleted. */
export async function deleteTestCrud(
	tx: Tx,
	ids: ReadonlyArray<string>,
): Promise<{ items: Array<{ id: string; title: string; status: TestCrudStatus }>; removed: AttachmentRow[] }> {
	const items = await tx
		.delete(testCrud)
		.where(inArray(testCrud.id, [...ids]))
		.returning({ id: testCrud.id, title: testCrud.title, status: testCrud.status });
	const removed = await removeForEntities(
		tx,
		ENTITY,
		items.map((row) => row.id),
	);
	return { items, removed };
}

// ---------------------------------------------------------------------------
// Public queries: ONLY published rows ever leave these functions.
// ---------------------------------------------------------------------------

const isPublished = eq(testCrud.status, "published");

/** Published rows always have a date; fall back defensively for hand-edited data. */
const publicCard = (row: TestCrudRow, images: ImageAsset[]) =>
	publicTestCrudCard.parse({ ...row, image: images[0] ?? null, publishedAt: row.publishedAt ?? row.updatedAt });

/** Newest first: a fixed order, so the public list has no sort param. */
export function listPublishedTestCrud(
	db: Db,
	input: { q: string; page: number },
	pageSize: number,
	store: ImageStore | null,
): Promise<PublicTestCrudPage> {
	return listPage(db, testCrud, {
		input: { ...input, pageSize, sort: "-published" },
		where: allOf(isPublished, textSearch(input.q, [testCrud.title, testCrud.summary])),
		sort: { columns: { published: testCrud.publishedAt }, fallback: "published" },
		map: (rows) => withImages(db, store, rows, publicCard),
	});
}

/** A published item by slug, or null (missing and draft look the same to the public). */
export async function getPublishedTestCrud(
	db: Db,
	slug: string,
	store: ImageStore | null,
): Promise<PublicTestCrudDetail | null> {
	const [row] = await db
		.select()
		.from(testCrud)
		.where(and(eq(testCrud.slug, slug), isPublished));
	if (!row) return null;
	return one(db, store, row, (item, images) =>
		publicTestCrudDetail.parse({
			...item,
			image: images[0] ?? null,
			images,
			publishedAt: item.publishedAt ?? item.updatedAt,
			body: sanitizeRichText(item.body),
		}),
	);
}
