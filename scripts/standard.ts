/**
 * pnpm standard [files…] [--summary] [--list <rule>] [--prune] [--rewrite]
 *
 * Checks the source against the standard (docs/guides/conventions.md, "The standard"; decision
 * 0297) and the list of known deviations (tests/unit/standard/known-deviations.json).
 *
 * - No arguments: every rule on the whole tree. Fails on a new deviation and on a listed one that
 *   is gone. tests/unit/standard/standard.test.ts is the same check as a test.
 * - `files…`: only the new deviations in those files (what the editor hook runs after an edit).
 * - `--summary`: how many deviations each rule has, found and known.
 * - `--list <rule>`: every deviation of one rule with its line, for the task that fixes them.
 * - `--prune`: takes fixed deviations off the list. It never adds one.
 * - `--rewrite`: writes the list from the tree. Only after files moved (the keys are paths), or
 *   with a decision that accepts a new deviation.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { compare, countsOf, KNOWN_FILE, type Known, knownCounts, prune, report, toEntry } from "./standard/ratchet.ts";
import { RULES } from "./standard/rules.ts";
import { diskTree } from "./standard/tree.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const listed = flag("--list") ? args[args.indexOf("--list") + 1] : undefined;
const files = args
	.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--list")
	.map((file) => file.replaceAll("\\", "/").replace(/^\.\//, ""));

const NOTE =
	"Known deviations from the standard (docs/guides/conventions.md). A task that fixes one takes it off " +
	"(pnpm standard --prune). Nothing is added without a decision (docs/PLAN.md 15.1, decision 0297).";

const known = JSON.parse(readFileSync(KNOWN_FILE, "utf8")) as Known;
const tree = diskTree();
const results = RULES.map((rule) => {
	const deviations = rule.check(tree);
	return { rule, deviations, found: countsOf(deviations), known: knownCounts(known[rule.id]) };
});

function write(entries: Array<[string, ReturnType<typeof toEntry>]>) {
	const data = Object.fromEntries([["//", NOTE], ...entries.filter(([, entry]) => Object.keys(entry).length > 0)]);
	writeFileSync(KNOWN_FILE, `${JSON.stringify(data, null, "\t")}\n`);
	spawnSync(process.execPath, ["node_modules/@biomejs/biome/bin/biome", "format", "--write", KNOWN_FILE], {
		stdio: "inherit",
	});
}

if (flag("--rewrite") || flag("--prune")) {
	const rewrite = flag("--rewrite");
	write(results.map((result) => [result.rule.id, toEntry(rewrite ? result.found : prune(result.found, result.known))]));
	console.log(`${KNOWN_FILE}: ${rewrite ? "written from the tree" : "fixed deviations taken off"}`);
} else if (flag("--summary")) {
	for (const result of results) {
		const total = (counts: Map<string, number>) => [...counts.values()].reduce((sum, count) => sum + count, 0);
		console.log(
			`${String(total(result.found)).padStart(5)} found ${String(total(result.known)).padStart(5)} known  ${result.rule.id}`,
		);
	}
} else if (listed) {
	const result = results.find((item) => item.rule.id === listed);
	if (!result) {
		console.error(`No rule "${listed}". The rules: ${RULES.map((rule) => rule.id).join(", ")}`);
		process.exit(2);
	}
	console.log(result.rule.rule);
	for (const deviation of result.deviations) {
		const [file = ""] = deviation.key.split("#");
		console.log(`${file}${deviation.line === undefined ? "" : `:${deviation.line}`}  ${deviation.message}`);
	}
} else {
	const inScope = (key: string) =>
		files.length === 0 || files.some((file) => key === file || key.startsWith(`${file}#`));
	let failed = false;
	for (const result of results) {
		const difference = compare(result.found, result.known);
		const scoped = {
			fresh: difference.fresh.filter((change) => inScope(change.key)),
			// A single file's check says nothing of what was fixed elsewhere.
			fixed: files.length === 0 ? difference.fixed : [],
		};
		if (scoped.fresh.length === 0 && scoped.fixed.length === 0) continue;
		failed = true;
		console.error(`\n${result.rule.id}: ${result.rule.rule}\n${report(result.rule.id, result.deviations, scoped)}`);
	}
	if (failed) {
		console.error(
			"\nThe standard: docs/guides/conventions.md. Fix the code; the list of known deviations only gets shorter.",
		);
		process.exit(1);
	}
	if (files.length === 0) console.log(`The standard holds: ${RULES.length} rules, no new deviation.`);
}
