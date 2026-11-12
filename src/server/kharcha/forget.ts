import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { removeForEntities } from "@/server/attachments/repository";
import {
	khCategory,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroup,
	khGroupMember,
	khMerchantRule,
	khMethod,
	khPayment,
	khPerson,
	khReceiptDraft,
	khTag,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { DRAFT_RECEIPTS, EXPENSE_RECEIPTS } from "./receipts/service";

/**
 * What happens to a user's Kharcha when the user goes (docs/guides/kharcha.md "When an
 * account goes", decision 0277). People aren't owned by foreign keys the way the apps'
 * rows are: a person can be on other people's expenses. So before a user is deleted:
 *
 * - what is theirs alone goes: their personal expenses, the groups and shared expenses
 *   that held only them and their own name-only contacts, those contacts, their friend list;
 * - what they share with others stays, and so does their person, with its name and without
 *   its account (`kh_person.user_id` is set null by the foreign key), so the others'
 *   balances and history don't change.
 *
 * A guest's Kharcha is a closed world (names only, no invites), so all of it goes. Called
 * for expired guests (`GuestData.forget`) and before an account is deleted
 * (src/server/auth/auth.ts). The profile goes with the user (its foreign key cascades).
 */
export async function forgetUsers(tx: Tx, userIds: ReadonlyArray<string>): Promise<void> {
	if (userIds.length === 0) return;
	const people = (await tx.select({ id: khPerson.id }).from(khPerson).where(inArray(khPerson.userId, userIds))).map(
		(row) => row.id,
	);
	if (people.length === 0) return;
	const contacts = (
		await tx
			.select({ id: khPerson.id })
			.from(khPerson)
			.where(and(inArray(khPerson.createdBy, people), isNull(khPerson.userId), isNull(khPerson.email)))
	).map((row) => row.id);
	const own = [...people, ...contacts];

	// Groups that hold nobody else.
	const groups = await tx
		.selectDistinct({ id: khGroupMember.groupId })
		.from(khGroupMember)
		.where(inArray(khGroupMember.personId, people));
	await deleteUnshared(
		groups.map((row) => row.id),
		async (ids) =>
			tx
				.selectDistinct({ id: khGroupMember.groupId })
				.from(khGroupMember)
				.where(and(inArray(khGroupMember.groupId, ids), notInArray(khGroupMember.personId, own))),
		async (ids) => {
			const inGroups = await tx.select({ id: khExpense.id }).from(khExpense).where(inArray(khExpense.groupId, ids));
			await removeForEntities(
				tx,
				EXPENSE_RECEIPTS,
				inGroups.map((row) => row.id),
			);
			await tx.delete(khGroup).where(inArray(khGroup.id, ids));
		},
	);

	// Expenses outside a group that name nobody else.
	const paid = await tx
		.selectDistinct({ id: khExpense.id })
		.from(khExpense)
		.innerJoin(khExpensePayer, eq(khExpensePayer.expenseId, khExpense.id))
		.where(and(isNull(khExpense.groupId), inArray(khExpensePayer.personId, own)));
	const owed = await tx
		.selectDistinct({ id: khExpense.id })
		.from(khExpense)
		.innerJoin(khExpenseShare, eq(khExpenseShare.expenseId, khExpense.id))
		.where(and(isNull(khExpense.groupId), inArray(khExpenseShare.personId, own)));
	await deleteUnshared(
		[...new Set([...paid, ...owed].map((row) => row.id))],
		async (ids) => [
			...(await tx
				.selectDistinct({ id: khExpensePayer.expenseId })
				.from(khExpensePayer)
				.where(and(inArray(khExpensePayer.expenseId, ids), notInArray(khExpensePayer.personId, own)))),
			...(await tx
				.selectDistinct({ id: khExpenseShare.expenseId })
				.from(khExpenseShare)
				.where(and(inArray(khExpenseShare.expenseId, ids), notInArray(khExpenseShare.personId, own)))),
		],
		async (ids) => {
			await removeForEntities(tx, EXPENSE_RECEIPTS, ids);
			await tx.delete(khExpense).where(inArray(khExpense.id, ids));
		},
	);

	// Payments outside a group between two of them.
	await tx
		.delete(khPayment)
		.where(and(isNull(khPayment.groupId), inArray(khPayment.fromPerson, own), inArray(khPayment.toPerson, own)));

	// Their own friend lists; the lists of whoever stays keep them.
	await tx.delete(khFriend).where(inArray(khFriend.ownerId, people));

	// Their own categories, tags, methods, rules and receipt drafts (Task 89): what stays
	// shared loses them (the foreign keys set its category and method null, its tags go).
	const drafts = await tx
		.select({ id: khReceiptDraft.id })
		.from(khReceiptDraft)
		.where(inArray(khReceiptDraft.ownerId, people));
	await removeForEntities(
		tx,
		DRAFT_RECEIPTS,
		drafts.map((row) => row.id),
	);
	for (const table of [khReceiptDraft, khMerchantRule, khTag, khMethod, khCategory]) {
		await tx.delete(table).where(inArray(table.ownerId, people));
	}

	// The people nothing points at any more.
	const kept = await referenced(tx, own);
	const gone = own.filter((id) => !kept.has(id));
	if (gone.length > 0) await tx.delete(khPerson).where(inArray(khPerson.id, gone));
}

/** `forgetUsers` for one account, in its own transaction (Better Auth's `beforeDelete`). */
export const forgetUser = (db: Db, userId: string): Promise<void> => db.transaction((tx) => forgetUsers(tx, [userId]));

/** Deletes those of `candidates` that `shared` doesn't find someone else in. */
async function deleteUnshared(
	candidates: string[],
	shared: (ids: string[]) => Promise<Array<{ id: string }>>,
	remove: (ids: string[]) => Promise<void>,
): Promise<void> {
	if (candidates.length === 0) return;
	const withOthers = new Set((await shared(candidates)).map((row) => row.id));
	const alone = candidates.filter((id) => !withOthers.has(id));
	if (alone.length > 0) await remove(alone);
}

/** Which of these people something still points at: an expense, a payment or a group. */
async function referenced(tx: Tx, ids: ReadonlyArray<string>): Promise<Set<string>> {
	const found = new Set<string>();
	const add = (rows: ReadonlyArray<{ id: string }>) => {
		for (const row of rows) found.add(row.id);
	};
	add(
		await tx
			.selectDistinct({ id: khExpensePayer.personId })
			.from(khExpensePayer)
			.where(inArray(khExpensePayer.personId, ids)),
	);
	add(
		await tx
			.selectDistinct({ id: khExpenseShare.personId })
			.from(khExpenseShare)
			.where(inArray(khExpenseShare.personId, ids)),
	);
	add(await tx.selectDistinct({ id: khExpense.createdBy }).from(khExpense).where(inArray(khExpense.createdBy, ids)));
	add(await tx.selectDistinct({ id: khPayment.fromPerson }).from(khPayment).where(inArray(khPayment.fromPerson, ids)));
	add(await tx.selectDistinct({ id: khPayment.toPerson }).from(khPayment).where(inArray(khPayment.toPerson, ids)));
	add(await tx.selectDistinct({ id: khPayment.createdBy }).from(khPayment).where(inArray(khPayment.createdBy, ids)));
	add(await tx.selectDistinct({ id: khGroup.createdBy }).from(khGroup).where(inArray(khGroup.createdBy, ids)));
	add(
		await tx
			.selectDistinct({ id: khGroupMember.personId })
			.from(khGroupMember)
			.where(inArray(khGroupMember.personId, ids)),
	);
	return found;
}
