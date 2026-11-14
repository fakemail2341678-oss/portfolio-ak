/**
 * Audit: unit-test coverage per layer and per folder (`scripts/coverage-report.ts` prints it per
 * area of the first plan; the floors of Task 123 are set per layer).
 *
 *   pnpm test:coverage -- --maxWorkers=4      (writes coverage/coverage-summary.json)
 *   node scripts/audit/coverage.ts
 *
 * This is the unit project only: route pages and UI composition are covered by Storybook and
 * e2e, which v8 coverage doesn't see.
 *
 * Prints the tables and writes docs/history/part9-audit/coverage.json.
 * Part 9 Task 98.
 */
import path from "node:path";
import { type Layer, layerOf, print, read, save } from "./lib.ts";

type Counts = { covered: number; total: number };
type FileSummary = { lines: Counts; branches: Counts; functions: Counts; statements: Counts };
type Totals = { files: number; lines: Counts; branches: Counts; functions: Counts };

const raw = JSON.parse(read(process.argv[2] ?? "coverage/coverage-summary.json")) as Record<string, FileSummary>;
const root = process.cwd();
const files = Object.entries(raw)
	.filter(([file]) => file !== "total")
	.map(([file, data]): [string, FileSummary] => [path.relative(root, file).split(path.sep).join("/"), data]);

const empty = (): Totals => ({
	files: 0,
	lines: { covered: 0, total: 0 },
	branches: { covered: 0, total: 0 },
	functions: { covered: 0, total: 0 },
});
const add = (totals: Totals, data: FileSummary) => {
	totals.files += 1;
	for (const key of ["lines", "branches", "functions"] as const) {
		totals[key].covered += data[key].covered;
		totals[key].total += data[key].total;
	}
};
const percent = ({ covered, total }: Counts) => (total === 0 ? 100 : Math.round((covered / total) * 1000) / 10);
const row = (totals: Totals) => ({
	files: totals.files,
	lines: percent(totals.lines),
	branches: percent(totals.branches),
	functions: percent(totals.functions),
	linesTotal: totals.lines.total,
});
const line = (totals: Totals) => {
	const data = row(totals);
	return `${String(data.lines).padStart(5)}% lines  ${String(data.branches).padStart(5)}% branches  ${String(data.functions).padStart(5)}% functions  (${data.files} files, ${data.linesTotal} lines)`;
};

/** `src/features/kharcha/…` gives `src/features`; the top folder says what kind of code it is. */
const kind = (file: string) => file.split("/").slice(0, 2).join("/");

const overall = empty();
const byLayer = new Map<Layer, Totals>();
const byKind = new Map<string, Totals>();
const byLayerKind = new Map<string, Totals>();
const group = <Key>(totals: Map<Key, Totals>, key: Key, data: FileSummary) => {
	const current = totals.get(key) ?? empty();
	add(current, data);
	totals.set(key, current);
};
for (const [file, data] of files) {
	add(overall, data);
	group(byLayer, layerOf(file), data);
	group(byKind, kind(file), data);
	group(byLayerKind, `${layerOf(file)}: ${kind(file)}`, data);
}
const untested = files.filter(([, data]) => data.lines.total >= 20 && data.lines.covered === 0).map(([file]) => file);

const sorted = <Key>(totals: Map<Key, Totals>) => [...totals].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
print("Coverage of the unit project", { overall: line(overall) });
print("By layer", Object.fromEntries(sorted(byLayer).map(([key, totals]) => [key, line(totals)])));
print("By kind of code", Object.fromEntries(sorted(byKind).map(([key, totals]) => [key, line(totals)])));
print("By layer and kind", Object.fromEntries(sorted(byLayerKind).map(([key, totals]) => [key, line(totals)])), 80);
print("Files of 20 lines or more that no unit test runs", { total: untested.length });

save("coverage", {
	generated: "pnpm test:coverage -- --maxWorkers=4, then node scripts/audit/coverage.ts",
	overall: row(overall),
	byLayer: Object.fromEntries(sorted(byLayer).map(([key, totals]) => [key, row(totals)])),
	byKind: Object.fromEntries(sorted(byKind).map(([key, totals]) => [key, row(totals)])),
	byLayerKind: Object.fromEntries(sorted(byLayerKind).map(([key, totals]) => [key, row(totals)])),
	untestedFiles: untested,
});
