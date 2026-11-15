/**
 * Kharcha's ledger, as arithmetic (PLAN 14.5 "Money core", decision 0278): who owes whom
 * because of one expense or payment, and the balances a set of such debts adds up to.
 * The server writes these rows to `kh_ledger` (src/server/kharcha/ledger.ts) and sums them
 * in SQL; the same functions check it in tests and let the browser patch a balance at once.
 *
 * Integers in minor units only. This file imports nothing at run time (see ./split.ts).
 */
import type { Paid, Share } from "./split";

/** `debtor` owes `creditor` this much, in the minor units of the source's currency. */
export type Debt = { debtor: string; creditor: string; amount: number };

/** A debt with its currency: a row of the ledger. */
export type LedgerEntry = Debt & { currency: string };

/**
 * The debts an expense makes. Everyone's net is what they paid minus what they owe; those
 * below zero owe those above, matched greedily in entry order (payers, then shares), which
 * is exact in integers. With one payer it is simply "each person owes the payer their share".
 *
 * A refund runs the other way: its "payers" received the money, and owe it to those whose
 * spending it lowers.
 */
export function expenseDebts(
	kind: "expense" | "refund",
	payers: ReadonlyArray<Paid>,
	shares: ReadonlyArray<Share>,
): Debt[] {
	const net = new Map<string, number>();
	for (const payer of payers) net.set(payer.person, (net.get(payer.person) ?? 0) + payer.amount);
	for (const share of shares) net.set(share.person, (net.get(share.person) ?? 0) - share.owed);

	// Map keeps insertion order: payers first, then the people who only owe.
	const creditors = [...net].filter(([, value]) => value > 0).map(([person, value]) => ({ person, left: value }));
	const debtors = [...net].filter(([, value]) => value < 0).map(([person, value]) => ({ person, left: -value }));

	const debts: Debt[] = [];
	let next = 0;
	for (const debtor of debtors) {
		while (debtor.left > 0) {
			const creditor = creditors[next];
			if (!creditor) return debts;
			const amount = Math.min(debtor.left, creditor.left);
			debts.push(
				kind === "refund"
					? { debtor: creditor.person, creditor: debtor.person, amount }
					: { debtor: debtor.person, creditor: creditor.person, amount },
			);
			debtor.left -= amount;
			creditor.left -= amount;
			if (creditor.left === 0) next += 1;
		}
	}
	return debts;
}

/** A payment from `from` to `to` settles what `from` owed: in the ledger, `to` owes it back. */
export const paymentDebt = (from: string, to: string, amount: number): Debt => ({
	debtor: to,
	creditor: from,
	amount,
});

/** What the debts come to in all: the sum an expense's rows must have. */
export const totalDebt = (debts: ReadonlyArray<Debt>): number => debts.reduce((sum, debt) => sum + debt.amount, 0);

/**
 * Each person's net per currency: what they are owed minus what they owe. In any set of
 * debts the nets of one currency sum to zero.
 */
export function netBalances(entries: Iterable<LedgerEntry>): Map<string, Map<string, number>> {
	const byCurrency = new Map<string, Map<string, number>>();
	for (const entry of entries) {
		const nets = byCurrency.get(entry.currency) ?? new Map<string, number>();
		nets.set(entry.creditor, (nets.get(entry.creditor) ?? 0) + entry.amount);
		nets.set(entry.debtor, (nets.get(entry.debtor) ?? 0) - entry.amount);
		byCurrency.set(entry.currency, nets);
	}
	return byCurrency;
}

/**
 * What each other person owes `me` per currency (negative: what I owe them), from the
 * debts between us. Pairs that come to zero are left out.
 */
export function pairBalances(entries: Iterable<LedgerEntry>, me: string): Map<string, Map<string, number>> {
	const byPerson = new Map<string, Map<string, number>>();
	for (const entry of entries) {
		const other = entry.creditor === me ? entry.debtor : entry.debtor === me ? entry.creditor : null;
		if (other === null) continue;
		const amounts = byPerson.get(other) ?? new Map<string, number>();
		amounts.set(
			entry.currency,
			(amounts.get(entry.currency) ?? 0) + (entry.creditor === me ? entry.amount : -entry.amount),
		);
		byPerson.set(other, amounts);
	}
	for (const [person, amounts] of byPerson) {
		for (const [currency, amount] of amounts) if (amount === 0) amounts.delete(currency);
		if (amounts.size === 0) byPerson.delete(person);
	}
	return byPerson;
}
