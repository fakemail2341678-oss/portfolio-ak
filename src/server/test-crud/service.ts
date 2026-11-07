import "@tanstack/react-start/server-only";
import type {
	PublicTestCrudDetail,
	PublicTestCrudPage,
	TestCrudDetail,
	TestCrudInput,
	TestCrudListItem,
	TestCrudPage,
	TestCrudStatus,
} from "@/features/test-crud/schema";
import type { TestCrudListInput } from "@/features/test-crud/search";
import { captureServerEvent } from "@/server/analytics/posthog";
import { purge } from "@/server/attachments/service";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import type { Services } from "@/server/services";
import * as repo from "./repository";

/**
 * What the Test CRUD server functions do once the permission check and input
 * validation have passed (src/functions/test-crud*.ts call these and nothing
 * else). Plain functions over the call's services, tested on PGlite. Every
 * change is audited in its own transaction (withAudit, decisions 0132 and 0173).
 */

type Reads = Pick<Services, "db" | "imageStore">;

const target = (item: { id: string; title: string }) => ({
	type: "test-crud" as const,
	id: item.id,
	label: item.title,
});

/** What an edit compares, and what its audit row shows: the body and the image ids count, but are left out of the row (long). */
const SUMMARIZED = ["title", "slug", "summary", "status", "price", "phone", "tags"] as const;
const COMPARED = [...SUMMARIZED, "body", "images"] as const;
const summary = (item: Omit<TestCrudDetail, "images"> & { images: ReadonlyArray<{ id: string }> }) => ({
	title: item.title,
	slug: item.slug,
	summary: item.summary,
	status: item.status,
	price: item.price,
	phone: item.phone || null,
	tags: item.tags,
	body: item.body,
	images: item.images.map((image) => image.id),
});

export const list = ({ db, imageStore }: Reads, input: TestCrudListInput): Promise<TestCrudPage> =>
	repo.listTestCrud(db, input, imageStore);

export const listTags = ({ db }: Pick<Services, "db">): Promise<string[]> => repo.listTestCrudTags(db);

export const get = ({ db, imageStore }: Reads, id: string): Promise<TestCrudDetail> =>
	repo.getTestCrud(db, id, imageStore);

export const isSlugFree = ({ db }: Pick<Services, "db">, input: { slug: string; id?: string | undefined }) =>
	repo.isSlugFree(db, input.slug, input.id);

export async function create({ db, actor, imageStore }: Services, input: TestCrudInput): Promise<TestCrudDetail> {
	const item = await withAudit(db, actor, async (tx, audit) => {
		const created = await repo.createTestCrud(tx, input, { userId: actor.id, store: imageStore });
		audit({
			action: "test-crud.create",
			target: target(created),
			after: { title: created.title, status: created.status },
		});
		return created;
	});
	await captureServerEvent("test_crud_created", actor.id, { item_id: item.id, status: item.status });
	return item;
}

/**
 * Saves the item and its images, if nobody changed it since `updatedAt` (else a
 * stale CONFLICT). Images it no longer uses are deleted from Cloudinary right
 * away; if that fails, the scheduled cleanup retries.
 */
export async function update(
	{ db, actor, imageStore }: Services,
	{ id, updatedAt, ...input }: TestCrudInput & { id: string; updatedAt: string },
): Promise<TestCrudDetail> {
	const { item, removed } = await withAudit(db, actor, async (tx, audit) => {
		const saved = await repo.updateTestCrud(tx, id, input, { userId: actor.id, store: imageStore, version: updatedAt });
		const changed = changes(summary(saved.before), summary(saved.item), COMPARED, SUMMARIZED);
		if (changed) audit({ action: "test-crud.update", target: target(saved.item), ...changed });
		return saved;
	});
	await purge(db, imageStore, removed);
	await captureServerEvent("test_crud_updated", actor.id, { item_id: item.id, change: "edit" });
	return item;
}

/** Publish / unpublish; setting the status it already has records nothing. */
export async function setStatus(
	{ db, actor, imageStore }: Services,
	{ id, status }: { id: string; status: TestCrudStatus },
): Promise<TestCrudListItem> {
	const item = await withAudit(db, actor, async (tx, audit) => {
		const result = await repo.setTestCrudStatus(tx, id, status, imageStore);
		if (result.changed) {
			audit({
				action: status === "published" ? "test-crud.publish" : "test-crud.unpublish",
				target: target(result.item),
				before: { status: status === "published" ? "draft" : "published" },
				after: { status },
			});
		}
		return result.item;
	});
	await captureServerEvent("test_crud_updated", actor.id, { item_id: item.id, change: "status", status: item.status });
	return item;
}

/** Deletes one or many (and their images), one audit row each; missing ids are ignored. */
export async function remove(
	{ db, actor, imageStore }: Services,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const { items, removed } = await withAudit(db, actor, async (tx, audit) => {
		const result = await repo.deleteTestCrud(tx, ids);
		audit(
			...result.items.map((item) => ({
				action: "test-crud.delete" as const,
				target: target(item),
				before: { title: item.title, status: item.status },
			})),
		);
		return result;
	});
	await purge(db, imageStore, removed);
	if (items.length > 0) await captureServerEvent("test_crud_deleted", actor.id, { count: items.length });
	return { deleted: items.length };
}

// Public reads (/dev/test-crud): no actor, published rows only.

export const listPublished = (
	{ db, imageStore }: Reads,
	input: { q: string; page: number },
	pageSize: number,
): Promise<PublicTestCrudPage> => repo.listPublishedTestCrud(db, input, pageSize, imageStore);

/** Missing and draft slugs are both NOT_FOUND. */
export async function getPublished({ db, imageStore }: Reads, slug: string): Promise<PublicTestCrudDetail> {
	const item = await repo.getPublishedTestCrud(db, slug, imageStore);
	if (!item) throw notFound("Test CRUD item");
	return item;
}
