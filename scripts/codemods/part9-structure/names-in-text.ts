/**
 * node scripts/codemods/part9-structure/names-in-text.ts
 *
 * The last step of Part 9 Task 101's codemod: old names where the language service does not look.
 * Storybook's mocks export each server function under its name, the guard and access tests list
 * functions as strings, and the guides and comments name them in prose. A renamed import that was
 * destructured from `await import(…)` also kept its old local name (`{ setThing: saveThing }`).
 *
 * Server functions and guards have names nothing else has, so they are replaced wherever they are
 * written. A schema's old name can also be a local variable's, so schemas are only renamed in
 * comments and in the guides.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { EXPORT_RENAMES, FOLDS, GUARD_RENAMES, VERB_RENAMES } from "./plan.ts";

/** The commit the codemod ran on: its list of known deviations names every schema that was renamed. */
const BASE = "736a784";
const before = JSON.parse(
	execSync(`git show ${BASE}:tests/unit/standard/known-deviations.json`, { encoding: "utf8", maxBuffer: 1e8 }),
) as Record<string, string[]>;

const everywhere = new Map<string, string>();
for (const [, from, to] of [...GUARD_RENAMES, ...VERB_RENAMES]) everywhere.set(from, to);
/** `saveForm` is also the name of the service's function, which keeps it. */
const SERVICE_NAMES = new Set(["saveForm"]);

const inProse = new Map<string, string>();
for (const [, from, to] of EXPORT_RENAMES) if (from !== "fieldChanges") inProse.set(from, to);
for (const [, from, object, key] of FOLDS) inProse.set(from, `${object}.${key}`);
for (const key of before["export-name"] ?? []) {
	const [file = "", name = ""] = key.split("#");
	if (file.endsWith("/schema.ts") && /(Input|Item|Detail|Summary|Form|Row|Ref)$/.test(name)) {
		inProse.set(name, `${name}Schema`);
	}
}

const ROOTS = [
	"src",
	"tests",
	"e2e",
	"scripts",
	".storybook",
	"docs/guides",
	".claude",
	"CLAUDE.md",
	"AGENTS.md",
	"README.md",
];
const SKIPPED = ["scripts/codemods", "src/paraglide", "tests/unit/standard", "tests/fixtures", "node_modules"];
const files: string[] = [];
const walk = (path: string) => {
	if (SKIPPED.some((prefix) => path.startsWith(prefix))) return;
	const stat = statSync(path, { throwIfNoEntry: false });
	if (!stat) return;
	if (stat.isDirectory()) for (const entry of readdirSync(path)) walk(`${path}/${entry}`);
	else if (/\.(tsx?|md|json|ya?ml|mjs)$/.test(path)) files.push(path);
};
for (const root of ROOTS) walk(root);

const word = (names: Iterable<string>) =>
	new RegExp(`(?<![A-Za-z0-9_.])(${[...names].join("|")})(?![A-Za-z0-9_])`, "g");
const everywherePattern = word(everywhere.keys());
const prosePattern = word(inProse.keys());

let changed = 0;
for (const file of files) {
	const original = readFileSync(file, "utf8");
	let text = original.replace(everywherePattern, (name: string) =>
		SERVICE_NAMES.has(name) && file.startsWith("src/server/") ? name : (everywhere.get(name) ?? name),
	);
	// `{ setThing: setThing }`, what a renamed destructuring is once its local name follows.
	text = text.replace(/\b([A-Za-z0-9_]+): \1\b(?=\s*[,}])/g, (whole, name: string) =>
		[...everywhere.values()].includes(name) ? name : whole,
	);
	const prose = file.endsWith(".md");
	text = text
		.split("\n")
		.map((line) =>
			prose || /^\s*(\*|\/\/|\/\*)/.test(line)
				? line.replace(prosePattern, (name: string) => inProse.get(name) ?? name)
				: line,
		)
		.join("\n");
	if (text !== original) {
		writeFileSync(file, text);
		changed++;
	}
}
console.log(`${changed} files`);
