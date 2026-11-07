import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { pdAccount, pdProfile } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

export type PardaProfileRow = typeof pdProfile.$inferSelect;

/** The owner's default profile, made if it isn't there yet (two first calls at once make one). */
export async function ensureDefaultProfile(db: Db | Tx, ownerId: string, name: string): Promise<PardaProfileRow> {
	const [created] = await db
		.insert(pdProfile)
		.values({ ownerId, name, isDefault: true })
		.onConflictDoNothing({ target: pdProfile.ownerId, where: eq(pdProfile.isDefault, true) })
		.returning();
	if (created) return created;
	const [existing] = await db
		.select()
		.from(pdProfile)
		.where(and(eq(pdProfile.ownerId, ownerId), eq(pdProfile.isDefault, true)))
		.limit(1);
	if (!existing) throw new Error("pd_profile: the default profile vanished");
	return existing;
}

/** A profile of this owner, by id; null for anyone else's (or none). */
export async function ownedProfile(db: Db | Tx, ownerId: string, id: string): Promise<PardaProfileRow | null> {
	const [row] = await db
		.select()
		.from(pdProfile)
		.where(and(eq(pdProfile.id, id), eq(pdProfile.ownerId, ownerId)))
		.limit(1);
	return row ?? null;
}

export async function defaultProfile(db: Db | Tx, ownerId: string): Promise<PardaProfileRow | null> {
	const [row] = await db
		.select()
		.from(pdProfile)
		.where(and(eq(pdProfile.ownerId, ownerId), eq(pdProfile.isDefault, true)))
		.limit(1);
	return row ?? null;
}

/** The owner's profiles, the default first, then the oldest. */
export const profilesOf = (db: Db | Tx, ownerId: string) =>
	db
		.select()
		.from(pdProfile)
		.where(eq(pdProfile.ownerId, ownerId))
		.orderBy(desc(pdProfile.isDefault), asc(pdProfile.createdAt), asc(pdProfile.id));

export async function countProfiles(db: Db | Tx, ownerId: string): Promise<number> {
	const [row] = await db.select({ value: count() }).from(pdProfile).where(eq(pdProfile.ownerId, ownerId));
	return row?.value ?? 0;
}

export type ProfileWrite = Partial<
	Pick<PardaProfileRow, "name" | "avatar" | "kids" | "cap" | "region" | "audioLanguage" | "autoplay" | "pinHash">
>;

export async function insertProfile(db: Db | Tx, ownerId: string, values: ProfileWrite & { name: string }) {
	const [row] = await db
		.insert(pdProfile)
		.values({ ownerId, ...values })
		.returning();
	if (!row) throw new Error("pd_profile: insert returned nothing");
	return row;
}

export async function updateProfile(db: Db | Tx, ownerId: string, id: string, values: ProfileWrite) {
	const [row] = await db
		.update(pdProfile)
		.set(values)
		.where(and(eq(pdProfile.id, id), eq(pdProfile.ownerId, ownerId)))
		.returning();
	return row ?? null;
}

/** Deletes a profile that isn't the default (its rows go with it: cascade). */
export async function deleteProfile(db: Db | Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await db
		.delete(pdProfile)
		.where(and(eq(pdProfile.id, id), eq(pdProfile.ownerId, ownerId), eq(pdProfile.isDefault, false)))
		.returning({ id: pdProfile.id });
	return rows.length > 0;
}

export async function accountDigest(db: Db | Tx, userId: string): Promise<boolean> {
	const [row] = await db.select({ digest: pdAccount.digest }).from(pdAccount).where(eq(pdAccount.userId, userId));
	return row?.digest ?? false;
}

export async function setAccountDigest(db: Db | Tx, userId: string, digest: boolean, locale: string) {
	await db
		.insert(pdAccount)
		.values({ userId, digest, locale })
		.onConflictDoUpdate({ target: pdAccount.userId, set: { digest, locale, updatedAt: new Date() } });
}
