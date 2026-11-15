/**
 * Kharcha's splits (PLAN 14.5 "Money core", decision 0278): how an expense's amount is
 * divided among people. Every method gives exact shares in integer minor units that add up
 * to the amount; nothing here uses floating point (products go through BigInt).
 *
 * Pure and isomorphic: the split editor, the server and the seed scripts run the same code.
 * This file imports nothing at run time, so `node scripts/…` can load it as it is.
 */

/** The largest amount of one expense or payment, in minor units: sums of 10,000 of them stay safe integers. */
export const MAX_AMOUNT_MINOR = 99_999_999_999;
/** A share's weight ("2 shares"): halves are entered as twice the weight. */
export const MAX_WEIGHT = 10_000;
/** All of it, in basis points. */
export const FULL_BP = 10_000;
/** Nepal's usual restaurant bill: 10% service charge, then 13% VAT on the subtotal with it. */
export const SERVICE_CHARGE_BP = 1_000;
export const VAT_BP = 1_300;

export const SPLIT_METHODS = ["equal", "exact", "percent", "shares", "adjustment", "itemized", "full"] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

/** One line of a bill: what it cost and who had it (split equally among them). */
export type ItemizedLine = { label: string; amount: number; people: string[] };

/**
 * A split as the editor enters it and `kh_expense.split` stores it. People are person ids,
 * in the order they were entered: that order breaks rounding ties.
 */
export type Split =
	| { method: "equal"; people: string[] }
	/** Each person's amount, in minor units; together the expense's amount. */
	| { method: "exact"; parts: Array<{ person: string; amount: number }> }
	/** Each person's part in basis points; together 10,000. */
	| { method: "percent"; parts: Array<{ person: string; bp: number }> }
	/** Each person's weight: 2 owes twice what 1 owes. */
	| { method: "shares"; parts: Array<{ person: string; weight: number }> }
	/** Equal, plus or minus each person's adjustment (minor units). */
	| { method: "adjustment"; parts: Array<{ person: string; adjust: number }> }
	/** Lines of a bill, with the service charge and tax (amounts) spread in proportion. */
	| { method: "itemized"; lines: ItemizedLine[]; service: number; tax: number }
	/** One person owes all of it ("they owe the full amount", "I owe the full amount"). */
	| { method: "full"; person: string };

/** What one person owes of an expense, in minor units. */
export type Share = { person: string; owed: number };

/** Who paid, and how much of the amount. */
export type Paid = { person: string; amount: number };

export type SplitProblem =
	/** Nobody to split among, or a bill without lines. */
	| { code: "empty" }
	/** A number that isn't a whole number in range. */
	| { code: "invalid" }
	| { code: "duplicate"; person: string }
	/** Exact amounts, a bill or the payers don't add up: minor units left to assign (negative: over). */
	| { code: "unassigned"; left: number }
	/** Percentages don't add up: basis points left (negative: over). */
	| { code: "percent"; left: number }
	/** Every weight is zero. */
	| { code: "weights" }
	/** An adjustment leaves this person owing less than nothing. */
	| { code: "negative"; person: string };

export type SplitResult = { ok: true; shares: Share[] } | { ok: false; problem: SplitProblem };

const whole = (value: number, min: number, max: number) => Number.isSafeInteger(value) && value >= min && value <= max;
const fail = (problem: SplitProblem): SplitResult => ({ ok: false, problem });

const firstDuplicate = (people: ReadonlyArray<string>): string | null => {
	const seen = new Set<string>();
	for (const person of people) {
		if (seen.has(person)) return person;
		seen.add(person);
	}
	return null;
};

/**
 * `total` divided in proportion to `weights`, in whole units that add up to `total`: each
 * gets the floor of its part, and the units left go to the largest remainders, ties to
 * whoever was entered first. The same input always gives the same output.
 */
export function allocate(total: number, weights: ReadonlyArray<number>): number[] {
	const sum = weights.reduce((acc, weight) => acc + BigInt(weight), 0n);
	if (sum === 0n) return weights.map(() => 0);
	const amount = BigInt(total);
	const parts = weights.map((weight, index) => {
		const product = amount * BigInt(weight);
		return { index, base: product / sum, remainder: product % sum };
	});
	let left = Number(amount - parts.reduce((acc, part) => acc + part.base, 0n));
	const result = parts.map((part) => Number(part.base));
	const byRemainder = [...parts].sort((a, b) =>
		a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
	);
	for (const part of byRemainder) {
		if (left <= 0) break;
		result[part.index] = (result[part.index] ?? 0) + 1;
		left -= 1;
	}
	return result;
}

/** `amount` × `bp` / 10,000, rounded half up, in minor units. */
const portion = (amount: number, bp: number): number => Number((BigInt(amount) * BigInt(bp) + 5_000n) / 10_000n);

/**
 * The service charge and tax of a bill from its subtotal, as the presets fill them in: the
 * service charge on the subtotal, then the tax on both. The editor's amounts stay editable,
 * because a printed bill's own rounding wins.
 */
export const itemizedExtras = (
	subtotal: number,
	{ serviceBp = SERVICE_CHARGE_BP, taxBp = VAT_BP }: { serviceBp?: number; taxBp?: number } = {},
): { service: number; tax: number } => {
	const service = portion(subtotal, serviceBp);
	return { service, tax: portion(subtotal + service, taxBp) };
};

