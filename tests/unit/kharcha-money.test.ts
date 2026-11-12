import { describe, expect, it } from "vitest";
import { expenseDebts, netBalances, pairBalances, paymentDebt, totalDebt } from "@/features/kharcha/money/ledger";
import { simplify } from "@/features/kharcha/money/simplify";
import {
	allocate,
	computeShares,
	FULL_BP,
	itemizedExtras,
	type Paid,
	payersProblem,
	type Share,
	type Split,
	splitPeople,
} from "@/features/kharcha/money/split";

/**
 * Kharcha's money core (src/features/kharcha/money, decision 0278): each split method, the
 * rounding, the ledger's debts, balances and simplify; then properties over random
 * expenses: shares and payers add up, nets sum to zero, the same input gives the same output.
 */

const shares = (amount: number, split: Split): Share[] => {
	const result = computeShares(amount, split);
	if (!result.ok) throw new Error(`split failed: ${JSON.stringify(result.problem)}`);
	return result.shares;
};
const owed = (amount: number, split: Split) => shares(amount, split).map((share) => share.owed);

describe("allocate", () => {
	it("gives the units left to the largest remainders, ties to whoever came first", () => {
		expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
		expect(allocate(200, [1, 1, 1])).toEqual([67, 67, 66]);
		expect(allocate(10, [1, 2])).toEqual([3, 7]);
		expect(allocate(5, [0, 0])).toEqual([0, 0]);
		expect(allocate(7, [3, 0, 1])).toEqual([5, 0, 2]);
	});

	it("is exact for amounts whose products pass 2^53", () => {
		const parts = allocate(99_999_999_999, [9_999, 1]);
		// 99,989,999,999.0001 and 9,999,999.9999: the unit left goes to the larger remainder.
		expect(parts).toEqual([99_989_999_999, 10_000_000]);
		expect(parts.reduce((sum, part) => sum + part, 0)).toBe(99_999_999_999);
	});
});

