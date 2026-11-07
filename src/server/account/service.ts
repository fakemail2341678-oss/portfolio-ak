import "@tanstack/react-start/server-only";
import type { Db } from "@/server/db/types";
import { getAuthSubject, lockActiveAdmins } from "@/server/rbac/repository";
import * as repo from "./repository";

/**
 * Account lifecycle rules (decisions.md 0129): what deleting an account may do and
 * clean up, and what a user's data export contains.
 */

export type DeletionCheck = { ok: true; queuedAttachments: number } | { ok: false; reason: "LAST_ADMIN" };

/**
 * Runs just before Better Auth deletes the user (its `beforeDelete`). Refuses when
 * they're the last admin who can sign in (nobody could manage the app afterwards),
 * otherwise queues their unsaved uploads for the cleanup job. Sessions, sign-in
 * methods, 2FA and role assignments go with the user row (foreign keys cascade);
 * records they created stay, with no author.
 */
export async function prepareAccountDeletion(db: Db, userId: string, now = new Date()): Promise<DeletionCheck> {
	return db.transaction(async (tx) => {
		const subject = await getAuthSubject(tx, userId);
		if (subject?.role === "admin" && !subject.banned) {
			const active = await lockActiveAdmins(tx);
			if (active.length <= 1 && active.includes(userId)) return { ok: false, reason: "LAST_ADMIN" } as const;
		}
		return { ok: true, queuedAttachments: await repo.queuePendingUploads(tx, userId, now) } as const;
	});
}

/** Name, address and number of sign-in methods, for security notices. */
export const accountOwner = (db: Db, userId: string) => repo.getOwner(db, userId);

/** Version of the export's shape, so a reader can tell later formats apart. */
export const EXPORT_FORMAT = 1;

/** The user's own data as a JSON document (GET /api/account/export). Null when the user is gone. */
export async function exportAccountData(db: Db, userId: string, now = new Date()) {
	const data = await repo.collectUserData(db, userId);
	if (!data) return null;
	return { format: EXPORT_FORMAT, exportedAt: now.toISOString(), ...data };
}
