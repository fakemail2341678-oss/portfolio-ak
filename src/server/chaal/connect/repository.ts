import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { chConnection } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

export type ChaalConnectionRow = typeof chConnection.$inferSelect;

export async function connectionOf(db: Db, userId: string): Promise<ChaalConnectionRow | null> {
	const [row] = await db.select().from(chConnection).where(eq(chConnection.userId, userId));
	return row ?? null;
}

export async function connectionForLichess(db: Db, lichessId: string): Promise<ChaalConnectionRow | null> {
	const [row] = await db.select().from(chConnection).where(eq(chConnection.lichessId, lichessId.toLowerCase()));
	return row ?? null;
}

export type NewConnection = Pick<
	ChaalConnectionRow,
	"userId" | "lichessId" | "username" | "title" | "token" | "scopes" | "expiresAt"
>;

/** Connects (or reconnects) a user: a fresh token clears the old one's revocation, cooldown and use. */
export async function saveConnection(db: Db, connection: NewConnection, at: Date): Promise<void> {
	const fresh = { connectedAt: at, lastUsedAt: null, revokedAt: null, cooldownUntil: null, cooldownMs: 0 };
	await db
		.insert(chConnection)
		.values({ ...connection, ...fresh })
		.onConflictDoUpdate({ target: chConnection.userId, set: { ...connection, ...fresh } });
}

export async function deleteConnection(db: Db, userId: string): Promise<void> {
	await db.delete(chConnection).where(eq(chConnection.userId, userId));
}

export async function markRevoked(db: Db, userId: string, at: Date): Promise<void> {
	await db.update(chConnection).set({ revokedAt: at }).where(eq(chConnection.userId, userId));
}

export async function markUsed(db: Db, userId: string, at: Date): Promise<void> {
	await db.update(chConnection).set({ lastUsedAt: at }).where(eq(chConnection.userId, userId));
}

/** Hands a guest's connection to the account it became (the claim, PLAN 13.5 "Guests"). */
export async function moveConnection(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(chConnection).set({ userId: toUserId }).where(eq(chConnection.userId, fromUserId));
}
