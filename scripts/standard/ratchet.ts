/**
 * The ratchet: the standard's rules against the list of known deviations
 * (tests/unit/standard/known-deviations.json). A deviation that is not on the list fails, and so
 * does a listed one that is gone, so the list only gets shorter (PLAN 15.1; decision 0297).
 */
import type { Deviation } from "./tree.ts";

export const KNOWN_FILE = "tests/unit/standard/known-deviations.json";

/** One rule's list: the keys, or `{ key: count }` when a key has more than one deviation. */
export type KnownEntry = ReadonlyArray<string> | Readonly<Record<string, number>>;
export type Known = Record<string, KnownEntry>;

export type Counts = Map<string, number>;

export function countsOf(deviations: ReadonlyArray<Deviation>): Counts {
	const counts: Counts = new Map();
	for (const { key } of deviations) counts.set(key, (counts.get(key) ?? 0) + 1);
	return counts;
}

export function knownCounts(entry: KnownEntry | undefined): Counts {
	if (!entry) return new Map();
	if (Array.isArray(entry)) return new Map(entry.map((key: string) => [key, 1]));
	return new Map(Object.entries(entry));
}

/** The shortest form of a list: the keys alone when each has one deviation. */
export function toEntry(counts: Counts): KnownEntry {
	const keys = [...counts.keys()].sort();
	if (keys.every((key) => counts.get(key) === 1)) return keys;
	return Object.fromEntries(keys.map((key) => [key, counts.get(key) ?? 0]));
}

export type Change = { key: string; found: number; known: number };
export type Difference = {
	/** New deviations: not on the list, or more of them than the list allows. */
	fresh: Change[];
	/** Listed deviations that are gone, or fewer than listed: the list must lose them. */
	fixed: Change[];
};

export function compare(found: Counts, known: Counts): Difference {
	const difference: Difference = { fresh: [], fixed: [] };
	for (const key of [...new Set([...found.keys(), ...known.keys()])].sort()) {
		const change = { key, found: found.get(key) ?? 0, known: known.get(key) ?? 0 };
		if (change.found > change.known) difference.fresh.push(change);
		else if (change.found < change.known) difference.fixed.push(change);
	}
	return difference;
}

/** The list with what was fixed taken off. Nothing is ever added here. */
export function prune(found: Counts, known: Counts): Counts {
	const kept: Counts = new Map();
	for (const [key, count] of known) {
		const now = Math.min(count, found.get(key) ?? 0);
		if (now > 0) kept.set(key, now);
	}
	return kept;
}

/** What a failing rule prints: each new deviation with its line and what to do, then what to take off the list. */
export function report(ruleId: string, deviations: ReadonlyArray<Deviation>, difference: Difference): string {
	const lines: string[] = [];
	for (const change of difference.fresh) {
		const own = deviations.filter((deviation) => deviation.key === change.key);
		const count = change.known > 0 ? ` (${change.found} now, ${change.known} known)` : "";
		lines.push(`  new: ${change.key}${count}`);
		for (const deviation of own) {
			lines.push(`       ${deviation.line === undefined ? "" : `line ${deviation.line}: `}${deviation.message}`);
		}
	}
	for (const change of difference.fixed) {
		lines.push(
			change.found === 0
				? `  fixed: ${change.key} is on the list but no longer deviates`
				: `  fixed: ${change.key} has ${change.found}, the list says ${change.known}`,
		);
	}
	if (difference.fixed.length > 0)
		lines.push(`  Take what was fixed off the list: pnpm standard --prune (${KNOWN_FILE}, "${ruleId}")`);
	return lines.join("\n");
}
