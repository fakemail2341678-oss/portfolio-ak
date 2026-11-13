import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { firstRule } from "@/features/kharcha/lists";
import { splitProblemMessage } from "@/features/kharcha/money/problem";
import { computeShares, type Paid, payersProblem, type Split, type SplitProblem } from "@/features/kharcha/money/split";
import { threadKey } from "@/features/kharcha/notifications";
import type { CreateExpenseInput, UpdateExpenseInput } from "@/features/kharcha/schema";
import type {
	ActivityData,
	ActivityKind,
	ExpenseActivityLine,
	ExpenseDetail,
	ExpenseKind,
	ExpenseMine,
	ExpenseView,
	FixKind,
} from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import type { IsoDate } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { type KhExpenseRow, khActivity, khCategory, khExpense, khMethod, khTag } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import {
	assertGroupCan,
	assertSourceCan,
	type ExpenseAccess,
	type GroupAccess,
	type KharchaServices,
	type Me,
	resolveExpense,
	resolveGroup,
	resolveMe,
} from "../access";
import { type ActivityScope, fieldChanges, pairOf, recordActivity } from "../activity";
import { commentsOf, resolveThread, talkOf } from "../conversations/service";
import { writeLedger } from "../ledger";
import * as lists from "../lists/repository";
import { deliverAfter, produce } from "../notify/produce";
import { loadPeople } from "../people";
import { EXPENSE_RECEIPTS, linkReceipts, receiptIdsOf, receiptsOf, takeDraft } from "../receipts/service";
import { bumpRevs, saveVersioned } from "../rev";
import { assertCurrencyOffered, assertFormerSettled, befriendDebtors, touched } from "../rules";
import { assertQuota, getSettings, quotasFor } from "../settings";
import * as repo from "./repository";

/**
 * Kharcha's expenses (docs/guides/kharcha.md "Expenses"). Every write is one transaction:
 * access, the change, the ledger, the history, then the `rev` of everyone it touches. The
 * caller's own part (Task 89: their category, tags and method) rides on their share and
 * their payment; nobody else sees it.
 */

const splitError = (problem: SplitProblem, currency: string) =>
	ruleError("BAD_REQUEST", `Kharcha split: ${problem.code}`, splitProblemMessage(problem, currency));

/** The payers and the shares of an amount, or a BAD_REQUEST saying why they don't add up. */
function partsFor(amountMinor: number, currency: string, payers: Paid[], split: Split): repo.ExpenseParts {
	const unpaid = payersProblem(amountMinor, payers);
	if (unpaid) {
		throw unpaid.code === "unassigned"
			? ruleError("BAD_REQUEST", "Kharcha payers: sum", m.kharcha_error_payers_sum())
			: splitError(unpaid, currency);
	}
	const result = computeShares(amountMinor, split);
	if (!result.ok) throw splitError(result.problem, currency);
	return { payers, shares: result.shares };
}

/**
 * Who an expense may name. In a group: its current members. Outside one: the caller and
 * their friends, and the caller must be on it (it is theirs or shared with them). People
 * already on the expense may stay on it either way.
 */
async function assertPeople(
	tx: Tx,
	me: Me,
	group: GroupAccess | null,
	people: ReadonlyArray<string>,
	already: ReadonlySet<string> = new Set(),
): Promise<void> {
	const fresh = people.filter((person) => !already.has(person));
	if (group) {
		const members = await repo.currentMembersAmong(tx, group.group.id, fresh);
		if (!fresh.every((person) => members.has(person))) {
			throw ruleError("BAD_REQUEST", "Kharcha: not a member of the group", m.kharcha_error_not_member());
		}
		return;
	}
	if (!people.includes(me.personId)) {
		throw ruleError("BAD_REQUEST", "Kharcha: the caller isn't on the expense", m.kharcha_error_not_involved());
	}
	const others = fresh.filter((person) => person !== me.personId);
	const friends = await repo.friendsAmong(tx, me.personId, others);
	if (!others.every((person) => friends.has(person))) {
		throw ruleError("BAD_REQUEST", "Kharcha: not a friend", m.kharcha_error_not_friend());
	}
}

