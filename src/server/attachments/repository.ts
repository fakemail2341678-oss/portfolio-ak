import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { AttachmentRef } from "@/features/attachments/schema";
import { type AttachmentRow, attachment } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { RemoteImage } from "./cloudinary";

/**
 * Attachment rows. Plain functions over an injected db (PGlite in tests); the
 * rules and the Cloudinary calls live in ./service.ts.
 */

/**
 * Records a verified upload: pending (not yet saved with an entity), or straight
 * into a library (`library`: its entity type, e.g. "media"), where it stays.
 */
export async function insertUpload(
	db: Db,
	remote: RemoteImage,
	ownerId: string,
	library: string | null = null,
): Promise<AttachmentRow> {
	const [row] = await db
		.insert(attachment)
		.values({
			publicId: remote.publicId,
			version: remote.version,
			resourceType: remote.resourceType,
			format: remote.format,
			bytes: remote.bytes,
			width: remote.width,
			height: remote.height,
			ownerId,
			entityType: library,
		})
		.returning();
	if (!row) throw new Error("Attachment insert returned no row");
	return row;
}

export async function getByPublicId(db: Db, publicId: string): Promise<AttachmentRow | null> {
	const [row] = await db.select().from(attachment).where(eq(attachment.publicId, publicId));
	return row ?? null;
}

export async function getById(db: Db, id: string): Promise<AttachmentRow | null> {
	const [row] = await db.select().from(attachment).where(eq(attachment.id, id));
	return row ?? null;
}

/** Live (not removed) attachments of several entities, grouped by entity id and ordered. */
export async function listForEntities(
	db: Db | Tx,
	entityType: string,
	entityIds: ReadonlyArray<string>,
): Promise<Map<string, AttachmentRow[]>> {
	const grouped = new Map<string, AttachmentRow[]>();
	if (entityIds.length === 0) return grouped;
	const rows = await db
		.select()
		.from(attachment)
		.where(
			and(
				eq(attachment.entityType, entityType),
				inArray(attachment.entityId, [...entityIds]),
				isNull(attachment.deletedAt),
			),
		)
		.orderBy(asc(attachment.entityId), asc(attachment.position));
	for (const row of rows) {
		const key = row.entityId ?? "";
		grouped.set(key, [...(grouped.get(key) ?? []), row]);
	}
	return grouped;
}

export class AttachmentLinkError extends Error {}

/**
 * Makes `refs` (in order, with their alt text) the attachments of one entity,
 * inside the caller's transaction. Each ref must be either already attached to
 * this entity or a pending upload by `ownerId`; anything else is refused
 * (someone else's upload, another entity's image, a removed one). Attachments
 * the entity no longer lists are marked removed; they're returned so the caller
 * can delete the assets.
 */
export async function syncEntityAttachments(
	tx: Tx,
	target: { entityType: string; entityId: string; ownerId: string },
	refs: ReadonlyArray<AttachmentRef>,
	now = new Date(),
): Promise<AttachmentRow[]> {
	const ids = refs.map((ref) => ref.id);
	if (new Set(ids).size !== ids.length) throw new AttachmentLinkError("Duplicate attachment");
	const current = await tx
		.select()
		.from(attachment)
		.where(
			and(
				eq(attachment.entityType, target.entityType),
				eq(attachment.entityId, target.entityId),
				isNull(attachment.deletedAt),
			),
		);
	const requested = ids.length === 0 ? [] : await tx.select().from(attachment).where(inArray(attachment.id, ids));
	for (const id of ids) {
		const row = requested.find((candidate) => candidate.id === id);
		const linkedHere = row?.entityType === target.entityType && row.entityId === target.entityId;
		const ownPending = row?.entityType === null && row.ownerId === target.ownerId;
		if (!row || row.deletedAt !== null || !(linkedHere || ownPending)) {
			throw new AttachmentLinkError(`Attachment ${id} can't be used here`);
		}
	}
	for (const [position, ref] of refs.entries()) {
		await tx
			.update(attachment)
			.set({ entityType: target.entityType, entityId: target.entityId, position, alt: ref.alt })
			.where(eq(attachment.id, ref.id));
	}
	const dropped = current.filter((row) => !ids.includes(row.id));
	if (dropped.length > 0) {
		await tx
			.update(attachment)
			.set({ deletedAt: now })
			.where(
				inArray(
					attachment.id,
					dropped.map((row) => row.id),
				),
			);
	}
	return dropped;
}

/** Marks every attachment of the given entities removed (the entities are being deleted). */
export async function removeForEntities(
	tx: Tx,
	entityType: string,
	entityIds: ReadonlyArray<string>,
	now = new Date(),
): Promise<AttachmentRow[]> {
	if (entityIds.length === 0) return [];
	return tx
		.update(attachment)
		.set({ deletedAt: now })
		.where(
			and(
				eq(attachment.entityType, entityType),
				inArray(attachment.entityId, [...entityIds]),
				isNull(attachment.deletedAt),
			),
		)
		.returning();
}

/** Rows whose asset should be deleted: removed ones, and pending uploads older than `orphanAfterMs`. */
export async function dueForCleanup(db: Db, now: Date, orphanAfterMs: number, limit = 100): Promise<AttachmentRow[]> {
	return db
		.select()
		.from(attachment)
		.where(
			or(
				isNotNull(attachment.deletedAt),
				and(isNull(attachment.entityType), lt(attachment.createdAt, new Date(now.getTime() - orphanAfterMs))),
			),
		)
		.orderBy(asc(attachment.createdAt))
		.limit(limit);
}

export async function deleteRows(db: Db, ids: ReadonlyArray<string>): Promise<void> {
	if (ids.length > 0) await db.delete(attachment).where(inArray(attachment.id, [...ids]));
}
