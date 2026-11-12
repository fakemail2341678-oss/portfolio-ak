import type { RuleMatch } from "./types";

/**
 * The lists' helpers shared by the browser and the server (Task 89): how a merchant rule
 * matches, and how two merchants are told apart. Pure.
 */

/** A merchant as rules and the duplicate check compare it: lower case, letters and digits only. */
export const merchantKey = (text: string): string =>
	text
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}]+/gu, "");

type Rule = { match: RuleMatch; pattern: string };

/** Whether `rule` matches `merchant`: the whole of it (`equals`) or a part (`contains`), in any case. */
export function ruleMatches(rule: Rule, merchant: string): boolean {
	const text = merchantKey(merchant);
	const pattern = merchantKey(rule.pattern);
	if (!text || !pattern) return false;
	return rule.match === "equals" ? text === pattern : text.includes(pattern);
}

/**
 * Whether two expenses name a similar merchant (the duplicate check, Task 89): the same once
 * case and punctuation are gone, or one inside the other ("Bhatbhateni" and "Bhatbhateni
 * Store"). Without a merchant the title stands in; two with neither are alike.
 */
export function similarMerchant(
	a: { merchant: string; title: string },
	b: { merchant: string; title: string },
): boolean {
	const one = merchantKey(a.merchant || a.title);
	const other = merchantKey(b.merchant || b.title);
	if (one === other) return true;
	if (one.length < 3 || other.length < 3) return false;
	return one.includes(other) || other.includes(one);
}

/** The first rule, in order, that matches `merchant`. */
export const firstRule = <T extends Rule & { position: number }>(rules: ReadonlyArray<T>, merchant: string): T | null =>
	[...rules].sort((a, b) => a.position - b.position).find((rule) => ruleMatches(rule, merchant)) ?? null;