const scopeOf = (expense: Pick<KhExpenseRow, "groupId">, people: Iterable<string>): ActivityScope => ({
	groupId: expense.groupId,
	pair: expense.groupId ? null : pairOf(people),
});

/** The fields an edit's history compares, one line per change. */
const scalars = (row: KhExpenseRow) => ({
	title: row.title,
	merchant: row.merchant,
	notes: row.notes,
	amountMinor: row.amountMinor,
	currency: row.currency,
	spentOn: row.spentOn,
	kind: row.kind,
});

/** The caller's own part as they ask for it: each left out keeps what it is (or, on a new expense, the helpers fill it). */
type MineInput = {
	categoryId?: string | null | undefined;
	tagIds?: string[] | undefined;
	methodId?: string | null | undefined;
};

/** Checks that what the caller names is theirs: a category, a method and tags are nobody else's to use. */
async function assertMine(tx: Tx, me: Me, input: MineInput): Promise<void> {
	if (input.categoryId) await lists.ownCategory(tx, me.personId, input.categoryId);
	if (input.methodId) await lists.ownMethod(tx, me.personId, input.methodId);
	if (input.tagIds) await lists.ownTags(tx, me.personId, input.tagIds);
}

/**
 * A new expense's own part when the caller left some out (Task 89, "helpers without AI"):
 * the first merchant rule that matches, else the category they last gave the merchant.
 */
async function helped(tx: Tx, me: Me, merchant: string, input: MineInput) {
	const rule = merchant.trim() ? firstRule(await lists.rulesOf(tx, me.personId), merchant) : null;
	// A tag deleted since the rule was made is skipped (`tag_ids` has no foreign key).
	const live = rule?.tagIds.length
		? await tx
				.select({ id: khTag.id })
				.from(khTag)
				.where(and(eq(khTag.ownerId, me.personId), inArray(khTag.id, rule.tagIds)))
		: [];
	const ruleTags = (rule?.tagIds ?? []).filter((id) => live.some((tag) => tag.id === id)).map((id) => ({ id }));
	const categoryId =
		input.categoryId !== undefined
			? input.categoryId
			: (rule?.categoryId ?? (await lists.lastCategoryFor(tx, me.personId, merchant)));
	return {
		categoryId,
		methodId: input.methodId !== undefined ? input.methodId : (rule?.methodId ?? null),
		tagIds: input.tagIds ?? ruleTags.map((tag) => tag.id),
	};
}

export type NewExpense = {
	id?: string | undefined;
	groupId: string | null;
	kind: ExpenseKind;
	title: string;
	merchant: string;
	notes: string;
	amountMinor: number;
	currency: string;
	spentOn: IsoDate;
	payers: Paid[];
	split: Split;
	/** The actor's own category, method and tags (checked as theirs by the caller). */
	categoryId?: string | null;
	methodId?: string | null;
	tagIds?: string[];
};

/**
 * Writes a new expense once access is settled: the rows, its ledger, the friendships its
 * debts make, the history and the `rev`s. The services call it after their checks; the
 * sample data calls it directly (src/server/kharcha/guest-data.ts).
 */
export async function addExpense(tx: Tx, actorId: string, input: NewExpense): Promise<KhExpenseRow> {
	const parts = partsFor(input.amountMinor, input.currency, input.payers, input.split);
	const expense = await repo.insertExpense(
		tx,
		{
			...(input.id ? { id: input.id } : {}),
			groupId: input.groupId,
			createdBy: actorId,
			kind: input.kind,
			title: input.title,
			merchant: input.merchant,
			notes: input.notes,
			amountMinor: input.amountMinor,
			currency: input.currency,
			spentOn: input.spentOn,
			split: input.split,
		},
		parts,
		{ personId: actorId, categoryId: input.categoryId ?? null, methodId: input.methodId ?? null },
	);
	if (input.tagIds?.length && parts.shares.some((share) => share.person === actorId)) {
		await repo.setTags(tx, expense.id, actorId, input.tagIds);
	}
	const people = repo.partsPeople(parts);
	await repo.defaultShareCategories(
		tx,
		expense.id,
		input.categoryId ?? null,
		people.filter((person) => person !== actorId),
	);
	await befriendDebtors(tx, await writeLedger(tx, { expense }));
	await recordActivity(tx, actorId, scopeOf(expense, people), {
		kind: "expense.created",
		expenseId: expense.id,
		data: { title: expense.title || expense.merchant },
	});
	await bumpRevs(tx, await touched(tx, expense.groupId, [actorId, ...people]));
	return expense;
}

