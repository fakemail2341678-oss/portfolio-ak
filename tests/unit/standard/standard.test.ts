import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compare, countsOf, KNOWN_FILE, type Known, knownCounts, report } from "../../../scripts/standard/ratchet";
import { RULES } from "../../../scripts/standard/rules";
import { diskTree } from "../../../scripts/standard/tree";

/**
 * The standard (docs/guides/conventions.md, decision 0297), rule by rule, against the list of
 * known deviations. A deviation that is not on the list fails. A listed one that is gone fails
 * too (`pnpm standard --prune` takes it off), so the list only gets shorter.
 *
 * `pnpm standard` is the same check from the command line; `pnpm standard --list <rule>` prints a
 * rule's deviations with their lines.
 */
describe("the standard", () => {
	const known = JSON.parse(readFileSync(KNOWN_FILE, "utf8")) as Known;
	const tree = diskTree();

	it.each(RULES.map((rule) => [rule.id, rule] as const))("%s", (id, rule) => {
		const deviations = rule.check(tree);
		const difference = compare(countsOf(deviations), knownCounts(known[id]));
		const failed = difference.fresh.length > 0 || difference.fixed.length > 0;
		expect(failed ? `${rule.rule}\n${report(id, deviations, difference)}` : "").toBe("");
	});

	it("the list names only rules that exist", () => {
		const ids = new Set(RULES.map((rule) => rule.id));
		expect(Object.keys(known).filter((id) => id !== "//" && !ids.has(id))).toEqual([]);
	});
});