describe("split methods", () => {
	it("equal", () => {
		expect(owed(1000, { method: "equal", people: ["a", "b", "c"] })).toEqual([334, 333, 333]);
		expect(owed(1, { method: "equal", people: ["a", "b", "c"] })).toEqual([1, 0, 0]);
	});

	it("exact amounts, which must add up", () => {
		expect(
			owed(1000, {
				method: "exact",
				parts: [
					{ person: "a", amount: 700 },
					{ person: "b", amount: 300 },
				],
			}),
		).toEqual([700, 300]);
		expect(
			computeShares(1000, {
				method: "exact",
				parts: [
					{ person: "a", amount: 700 },
					{ person: "b", amount: 180 },
				],
			}),
		).toEqual({ ok: false, problem: { code: "unassigned", left: 120 } });
		expect(computeShares(1000, { method: "exact", parts: [{ person: "a", amount: 1200 }] })).toEqual({
			ok: false,
			problem: { code: "unassigned", left: -200 },
		});
	});

	it("percentages in basis points, which must make 100%", () => {
		expect(
			owed(1000, {
				method: "percent",
				parts: [
					{ person: "a", bp: 3_333 },
					{ person: "b", bp: 3_333 },
					{ person: "c", bp: 3_334 },
				],
			}),
		).toEqual([333, 333, 334]);
		expect(
			computeShares(1000, {
				method: "percent",
				parts: [
					{ person: "a", bp: 5_000 },
					{ person: "b", bp: 4_000 },
				],
			}),
		).toEqual({ ok: false, problem: { code: "percent", left: 1_000 } });
	});

	it("shares by weight", () => {
		expect(
			owed(1000, {
				method: "shares",
				parts: [
					{ person: "a", weight: 1 },
					{ person: "b", weight: 3 },
				],
			}),
		).toEqual([250, 750]);
		expect(computeShares(1000, { method: "shares", parts: [{ person: "a", weight: 0 }] })).toEqual({
			ok: false,
			problem: { code: "weights" },
		});
	});

	it("adjustments on top of equal parts", () => {
		expect(
			owed(1000, {
				method: "adjustment",
				parts: [
					{ person: "a", adjust: 200 },
					{ person: "b", adjust: 0 },
				],
			}),
		).toEqual([600, 400]);
		expect(
			computeShares(1000, {
				method: "adjustment",
				parts: [
					{ person: "a", adjust: -600 },
					{ person: "b", adjust: 500 },
				],
			}),
		).toEqual({ ok: false, problem: { code: "negative", person: "a" } });
	});

	it("itemized lines, with the service charge and VAT spread in proportion", () => {
		// रु 2,400 of food for three, रु 900 of drinks for two; 10% service, then 13% VAT on both.
		const extras = itemizedExtras(330_000);
		expect(extras).toEqual({ service: 33_000, tax: 47_190 });
		const amount = 330_000 + extras.service + extras.tax;
		const split: Split = {
			method: "itemized",
			lines: [
				{ label: "Food", amount: 240_000, people: ["a", "b", "c"] },
				{ label: "Drinks", amount: 90_000, people: ["b", "c"] },
			],
			...extras,
		};
		const result = shares(amount, split);
		expect(result.map((share) => share.person)).toEqual(["a", "b", "c"]);
		expect(result.reduce((sum, share) => sum + share.owed, 0)).toBe(amount);
		// Subtotals 800, 1,250 and 1,250; the extras (801.90) in proportion: 194.40, 303.75, 303.75.
		expect(result.map((share) => share.owed)).toEqual([99_440, 155_375, 155_375]);
		expect(computeShares(amount + 1, split)).toEqual({ ok: false, problem: { code: "unassigned", left: 1 } });
	});

	it("the full amount on one person", () => {
		expect(shares(500, { method: "full", person: "b" })).toEqual([{ person: "b", owed: 500 }]);
	});

	it("refuses what can't be split", () => {
		expect(computeShares(0, { method: "equal", people: ["a"] })).toEqual({ ok: false, problem: { code: "invalid" } });
		expect(computeShares(10, { method: "equal", people: [] })).toEqual({ ok: false, problem: { code: "empty" } });
		expect(computeShares(10, { method: "equal", people: ["a", "a"] })).toEqual({
			ok: false,
			problem: { code: "duplicate", person: "a" },
		});
		expect(computeShares(10.5, { method: "equal", people: ["a"] })).toEqual({
			ok: false,
			problem: { code: "invalid" },
		});
	});

	it("names everyone a split names, once, in entry order", () => {
		expect(
			splitPeople({
				method: "itemized",
				lines: [
					{ label: "", amount: 1, people: ["b", "a"] },
					{ label: "", amount: 1, people: ["a", "c"] },
				],
				service: 0,
				tax: 0,
			}),
		).toEqual(["b", "a", "c"]);
	});

	it("checks the payers", () => {
		expect(payersProblem(100, [{ person: "a", amount: 100 }])).toBeNull();
		expect(payersProblem(100, [{ person: "a", amount: 60 }])).toEqual({ code: "unassigned", left: 40 });
		expect(payersProblem(100, [])).toEqual({ code: "empty" });
		expect(
			payersProblem(100, [
				{ person: "a", amount: 50 },
				{ person: "a", amount: 50 },
			]),
		).toEqual({ code: "duplicate", person: "a" });
	});
});

describe("the ledger's debts", () => {
	it("with one payer, each person owes the payer their share", () => {
		const debts = expenseDebts(
			"expense",
			[{ person: "a", amount: 900 }],
			[
				{ person: "a", owed: 300 },
				{ person: "b", owed: 300 },
				{ person: "c", owed: 300 },
			],
		);
		expect(debts).toEqual([
			{ debtor: "b", creditor: "a", amount: 300 },
			{ debtor: "c", creditor: "a", amount: 300 },
		]);
	});

	it("with several payers, matches debtors to creditors in entry order", () => {
		const debts = expenseDebts(
			"expense",
			[
				{ person: "a", amount: 600 },
				{ person: "b", amount: 300 },
			],
			[
				{ person: "a", owed: 300 },
				{ person: "b", owed: 300 },
				{ person: "c", owed: 300 },
			],
		);
		expect(debts).toEqual([{ debtor: "c", creditor: "a", amount: 300 }]);
	});

	it("runs a refund the other way", () => {
		expect(expenseDebts("refund", [{ person: "a", amount: 200 }], [{ person: "b", owed: 200 }])).toEqual([
			{ debtor: "a", creditor: "b", amount: 200 },
		]);
	});

	it("a personal expense owes nobody", () => {
		expect(expenseDebts("expense", [{ person: "a", amount: 200 }], [{ person: "a", owed: 200 }])).toEqual([]);
	});

	it("a payment from X to Y takes it off what X owed Y", () => {
		const entries = [
			{ debtor: "x", creditor: "y", amount: 500, currency: "NPR" },
			{ ...paymentDebt("x", "y", 200), currency: "NPR" },
		];
		expect(pairBalances(entries, "y").get("x")?.get("NPR")).toBe(300);
		expect(pairBalances(entries, "x").get("y")?.get("NPR")).toBe(-300);
	});

	it("keeps currencies apart and drops pairs at zero", () => {
		const entries = [
			{ debtor: "b", creditor: "a", amount: 500, currency: "NPR" },
			{ debtor: "b", creditor: "a", amount: 10, currency: "USD" },
			{ debtor: "a", creditor: "b", amount: 500, currency: "NPR" },
		];
		const pairs = pairBalances(entries, "a");
		expect([...(pairs.get("b") ?? [])]).toEqual([["USD", 10]]);
		const nets = netBalances(entries);
		expect(nets.get("NPR")?.get("a")).toBe(0);
		expect(nets.get("USD")?.get("a")).toBe(10);
	});
});

