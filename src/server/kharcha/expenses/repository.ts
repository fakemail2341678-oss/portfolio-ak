import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { similarMerchant } from "@/features/kharcha/lists";
import type { Paid, Share } from "@/features/kharcha/money/split";
import type { DuplicateRef, ExpenseMine } from "@/features/kharcha/types";
import {
	type KhExpenseRow,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroupMember,
	khShareTag,
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

/** The payers and shares of many expenses at once (a page of Spend), each in entry order. */
export async function partsOfMany(db: Db | Tx, expenseIds: ReadonlyArray<string>): Promise<Map<string, ExpenseParts>> {
	const result = new Map<string, ExpenseParts>();
	if (expenseIds.length === 0) return result;
	const ids = [...expenseIds];
	for (const id of ids) result.set(id, { payers: [], shares: [] });
	const payers = await db
		.select({ id: khExpensePayer.expenseId, person: khExpensePayer.personId, amount: khExpensePayer.amountMinor })
		.from(khExpensePayer)
		.where(inArray(khExpensePayer.expenseId, ids))
		.orderBy(khExpensePayer.position);
	const shares = await db
		.select({ id: khExpenseShare.expenseId, person: khExpenseShare.personId, owed: khExpenseShare.owedMinor })
		.from(khExpenseShare)
		.where(inArray(khExpenseShare.expenseId, ids))
		.orderBy(khExpenseShare.position);
	for (const { id, ...payer } of payers) result.get(id)?.payers.push(payer);
	for (const { id, ...share } of shares) result.get(id)?.shares.push(share);
	return result;
}

/**
 * Each person's own part of an expense that isn't its money (Task 89): the category of their
 * share, the method of their payment, a duplicate they dismissed. Kept by person, so the
 * rows can be rewritten when the split changes without anyone losing theirs.
 */
type PartExtras = {
	categories: Map<string, string | null>;
	methods: Map<string, string | null>;
	duplicateOk: Map<string, boolean>;
};

const noExtras = (): PartExtras => ({ categories: new Map(), methods: new Map(), duplicateOk: new Map() });

async function insertParts(tx: Tx, expenseId: string, parts: ExpenseParts, extras = noExtras()): Promise<void> {
	await tx.insert(khExpensePayer).values(
		parts.payers.map((payer, position) => ({
			expenseId,
			personId: payer.person,
			amountMinor: payer.amount,
			position,
			methodId: extras.methods.get(payer.person) ?? null,
		})),
	);
	await tx.insert(khExpenseShare).values(
		parts.shares.map((share, position) => ({
			expenseId,
			personId: share.person,
			owedMinor: share.owed,
			position,
			categoryId: extras.categories.get(share.person) ?? null,
			duplicateOk: extras.duplicateOk.get(share.person) ?? false,
		})),
	);
}

/** One person's part of an expense: their category and method (on their share and their payment, when they have them). */
export type Mine = { personId: string; categoryId: string | null; methodId: string | null };

export async function insertExpense(
	tx: Tx,
	values: typeof khExpense.$inferInsert,
	parts: ExpenseParts,
	mine?: Mine,
): Promise<KhExpenseRow> {
	const [row] = await tx.insert(khExpense).values(values).returning();
	if (!row) throw new Error("kh_expense: nothing inserted");
	const extras = noExtras();
	if (mine) {
		extras.categories.set(mine.personId, mine.categoryId);
		extras.methods.set(mine.personId, mine.methodId);
	}
	await insertParts(tx, row.id, parts, extras);
	return row;
}

/**
 * Rewrites who paid and the shares, keeping each person's category, method and dismissed
 * duplicate (`mine` changes the caller's), and drops the tags of anyone without a share now.
 */
export async function replaceParts(
	tx: Tx,
	expenseId: string,
	parts: ExpenseParts,
	mine?: Partial<Mine> & { personId: string },
): Promise<void> {
	const extras = noExtras();
	const payers = await tx
		.select({ person: khExpensePayer.personId, method: khExpensePayer.methodId })
		.from(khExpensePayer)
		.where(eq(khExpensePayer.expenseId, expenseId));
	for (const row of payers) extras.methods.set(row.person, row.method);
	const shares = await tx
		.select({ person: khExpenseShare.personId, category: khExpenseShare.categoryId, ok: khExpenseShare.duplicateOk })
		.from(khExpenseShare)
		.where(eq(khExpenseShare.expenseId, expenseId));
	for (const row of shares) {
		extras.categories.set(row.person, row.category);
		extras.duplicateOk.set(row.person, row.ok);
	}
	if (mine?.categoryId !== undefined) extras.categories.set(mine.personId, mine.categoryId);
	if (mine?.methodId !== undefined) extras.methods.set(mine.personId, mine.methodId);
	await tx.delete(khExpensePayer).where(eq(khExpensePayer.expenseId, expenseId));
	await tx.delete(khExpenseShare).where(eq(khExpenseShare.expenseId, expenseId));
	await insertParts(tx, expenseId, parts, extras);
	await tx.delete(khShareTag).where(
		and(
			eq(khShareTag.expenseId, expenseId),
			notInArray(
				khShareTag.personId,
				parts.shares.map((share) => share.person),
			),
		),
	);
}

/**
 * Each other participant's own category on a shared expense (Task 90, PLAN 14.5 "Access"):
 * the one of theirs with the same built-in key as the creator's, so the creator's Food is
 * the participant's Food. Only shares without one, of `people` (those new to the expense);
 * a category of the creator's own making, or a participant without that built-in, leaves it empty.
 */
export async function defaultShareCategories(
	tx: Tx,
	expenseId: string,
	creatorCategoryId: string | null,
	people: ReadonlyArray<string>,
): Promise<void> {
	if (!creatorCategoryId || people.length === 0) return;
	await tx.execute(sql`
		update kh_expense_share s set category_id = theirs.id
		from kh_category mine, kh_category theirs
		where s.expense_id = ${expenseId} and s.category_id is null
			and s.person_id in (${sql.join(
				people.map((person) => sql`${person}::uuid`),
				sql`, `,
			)})
			and mine.id = ${creatorCategoryId} and mine.key is not null
			and theirs.owner_id = s.person_id and theirs.key = mine.key and theirs.archived_at is null
	`);
}

/** Makes `tagIds` (already checked as theirs) one person's tags on an expense. */
export async function setTags(
	tx: Tx,
	expenseId: string,
	personId: string,
	tagIds: ReadonlyArray<string>,
): Promise<void> {
	await tx.delete(khShareTag).where(and(eq(khShareTag.expenseId, expenseId), eq(khShareTag.personId, personId)));
	if (tagIds.length > 0) {
		await tx.insert(khShareTag).values(tagIds.map((tagId) => ({ expenseId, personId, tagId })));
	}
}

/** The caller's own part of some expenses: category, tags, method, a dismissed duplicate. */
export async function minesOf(
	db: Db | Tx,
	personId: string,
	expenseIds: ReadonlyArray<string>,
): Promise<Map<string, ExpenseMine>> {
	const result = new Map<string, ExpenseMine>();
	if (expenseIds.length === 0) return result;
	const ids = [...expenseIds];
	const shares = await db
		.select({ id: khExpenseShare.expenseId, category: khExpenseShare.categoryId, ok: khExpenseShare.duplicateOk })
		.from(khExpenseShare)
		.where(and(eq(khExpenseShare.personId, personId), inArray(khExpenseShare.expenseId, ids)));
	const payers = await db
		.select({ id: khExpensePayer.expenseId, method: khExpensePayer.methodId })
		.from(khExpensePayer)
		.where(and(eq(khExpensePayer.personId, personId), inArray(khExpensePayer.expenseId, ids)));
	const tags = await db
		.select({ id: khShareTag.expenseId, tag: khShareTag.tagId })
		.from(khShareTag)
		.where(and(eq(khShareTag.personId, personId), inArray(khShareTag.expenseId, ids)));
	for (const id of ids) {
		const share = shares.find((row) => row.id === id);
		result.set(id, {
			categoryId: share?.category ?? null,
			duplicateOk: share?.ok ?? false,
			methodId: payers.find((row) => row.id === id)?.method ?? null,
			tagIds: tags.filter((row) => row.id === id).map((row) => row.tag),
		});
	}
	return result;
}

/**
 * Possible duplicates among the caller's expenses (Task 89, "helpers without AI"): another
 * of theirs outside the trash of the same kind, amount and currency, within a day, with a
 * similar merchant. Saying "not a duplicate" on either one (`duplicate_ok`) settles the pair.
 */
export async function duplicatesOf(
	db: Db | Tx,
	personId: string,
	expenseIds: ReadonlyArray<string>,
): Promise<Map<string, DuplicateRef[]>> {
	const result = new Map<string, DuplicateRef[]>();
	if (expenseIds.length === 0) return result;
	const other = alias(khExpense, "kh_dup_other");
	const otherShare = alias(khExpenseShare, "kh_dup_other_share");
	const rows = await db
		.select({
			id: khExpense.id,
			merchant: khExpense.merchant,
			title: khExpense.title,
			otherId: other.id,
			otherMerchant: other.merchant,
			otherTitle: other.title,
			otherOn: other.spentOn,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.innerJoin(otherShare, and(eq(otherShare.personId, personId), eq(otherShare.duplicateOk, false)))
		.innerJoin(
			other,
			and(
				eq(other.id, otherShare.expenseId),
				ne(other.id, khExpense.id),
				eq(other.amountMinor, khExpense.amountMinor),
				eq(other.currency, khExpense.currency),
				eq(other.kind, khExpense.kind),
				isNull(other.deletedAt),
				sql`abs(${other.spentOn} - ${khExpense.spentOn}) <= 1`,
			),
		)
		.where(
			and(
				eq(khExpenseShare.personId, personId),
				eq(khExpenseShare.duplicateOk, false),
				inArray(khExpenseShare.expenseId, [...expenseIds]),
				isNull(khExpense.deletedAt),
			),
		)
		.orderBy(other.spentOn, other.createdAt);
	for (const row of rows) {
		if (!similarMerchant(row, { merchant: row.otherMerchant, title: row.otherTitle })) continue;
		const ref = { id: row.otherId, title: row.otherTitle || row.otherMerchant, spentOn: row.otherOn };
		result.set(row.id, [...(result.get(row.id) ?? []), ref]);
	}
	return result;
}

/** Says the caller's part of an expense isn't a duplicate (or is one again). */
export async function setDuplicateOk(tx: Tx, expenseId: string, personId: string, ok: boolean): Promise<void> {
	await tx
		.update(khExpenseShare)
		.set({ duplicateOk: ok })
		.where(and(eq(khExpenseShare.expenseId, expenseId), eq(khExpenseShare.personId, personId)));
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
