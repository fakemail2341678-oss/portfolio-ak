import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, max, ne, notInArray, sql } from "drizzle-orm";
import {
	type PortfolioStatus,
	type ProjectDetail,
	type ProjectInput,
	type ProjectListItem,
	type ProjectOrderItem,
	type ProjectPage,
	projectDetail,
	projectListItem,
	projectOrderItem,
} from "@/features/portfolio/schema";
import type { ProjectListInput } from "@/features/portfolio/search";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { findOrThrow, isValueFree, listPage, notFound, uniqueViolation, updateVersioned } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { type PortfolioProjectRow, portfolioProject } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { lockMedia, mediaAssets } from "@/server/media/repository";

/**
 * Portfolio projects (decision 0176): plain functions over an injected Drizzle
 * database, built from the CRUD helpers (src/server/db/crud.ts). Writes take
 * the service's transaction. The cover and gallery are media-library items,
 * referenced by id and locked while a save uses them.
 */

const WHAT = "Project";
const SORT_COLUMNS = {
	order: portfolioProject.sortOrder,
	updated: portfolioProject.updatedAt,
	title: portfolioProject.title,
	year: portfolioProject.year,
};

const listItem = (row: PortfolioProjectRow, cover: ProjectListItem["cover"]) =>
	projectListItem.parse({ ...row, cover });

/** Rows as list items, with their covers (one query for the page). */
async function withCovers(db: Db | Tx, store: ImageStore | null, rows: ReadonlyArray<PortfolioProjectRow>) {
	const assets = await mediaAssets(
		db,
		store,
		rows.map((row) => row.coverId),
	);
	return rows.map((row) => listItem(row, row.coverId ? (assets.get(row.coverId) ?? null) : null));
}

async function detail(db: Db | Tx, store: ImageStore | null, row: PortfolioProjectRow): Promise<ProjectDetail> {
	const assets = await mediaAssets(db, store, [row.coverId, ...row.gallery]);
	return projectDetail.parse({
		...row,
		appSlug: row.appSlug ?? "", // @apps
		cover: row.coverId ? (assets.get(row.coverId) ?? null) : null,
		gallery: row.gallery.flatMap((id) => assets.get(id) ?? []),
	});
}

export function listProjects(db: Db, input: ProjectListInput, store: ImageStore | null): Promise<ProjectPage> {
	return listPage(db, portfolioProject, {
		input,
		where: allOf(
			input.status === "all" ? undefined : eq(portfolioProject.status, input.status),
			textSearch(input.q, [
				portfolioProject.title,
				portfolioProject.slug,
				sql`${portfolioProject.client}->>'en'`,
				sql`${portfolioProject.client}->>'ne'`,
			]),
		),
		sort: { columns: SORT_COLUMNS, fallback: "order" },
		map: (rows) => withCovers(db, store, rows),
	});
}

/** Every project in display order (the reorder dialog). */
export async function listProjectOrder(db: Db): Promise<ProjectOrderItem[]> {
	const rows = await db
		.select()
		.from(portfolioProject)
		.orderBy(asc(portfolioProject.sortOrder), asc(portfolioProject.title));
	return rows.map((row) => projectOrderItem.parse(row));
}

export async function getProject(db: Db, id: string, store: ImageStore | null): Promise<ProjectDetail> {
	return detail(db, store, await findOrThrow(db, portfolioProject, id, WHAT));
}

export const isSlugFree = (db: Db, slug: string, exceptId?: string) =>
	isValueFree(db, portfolioProject, portfolioProject.slug, slug, exceptId);

const saveError = (error: unknown) =>
	uniqueViolation(error, { portfolio_project_slug_unique: { field: "slug", message: m.validation_slug_taken } });

/** Published keeps its first publish date; a draft has none. */
const publishedAt = (status: PortfolioStatus, now: Date) =>
	status === "published" ? sql`coalesce(${portfolioProject.publishedAt}, ${now.toISOString()}::timestamptz)` : null;

const fields = (input: ProjectInput) => ({
	...input,
	appSlug: input.appSlug || null, // @apps
});