/** Everyone a split names, in entry order, once each. */
export function splitPeople(split: Split): string[] {
	switch (split.method) {
		case "equal":
			return [...new Set(split.people)];
		case "full":
			return [split.person];
		case "itemized":
			return [...new Set(split.lines.flatMap((line) => line.people))];
		default:
			return [...new Set(split.parts.map((part) => part.person))];
	}
}

const named = (people: ReadonlyArray<string>, owed: ReadonlyArray<number>): SplitResult => ({
	ok: true,
	shares: people.map((person, index) => ({ person, owed: owed[index] ?? 0 })),
});

function itemized(amount: number, split: Extract<Split, { method: "itemized" }>): SplitResult {
	if (split.lines.length === 0) return fail({ code: "empty" });
	if (!whole(split.service, 0, MAX_AMOUNT_MINOR) || !whole(split.tax, 0, MAX_AMOUNT_MINOR)) {
		return fail({ code: "invalid" });
	}
	const subtotals = new Map<string, number>();
	let subtotal = 0;
	for (const line of split.lines) {
		if (!whole(line.amount, 1, MAX_AMOUNT_MINOR)) return fail({ code: "invalid" });
		if (line.people.length === 0) return fail({ code: "empty" });
		const twice = firstDuplicate(line.people);
		if (twice) return fail({ code: "duplicate", person: twice });
		const each = allocate(
			line.amount,
			line.people.map(() => 1),
		);
		for (const [index, person] of line.people.entries()) {
			subtotals.set(person, (subtotals.get(person) ?? 0) + (each[index] ?? 0));
		}
		subtotal += line.amount;
	}
	const left = amount - (subtotal + split.service + split.tax);
	if (left !== 0) return fail({ code: "unassigned", left });
	const people = [...subtotals.keys()];
	const own = people.map((person) => subtotals.get(person) ?? 0);
	const extras = allocate(split.service + split.tax, own);
	return named(
		people,
		own.map((value, index) => value + (extras[index] ?? 0)),
	);
}

/**
 * What each person the split names owes of `amount` (minor units), in entry order; or why
 * the split can't be used yet (the editor shows it live, the server refuses it). The
 * shares always add up to `amount`. Someone named may owe nothing (0%, one paisa among
 * three): they keep a share of zero, so everyone a split names is on the expense.
 */
export function computeShares(amount: number, split: Split): SplitResult {
	if (!whole(amount, 1, MAX_AMOUNT_MINOR)) return fail({ code: "invalid" });
	if (split.method === "full") return { ok: true, shares: [{ person: split.person, owed: amount }] };
	if (split.method === "itemized") return itemized(amount, split);

	const people = split.method === "equal" ? split.people : split.parts.map((part) => part.person);
	if (people.length === 0) return fail({ code: "empty" });
	const twice = firstDuplicate(people);
	if (twice) return fail({ code: "duplicate", person: twice });

	switch (split.method) {
		case "equal":
			return named(
				people,
				allocate(
					amount,
					people.map(() => 1),
				),
			);
		case "exact": {
			const amounts = split.parts.map((part) => part.amount);
			if (!amounts.every((value) => whole(value, 0, MAX_AMOUNT_MINOR))) return fail({ code: "invalid" });
			const left = amount - amounts.reduce((sum, value) => sum + value, 0);
			return left === 0 ? named(people, amounts) : fail({ code: "unassigned", left });
		}
		case "percent": {
			const points = split.parts.map((part) => part.bp);
			if (!points.every((value) => whole(value, 0, FULL_BP))) return fail({ code: "invalid" });
			const left = FULL_BP - points.reduce((sum, value) => sum + value, 0);
			return left === 0 ? named(people, allocate(amount, points)) : fail({ code: "percent", left });
		}
		case "shares": {
			const weights = split.parts.map((part) => part.weight);
			if (!weights.every((value) => whole(value, 0, MAX_WEIGHT))) return fail({ code: "invalid" });
			if (weights.every((value) => value === 0)) return fail({ code: "weights" });
			return named(people, allocate(amount, weights));
		}
		case "adjustment": {
			const adjusts = split.parts.map((part) => part.adjust);
			if (!adjusts.every((value) => whole(value, -MAX_AMOUNT_MINOR, MAX_AMOUNT_MINOR))) {
				return fail({ code: "invalid" });
			}
			// What is left once the adjustments are taken out is shared equally.
			const base = amount - adjusts.reduce((sum, value) => sum + value, 0);
			if (base < 0) return fail({ code: "unassigned", left: base });
			const equal = allocate(
				base,
				people.map(() => 1),
			);
			const owed = equal.map((value, index) => value + (adjusts[index] ?? 0));
			const below = owed.findIndex((value) => value < 0);
			if (below >= 0) return fail({ code: "negative", person: people[below] ?? "" });
			return named(people, owed);
		}
	}
}

/**
 * Why `payers` can't be an expense's payers yet, or null: each paid something, nobody is
 * named twice, and together they paid the amount.
 */
export function payersProblem(amount: number, payers: ReadonlyArray<Paid>): SplitProblem | null {
	if (payers.length === 0) return { code: "empty" };
	const twice = firstDuplicate(payers.map((payer) => payer.person));
	if (twice) return { code: "duplicate", person: twice };
	if (!payers.every((payer) => whole(payer.amount, 1, MAX_AMOUNT_MINOR))) return { code: "invalid" };
	const left = amount - payers.reduce((sum, payer) => sum + payer.amount, 0);
	return left === 0 ? null : { code: "unassigned", left };
}