describe("simplify", () => {
	it("settles a group in at most n − 1 payments, largest debtor to largest creditor", () => {
		const transfers = simplify([
			{ person: "a", net: 500 },
			{ person: "b", net: -300 },
			{ person: "c", net: -200 },
			{ person: "d", net: 0 },
		]);
		expect(transfers).toEqual([
			{ from: "b", to: "a", amount: 300 },
			{ from: "c", to: "a", amount: 200 },
		]);
		expect(simplify([])).toEqual([]);
	});
});

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function random(seed: number) {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
	const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
	const pick = <T>(items: ReadonlyArray<T>): T => items[int(0, items.length - 1)] as T;
	const subset = (items: ReadonlyArray<string>, min = 1) => {
		const chosen = items.filter(() => next() < 0.6);
		return chosen.length >= min ? chosen : items.slice(0, min);
	};
	return { int, pick, subset };
}

const PEOPLE = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"];

/** A valid random expense: an amount, its payers, and a split by any method. */
function randomExpense(r: ReturnType<typeof random>): { amount: number; payers: Paid[]; split: Split } {
	const amount = r.int(1, r.pick([100, 10_000, 5_000_000, 99_999_999_999]));
	const people = r.subset(PEOPLE);
	const weights = () => people.map(() => r.int(0, 50));
	const payerPeople = r.subset(PEOPLE).slice(0, r.int(1, 3));
	const paid = allocate(
		amount,
		payerPeople.map(() => r.int(1, 10)),
	);
	const payers = payerPeople
		.map((person, index) => ({ person, amount: paid[index] ?? 0 }))
		.filter((payer) => payer.amount > 0);
	const method = r.pick(["equal", "exact", "percent", "shares", "adjustment", "itemized", "full"] as const);
	switch (method) {
		case "equal":
			return { amount, payers, split: { method, people } };
		case "exact": {
			const parts = allocate(amount, [1, ...weights().slice(1)]);
			return {
				amount,
				payers,
				split: { method, parts: people.map((person, i) => ({ person, amount: parts[i] ?? 0 })) },
			};
		}
		case "percent": {
			const parts = allocate(FULL_BP, [1, ...weights().slice(1)]);
			return { amount, payers, split: { method, parts: people.map((person, i) => ({ person, bp: parts[i] ?? 0 })) } };
		}
		case "shares":
			return { amount, payers, split: { method, parts: people.map((person) => ({ person, weight: r.int(1, 20) })) } };
		case "adjustment": {
			const each = Math.floor(amount / people.length);
			return {
				amount,
				payers,
				split: {
					method,
					parts: people.map((person) => ({ person, adjust: r.int(-Math.floor(each / 2), Math.floor(each / 2)) })),
				},
			};
		}
		case "itemized": {
			const lineCount = r.int(1, 5);
			const subtotal = Math.max(lineCount, Math.floor(amount * 0.8));
			const lines = allocate(
				subtotal,
				Array.from({ length: lineCount }, () => r.int(1, 10)),
			).map((lineAmount, index) => ({
				label: `line ${index}`,
				amount: Math.max(1, lineAmount),
				people: r.subset(people),
			}));
			const sum = lines.reduce((total, line) => total + line.amount, 0);
			const service = r.int(0, Math.floor(sum / 10));
			const tax = r.int(0, Math.floor(sum / 8));
			const total = sum + service + tax;
			const paidTotal = allocate(
				total,
				payers.map(() => 1),
			);
			return {
				amount: total,
				payers: payers
					.map((payer, index) => ({ ...payer, amount: paidTotal[index] ?? 0 }))
					.filter((payer) => payer.amount > 0),
				split: { method, lines, service, tax },
			};
		}
		case "full":
			return { amount, payers, split: { method, person: r.pick(people) } };
	}
}

