import "@tanstack/react-start/server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
	type PortfolioStatus,
	type PostDetail,
	type PostInput,
	type PostListItem,
	type PostPage,
	postDetail,
	postListItem,
} from "@/features/portfolio/schema";
import type { PostListInput } from "@/features/portfolio/search";
import { ruleError } from "@/lib/errors";
import type { Localized } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { findOrThrow, isValueFree, listPage, notFound, uniqueViolation, updateVersioned } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { type PortfolioPostRow, portfolioPost } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { lockMedia, mediaAssets } from "@/server/media/repository";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

/**
 * Journal posts (decision 0176): the body is rich-text HTML per language,
 * sanitized before it is stored and again on the way out. The cover is a
 * media-library item. Writes take the service's transaction.
 */

const WHAT = "Post";
const SORT_COLUMNS = {
	// Drafts (no date yet) first when newest first.
	published: sql`coalesce(${portfolioPost.publishedAt}, 'infinity'::timestamptz)`,
	updated: portfolioPost.updatedAt,
	title: sql`${portfolioPost.title}->>'en'`,
};

/** Both languages sanitized: the editor's output, or a stored row (defence in depth). */
export const sanitizeLocalized = (body: Localized): Localized => ({
	en: sanitizeRichText(body.en),
	ne: sanitizeRichText(body.ne),
});

async function withCovers(db: Db | Tx, store: ImageStore | null, rows: ReadonlyArray<PortfolioPostRow>) {
	const assets = await mediaAssets(
		db,
		store,
		rows.map((row) => row.coverId),
	);
	return rows.map((row) => ({ row, cover: row.coverId ? (assets.get(row.coverId) ?? null) : null }));
}

const detail = async (db: Db | Tx, store: ImageStore | null, row: PortfolioPostRow): Promise<PostDetail> => {
	const [entry] = await withCovers(db, store, [row]);
	return postDetail.parse({ ...row, cover: entry?.cover ?? null, body: sanitizeLocalized(row.body) });
};

export function listPosts(db: Db, input: PostListInput, store: ImageStore | null): Promise<PostPage> {
	return listPage(db, portfolioPost, {
		input,
		where: allOf(
			input.status === "all" ? undefined : eq(portfolioPost.status, input.status),
			textSearch(input.q, [
				sql`${portfolioPost.title}->>'en'`,
				sql`${portfolioPost.title}->>'ne'`,
				portfolioPost.slug,
				sql`array_to_string(${portfolioPost.tags}, ' ')`,
			]),
		),
		sort: { columns: SORT_COLUMNS, fallback: "published" },
		map: async (rows) =>
			(await withCovers(db, store, rows)).map(({ row, cover }) => postListItem.parse({ ...row, cover })),
	});
}

export async function getPost(db: Db, id: string, store: ImageStore | null): Promise<PostDetail> {
	return detail(db, store, await findOrThrow(db, portfolioPost, id, WHAT));
}

export const isSlugFree = (db: Db, slug: string, exceptId?: string) =>
	isValueFree(db, portfolioPost, portfolioPost.slug, slug, exceptId);

const saveError = (error: unknown) =>
	uniqueViolation(error, { portfolio_post_slug_unique: { field: "slug", message: m.validation_slug_taken } });

const publishedAt = (status: PortfolioStatus, now: Date) =>
	status === "published" ? sql`coalesce(${portfolioPost.publishedAt}, ${now.toISOString()}::timestamptz)` : null;

const fields = (input: PostInput) => ({ ...input, body: sanitizeLocalized(input.body) });

/**
 * Saves may change the status only with portfolio:publish (`canPublish`): without
 * it a save keeps the status the record had (a new one must be a draft).
 */
type WriteOptions = { userId: string; store: ImageStore | null; canPublish: boolean; now?: Date };

const refusePublish = () =>
	ruleError("FORBIDDEN", "Missing permission: portfolio:publish", m.portfolio_error_publish());

export async function createPost(tx: Tx, input: PostInput, options: WriteOptions): Promise<PostDetail> {
	try {
		if (input.status !== "draft" && !options.canPublish) throw refusePublish();
		await lockMedia(tx, [{ id: input.coverId, field: "cover" }]);
		const [row] = await tx
			.insert(portfolioPost)
			.values({
				...fields(input),
				createdBy: options.userId,
				publishedAt: input.status === "published" ? (options.now ?? new Date()) : null,
			})
			.returning();
		if (!row) throw notFound(WHAT);
		return await detail(tx, options.store, row);
	} catch (error) {
		throw saveError(error);
	}
}

export async function updatePost(
	tx: Tx,
	id: string,
	input: PostInput,
	options: WriteOptions & { version: string },
): Promise<{ before: PostDetail; item: PostDetail }> {
	try {
		await lockMedia(tx, [{ id: input.coverId, field: "cover" }]);
		const before = await detail(tx, options.store, await findOrThrow(tx, portfolioPost, id, WHAT));
		if (before.status !== input.status && !options.canPublish) throw refusePublish();
		const row = await updateVersioned(tx, portfolioPost, {
			id,
			version: options.version,
			set: { ...fields(input), publishedAt: publishedAt(input.status, options.now ?? new Date()) },
			what: WHAT,
		});
		return { before, item: await detail(tx, options.store, row) };
	} catch (error) {
		throw saveError(error);
	}
}

export async function setPostStatus(
	tx: Tx,
	id: string,
	status: PortfolioStatus,
	store: ImageStore | null,
	now = new Date(),
): Promise<{ item: PostListItem; changed: boolean }> {
	const [row] = await tx
		.update(portfolioPost)
		.set({ status, publishedAt: publishedAt(status, now) })
		.where(and(eq(portfolioPost.id, id), ne(portfolioPost.status, status)))
		.returning();
	const current = row ?? (await findOrThrow(tx, portfolioPost, id, WHAT));
	const [entry] = await withCovers(tx, store, [current]);
	return { item: postListItem.parse({ ...current, cover: entry?.cover ?? null }), changed: Boolean(row) };
}

export async function deletePosts(
	tx: Tx,
	ids: ReadonlyArray<string>,
): Promise<Array<{ id: string; title: Localized; status: PortfolioStatus }>> {
	return tx
		.delete(portfolioPost)
		.where(inArray(portfolioPost.id, [...ids]))
		.returning({ id: portfolioPost.id, title: portfolioPost.title, status: portfolioPost.status });
}
