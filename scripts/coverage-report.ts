// Per-area coverage report (docs/PLAN.md, Phase 11b). Reads Vitest's
// json-summary output and prints line / branch / function coverage for each
// area of the codebase, plus the overall total.
//
//   pnpm test:coverage          (runs the tests, then this script)
//   node scripts/coverage-report.ts [coverage/coverage-summary.json]
import { readFileSync } from "node:fs";
import path from "node:path";

type Counts = { covered: number; total: number };
type FileSummary = { lines: Counts; branches: Counts; functions: Counts };
type Pair = [covered: number, total: number];
type Totals = { lines: Pair; branches: Pair; functions: Pair };

const summaryPath = process.argv[2] ?? "coverage/coverage-summary.json";

/** Areas in the order of the plan. A file counts toward every area whose pattern it matches. */
const AREAS: ReadonlyArray<{ name: string; patterns: RegExp[] }> = [
	{
		name: "Schemas & validation",
		patterns: [
			/^src\/lib\/(validation|phone)\.ts$/,
			/^src\/features\/[^/]+\/(schema|search|constants|validation)\.ts$/,
			/^src\/lib\/(i18n\/date-only|http\/redirect)\.ts$/,
			/^src\/functions\/_lib\//,
		],
	},
	{ name: "Form fields", patterns: [/^src\/components\/forms\//] },
	{
		name: "Server functions",
		patterns: [
			/^src\/functions\//,
			/^src\/server\/test-crud\//,
			/^src\/server\/rich-text\//,
			/^src\/server\/analytics\//,
		],
	},
	{
		name: "Guards",
		patterns: [/^src\/middleware\//, /^src\/lib\/(errors|start\/http-status)\.ts$/, /^src\/server\/http\//],
	},
	{ name: "Email", patterns: [/^src\/server\/email\//] },
	{ name: "i18n", patterns: [/^src\/lib\/i18n\//, /^src\/lib\/seo\.ts$/] },
	{ name: "Env", patterns: [/^src\/server\/env\.ts$/, /^src\/lib\/env\//] },
	// Part 2 areas (docs/PLAN.md section 7).
	{
		name: "Lists & filters",
		patterns: [
			/^src\/lib\/list\//,
			/^src\/lib\/(query|breadcrumbs)\.ts$/,
			/^src\/hooks\/use-list-/,
			/^src\/server\/db\/list\.ts$/,
			/^src\/components\/(filters|data-table|navigation|page)\//,
		],
	},
	{ name: "RBAC", patterns: [/^src\/features\/rbac\//, /^src\/server\/rbac\//] },
	{ name: "Attachments", patterns: [/^src\/features\/attachments\//, /^src\/server\/attachments\//] },
	{ name: "SEO", patterns: [/^src\/lib\/(seo|structured-data)\.ts$/, /^src\/server\/seo\//] },
];

const raw = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<string, FileSummary>;
const root = process.cwd();
const files = Object.entries(raw)
	.filter(([file]) => file !== "total")
	.map(([file, data]): [string, FileSummary] => [path.relative(root, file).split(path.sep).join("/"), data]);

const KEYS = ["lines", "branches", "functions"] as const;
const emptyTotals = (): Totals => ({ lines: [0, 0], branches: [0, 0], functions: [0, 0] });
const add = (totals: Totals, data: FileSummary) => {
	for (const key of KEYS) {
		totals[key][0] += data[key].covered;
		totals[key][1] += data[key].total;
	}
};
const pct = ([covered, total]: Pair) => (total === 0 ? "–" : `${((covered / total) * 100).toFixed(1)}%`);

const rows: Array<[string, number, Totals]> = AREAS.map((area) => {
	const totals = emptyTotals();
	let count = 0;
	for (const [file, data] of files) {
		if (area.patterns.some((pattern) => pattern.test(file))) {
			add(totals, data);
			count += 1;
		}
	}
	return [area.name, count, totals];
});
const overall = emptyTotals();
for (const [, data] of files) add(overall, data);
rows.push(["Overall (all measured files)", files.length, overall]);

const header = ["Area", "Files", "Lines", "Branches", "Functions"];
const table = [
	header,
	...rows.map(([name, count, t]) => [name, String(count), pct(t.lines), pct(t.branches), pct(t.functions)]),
];
const widths = header.map((_, column) => Math.max(...table.map((row) => row[column]?.length ?? 0)));
const line = (row: string[]) =>
	`| ${row.map((cell, column) => (column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0))).join(" | ")} |`;
console.log("\nCoverage by area\n");
console.log(line(header));
console.log(
	`|${widths.map((width, column) => (column === 0 ? `:${"-".repeat(width + 1)}` : `${"-".repeat(width + 1)}:`)).join("|")}|`,
);
for (const row of table.slice(1)) console.log(line(row));
console.log(
	"\nNotes: src/functions/* are thin createServerFn wrappers that only execute inside the TanStack Start\n" +
		"runtime, so unit tests cannot run them; their logic lives in src/server/** (tested) and their auth\n" +
		"middleware is asserted by tests/server/test-crud-functions.test.ts. Route pages and UI composition are\n" +
		"exercised by `pnpm test:storybook` (in a real browser) rather than by this unit run.\n",
);
