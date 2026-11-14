/**
 * Audit: the docs against the repository, to find what went stale.
 *
 *   node scripts/audit/docs.ts
 *
 * Checked: CLAUDE.md, README.md and docs/guides. Not checked: docs/PLAN.md, docs/decisions.md's
 * entries and docs/history, which say what was true when they were written (decision 0163).
 *
 * - paths in backticks that no longer exist;
 * - `pnpm <script>` commands that package.json doesn't have;
 * - decision numbers that have no entry, and the decisions index against the entries;
 * - guides CLAUDE.md doesn't list, and listed guides that are gone;
 * - lines that state a duration, to read against docs/history/part9-audit/gates.json.
 *
 * Prints counts and writes docs/history/part9-audit/docs.json.
 * Part 9 Task 98.
 */
import { existsSync, readdirSync } from "node:fs";
import { print, read, save, tally } from "./lib.ts";

const guides = readdirSync("docs/guides")
	.filter((name) => name.endsWith(".md"))
	.map((name) => `docs/guides/${name}`);
const docs = ["CLAUDE.md", "README.md", ...guides];

// --- Paths -------------------------------------------------------------------------------------

const ROOTS = "src|tests|e2e|scripts|docs|drizzle|messages|vite|public|\\.storybook|\\.github|project\\.inlang";
const PATH = new RegExp(`\`((?:${ROOTS})/[^\`\\s]+)\``, "g");
/** Not a real path: a pattern, a placeholder or an example. */
const PATTERN = /[*<>{}…|,]|\.\.\.|\(|NNNN|\$\{|\/x\/|example|your-|my-/;
/** Paths a doc names before they exist: a command creates them. */
const CREATED_LATER = new Set(["src/routes/_public/index.tsx"]); // pnpm strip-demo's landing page

type Missing = { doc: string; line: number; path: string };
const missing: Missing[] = [];
let checked = 0;
for (const doc of docs) {
	read(doc)
		.split("\n")
		.forEach((line, index) => {
			for (const match of line.matchAll(PATH)) {
				const path = (match[1] ?? "")
					.replace(/[.:;)]+$/, "")
					.replace(/:\d+(-\d+)?$/, "")
					.replace(/#.*$/, "");
				if (PATTERN.test(path) || CREATED_LATER.has(path)) continue;
				checked += 1;
				const exists = [path, `${path}.ts`, `${path}.tsx`].some((candidate) => existsSync(candidate));
				if (!exists) missing.push({ doc, line: index + 1, path });
			}
		});
}
print("Paths in backticks", { checked, "that no longer exist": missing.length });
print(
	"Missing paths by doc",
	tally(missing, (item) => item.doc),
	30,
);

// --- Commands ----------------------------------------------------------------------------------

const scripts = new Set(Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts));
const BUILT_IN = new Set([
	"install",
	"i",
	"add",
	"remove",
	"exec",
	"dlx",
	"run",
	"up",
	"update",
	"outdated",
	"why",
	"store",
	"audit",
	"create",
	"approve-builds",
	"rebuild",
	"prune",
	"link",
	"import",
	"init",
	"config",
	"env",
	"list",
	"ls",
	"publish",
	"pack",
	"patch",
	"patch-commit",
	"dedupe",
	"fetch",
	"test",
	"start",
	"self-update",
	"view",
	"info",
	"tsx",
	"vitest",
	"playwright",
	"biome",
	"tsc",
	"knip",
	"drizzle-kit",
	"storybook",
	"vite",
]);
const unknownCommands: Array<{ doc: string; line: number; command: string }> = [];
for (const doc of docs) {
	read(doc)
		.split("\n")
		.forEach((line, index) => {
			for (const match of line.matchAll(/\bpnpm ([a-z][\w:-]*)/g)) {
				const command = match[1] ?? "";
				if (!scripts.has(command) && !BUILT_IN.has(command)) unknownCommands.push({ doc, line: index + 1, command });
			}
		});
}
print(
	"`pnpm <script>` in the docs that package.json doesn't have",
	tally(unknownCommands, (item) => item.command),
);

// --- Decisions ---------------------------------------------------------------------------------

const decisions = read("docs/decisions.md");
const entries = new Set([...decisions.matchAll(/^## (\d{4}):/gm)].map((match) => match[1] ?? ""));
const indexed = new Set([...decisions.matchAll(/^- \[(\d{4})\]\(#/gm)].map((match) => match[1] ?? ""));
const indexLabel = decisions.match(/<summary>Index \((\d+) entries\)<\/summary>/)?.[1] ?? "?";
const numbers = [...entries].map(Number).sort((a, b) => a - b);
const gaps = numbers.filter((number, index) => index > 0 && number !== (numbers[index - 1] ?? 0) + 1);
const unknownDecisions: Array<{ doc: string; line: number; decision: string }> = [];
for (const doc of docs) {
	read(doc)
		.split("\n")
		.forEach((line, index) => {
			for (const match of line.matchAll(/(?<![\w.#/-])(0[0-2]\d{2})(?![\w/-]|\.\d)/g)) {
				const decision = match[1] ?? "";
				if (!entries.has(decision)) unknownDecisions.push({ doc, line: index + 1, decision });
			}
		});
}
print("Decisions", {
	entries: entries.size,
	"lines in the index": indexed.size,
	"the index's own count": indexLabel,
	"entries missing from the index": [...entries].filter((entry) => !indexed.has(entry)).length,
	"numbers skipped": gaps.length,
	"numbers the docs cite that have no entry": unknownDecisions.length,
});

// --- Guides ------------------------------------------------------------------------------------

const claude = read("CLAUDE.md");
const listed = new Set(
	[...claude.matchAll(/\(docs\/guides\/([\w-]+\.md)\)/g)].map((match) => `docs/guides/${match[1]}`),
);
const unlisted = guides.filter((guide) => !listed.has(guide));
const gone = [...listed].filter((guide) => !existsSync(guide));
print("Guides", { files: guides.length, "not listed in CLAUDE.md": unlisted.length, "listed but gone": gone.length });
print(
	"Lines per guide",
	Object.fromEntries(
		guides.map((guide): [string, number] => [guide, read(guide).split("\n").length]).sort((a, b) => b[1] - a[1]),
	),
	30,
);

// --- Durations ---------------------------------------------------------------------------------

const durations: Array<{ doc: string; line: number; text: string }> = [];
for (const doc of docs) {
	read(doc)
		.split("\n")
		.forEach((line, index) => {
			if (
				/\b(about|around|under|over|nearly|~)?\s?\d+(\.\d+)?\s?(minutes?|min|seconds?|s)\b/.test(line) &&
				/pnpm|test|build|suite|e2e|storybook|typecheck|gate/i.test(line)
			) {
				durations.push({ doc, line: index + 1, text: line.trim().slice(0, 220) });
			}
		});
}
print(
	"Lines that state how long a command takes",
	tally(durations, (item) => item.doc),
);

save("docs", {
	generated: "node scripts/audit/docs.ts",
	paths: { checked, missing },
	commands: unknownCommands,
	decisions: {
		entries: entries.size,
		indexLines: indexed.size,
		indexLabel,
		missingFromIndex: [...entries].filter((entry) => !indexed.has(entry)),
		skipped: gaps,
		citedWithoutEntry: unknownDecisions,
	},
	guides: { unlisted, gone },
	durations,
});
