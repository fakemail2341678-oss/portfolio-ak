import "@tanstack/react-start/server-only";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { NoteSummary } from "@/features/apps/notes/types";
import type { AttachmentRef } from "@/features/attachments/schema";
import { staleError } from "@/lib/concurrency";
import { ownedBy } from "@/server/apps/ownership";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import { listForEntities, removeForEntities, syncEntityAttachments } from "@/server/attachments/repository";
import { sameVersion } from "@/server/db/concurrency";
import { type AttachmentRow, attachment, type NoteRow, note, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Notes' data access (decision 0190). Every function takes the owner and scopes by it
 * (`ownedBy`), so one user's call never reads or changes another's notes; the shared
 * page reads by its token instead, and only a note that is shared.
 */

/** A note's images are attachments of this type (`entity_id` is the note's id). */
export const NOTE_ENTITY = "note";

/** Characters of body text in a list card. */
const EXCERPT_LENGTH = 180;

const excerpt = (text: string) => {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length <= EXCERPT_LENGTH ? flat : `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`;
};

/** The owner's notes, pinned first, then the most recently changed, each with its first image. */
export async function listNotes(db: Db, store: ImageStore | null, ownerId: string): Promise<NoteSummary[]> {
	const rows = await db
		.select({
			id: note.id,
			title: note.title,
			bodyText: note.bodyText,
			tags: note.tags,
			pinned: note.pinned,
			archived: note.archived,
			shared: sql<boolean>`${note.shareToken} is not null`,
			updatedAt: note.updatedAt,
		})
		.from(note)
		.where(ownedBy(note, ownerId))
		.orderBy(desc(note.pinned), desc(note.updatedAt), desc(note.id));
	const images = store
		? await listForEntities(
				db,
				NOTE_ENTITY,
				rows.map((row) => row.id),
			)
		: new Map();
	return rows.map(({ bodyText, updatedAt, ...row }) => {
		const first: AttachmentRow | undefined = images.get(row.id)?.[0];
		return {
			...row,
			excerpt: excerpt(bodyText),
			cover: store && first ? toImageAsset(store, first) : null,
			updatedAt: updatedAt.toISOString(),
		};
	});
}

/** Ids of the owner's notes matching a web-search style query (`"a phrase" -not or`), best first. */
export async function searchNotes(db: Db, ownerId: string, q: string): Promise<string[]> {
	const query = sql`websearch_to_tsquery('simple', ${q})`;
	const rows = await db
		.select({ id: note.id })
		.from(note)
		.where(and(ownedBy(note, ownerId), sql`${note.search} @@ ${query}`))
		.orderBy(sql`ts_rank(${note.search}, ${query}) desc`, desc(note.updatedAt))
		.limit(100);
	return rows.map((row) => row.id);
}

export async function getNote(db: Db | Tx, ownerId: string, id: string): Promise<NoteRow | null> {
	const [row] = await db
		.select()
		.from(note)
		.where(and(eq(note.id, id), ownedBy(note, ownerId)));
	return row ?? null;
}

/** A shared note by its token (whoever owns it), or null. */
export async function getSharedNote(db: Db, token: string): Promise<NoteRow | null> {
	const [row] = await db
		.select()
		.from(note)
		.where(and(eq(note.shareToken, token), isNotNull(note.shareToken)));
	return row ?? null;
}

/** A note's images in order (none without a store: there is nothing to show them from). */
export async function noteImages(db: Db | Tx, store: ImageStore | null, id: string): Promise<AttachmentRow[]> {
	if (!store) return [];
	return (await listForEntities(db, NOTE_ENTITY, [id])).get(id) ?? [];
}

export const countNotes = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(note).where(ownedBy(note, ownerId)))[0]?.total ?? 0;

export type NewNote = {
	id?: string;
	title: string;
	body?: string;
	bodyText?: string;
	tags?: string[];
	pinned?: boolean;
};

