import { toMinor } from "@/lib/i18n/currency";
import { parseLocaleNumber } from "@/lib/i18n/intl";
import { type Debt, expenseDebts } from "../money/ledger";
import {
	computeShares,
	FULL_BP,
	type ItemizedLine,
	type Paid,
	payersProblem,
	type Share,
	type Split,
	type SplitMethod,
	type SplitProblem,
	splitPeople,
} from "../money/split";
import type { ExpenseKind } from "../types";

/**
 * The split editor's state (Task 90, PLAN 14.5 "The split editor"): what the caller typed,
 * as text (Devanagari digits read), turned into the money core's `Split` and payers on
 * every change. Pure: the editor shows its problem and its sentence live, and the dialog
 * saves what `buildSplit` gives. Each method keeps its own numbers, so switching back and
 * forth loses nothing.
 */

export type DraftLine = { key: string; label: string; amount: string; people: string[] };

export type SplitDraft = {
	/** Everyone on it, in the order shares are entered (the caller first). */
	people: string[];
	/** Who paid: one person, or several with `paid` each. */
	payer: string;
	several: boolean;
	paid: Record<string, string>;
	method: SplitMethod;
	/** `equal`: who is in. */
	included: string[];
	exact: Record<string, string>;
	percent: Record<string, string>;
	shares: Record<string, string>;
	adjust: Record<string, string>;
	lines: DraftLine[];
	service: string;
	tax: string;
	/** `full`: who owes all of it. */
	owesAll: string;
};

let lineSeq = 0;
export const newLine = (people: ReadonlyArray<string>): DraftLine => ({
	key: `line-${++lineSeq}`,
	label: "",
	amount: "",
	people: [...people],
});

/** A fresh split among `people`, paid by the caller, by `method` (the group's or the caller's default). */
export function newDraft(people: ReadonlyArray<string>, meId: string, method: SplitMethod = "equal"): SplitDraft {
	const ordered = [meId, ...people.filter((person) => person !== meId)];
	return {
		people: ordered,
		payer: meId,
		several: false,
		paid: {},
		method,
		included: [...ordered],
		exact: {},
		percent: {},
		shares: Object.fromEntries(ordered.map((person) => [person, "1"])),
		adjust: {},
		lines: [newLine(ordered)],
		service: "",
		tax: "",
		owesAll: ordered.find((person) => person !== meId) ?? meId,
	};
}

/** Major units as text, for a field: "1500.5", never grouped (the fields read Devanagari digits too). */
const asText = (minor: number, digits: number) =>
	digits === 0 ? String(minor) : (minor / 10 ** digits).toFixed(digits).replace(/\.?0+$/, "");

/** The draft of an expense being edited: its people, payers and split as they were entered. */
export function draftFrom(
	split: Split,
	payers: ReadonlyArray<{ personId: string; amountMinor: number }>,
	people: ReadonlyArray<string>,
	meId: string,
	digits: number,
): SplitDraft {
	const named = [...new Set([...people, ...splitPeople(split), ...payers.map((payer) => payer.personId)])];
	const draft = newDraft(named, named.includes(meId) ? meId : (named[0] ?? meId), split.method);
	const [only, ...more] = payers;
	draft.several = more.length > 0;
	draft.payer = only?.personId ?? draft.payer;
	draft.paid = Object.fromEntries(payers.map((payer) => [payer.personId, asText(payer.amountMinor, digits)]));
	switch (split.method) {
		case "equal":
			draft.included = [...split.people];
			break;
		case "exact":
			draft.exact = Object.fromEntries(split.parts.map((part) => [part.person, asText(part.amount, digits)]));
			break;
		case "percent":
			draft.percent = Object.fromEntries(split.parts.map((part) => [part.person, asText(part.bp, 2)]));
			break;
		case "shares":
			draft.shares = Object.fromEntries(split.parts.map((part) => [part.person, String(part.weight)]));
			break;
		case "adjustment":
			draft.adjust = Object.fromEntries(split.parts.map((part) => [part.person, asText(part.adjust, digits)]));
			break;
		case "itemized":
			draft.lines = split.lines.map((line) => ({
				...newLine(line.people),
				label: line.label,
				amount: asText(line.amount, digits),
			}));
			draft.service = split.service ? asText(split.service, digits) : "";
			draft.tax = split.tax ? asText(split.tax, digits) : "";
			break;
		case "full":
			draft.owesAll = split.person;
			break;
	}
	return draft;
}