describe("properties over random expenses", () => {
	const RUNS = 2_000;

	it("shares and payers add up, the same input gives the same output, and the debts are each person's net", () => {
		const r = random(86);
		for (let run = 0; run < RUNS; run++) {
			const { amount, payers, split } = randomExpense(r);
			const context = JSON.stringify({ run, amount, payers, split });
			expect(payersProblem(amount, payers), context).toBeNull();
			const result = computeShares(amount, split);
			if (!result.ok) {
				// Adjustments may push someone below zero: refused, never half-done.
				expect(result.problem.code, context).toBe("negative");
				continue;
			}
			expect(
				result.shares.reduce((sum, share) => sum + share.owed, 0),
				context,
			).toBe(amount);
			expect(
				result.shares.every((share) => Number.isSafeInteger(share.owed) && share.owed >= 0),
				context,
			).toBe(true);
			expect(
				result.shares.map((share) => share.person),
				context,
			).toEqual(splitPeople(split));
			expect(computeShares(amount, JSON.parse(JSON.stringify(split)) as Split), context).toEqual(result);

			for (const kind of ["expense", "refund"] as const) {
				const debts = expenseDebts(kind, payers, result.shares);
				expect(expenseDebts(kind, payers, result.shares), context).toEqual(debts);
				expect(
					debts.every((debt) => debt.amount > 0 && debt.debtor !== debt.creditor),
					context,
				).toBe(true);
				const net = new Map<string, number>();
				for (const payer of payers) net.set(payer.person, (net.get(payer.person) ?? 0) + payer.amount);
				for (const share of result.shares) net.set(share.person, (net.get(share.person) ?? 0) - share.owed);
				const sign = kind === "refund" ? -1 : 1;
				const fromDebts = netBalances(debts.map((debt) => ({ ...debt, currency: "NPR" }))).get("NPR") ?? new Map();
				for (const [person, value] of net) expect(fromDebts.get(person) ?? 0, context).toBe(sign * value + 0);
				const owedTotal = [...net.values()].filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
				expect(totalDebt(debts), context).toBe(owedTotal);
			}
		}
	});

	it("nets sum to zero per currency over expenses and payments, and simplify settles them", () => {
		const r = random(278);
		for (let run = 0; run < 200; run++) {
			const entries = [];
			for (let index = 0; index < r.int(1, 15); index++) {
				const currency = r.pick(["NPR", "USD", "JPY"]);
				if (r.int(0, 4) === 0) {
					const [from, to] = [r.pick(PEOPLE), r.pick(PEOPLE)];
					if (from !== to) entries.push({ ...paymentDebt(from, to, r.int(1, 100_000)), currency });
					continue;
				}
				const { amount, payers, split } = randomExpense(r);
				const result = computeShares(amount, split);
				if (!result.ok) continue;
				for (const debt of expenseDebts(r.pick(["expense", "refund"]), payers, result.shares)) {
					entries.push({ ...debt, currency });
				}
			}
			for (const [currency, nets] of netBalances(entries)) {
				const context = JSON.stringify({ run, currency });
				expect(
					[...nets.values()].reduce((sum, value) => sum + value, 0),
					context,
				).toBe(0);
				const list = [...nets].map(([person, net]) => ({ person, net }));
				const transfers = simplify(list);
				expect(simplify(list), context).toEqual(transfers);
				expect(transfers.length, context).toBeLessThanOrEqual(Math.max(0, list.filter((n) => n.net !== 0).length - 1));
				const left = new Map(nets);
				for (const transfer of transfers) {
					expect(transfer.amount, context).toBeGreaterThan(0);
					left.set(transfer.from, (left.get(transfer.from) ?? 0) + transfer.amount);
					left.set(transfer.to, (left.get(transfer.to) ?? 0) - transfer.amount);
				}
				expect(
					[...left.values()].every((value) => value === 0),
					context,
				).toBe(true);
			}
		}
	});
});