/** What an expense still needs from the caller: a category for their share, a look at a possible duplicate. */
export const fixesOf = (
	expense: Pick<KhExpenseRow, "deletedAt">,
	myShareMinor: number | null,
	mine: ExpenseMine,
	duplicates: number,
): FixKind[] => {
	if (expense.deletedAt) return [];
	const fixes: FixKind[] = [];
	if (myShareMinor !== null && myShareMinor > 0 && mine.categoryId === null) fixes.push("uncategorized");
	if (duplicates > 0) fixes.push("duplicate");
	return fixes;
};

const NO_MINE: ExpenseMine = { categoryId: null, tagIds: [], methodId: null, duplicateOk: false };

async function expenseView(
	tx: Db | Tx,
	me: Me,
	access: ExpenseAccess,
	store: ImageStore | null | undefined,
): Promise<ExpenseView> {
	const { expense } = access;
	const parts = await repo.partsOf(tx, expense.id);
	const people = await loadPeople(tx, me.personId, [...repo.partsPeople(parts), expense.createdBy]);
	const mine = (await repo.minesOf(tx, me.personId, [expense.id])).get(expense.id) ?? NO_MINE;
	const myShare = parts.shares.find((share) => share.person === me.personId);
	const duplicates = mine.duplicateOk
		? []
		: ((await repo.duplicatesOf(tx, me.personId, [expense.id])).get(expense.id) ?? []);
	const chips = await lists.chipsOf(tx, [mine.categoryId]);
	const tags =
		mine.tagIds.length === 0
			? []
			: await tx.select({ id: khTag.id, name: khTag.name }).from(khTag).where(inArray(khTag.id, mine.tagIds));
	const [method] = mine.methodId
		? await tx.select({ id: khMethod.id, name: khMethod.name }).from(khMethod).where(eq(khMethod.id, mine.methodId))
		: [];
	const receipts = await receiptsOf(tx, store, EXPENSE_RECEIPTS, [expense.id]);
	return {
		id: expense.id,
		groupId: expense.groupId,
		kind: expense.kind,
		title: expense.title,
		merchant: expense.merchant,
		notes: expense.notes,
		amountMinor: expense.amountMinor,
		currency: expense.currency,
		spentOn: expense.spentOn,
		split: expense.split,
		payers: parts.payers.map((payer) => ({ personId: payer.person, amountMinor: payer.amount })),
		shares: parts.shares.map((share) => ({ personId: share.person, owedMinor: share.owed })),
		people,
		createdBy: expense.createdBy,
		myShareMinor: myShare?.owed ?? 0,
		myPaidMinor: parts.payers.find((payer) => payer.person === me.personId)?.amount ?? 0,
		version: expense.version,
		deletedAt: expense.deletedAt?.toISOString() ?? null,
		createdAt: expense.createdAt.toISOString(),
		updatedAt: expense.updatedAt.toISOString(),
		can: access.can,
		mine,
		category: mine.categoryId ? (chips.get(mine.categoryId) ?? null) : null,
		tags: mine.tagIds.flatMap((id) => tags.filter((tag) => tag.id === id)),
		method: method ?? null,
		receipts: receipts.get(expense.id) ?? [],
		fixes: fixesOf(expense, myShare ? myShare.owed : null, mine, duplicates.length),
		duplicates,
	};
}

/** The expense's history, oldest first: who did what, each edit as "field: from → to". */
async function historyOf(tx: Db | Tx, me: Me, expenseId: string): Promise<ExpenseActivityLine[]> {
	const rows = await tx
		.select()
		.from(khActivity)
		.where(eq(khActivity.expenseId, expenseId))
		.orderBy(asc(khActivity.at), asc(khActivity.id));
	const actors = await loadPeople(
		tx,
		me.personId,
		rows.flatMap((row) => (row.actorId ? [row.actorId] : [])),
	);
	return rows.map((row) => ({
		id: row.id,
		kind: row.kind,
		at: row.at.toISOString(),
		actor: actors.find((person) => person.id === row.actorId) ?? null,
		data: row.data,
	}));
}

