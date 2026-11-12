import "@tanstack/react-start/server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { splitProblemMessage } from "@/features/kharcha/money/problem";
import { computeShares, type Paid, payersProblem, type Split, type SplitProblem } from "@/features/kharcha/money/split";
import type { CreateExpenseInput, UpdateExpenseInput } from "@/features/kharcha/schema";
import type { ExpenseKind, ExpenseView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import type { IsoDate } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { type KhExpenseRow, khExpense } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
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
import { writeLedger } from "../ledger";
import { loadPeople } from "../people";
import { bumpRevs, saveVersioned } from "../rev";
import { assertCurrencyOffered, assertFormerSettled, befriendDebtors, touched } from "../rules";
import { assertQuota, getSettings, quotasFor } from "../settings";
import * as repo from "./repository";

/**
 * Kharcha's expenses (docs/guides/kharcha.md "Expenses"). Every write is one transaction:
 * access, the change, the ledger, the history, then the `rev` of everyone it touches.
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
	);
	await befriendDebtors(tx, await writeLedger(tx, { expense }));
	const people = repo.partsPeople(parts);
	await recordActivity(tx, actorId, scopeOf(expense, people), {
		kind: "expense.created",
		expenseId: expense.id,
		data: { title: expense.title || expense.merchant },
	});
	await bumpRevs(tx, await touched(tx, expense.groupId, [actorId, ...people]));
	return expense;
}

async function expenseView(tx: Tx, me: Me, access: ExpenseAccess): Promise<ExpenseView> {
	const { expense } = access;
	const parts = await repo.partsOf(tx, expense.id);
	const people = await loadPeople(tx, me.personId, [...repo.partsPeople(parts), expense.createdBy]);
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
		myShareMinor: parts.shares.find((share) => share.person === me.personId)?.owed ?? 0,
		myPaidMinor: parts.payers.find((payer) => payer.person === me.personId)?.amount ?? 0,
		version: expense.version,
		deletedAt: expense.deletedAt?.toISOString() ?? null,
		createdAt: expense.createdAt.toISOString(),
		updatedAt: expense.updatedAt.toISOString(),
		can: access.can,
	};
}

export async function getExpense({ db, user }: KharchaServices, expenseId: string): Promise<ExpenseView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		return expenseView(tx, me, await resolveExpense(tx, me, expenseId));
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

export async function createExpense({ db, user }: KharchaServices, input: CreateExpenseInput): Promise<ExpenseView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const group = input.groupId ? await resolveGroup(tx, me, input.groupId) : null;
		if (group) assertGroupCan(group, "edit");
		const settings = await getSettings(tx);
		assertCurrencyOffered(settings, input.currency);
		const { payers, split } = withDefaults(me, input);
		const parts = partsFor(input.amountMinor, input.currency, payers, split);
		await assertPeople(tx, me, group, repo.partsPeople(parts));
		await assertQuota(tx, `${me.personId}:expenses`, {
			table: khExpense,
			where: eq(khExpense.createdBy, me.personId),
			max: quotasFor(settings, user).expenses,
		});
		const expense = await addExpense(tx, me.personId, { ...input, payers, split });
		return expenseView(tx, me, { expense, group, can: { edit: true, delete: true, restore: false } });
	});
}

/**
 * The expense form's save: every field, at the `version` it was loaded with. The payers,
 * the shares and the ledger are rewritten; each changed field leaves a line of history.
 */
export async function updateExpense({ db, user }: KharchaServices, input: UpdateExpenseInput): Promise<ExpenseView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, input.expenseId);
		assertSourceCan(access, "edit");
		const before = access.expense;
		const beforeParts = await repo.partsOf(tx, before.id);
		const beforePeople = repo.partsPeople(beforeParts);
		if (input.currency !== before.currency) assertCurrencyOffered(await getSettings(tx), input.currency);
		const { payers, split } = withDefaults(me, input);
		const parts = partsFor(input.amountMinor, input.currency, payers, split);
		const people = repo.partsPeople(parts);
		await assertPeople(tx, me, access.group, people, new Set(beforePeople));

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
		await repo.replaceParts(tx, expense.id, parts);
		await befriendDebtors(tx, await writeLedger(tx, { expense }));
		if (expense.groupId) await assertFormerSettled(tx, expense.groupId);

		const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
		await recordActivity(
			tx,
			me.personId,
			scopeOf(expense, [...beforePeople, ...people]),
			...[
				...fieldChanges("expense.updated", scalars(before), scalars(expense)),
				...(same(beforeParts.payers, parts.payers)
					? []
					: [{ kind: "expense.updated" as const, data: { field: "payers" } }]),
				...(same(beforeParts.shares, parts.shares)
					? []
					: [{ kind: "expense.updated" as const, data: { field: "split" } }]),
			].map((entry) => ({ ...entry, expenseId: expense.id })),
		);
		await bumpRevs(tx, await touched(tx, expense.groupId, [me.personId, ...beforePeople, ...people]));
		return expenseView(tx, me, { ...access, expense });
	});
}

/**
 * To the trash, or back: the expense's ledger rows go and come back with it. Guarded by the
 * row's own state, so two people deleting at once leave one line of history.
 */
async function setDeleted(
	{ db, user }: KharchaServices,
	expenseId: string,
	deleted: boolean,
	now = new Date(),
): Promise<ExpenseView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveExpense(tx, me, expenseId, now);
		assertSourceCan(access, deleted ? "delete" : "restore");
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
		const editable = access.can.delete || access.can.restore;
		return expenseView(tx, me, {
			...access,
			expense,
			can: { edit: editable && !deleted, delete: editable && !deleted, restore: editable && deleted },
		});
	});
}

export const deleteExpense = (services: KharchaServices, expenseId: string, now?: Date) =>
	setDeleted(services, expenseId, true, now);

export const restoreExpense = (services: KharchaServices, expenseId: string, now?: Date) =>
	setDeleted(services, expenseId, false, now);
