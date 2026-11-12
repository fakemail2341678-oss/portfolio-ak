import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Paid, Share } from "@/features/kharcha/money/split";
import {
	type KhExpenseRow,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroupMember,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Kharcha's expense rows: an expense with who paid it and what each person owes of it. */

export type ExpenseParts = { payers: Paid[]; shares: Share[] };

/** Everyone an expense names, payers first, once each. */
export const partsPeople = (parts: ExpenseParts): string[] => [
	...new Set([...parts.payers.map((payer) => payer.person), ...parts.shares.map((share) => share.person)]),
];

export async function partsOf(db: Db | Tx, expenseId: string): Promise<ExpenseParts> {
	const payers = await db
		.select({ person: khExpensePayer.personId, amount: khExpensePayer.amountMinor })
		.from(khExpensePayer)
		.where(eq(khExpensePayer.expenseId, expenseId))
		.orderBy(khExpensePayer.position);
	const shares = await db
		.select({ person: khExpenseShare.personId, owed: khExpenseShare.owedMinor })
		.from(khExpenseShare)
		.where(eq(khExpenseShare.expenseId, expenseId))
		.orderBy(khExpenseShare.position);
	return { payers, shares };
}

async function insertParts(tx: Tx, expenseId: string, parts: ExpenseParts): Promise<void> {
	await tx.insert(khExpensePayer).values(
		parts.payers.map((payer, position) => ({
			expenseId,
			personId: payer.person,
			amountMinor: payer.amount,
			position,
		})),
	);
	await tx.insert(khExpenseShare).values(
		parts.shares.map((share, position) => ({
			expenseId,
			personId: share.person,
			owedMinor: share.owed,
			position,
		})),
	);
}

export async function insertExpense(
	tx: Tx,
	values: typeof khExpense.$inferInsert,
	parts: ExpenseParts,
): Promise<KhExpenseRow> {
	const [row] = await tx.insert(khExpense).values(values).returning();
	if (!row) throw new Error("kh_expense: nothing inserted");
	await insertParts(tx, row.id, parts);
	return row;
}

export async function replaceParts(tx: Tx, expenseId: string, parts: ExpenseParts): Promise<void> {
	await tx.delete(khExpensePayer).where(eq(khExpensePayer.expenseId, expenseId));
	await tx.delete(khExpenseShare).where(eq(khExpenseShare.expenseId, expenseId));
	await insertParts(tx, expenseId, parts);
}

/** Which of `ids` are current members of the group. */
export async function currentMembersAmong(
	tx: Db | Tx,
	groupId: string,
	ids: ReadonlyArray<string>,
): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await tx
		.select({ id: khGroupMember.personId })
		.from(khGroupMember)
		.where(and(eq(khGroupMember.groupId, groupId), inArray(khGroupMember.personId, ids), isNull(khGroupMember.leftAt)));
	return new Set(rows.map((row) => row.id));
}

/** Which of `ids` are friends of `ownerId`. */
export async function friendsAmong(tx: Db | Tx, ownerId: string, ids: ReadonlyArray<string>): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await tx
		.select({ id: khFriend.friendId })
		.from(khFriend)
		.where(and(eq(khFriend.ownerId, ownerId), inArray(khFriend.friendId, ids)));
	return new Set(rows.map((row) => row.id));
}