export async function insertNotes(tx: Tx, ownerId: string, notes: ReadonlyArray<NewNote>): Promise<NoteRow[]> {
	if (notes.length === 0) return [];
	return tx
		.insert(note)
		.values(notes.map((each) => ({ ...each, ownerId })))
		.returning();
}

/**
 * The editor's save, only while the note still has `version` (its `updatedAt` when the
 * editor opened): zero rows is NOT_FOUND (not the owner's, or deleted) or a stale CONFLICT.
 */
export async function updateNote(
	tx: Tx,
	ownerId: string,
	id: string,
	version: string,
	set: { title: string; body: string; bodyText: string; tags: string[] },
): Promise<NoteRow | null> {
	const [row] = await tx
		.update(note)
		.set(set)
		.where(and(eq(note.id, id), ownedBy(note, ownerId), sameVersion(note.updatedAt, version)))
		.returning();
	if (row) return row;
	if (await getNote(tx, ownerId, id)) throw staleError("Note");
	return null;
}

/** Links the editor's images to the note; returns the ones it dropped (to delete). */
export const syncNoteImages = (tx: Tx, ownerId: string, id: string, refs: ReadonlyArray<AttachmentRef>) =>
	syncEntityAttachments(tx, { entityType: NOTE_ENTITY, entityId: id, ownerId }, refs);

export async function setFlags(
	tx: Tx,
	ownerId: string,
	id: string,
	flags: { pinned?: boolean; archived?: boolean },
): Promise<NoteRow | null> {
	const [row] = await tx
		.update(note)
		.set(flags)
		.where(and(eq(note.id, id), ownedBy(note, ownerId)))
		.returning();
	return row ?? null;
}

export async function setShareToken(tx: Tx, ownerId: string, id: string, token: string | null) {
	const [row] = await tx
		.update(note)
		.set({ shareToken: token })
		.where(and(eq(note.id, id), ownedBy(note, ownerId)))
		.returning();
	return row ?? null;
}

/** Deletes a note and marks its images removed; returns them (to delete the files), or null when not found. */
export async function deleteNote(tx: Tx, ownerId: string, id: string): Promise<AttachmentRow[] | null> {
	const [row] = await tx
		.delete(note)
		.where(and(eq(note.id, id), ownedBy(note, ownerId)))
		.returning({ id: note.id });
	if (!row) return null;
	return removeForEntities(tx, NOTE_ENTITY, [row.id]);
}

/**
 * Moves every note of a guest to an account (decision 0186). Their images move with
 * the guest's other uploads (src/server/guests/service.ts). A shared note of a guest
 * has no token (guests can't share), so nothing becomes public by the move.
 */
export async function transferNotes(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(note).set({ ownerId: toUserId }).where(ownedBy(note, fromUserId));
}

/** Usage for /admin/apps: how many accounts and guests have a note, and the rows. */
export async function notesUsage(db: Db) {
	const [owners] = await db
		.select({
			accounts:
				sql<number>`count(distinct ${note.ownerId}) filter (where not coalesce(${user.isAnonymous}, false))`.mapWith(
					Number,
				),
			guests: sql<number>`count(distinct ${note.ownerId}) filter (where ${user.isAnonymous})`.mapWith(Number),
			notes: count(),
			shared: sql<number>`count(*) filter (where ${note.shareToken} is not null)`.mapWith(Number),
		})
		.from(note)
		.innerJoin(user, eq(user.id, note.ownerId));
	const [images] = await db
		.select({ total: count() })
		.from(attachment)
		.where(and(eq(attachment.entityType, NOTE_ENTITY), sql`${attachment.deletedAt} is null`));
	return {
		accounts: owners?.accounts ?? 0,
		guests: owners?.guests ?? 0,
		rows: { notes: owners?.notes ?? 0, shared: owners?.shared ?? 0, images: images?.total ?? 0 },
	};
}
