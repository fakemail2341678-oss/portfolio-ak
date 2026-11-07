import "@tanstack/react-start/server-only";
import { IMAGE_MAX_BYTES, type UploadScope, uploadRule } from "@/features/attachments/constants";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import { hasAll } from "@/features/rbac/permissions";
import { AppError, ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { AttachmentRow } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ImageStore } from "./cloudinary";
import { toImageAsset } from "./images";
import * as repo from "./repository";

/**
 * The upload flow (docs/decisions.md 0098):
 *
 * 1. signUpload: the browser asks for a signature for one upload; the server
 *    picks the public_id (so the browser can only write that one slot) and
 *    restricts formats (Cloudinary enforces the signed allowed_formats).
 * 2. The browser uploads the file straight to Cloudinary.
 * 3. confirmUpload: the server reads the asset back with the Admin API, checks
 *    format and size against the rules (Cloudinary has no size limit for signed
 *    uploads, so it's enforced here: a too-large file is deleted again) and
 *    records it as a pending attachment owned by the uploader.
 * 4. The entity's own save links pending attachments (repository.syncEntityAttachments).
 *    A library scope (the media library, decision 0177) records the upload in
 *    the library at once instead; items then reference it by id.
 *
 * Removed and orphaned assets are deleted by `cleanup` (scheduled) and, right
 * away when possible, by `purge`.
 */

/** Pending uploads nobody saved are deleted after a day. */
export const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;

const disabled = () => ruleError("BAD_REQUEST", "Uploads not configured", m.attachments_error_disabled());

export function requireStore(store: ImageStore | null): ImageStore {
	if (!store) throw disabled();
	return store;
}

/** Who uploads: the owner of the new attachment, and what they may do (a library scope needs its own permission). */
export type Uploader = { id: string; permissions: ReadonlyArray<string> };

function allowScope(uploader: Uploader, scope: UploadScope) {
	const { permission } = uploadRule(scope);
	if (permission && !hasAll(uploader.permissions, [permission])) {
		throw new AppError("FORBIDDEN", `Missing permission: ${permission}`);
	}
}

export function signUpload(store: ImageStore | null, scope: UploadScope, uploader: Uploader): UploadTicket {
	allowScope(uploader, scope);
	return requireStore(store).signUpload(scope);
}

export async function confirmUpload(
	db: Db,
	storeOrNull: ImageStore | null,
	input: { publicId: string; scope: UploadScope },
	uploader: Uploader,
): Promise<ImageAsset> {
	allowScope(uploader, input.scope);
	const ownerId = uploader.id;
	const rule = uploadRule(input.scope);
	const store = requireStore(storeOrNull);
	// Only this app's slots for this scope (the signature fixed the public_id).
	if (!store.owns(input.publicId) || !input.publicId.startsWith(`${store.config.folder}/${input.scope}/`)) {
		throw ruleError("BAD_REQUEST", "Foreign public_id", m.attachments_error_missing());
	}
	const existing = await repo.getByPublicId(db, input.publicId);
	if (existing) {
		// Confirming twice (a retried request) returns the same attachment, to its owner only.
		if (existing.ownerId !== ownerId || existing.deletedAt) {
			throw ruleError("BAD_REQUEST", "Already claimed", m.attachments_error_missing());
		}
		return toImageAsset(store, existing);
	}
	const remote = await store.getImage(input.publicId);
	if (!remote) throw ruleError("BAD_REQUEST", "Upload not found", m.attachments_error_missing());
	const formatOk = remote.resourceType === "image" && rule.formats.includes(remote.format);
	if (!formatOk || remote.bytes > IMAGE_MAX_BYTES) {
		await store.destroy(remote.publicId);
		throw formatOk
			? ruleError(
					"BAD_REQUEST",
					"Upload too large",
					m.attachments_error_too_large({ max: `${formatNumber(IMAGE_MAX_BYTES / 1024 / 1024)} MB` }),
				)
			: ruleError("BAD_REQUEST", "Upload format", m.attachments_error_format());
	}
	return toImageAsset(store, await repo.insertUpload(db, remote, ownerId, rule.library ?? null));
}

/** Throws away one's own pending upload (removed from the form before saving). */
export async function discardUpload(db: Db, store: ImageStore | null, id: string, ownerId: string): Promise<void> {
	const row = await repo.getById(db, id);
	if (!row || row.ownerId !== ownerId || row.entityType !== null) return;
	await purge(db, store, [row]);
}

/**
 * Deletes the assets of removed or orphaned rows, then the rows. A row whose
 * asset couldn't be deleted (Cloudinary unreachable) stays for the next run.
 */
export async function purge(db: Db, store: ImageStore | null, rows: ReadonlyArray<AttachmentRow>) {
	const done: string[] = [];
	let failed = 0;
	for (const row of rows) {
		try {
			if (store) await store.destroy(row.publicId);
			done.push(row.id);
		} catch {
			failed++;
		}
	}
	// Without a store (unconfigured), rows are kept: their assets still exist somewhere.
	if (store) await repo.deleteRows(db, done);
	return { deleted: store ? done.length : 0, failed };
}

/** The scheduled cleanup: removed attachments and day-old orphans. */
export async function cleanup(db: Db, store: ImageStore | null, now = new Date()) {
	const due = await repo.dueForCleanup(db, now, ORPHAN_AFTER_MS);
	return purge(db, store, due);
}