/** The expense page and panel: the expense with the caller's part, its receipts and its history. */
export async function getExpense({ db, user, imageStore }: KharchaServices, expenseId: string): Promise<ExpenseDetail> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, expenseId);
		const view = await expenseView(tx, me, access, imageStore);
		const thread = await resolveThread(tx, me, threadKey("e", expenseId));
		return {
			...view,
			activity: await historyOf(tx, me, expenseId),
			comments: await commentsOf(tx, me, thread),
			talk: await talkOf(tx, me, thread),
		};
	});
}

/** Left out, the caller paid all of it and it is theirs alone: a personal expense. */
const withDefaults = (
	me: Me,
	input: { amountMinor: number; payers?: Paid[] | undefined; split?: Split | undefined },
) => ({
	payers: input.payers ?? [{ person: me.personId, amount: input.amountMinor }],
	split: input.split ?? ({ method: "full", person: me.personId } satisfies Split),
});

export async function createExpense(
	{ db, user, imageStore, deliver }: KharchaServices,
	input: CreateExpenseInput,
): Promise<ExpenseView> {
	const { view, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const group = input.groupId ? await resolveGroup(tx, me, input.groupId) : null;
		if (group) assertGroupCan(group, "edit");
		const settings = await getSettings(tx);
		assertCurrencyOffered(settings, input.currency);
		const { payers, split } = withDefaults(me, input);
		const parts = partsFor(input.amountMinor, input.currency, payers, split);
		await assertPeople(tx, me, group, repo.partsPeople(parts));
		await assertMine(tx, me, input);
		await assertQuota(tx, `${me.personId}:expenses`, {
			table: khExpense,
			where: eq(khExpense.createdBy, me.personId),
			max: quotasFor(settings, user).expenses,
		});
		const own = await helped(tx, me, input.merchant, input);
		const expense = await addExpense(tx, me.personId, { ...input, payers, split, ...own });
		if (input.draftId) await takeDraft(tx, me, input.draftId, expense.id);
		const receiptIds = input.receiptIds ?? (input.draftId ? await receiptIdsOf(tx, EXPENSE_RECEIPTS, expense.id) : []);
		if (receiptIds.length > 0 || input.draftId) {
			await linkReceipts(tx, me, { entityType: EXPENSE_RECEIPTS, entityId: expense.id }, receiptIds);
		}
		const { instant } = await notifyExpense(
			tx,
			me,
			"expense.added",
			expense,
			repo.partsPeople(parts),
			group?.group.name ?? null,
		);
		const view = await expenseView(
			tx,
			me,
			{ expense, group, can: { edit: true, delete: true, restore: false } },
			imageStore,
		);
		return { view, instant };
	});
	deliverAfter(deliver, instant);
	return view;
}

/** Tells the people on an expense (Task 92): added, changed or deleted; the actor never. */
function notifyExpense(
	tx: Tx,
	me: Me,
	kind: "expense.added" | "expense.updated" | "expense.deleted",
	expense: KhExpenseRow,
	people: ReadonlyArray<string>,
	group: string | null,
) {
	return produce(tx, { personId: me.personId, name: me.person.displayName }, [
		{
			kind,
			to: people,
			thread: threadKey("e", expense.id),
			groupId: expense.groupId,
			expenseId: expense.id,
			data: { title: expense.title || expense.merchant, ...(group ? { group } : {}) },
		},
	]);
}

/** The names a private field's history shows: a category's, a method's, tags joined. */
async function privateNames(tx: Tx, mine: Pick<ExpenseMine, "categoryId" | "methodId" | "tagIds">) {
	const [category] = mine.categoryId
		? await tx.select({ name: khCategory.name }).from(khCategory).where(eq(khCategory.id, mine.categoryId))
		: [];
	const [method] = mine.methodId
		? await tx.select({ name: khMethod.name }).from(khMethod).where(eq(khMethod.id, mine.methodId))
		: [];
	const tags =
		mine.tagIds.length === 0
			? []
			: await tx.select({ id: khTag.id, name: khTag.name }).from(khTag).where(inArray(khTag.id, mine.tagIds));
	return {
		category: category?.name ?? null,
		method: method?.name ?? null,
		tags: mine.tagIds.flatMap((id) => tags.filter((tag) => tag.id === id).map((tag) => tag.name)).join(", ") || null,
	};
}

