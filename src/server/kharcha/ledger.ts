import "@tanstack/react-start/server-only";
import { and, eq, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import { type Debt, expenseDebts, paymentDebt } from "@/features/kharcha/money/ledger";
import type { Amount } from "@/features/kharcha/types";
import { type KhExpenseRow, type KhPaymentRow, khExpensePayer, khExpenseShare, khLedger } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Kharcha's ledger on the server (docs/guides/kharcha.md "The ledger", decision 0278).
 * `writeLedger` is the only writer of `kh_ledger`: every write path of an expense or a
 * payment calls it in its own transaction, so the rows always are what the money core
 * (src/features/kharcha/money/ledger.ts) says the source's debts are. Balances are sums
 * over the rows, per currency, never converted.
 */

type Source =
	| { expense: Pick<KhExpenseRow, "id" | "groupId" | "kind" | "currency" | "deletedAt"> }
	| {
			payment: Pick<
				KhPaymentRow,
				"id" | "groupId" | "fromPerson" | "toPerson" | "amountMinor" | "currency" | "deletedAt"
			>;
	  };

/**
 * Rewrites the source's rows from what is stored now: an expense's payers and shares, a
 * payment's two people. A source in the trash has none. Returns the debts written.
 */
export async function writeLedger(tx: Tx, source: Source): Promise<Debt[]> {
	if ("expense" in source) {
		const { expense } = source;
		await tx.delete(khLedger).where(eq(khLedger.expenseId, expense.id));
		if (expense.deletedAt) return [];
		const payers = await tx
			.select({ person: khExpensePayer.personId, amount: khExpensePayer.amountMinor })
			.from(khExpensePayer)
			.where(eq(khExpensePayer.expenseId, expense.id))
			.orderBy(khExpensePayer.position);
		const shares = await tx
			.select({ person: khExpenseShare.personId, owed: khExpenseShare.owedMinor })
			.from(khExpenseShare)
			.where(eq(khExpenseShare.expenseId, expense.id))
			.orderBy(khExpenseShare.position);
		const debts = expenseDebts(expense.kind, payers, shares);
		await insertDebts(tx, debts, { expenseId: expense.id, groupId: expense.groupId, currency: expense.currency });
		return debts;
	}
	const { payment } = source;
	await tx.delete(khLedger).where(eq(khLedger.paymentId, payment.id));
	if (payment.deletedAt) return [];
	const debts = [paymentDebt(payment.fromPerson, payment.toPerson, payment.amountMinor)];
	await insertDebts(tx, debts, { paymentId: payment.id, groupId: payment.groupId, currency: payment.currency });
	return debts;
}

async function insertDebts(
	tx: Tx,
	debts: ReadonlyArray<Debt>,
	source: { expenseId?: string; paymentId?: string; groupId: string | null; currency: string },
): Promise<void> {
	if (debts.length === 0) return;
	await tx.insert(khLedger).values(
		debts.map((debt) => ({
			...source,
			debtorId: debt.debtor,
			creditorId: debt.creditor,
			amountMinor: debt.amount,
		})),
	);
}

const total = sql<number>`sum(${khLedger.amountMinor})`.mapWith(Number);

/** Which rows a balance is summed over: one group's, those outside any group, or all. */
export type LedgerScope = { groupId?: string | null };

const inScope = (scope: LedgerScope): SQL | undefined =>
	scope.groupId === undefined
		? undefined
		: scope.groupId === null
			? isNull(khLedger.groupId)
			: eq(khLedger.groupId, scope.groupId);

export type PairBalance = { personId: string; currency: string; amountMinor: number };

/**
 * What each other person owes `meId` per currency (below zero: what `meId` owes them),
 * from the debts between them; pairs at zero are left out. `otherId` narrows it to one person.
 */
export async function pairBalances(
	db: Db | Tx,
	meId: string,
	scope: LedgerScope & { otherId?: string } = {},
): Promise<PairBalance[]> {
	const owedToMe = await db
		.select({ personId: khLedger.debtorId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(
			and(
				eq(khLedger.creditorId, meId),
				scope.otherId ? eq(khLedger.debtorId, scope.otherId) : undefined,
				inScope(scope),
			),
		)
		.groupBy(khLedger.debtorId, khLedger.currency);
	const owedByMe = await db
		.select({ personId: khLedger.creditorId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(
			and(
				eq(khLedger.debtorId, meId),
				scope.otherId ? eq(khLedger.creditorId, scope.otherId) : undefined,
				inScope(scope),
			),
		)
		.groupBy(khLedger.creditorId, khLedger.currency);
	const sums = new Map<string, PairBalance>();
	const add = (personId: string, currency: string, amount: number) => {
		const key = `${personId}|${currency}`;
		const entry = sums.get(key) ?? { personId, currency, amountMinor: 0 };
		entry.amountMinor += amount;
		sums.set(key, entry);
	};
	for (const row of owedToMe) add(row.personId, row.currency, row.amount);
	for (const row of owedByMe) add(row.personId, row.currency, -row.amount);
	return [...sums.values()].filter((entry) => entry.amountMinor !== 0);
}

export type GroupNet = { personId: string; currency: string; netMinor: number };

/**
 * Every person's net in a group per currency: what they are owed minus what they owe.
 * The nets of one currency sum to zero; people at zero are left out.
 */
export async function groupNets(db: Db | Tx, groupId: string): Promise<GroupNet[]> {
	const credited = await db
		.select({ personId: khLedger.creditorId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(eq(khLedger.groupId, groupId))
		.groupBy(khLedger.creditorId, khLedger.currency);
	const owed = await db
		.select({ personId: khLedger.debtorId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(eq(khLedger.groupId, groupId))
		.groupBy(khLedger.debtorId, khLedger.currency);
	const sums = new Map<string, GroupNet>();
	const add = (personId: string, currency: string, amount: number) => {
		const key = `${personId}|${currency}`;
		const entry = sums.get(key) ?? { personId, currency, netMinor: 0 };
		entry.netMinor += amount;
		sums.set(key, entry);
	};
	for (const row of credited) add(row.personId, row.currency, row.amount);
	for (const row of owed) add(row.personId, row.currency, -row.amount);
	return [...sums.values()].filter((entry) => entry.netMinor !== 0);
}

/** One person's net in a group per currency; empty when they are settled there. */
export async function groupNetOf(db: Db | Tx, groupId: string, personId: string): Promise<Amount[]> {
	const credited = await db
		.select({ currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(and(eq(khLedger.groupId, groupId), eq(khLedger.creditorId, personId)))
		.groupBy(khLedger.currency);
	const owed = await db
		.select({ currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(and(eq(khLedger.groupId, groupId), eq(khLedger.debtorId, personId)))
		.groupBy(khLedger.currency);
	const sums = new Map<string, number>();
	for (const row of credited) sums.set(row.currency, (sums.get(row.currency) ?? 0) + row.amount);
	for (const row of owed) sums.set(row.currency, (sums.get(row.currency) ?? 0) - row.amount);
	return [...sums]
		.filter(([, amountMinor]) => amountMinor !== 0)
		.map(([currency, amountMinor]) => ({ currency, amountMinor }))
		.sort(byCurrency);
}

/**
 * The caller's net in each of their groups per currency, keyed by group. One query each
 * way, whatever the number of groups.
 */
export async function netsByGroup(db: Db | Tx, personId: string): Promise<Map<string, Amount[]>> {
	const credited = await db
		.select({ groupId: khLedger.groupId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(and(eq(khLedger.creditorId, personId), isNotNull(khLedger.groupId)))
		.groupBy(khLedger.groupId, khLedger.currency);
	const owed = await db
		.select({ groupId: khLedger.groupId, currency: khLedger.currency, amount: total })
		.from(khLedger)
		.where(and(eq(khLedger.debtorId, personId), isNotNull(khLedger.groupId)))
		.groupBy(khLedger.groupId, khLedger.currency);
	const sums = new Map<string, Map<string, number>>();
	const add = (groupId: string | null, currency: string, amount: number) => {
		if (!groupId) return;
		const amounts = sums.get(groupId) ?? new Map<string, number>();
		amounts.set(currency, (amounts.get(currency) ?? 0) + amount);
		sums.set(groupId, amounts);
	};
	for (const row of credited) add(row.groupId, row.currency, row.amount);
	for (const row of owed) add(row.groupId, row.currency, -row.amount);
	return new Map(
		[...sums].map(([groupId, amounts]) => [
			groupId,
			[...amounts]
				.filter(([, amountMinor]) => amountMinor !== 0)
				.map(([currency, amountMinor]) => ({ currency, amountMinor }))
				.sort(byCurrency),
		]),
	);
}

export const byCurrency = (a: { currency: string }, b: { currency: string }) => a.currency.localeCompare(b.currency);