/**
 * The draft with `people` on it now: someone new joins every method (in equal, in every
 * line, one share), someone gone leaves; their numbers are kept in case they come back.
 */
export function withPeople(draft: SplitDraft, people: ReadonlyArray<string>, meId: string): SplitDraft {
	const ordered = [meId, ...people.filter((person) => person !== meId)];
	const added = ordered.filter((person) => !draft.people.includes(person));
	const kept = (list: ReadonlyArray<string>) => [...list.filter((person) => ordered.includes(person)), ...added];
	return {
		...draft,
		people: ordered,
		payer: ordered.includes(draft.payer) ? draft.payer : meId,
		included: kept(draft.included),
		shares: { ...Object.fromEntries(added.map((person) => [person, "1"])), ...draft.shares },
		lines: draft.lines.map((line) => ({ ...line, people: kept(line.people) })),
		owesAll: ordered.includes(draft.owesAll) ? draft.owesAll : (ordered.find((person) => person !== meId) ?? meId),
	};
}

/** Typed text as a number: empty is 0, anything else not a plain decimal is NaN (the core calls that invalid). */
const number = (text: string | undefined): number => parseLocaleNumber(text ?? "") ?? 0;
const minorOf = (text: string | undefined, currency: string) => toMinor(number(text), currency);
/** "33.33" (%) as basis points: 3333. */
const basisPoints = (text: string | undefined) => Math.round(number(text) * (FULL_BP / 100));

/** The core's `Split` from the draft (everyone on it named, a zero where nothing was typed). */
export function splitOf(draft: SplitDraft, currency: string): Split {
	const { people } = draft;
	switch (draft.method) {
		case "equal":
			return { method: "equal", people: people.filter((person) => draft.included.includes(person)) };
		case "exact":
			return {
				method: "exact",
				parts: people.map((person) => ({ person, amount: minorOf(draft.exact[person], currency) })),
			};
		case "percent":
			return { method: "percent", parts: people.map((person) => ({ person, bp: basisPoints(draft.percent[person]) })) };
		case "shares":
			return { method: "shares", parts: people.map((person) => ({ person, weight: number(draft.shares[person]) })) };
		case "adjustment":
			return {
				method: "adjustment",
				parts: people.map((person) => ({ person, adjust: minorOf(draft.adjust[person], currency) })),
			};
		case "itemized":
			return {
				method: "itemized",
				lines: draft.lines.map(
					(line): ItemizedLine => ({
						label: line.label.trim(),
						amount: minorOf(line.amount, currency),
						people: people.filter((person) => line.people.includes(person)),
					}),
				),
				service: minorOf(draft.service, currency),
				tax: minorOf(draft.tax, currency),
			};
		case "full":
			return { method: "full", person: draft.owesAll };
	}
}

export function payersOf(draft: SplitDraft, amountMinor: number, currency: string): Paid[] {
	if (!draft.several) return [{ person: draft.payer, amount: amountMinor }];
	return draft.people
		.map((person) => ({ person, amount: minorOf(draft.paid[person], currency) }))
		.filter((payer) => payer.amount !== 0);
}

/** The subtotal of a bill's lines, in minor units (NaN once a line isn't a number). */
export const linesSubtotal = (draft: SplitDraft, currency: string) =>
	draft.lines.reduce((sum, line) => sum + minorOf(line.amount, currency), 0);

export type BuiltSplit =
	| { ok: true; split: Split; payers: Paid[]; shares: Share[]; debts: Debt[] }
	| { ok: false; split: Split; problem: SplitProblem; where: "payers" | "split" };

/** What the draft says for `amountMinor`: the split, payers, shares and debts, or the first problem in it. */
export function buildSplit(draft: SplitDraft, amountMinor: number, currency: string, kind: ExpenseKind): BuiltSplit {
	const split = splitOf(draft, currency);
	const payers = payersOf(draft, amountMinor, currency);
	const unpaid = payersProblem(amountMinor, payers);
	if (unpaid) return { ok: false, split, problem: unpaid, where: "payers" };
	const result = computeShares(amountMinor, split);
	if (!result.ok) return { ok: false, split, problem: result.problem, where: "split" };
	return { ok: true, split, payers, shares: result.shares, debts: expenseDebts(kind, payers, result.shares) };
}
