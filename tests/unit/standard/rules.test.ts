import { describe, expect, it } from "vitest";
import { compare, countsOf, knownCounts, prune, report, toEntry } from "../../../scripts/standard/ratchet";
import { RULES } from "../../../scripts/standard/rules";
import { memoryTree } from "../../../scripts/standard/tree";
import { CONFORMING_FIXTURE, EXPECTED, FIXTURE } from "./fixture";

/** The standard's rules, tested on a tree that holds one of each deviation (fixture.ts). */
describe("the standard's rules", () => {
	const tree = memoryTree(FIXTURE);

	it.each(RULES.map((rule) => [rule.id, rule] as const))("%s finds its deviations, and only those", (id, rule) => {
		expect(Object.fromEntries(countsOf(rule.check(tree)))).toEqual(EXPECTED[id] ?? {});
	});

	it("every rule has a deviation in the fixture", () => {
		expect(Object.keys(EXPECTED).sort()).toEqual(RULES.map((rule) => rule.id).sort());
	});

	it("a feature in the standard's shape has no deviation", () => {
		const clean = memoryTree(CONFORMING_FIXTURE);
		const found = RULES.flatMap((rule) => rule.check(clean).map((deviation) => `${rule.id}: ${deviation.key}`));
		expect(found).toEqual([]);
	});

	it("every deviation says what to do", () => {
		for (const rule of RULES) {
			for (const deviation of rule.check(tree)) expect(deviation.message.length).toBeGreaterThan(10);
		}
	});

	it("rule ids are unique", () => {
		expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length);
	});
});

describe("the ratchet", () => {
	const found = countsOf([
		{ key: "a.ts", message: "one" },
		{ key: "b.ts", message: "one" },
		{ key: "b.ts", message: "two" },
	]);

	it("passes when the tree and the list agree", () => {
		expect(compare(found, knownCounts({ "a.ts": 1, "b.ts": 2 }))).toEqual({ fresh: [], fixed: [] });
	});

	it("fails on a new deviation, and on one more in a listed file", () => {
		expect(compare(found, knownCounts(["b.ts"])).fresh).toEqual([
			{ key: "a.ts", found: 1, known: 0 },
			{ key: "b.ts", found: 2, known: 1 },
		]);
	});

	it("fails on a listed deviation that is gone, and on fewer than listed", () => {
		expect(compare(found, knownCounts({ "a.ts": 1, "b.ts": 3, "c.ts": 1 })).fixed).toEqual([
			{ key: "b.ts", found: 2, known: 3 },
			{ key: "c.ts", found: 0, known: 1 },
		]);
	});

	it("prunes what was fixed and never adds", () => {
		const kept = prune(found, knownCounts({ "b.ts": 3, "c.ts": 1 }));
		expect(Object.fromEntries(kept)).toEqual({ "b.ts": 2 });
	});

	it("writes a list of keys when each has one deviation, and counts otherwise", () => {
		expect(toEntry(knownCounts(["b.ts", "a.ts"]))).toEqual(["a.ts", "b.ts"]);
		expect(toEntry(found)).toEqual({ "a.ts": 1, "b.ts": 2 });
	});

	it("reports each new deviation with its line and what to do", () => {
		const deviations = [{ key: "a.ts", line: 7, message: "do this" }];
		const text = report("some-rule", deviations, compare(countsOf(deviations), knownCounts(["gone.ts"])));
		expect(text).toContain("new: a.ts");
		expect(text).toContain("line 7: do this");
		expect(text).toContain("fixed: gone.ts");
		expect(text).toContain("pnpm standard --prune");
	});
});
