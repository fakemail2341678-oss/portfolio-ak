import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Locale } from "@/paraglide/runtime";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { purge } from "@/server/attachments/service";
import { attachment, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { GUEST_LIFETIME_MS } from "./claim-cookie";
import { GUEST_DATA, type GuestData } from "./data";

/**
 * Guest sessions' data (decisions 0185, 0186): sample rows when a guest starts, the
 * move to an account when they sign up or in, and the daily cleanup. Guests' rows are
 * never audited (the audit log is for admin actions, 0132).
 */

/** A new guest's sample rows, from every owner, in one transaction. */
export async function seedGuest(
	db: Db,
	userId: string,
	locale: Locale,
	owners: ReadonlyArray<GuestData> = GUEST_DATA,
): Promise<void> {
	if (owners.length === 0) return;
	await db.transaction(async (tx) => {
		for (const owner of owners) await owner.seedGuestData(tx, userId, locale);
	});
}

/**
 * Moves a guest's rows to an account, then deletes the guest, in one transaction.
 * Idempotent: false (and nothing changes) when `guestId` is no longer a guest (already
 * claimed, cleaned up, or never one) or `userId` isn't an account. Quotas don't apply:
 * nothing a guest made is lost, though the account may need to delete some before it
 * can add more. Uploads the guest owned go to the account too.
 */
export async function claimGuest(
	db: Db,
	guestId: string,
	userId: string,
	owners: ReadonlyArray<GuestData> = GUEST_DATA,
): Promise<boolean> {
	if (guestId === userId) return false;
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: user.id, isAnonymous: user.isAnonymous })
			.from(user)
			.where(inArray(user.id, [guestId, userId]))
			.for("update");
		const guest = rows.find((row) => row.id === guestId);
		const account = rows.find((row) => row.id === userId);
		if (!guest?.isAnonymous || !account || account.isAnonymous) return false;
		for (const owner of owners) await owner.claim(tx, guestId, userId);
		await tx.update(attachment).set({ ownerId: userId }).where(eq(attachment.ownerId, guestId));
		// Its sessions go with it (foreign keys cascade).
		await tx.delete(user).where(eq(user.id, guestId));
		return true;
	});
}

/** Guests deleted per batch; a run takes batches until none is left (or MAX_BATCHES). */
const BATCH = 200;
const MAX_BATCHES = 25;

/**
 * The daily cleanup (GET /api/cron/guests): deletes guests created more than seven days
 * ago. Their rows go with them (every app table's `owner_id` cascades); their uploads
 * are marked removed in the same transaction and then deleted from Cloudinary through
 * the attachments service (the anonymous plugin's own delete would skip that). An
 * upload Cloudinary didn't delete stays queued for the attachments cleanup.
 */
export async function deleteExpiredGuests(db: Db, store: ImageStore | null, now = new Date()) {
	const cutoff = new Date(now.getTime() - GUEST_LIFETIME_MS);
	let guests = 0;
	let attachments = 0;
	let failed = 0;
	for (let batch = 0; batch < MAX_BATCHES; batch++) {
		const removed = await db.transaction(async (tx) => {
			const expired = await tx
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.isAnonymous, true), lt(user.createdAt, cutoff)))
				.limit(BATCH)
				.for("update", { skipLocked: true });
			const ids = expired.map((row) => row.id);
			if (ids.length === 0) return null;
			const uploads = await tx
				.update(attachment)
				.set({ deletedAt: now })
				.where(and(inArray(attachment.ownerId, ids), isNull(attachment.deletedAt)))
				.returning();
			await tx.delete(user).where(inArray(user.id, ids));
			return { count: ids.length, uploads };
		});
		if (!removed) break;
		guests += removed.count;
		const purged = await purge(db, store, removed.uploads);
		attachments += purged.deleted;
		failed += purged.failed;
		if (removed.count < BATCH) break;
	}
	return { guests, attachments, failedAttachments: failed };
}