/**
 * The expense form's save: every field, at the `version` it was loaded with. The payers,
 * the shares and the ledger are rewritten; each changed field leaves a line of history.
 * The caller's category, tags and method change only when sent, and their history is kept
 * only on an expense that is theirs alone: on a shared one, their lists stay private.
 */
export async function updateExpense(
	{ db, user, imageStore, deliver }: KharchaServices,
	input: UpdateExpenseInput,
): Promise<ExpenseView> {
	const { view, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, input.expenseId);
		assertSourceCan(access, "edit");
		const before = access.expense;
		const beforeParts = await repo.partsOf(tx, before.id);
		const beforePeople = repo.partsPeople(beforeParts);
		const beforeMine = (await repo.minesOf(tx, me.personId, [before.id])).get(before.id) ?? NO_MINE;
		const beforeReceipts = await receiptIdsOf(tx, EXPENSE_RECEIPTS, before.id);
		if (input.currency !== before.currency) assertCurrencyOffered(await getSettings(tx), input.currency);
		const { payers, split } = withDefaults(me, input);
		const parts = partsFor(input.amountMinor, input.currency, payers, split);
		const people = repo.partsPeople(parts);
		await assertPeople(tx, me, access.group, people, new Set(beforePeople));
		await assertMine(tx, me, input);

		const expense = await saveVersioned(tx, khExpense, {
			id: before.id,
			version: input.version,
			what: "Expense",
			set: {
				kind: input.kind,
				title: input.title,
				merchant: input.merchant,
				notes: input.notes,
				amountMinor: input.amountMinor,
				currency: input.currency,
				spentOn: input.spentOn,
				split,
			},
		});
		await repo.replaceParts(tx, expense.id, parts, {
			personId: me.personId,
			...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
			...(input.methodId !== undefined ? { methodId: input.methodId } : {}),
		});
		const sharing = parts.shares.some((share) => share.person === me.personId);
		if (input.tagIds && sharing) await repo.setTags(tx, expense.id, me.personId, input.tagIds);
		// Someone new on it gets their own category of the same built-in as the editor's (Task 90).
		const editorCategory = input.categoryId !== undefined ? input.categoryId : beforeMine.categoryId;
		await repo.defaultShareCategories(
			tx,
			expense.id,
			editorCategory,
			people.filter((person) => person !== me.personId && !beforePeople.includes(person)),
		);
		if (input.receiptIds) {
			await linkReceipts(tx, me, { entityType: EXPENSE_RECEIPTS, entityId: expense.id }, input.receiptIds);
		}
		await befriendDebtors(tx, await writeLedger(tx, { expense }));
		if (expense.groupId) await assertFormerSettled(tx, expense.groupId);

		const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
		const afterMine = (await repo.minesOf(tx, me.personId, [expense.id])).get(expense.id) ?? NO_MINE;
		const alone = people.length === 1 && people[0] === me.personId && beforePeople.every((id) => id === me.personId);
		const own: Array<{ kind: ActivityKind; data: ActivityData }> = [];
		if (alone) {
			const [from, to] = [await privateNames(tx, beforeMine), await privateNames(tx, afterMine)];
			own.push(...fieldChanges("expense.updated", from, to));
		}
		const receipts = input.receiptIds ?? beforeReceipts;
		await recordActivity(
			tx,
			me.personId,
			scopeOf(expense, [...beforePeople, ...people]),
			...[
				...fieldChanges("expense.updated", scalars(before), scalars(expense)),
				...own,
				...(same(beforeParts.payers, parts.payers)
					? []
					: [{ kind: "expense.updated" as const, data: { field: "payers" } }]),
				...(same(beforeParts.shares, parts.shares)
					? []
					: [{ kind: "expense.updated" as const, data: { field: "split" } }]),
				...(same(beforeReceipts, receipts)
					? []
					: [
							{
								kind: "expense.updated" as const,
								data: { field: "receipts", from: beforeReceipts.length, to: receipts.length },
							},
						]),
			].map((entry) => ({ ...entry, expenseId: expense.id })),
		);
		await bumpRevs(tx, await touched(tx, expense.groupId, [me.personId, ...beforePeople, ...people]));
		const { instant } = await notifyExpense(
			tx,
			me,
			"expense.updated",
			expense,
			[...beforePeople, ...people],
			access.group?.group.name ?? null,
		);
		return { view: await expenseView(tx, me, { ...access, expense }, imageStore), instant };
	});
	deliverAfter(deliver, instant);
	return view;
}

