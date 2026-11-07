import "@tanstack/react-start/server-only";
import { and, arrayOverlaps, eq, inArray, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import type { ImageAsset } from "@/features/attachments/schema";
import { MEDIA_ENTITY, type MediaPage, type MediaUsage, mediaItem } from "@/features/media/schema";
import type { MediaListInput } from "@/features/media/search";
import { AppError } from "@/lib/errors";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import { listPage } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { type AttachmentRow, attachment, portfolioPost, portfolioProfile, portfolioProject } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * The media library (decision 0177): attachments with entity type "media",
 * uploaded at /admin/media or from a portfolio form, and referenced by id from
 * the profile, projects and posts. An item is "used" while one of those
 * references it; only unused items can be deleted.
 */

const isLibrary = and(eq(attachment.entityType, MEDIA_ENTITY), isNull(attachment.deletedAt));

/** The file name of a public id ("portfolio/media/<uuid>" → "<uuid>.jpg"). */
const fileName = (row: AttachmentRow) => `${row.publicId.split("/").at(-1) ?? row.publicId}.${row.format}`;

/** Every record using any of `ids`, grouped by item (one query per kind of user, never per item). */
export async function usageOf(db: Db | Tx, ids: ReadonlyArray<string>): Promise<Map<string, MediaUsage[]>> {
	const usage = new Map<string, MediaUsage[]>();
	if (ids.length === 0) return usage;
	const list = [...ids];
	const add = (mediaId: string | null, entry: MediaUsage) => {
		if (mediaId && list.includes(mediaId)) usage.set(mediaId, [...(usage.get(mediaId) ?? []), entry]);
	};
	const [profiles, projects, posts] = await Promise.all([
		db
			.select({
				portraitId: portfolioProfile.portraitId,
				resumeId: portfolioProfile.resumeId,
				ogImageId: portfolioProfile.ogImageId,
			})
			.from(portfolioProfile)
			.where(
				or(
					inArray(portfolioProfile.portraitId, list),
					inArray(portfolioProfile.resumeId, list),
					inArray(portfolioProfile.ogImageId, list),
				),
			),
		db
			.select({
				id: portfolioProject.id,
				title: portfolioProject.title,
				coverId: portfolioProject.coverId,
				gallery: portfolioProject.gallery,
			})
			.from(portfolioProject)
			.where(or(inArray(portfolioProject.coverId, list), arrayOverlaps(portfolioProject.gallery, list))),
		db
			.select({ id: portfolioPost.id, title: portfolioPost.title, coverId: portfolioPost.coverId })
			.from(portfolioPost)
			.where(inArray(portfolioPost.coverId, list)),
	]);
	for (const profile of profiles) {
		const entry = { type: "profile" as const, id: "profile", label: m.media_used_by_profile() };
		for (const id of new Set([profile.portraitId, profile.resumeId, profile.ogImageId])) add(id, entry);
	}
	for (const project of projects) {
		const entry = { type: "project" as const, id: project.id, label: project.title };
		for (const id of new Set([project.coverId, ...project.gallery])) add(id, entry);
	}
	for (const post of posts) add(post.coverId, { type: "post", id: post.id, label: localizedValue(post.title) });
	return usage;
}

/** Library items used (or not) by anything, as a filter. */
const used = sql`(
	exists (select 1 from ${portfolioProfile} where ${attachment.id} in (${portfolioProfile.portraitId}, ${portfolioProfile.resumeId}, ${portfolioProfile.ogImageId}))
	or exists (select 1 from ${portfolioProject} where ${portfolioProject.coverId} = ${attachment.id} or ${attachment.id} = any(${portfolioProject.gallery}))
	or exists (select 1 from ${portfolioPost} where ${portfolioPost.coverId} = ${attachment.id})
)`;

const kindFilter = (kind: MediaListInput["kind"]): SQL | undefined =>
	kind === "all" ? undefined : kind === "document" ? eq(attachment.format, "pdf") : ne(attachment.format, "pdf");

export function listMedia(db: Db, input: MediaListInput, store: ImageStore): Promise<MediaPage> {
	return listPage(db, attachment, {
		input,
		where: allOf(
			isLibrary,
			textSearch(input.q, [sql`${attachment.alt}->>'en'`, sql`${attachment.alt}->>'ne'`, attachment.publicId]),
			kindFilter(input.kind),
			input.usage === "all" ? undefined : input.usage === "used" ? used : sql`not ${used}`,
		),
		sort: { columns: { uploaded: attachment.createdAt }, fallback: "uploaded" },
		map: async (rows) => {
			const usage = await usageOf(
				db,
				rows.map((row) => row.id),
			);
			return rows.map((row) =>
				mediaItem.parse({
					...row,
					image: toImageAsset(store, row),
					name: fileName(row),
					usage: usage.get(row.id) ?? [],
				}),
			);
		},
	});
}

/** The library items `ids` as images, by id (removed and foreign ids are left out). */
export async function mediaAssets(
	db: Db | Tx,
	store: ImageStore | null,
	ids: ReadonlyArray<string | null>,
): Promise<Map<string, ImageAsset>> {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	const assets = new Map<string, ImageAsset>();
	if (!store || wanted.length === 0) return assets;
	const rows = await db
		.select()
		.from(attachment)
		.where(and(isLibrary, inArray(attachment.id, wanted)));
	for (const row of rows) assets.set(row.id, toImageAsset(store, row));
	return assets;
}

/**
 * Checks that `ids` are live library items and locks them (FOR SHARE) for the
 * rest of the caller's transaction, so a concurrent delete waits and then sees
 * the new reference. `field` names the form field an unknown id is reported on.
 */
export async function lockMedia(tx: Tx, refs: ReadonlyArray<{ id: string | null; field: string }>): Promise<void> {
	const wanted = refs.filter((ref): ref is { id: string; field: string } => ref.id !== null);
	if (wanted.length === 0) return;
	const rows = await tx
		.select({ id: attachment.id })
		.from(attachment)
		.where(
			and(
				isLibrary,
				inArray(
					attachment.id,
					wanted.map((ref) => ref.id),
				),
			),
		)
		.for("share");
	const found = new Set(rows.map((row) => row.id));
	const missing = wanted.filter((ref) => !found.has(ref.id));
	if (missing.length > 0) {
		throw new AppError("BAD_REQUEST", "Unknown media", {
			fieldErrors: Object.fromEntries(missing.map((ref) => [ref.field, [m.media_error_missing()]])),
		});
	}
}

/** Locks one library item for a change (FOR UPDATE): the row, or null when it isn't one. */
export async function lockItem(tx: Tx, id: string): Promise<AttachmentRow | null> {
	const [row] = await tx
		.select()
		.from(attachment)
		.where(and(isLibrary, eq(attachment.id, id)))
		.for("update");
	return row ?? null;
}

export async function setAlt(tx: Tx, id: string, alt: { en: string; ne: string }): Promise<AttachmentRow> {
	const [row] = await tx.update(attachment).set({ alt }).where(eq(attachment.id, id)).returning();
	if (!row) throw new AppError("NOT_FOUND", "Media not found");
	return row;
}

/** Marks items removed (their assets are deleted right after, or by the cleanup job). */
export async function markRemoved(tx: Tx, ids: ReadonlyArray<string>, now = new Date()): Promise<AttachmentRow[]> {
	if (ids.length === 0) return [];
	return tx
		.update(attachment)
		.set({ deletedAt: now })
		.where(and(isLibrary, inArray(attachment.id, [...ids])))
		.returning();
}