/** The media a save references, each reported on its form field when it isn't a live library item. */
const mediaRefs = (input: ProjectInput) => [
	{ id: input.coverId, field: "cover" },
	...input.gallery.map((id) => ({ id, field: "gallery" })),
];

/**
 * Saves may change the status only with portfolio:publish (`canPublish`): without
 * it a save keeps the status the record had (a new one must be a draft).
 */
type WriteOptions = { userId: string; store: ImageStore | null; canPublish: boolean; now?: Date };

const refusePublish = () =>
	ruleError("FORBIDDEN", "Missing permission: portfolio:publish", m.portfolio_error_publish());

/** Creates a project, last in the display order. Call inside the service's transaction. */
export async function createProject(tx: Tx, input: ProjectInput, options: WriteOptions): Promise<ProjectDetail> {
	try {
		if (input.status !== "draft" && !options.canPublish) throw refusePublish();
		await lockMedia(tx, mediaRefs(input));
		const [last] = await tx.select({ order: max(portfolioProject.sortOrder) }).from(portfolioProject);
		const [row] = await tx
			.insert(portfolioProject)
			.values({
				...fields(input),
				sortOrder: (last?.order ?? -1) + 1,
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

/** Saves a project if it still has `version` (else a stale CONFLICT). Returns it before and after. */
export async function updateProject(
	tx: Tx,
	id: string,
	input: ProjectInput,
	options: WriteOptions & { version: string },
): Promise<{ before: ProjectDetail; item: ProjectDetail }> {
	try {
		await lockMedia(tx, mediaRefs(input));
		const before = await detail(tx, options.store, await findOrThrow(tx, portfolioProject, id, WHAT));
		if (before.status !== input.status && !options.canPublish) throw refusePublish();
		const row = await updateVersioned(tx, portfolioProject, {
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

/** Publish / unpublish from the list: the project as it is now, and whether its status changed. */
export async function setProjectStatus(
	tx: Tx,
	id: string,
	status: PortfolioStatus,
	store: ImageStore | null,
	now = new Date(),
): Promise<{ item: ProjectListItem; changed: boolean }> {
	const [row] = await tx
		.update(portfolioProject)
		.set({ status, publishedAt: publishedAt(status, now) })
		.where(and(eq(portfolioProject.id, id), ne(portfolioProject.status, status)))
		.returning();
	const current = row ?? (await findOrThrow(tx, portfolioProject, id, WHAT));
	const [item] = await withCovers(tx, store, [current]);
	if (!item) throw notFound(WHAT);
	return { item, changed: Boolean(row) };
}

export async function deleteProjects(
	tx: Tx,
	ids: ReadonlyArray<string>,
): Promise<Array<{ id: string; title: string; status: PortfolioStatus }>> {
	return tx
		.delete(portfolioProject)
		.where(inArray(portfolioProject.id, [...ids]))
		.returning({ id: portfolioProject.id, title: portfolioProject.title, status: portfolioProject.status });
}

/**
 * Puts the projects in the order of `ids` (the first shows first). Projects not
 * listed keep their place after them. The version (`updatedAt`) is kept: moving
 * a project doesn't make someone's open edit of it stale.
 */
export async function reorderProjects(tx: Tx, ids: ReadonlyArray<string>): Promise<number> {
	let moved = 0;
	for (const [index, id] of ids.entries()) {
		const rows = await tx
			.update(portfolioProject)
			.set({ sortOrder: index, updatedAt: sql`${portfolioProject.updatedAt}` })
			.where(and(eq(portfolioProject.id, id), ne(portfolioProject.sortOrder, index)))
			.returning({ id: portfolioProject.id });
		moved += rows.length;
	}
	const rest = await tx
		.select({ id: portfolioProject.id })
		.from(portfolioProject)
		.where(notInArray(portfolioProject.id, [...ids]))
		.orderBy(asc(portfolioProject.sortOrder), asc(portfolioProject.title));
	for (const [offset, row] of rest.entries()) {
		await tx
			.update(portfolioProject)
			.set({ sortOrder: ids.length + offset, updatedAt: sql`${portfolioProject.updatedAt}` })
			.where(eq(portfolioProject.id, row.id));
	}
	return moved;
}