/**
 * "Not a duplicate" (or "it may be one" again): the caller's own flag on their share, so the
 * badge goes from both expenses of the pair. Only theirs: nobody else's view changes.
 */
export async function setNotDuplicate(
	{ db, user, imageStore }: KharchaServices,
	expenseId: string,
	ok: boolean,
): Promise<ExpenseView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, expenseId);
		await repo.setDuplicateOk(tx, expenseId, me.personId, ok);
		await bumpRevs(tx, [me.personId]);
		return expenseView(tx, me, access, imageStore);
	});
}

/**
 * To the trash, or back: the expense's ledger rows go and come back with it. Guarded by the
 * row's own state, so two people deleting at once leave one line of history. Its receipts
 * stay with it until the trash is emptied.
 */
async function setDeleted(
	{ db, user, imageStore, deliver }: KharchaServices,
	expenseId: string,
	deleted: boolean,
	now = new Date(),
): Promise<ExpenseView> {
	const { view, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, expenseId, now);
		assertSourceCan(access, deleted ? "delete" : "restore");
		const { expense, instant } = await trashInTx(tx, me, access, deleted, now);
		const editable = access.can.delete || access.can.restore;
		const view = await expenseView(
			tx,
			me,
			{
				...access,
				expense,
				can: { edit: editable && !deleted, delete: editable && !deleted, restore: editable && deleted },
			},
			imageStore,
		);
		return { view, instant };
	});
	deliverAfter(deliver, instant);
	return view;
}

/**
 * The trash's change inside a transaction, once access allows it (`setDeleted`, and Spend's
 * bulk delete, Task 93): the row, its ledger, the history, the `rev`s and who is told.
 */
export async function trashInTx(
	tx: Tx,
	me: Me,
	access: Awaited<ReturnType<typeof resolveExpense>>,
	deleted: boolean,
	now: Date,
) {
	const expenseId = access.expense.id;
	const [expense] = await tx
		.update(khExpense)
		.set({ deletedAt: deleted ? now : null })
		.where(and(eq(khExpense.id, expenseId), deleted ? isNull(khExpense.deletedAt) : isNotNull(khExpense.deletedAt)))
		.returning();
	if (!expense) {
		throw deleted
			? ruleError("FORBIDDEN", "Kharcha: in the trash", m.kharcha_error_in_trash())
			: ruleError("FORBIDDEN", "Kharcha: not in the trash", m.kharcha_error_not_in_trash());
	}
	await writeLedger(tx, { expense });
	if (expense.groupId) await assertFormerSettled(tx, expense.groupId);
	const people = repo.partsPeople(await repo.partsOf(tx, expense.id));
	await recordActivity(tx, me.personId, scopeOf(expense, people), {
		kind: deleted ? "expense.deleted" : "expense.restored",
		expenseId: expense.id,
		data: { title: expense.title || expense.merchant },
	});
	await bumpRevs(tx, await touched(tx, expense.groupId, [me.personId, ...people]));
	const { instant } = deleted
		? await notifyExpense(tx, me, "expense.deleted", expense, people, access.group?.group.name ?? null)
		: { instant: [] };
	return { expense, instant };
}

export const deleteExpense = (services: KharchaServices, expenseId: string, now?: Date) =>
	setDeleted(services, expenseId, true, now);

export const restoreExpense = (services: KharchaServices, expenseId: string, now?: Date) =>
	setDeleted(services, expenseId, false, now);
