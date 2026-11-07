import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { TaskAttachment } from "@/features/taskline/types";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { toImageAsset } from "@/server/attachments/images";
import { listForEntities, removeForEntities } from "@/server/attachments/repository";
import { type AttachmentRow, type TlCommentRow, tlComment, tlTaskWatcher } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Comments, watchers and the files of tasks and comments (Task 50). Files are the
 * attachments service's rows (decision 0098) with `entity_type` `tl_task` or
 * `tl_comment`; deleting a task marks its files removed, and the attachments cron
 * deletes the assets.
 */

export const TASK_FILES = "tl_task";
export const COMMENT_FILES = "tl_comment";
export const COMMENTS_SHOWN = 200;

export async function listComments(db: Db, taskId: string): Promise<TlCommentRow[]> {
	return db
		.select()
		.from(tlComment)
		.where(and(eq(tlComment.taskId, taskId), isNull(tlComment.deletedAt)))
		.orderBy(asc(tlComment.createdAt), asc(tlComment.id))
		.limit(COMMENTS_SHOWN);
}

export async function getComment(db: Db, taskId: string, id: string): Promise<TlCommentRow | null> {
	const [row] = await db
		.select()
		.from(tlComment)
		.where(and(eq(tlComment.taskId, taskId), eq(tlComment.id, id), isNull(tlComment.deletedAt)));
	return row ?? null;
}

export async function insertComment(tx: Tx, values: typeof tlComment.$inferInsert): Promise<TlCommentRow> {
	const [row] = await tx.insert(tlComment).values(values).returning();
	if (!row) throw new Error("Comment insert returned no row");
	return row;
}

export async function patchComment(
	tx: Tx,
	id: string,
	set: Partial<Pick<TlCommentRow, "bodyHtml" | "bodyText" | "mentions" | "editedAt" | "deletedAt">>,
): Promise<TlCommentRow> {
	const [row] = await tx.update(tlComment).set(set).where(eq(tlComment.id, id)).returning();
	if (!row) throw new Error("Comment update returned no row");
	return row;
}

export async function watcherIds(db: Db, taskId: string): Promise<string[]> {
	const rows = await db
		.select({ memberId: tlTaskWatcher.memberId })
		.from(tlTaskWatcher)
		.where(eq(tlTaskWatcher.taskId, taskId));
	return rows.map((row) => row.memberId);
}

export async function setWatching(tx: Tx, taskId: string, memberId: string, watching: boolean): Promise<void> {
	if (watching) {
		await tx.insert(tlTaskWatcher).values({ taskId, memberId }).onConflictDoNothing();
	} else {
		await tx.delete(tlTaskWatcher).where(and(eq(tlTaskWatcher.taskId, taskId), eq(tlTaskWatcher.memberId, memberId)));
	}
}

/** An attachment row as the task page shows it (nothing without a store: there's nowhere to show it from). */
export function attachmentDto(store: ImageStore, row: AttachmentRow): TaskAttachment {
	const asset = toImageAsset(store, row);
	return {
		id: asset.id,
		url: asset.url,
		thumbUrl: asset.thumb,
		src: asset.full.src,
		width: asset.width,
		height: asset.height,
		format: asset.format,
	};
}

/** The files of several entities of one type, grouped by entity id. */
export async function filesOf(
	db: Db,
	store: ImageStore | null | undefined,
	entityType: string,
	ids: ReadonlyArray<string>,
): Promise<Map<string, TaskAttachment[]>> {
	const out = new Map<string, TaskAttachment[]>();
	if (!store || ids.length === 0) return out;
	for (const [id, rows] of await listForEntities(db, entityType, ids)) {
		out.set(
			id,
			rows.map((row) => attachmentDto(store, row)),
		);
	}
	return out;
}

/** The ids of an entity's live files, in order (whether or not uploads are configured now). */
export async function fileIds(db: Db, entityType: string, id: string): Promise<string[]> {
	return ((await listForEntities(db, entityType, [id])).get(id) ?? []).map((row) => row.id);
}

/**
 * Marks the files of these tasks and of their comments removed (they're being deleted
 * for good); the attachments cron deletes the assets.
 */
export async function removeTaskFiles(tx: Tx, taskIds: ReadonlyArray<string>): Promise<void> {
	if (taskIds.length === 0) return;
	const comments = await tx
		.select({ id: tlComment.id })
		.from(tlComment)
		.where(inArray(tlComment.taskId, [...taskIds]));
	await removeForEntities(tx, TASK_FILES, taskIds);
	await removeForEntities(
		tx,
		COMMENT_FILES,
		comments.map((row) => row.id),
	);
}
