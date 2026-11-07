import "@tanstack/react-start/server-only";
import { and, asc, eq, lt, ne } from "drizzle-orm";
import { pdParty, pdPartyMember } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Watch parties' rows (decision 0243). The rules are in service.ts. */

export type PartyRow = typeof pdParty.$inferSelect;
export type PartyMemberRow = typeof pdPartyMember.$inferSelect;

type Reader = Db | Tx;

export async function partyByCode(db: Reader, code: string): Promise<PartyRow | null> {
	const [row] = await db.select().from(pdParty).where(eq(pdParty.code, code)).limit(1);
	return row ?? null;
}

/** The party locked for this transaction: seats and the host change one at a time. */
export async function lockParty(tx: Tx, code: string): Promise<PartyRow | null> {
	const [row] = await tx.select().from(pdParty).where(eq(pdParty.code, code)).for("update").limit(1);
	return row ?? null;
}

export async function memberOf(db: Reader, partyId: string, userId: string): Promise<PartyMemberRow | null> {
	const [row] = await db
		.select()
		.from(pdPartyMember)
		.where(and(eq(pdPartyMember.partyId, partyId), eq(pdPartyMember.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function membersOf(db: Reader, partyId: string): Promise<PartyMemberRow[]> {
	return db
		.select()
		.from(pdPartyMember)
		.where(eq(pdPartyMember.partyId, partyId))
		.orderBy(asc(pdPartyMember.joinedAt), asc(pdPartyMember.id));
}

export async function touchMember(db: Reader, memberId: string, now: Date, leftAt: Date | null = null) {
	await db.update(pdPartyMember).set({ seenAt: now, leftAt }).where(eq(pdPartyMember.id, memberId));
}

/** Ends what's past its time, and deletes what ended over `keepBefore` ago. */
export async function endIdle(db: Db, now: Date, keepBefore: Date): Promise<{ ended: number; deleted: number }> {
	const ended = await db
		.update(pdParty)
		.set({ state: "ended" })
		.where(and(lt(pdParty.expiresAt, now), ne(pdParty.state, "ended")))
		.returning({ id: pdParty.id });
	const deleted = await db
		.delete(pdParty)
		.where(and(eq(pdParty.state, "ended"), lt(pdParty.expiresAt, keepBefore)))
		.returning({ id: pdParty.id });
	return { ended: ended.length, deleted: deleted.length };
}

/** Parties a guest hosts or sits in move to the account, and a seat the account already has stays the one kept. */
export async function claimParties(tx: Tx, fromUserId: string, toUserId: string) {
	await tx.update(pdParty).set({ hostId: toUserId }).where(eq(pdParty.hostId, fromUserId));
	const seats = await tx.select().from(pdPartyMember).where(eq(pdPartyMember.userId, fromUserId));
	for (const seat of seats) {
		if (await memberOf(tx, seat.partyId, toUserId)) {
			await tx.delete(pdPartyMember).where(eq(pdPartyMember.id, seat.id));
		} else {
			await tx.update(pdPartyMember).set({ userId: toUserId }).where(eq(pdPartyMember.id, seat.id));
		}
	}
}
