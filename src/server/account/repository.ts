import "@tanstack/react-start/server-only";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { account, attachment, role, session, testCrud, user, userRole } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * A user's own data, for the account page's export and deletion. Plain functions
 * over an injected db (PGlite in tests); the rules live in ./service.ts.
 */

export async function getOwner(db: Db, userId: string) {
	const [row] = await db
		.select({ email: user.email, name: user.name, accounts: count(account.id) })
		.from(user)
		.leftJoin(account, eq(account.userId, user.id))
		.where(eq(user.id, userId))
		.groupBy(user.id);
	return row ?? null;
}

/**
 * Marks the user's pending uploads (never saved with a record) removed, so the
 * cleanup job deletes them from Cloudinary. Images already linked to a record
 * belong to that record and stay; the foreign key clears their owner.
 */
export async function queuePendingUploads(db: Db, userId: string, now: Date): Promise<number> {
	const rows = await db
		.update(attachment)
		.set({ deletedAt: now })
		.where(and(eq(attachment.ownerId, userId), isNull(attachment.entityType), isNull(attachment.deletedAt)))
		.returning({ id: attachment.id });
	return rows.length;
}

/** Everything stored about one user, without secrets (no password hashes, tokens or 2FA secrets). */
export async function collectUserData(db: Db, userId: string) {
	const [profile] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			role: user.role,
			twoFactorEnabled: user.twoFactorEnabled,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})
		.from(user)
		.where(eq(user.id, userId));
	if (!profile) return null;
	const [signInMethods, sessions, roles, uploads, items] = await Promise.all([
		db
			.select({ providerId: account.providerId, createdAt: account.createdAt })
			.from(account)
			.where(eq(account.userId, userId))
			.orderBy(asc(account.createdAt)),
		db
			.select({
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
				ipAddress: session.ipAddress,
				userAgent: session.userAgent,
			})
			.from(session)
			.where(eq(session.userId, userId))
			.orderBy(asc(session.createdAt)),
		db
			.select({ key: role.key, name: role.name })
			.from(userRole)
			.innerJoin(role, eq(role.id, userRole.roleId))
			.where(eq(userRole.userId, userId))
			.orderBy(asc(role.key)),
		db
			.select({
				publicId: attachment.publicId,
				format: attachment.format,
				bytes: attachment.bytes,
				width: attachment.width,
				height: attachment.height,
				alt: attachment.alt,
				entityType: attachment.entityType,
				entityId: attachment.entityId,
				createdAt: attachment.createdAt,
			})
			.from(attachment)
			.where(and(eq(attachment.ownerId, userId), isNull(attachment.deletedAt)))
			.orderBy(asc(attachment.createdAt)),
		db
			.select({
				id: testCrud.id,
				slug: testCrud.slug,
				title: testCrud.title,
				status: testCrud.status,
				createdAt: testCrud.createdAt,
			})
			.from(testCrud)
			.where(eq(testCrud.createdBy, userId))
			.orderBy(asc(testCrud.createdAt)),
	]);
	return { profile, signInMethods, sessions, roles, uploads, items };
}
