/**
 * Simplified debts (PLAN 14.5 "Money core", decision 0278): the fewest payments that would
 * settle a group in one currency, as suggestions. Records never change because of it.
 *
 * Integers in minor units only. This file imports nothing at run time (see ./split.ts).
 */

/** A person's net in one currency: what they are owed (above zero) or owe (below). */
export type Net = { person: string; net: number };

/** A suggested payment. */
export type Transfer = { from: string; to: string; amount: number };

/**
 * Matches the largest debtor to the largest creditor until everyone is settled: at most
 * n − 1 payments for n people. Ties go to whoever comes first in `nets`, so the same nets
 * always give the same suggestions. The nets must sum to zero (a ledger's always do).
 */
export function simplify(nets: ReadonlyArray<Net>): Transfer[] {
	const left = nets.map((entry) => entry.net);
	const transfers: Transfer[] = [];
	for (;;) {
		let debtor = -1;
		let creditor = -1;
		for (const [index, value] of left.entries()) {
			if (value < 0 && (debtor < 0 || value < (left[debtor] ?? 0))) debtor = index;
			if (value > 0 && (creditor < 0 || value > (left[creditor] ?? 0))) creditor = index;
		}
		const from = nets[debtor];
		const to = nets[creditor];
		if (!from || !to) return transfers;
		const amount = Math.min(-(left[debtor] ?? 0), left[creditor] ?? 0);
		transfers.push({ from: from.person, to: to.person, amount });
		left[debtor] = (left[debtor] ?? 0) + amount;
		left[creditor] = (left[creditor] ?? 0) - amount;
	}
}
