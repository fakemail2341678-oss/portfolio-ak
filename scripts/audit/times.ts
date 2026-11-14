/**
 * Audit: where the test suites spend their time, from the reporters' JSON.
 *
 *   node scripts/audit/times.ts
 *
 * It reads what the measured runs left in .data/audit/ (not committed):
 *   vitest-unit.json, vitest-storybook.json, vitest-storybook-ne.json
 *     pnpm exec vitest run --project <name> --reporter=default --reporter=json --outputFile.json=<file>
 *   pw-01.json … pw-10.json
 *     PLAYWRIGHT_JSON_OUTPUT_NAME=<file> pnpm exec playwright test --shard=n/10 --reporter=list,json
 *
 * Prints the slowest files and pages and writes docs/history/part9-audit/times.json.
 * Part 9 Task 98; Task 99 starts from this list.
 */
import { existsSync, readdirSync } from "node:fs";
import { layerOf, print, read, save } from "./lib.ts";

const DIR = ".data/audit";
const seconds = (ms: number) => Math.round(ms / 100) / 10;
const sortDesc = (totals: Map<string, number>) => [...totals].sort((a, b) => b[1] - a[1]);
const top = (totals: Map<string, number>, limit: number) =>
	Object.fromEntries(
		sortDesc(totals)
			.slice(0, limit)
			.map(([name, ms]) => [name, `${seconds(ms)} s`]),
	);
const add = (totals: Map<string, number>, key: string, ms: number) => totals.set(key, (totals.get(key) ?? 0) + ms);

// --- Vitest ------------------------------------------------------------------------------------

type VitestReport = {
	numTotalTests: number;
	testResults: Array<{
		name: string;
		startTime: number;
		endTime: number;
		assertionResults: Array<{ fullName: string; duration?: number | null }>;
	}>;
};
type FileTime = { file: string; tests: number; ms: number };

function vitest(name: string) {
	const path = `${DIR}/${name}.json`;
	if (!existsSync(path)) return undefined;
	const report = JSON.parse(read(path)) as VitestReport;
	const root = process.cwd().split("\\").join("/");
	const files: FileTime[] = report.testResults
		.map((result) => ({
			file: result.name.replace(`${root}/`, ""),
			tests: result.assertionResults.length,
			ms: result.endTime - result.startTime,
		}))
		.sort((a, b) => b.ms - a.ms);
	const tests = report.testResults
		.flatMap((result) => result.assertionResults.map((test) => ({ name: test.fullName, ms: test.duration ?? 0 })))
		.sort((a, b) => b.ms - a.ms);
	const byFolder = new Map<string, number>();
	const byLayer = new Map<string, number>();
	for (const file of files) {
		add(byFolder, file.file.split("/").slice(0, 2).join("/"), file.ms);
		add(byLayer, layerOf(file.file), file.ms);
	}
	const total = files.reduce((sum, file) => sum + file.ms, 0);
	print(
		`${name}: ${files.length} files, ${report.numTotalTests} tests, ${seconds(total)} s inside the files (summed over workers)`,
		{},
	);
	print("  by folder", top(byFolder, 10));
	print("  by layer", top(byLayer, 10));
	print(
		"  slowest files",
		Object.fromEntries(files.slice(0, 15).map((file) => [`${file.file} (${file.tests})`, `${seconds(file.ms)} s`])),
	);
	return {
		files: files.length,
		tests: report.numTotalTests,
		totalSeconds: seconds(total),
		byFolder: Object.fromEntries(sortDesc(byFolder).map(([key, ms]) => [key, seconds(ms)])),
		byLayer: Object.fromEntries(sortDesc(byLayer).map(([key, ms]) => [key, seconds(ms)])),
		slowestFiles: files.slice(0, 40).map((file) => ({ ...file, ms: Math.round(file.ms) })),
		slowestTests: tests.slice(0, 40).map((test) => ({ ...test, ms: Math.round(test.ms) })),
		/** The share of the time the slowest tenth of the files takes. */
		slowestTenthShare: Math.round(
			(files.slice(0, Math.ceil(files.length / 10)).reduce((sum, file) => sum + file.ms, 0) / total) * 100,
		),
	};
}

// --- Playwright --------------------------------------------------------------------------------

type PwResult = { duration: number; status: string; retry: number };
type PwSpec = { title: string; tests: Array<{ projectName: string; results: PwResult[]; status: string }> };
type PwSuite = { title: string; file?: string; specs?: PwSpec[]; suites?: PwSuite[] };
type PwReport = {
	suites: PwSuite[];
	stats: { duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
};

const shards = existsSync(DIR)
	? readdirSync(DIR)
			.filter((name) => /^pw-\d+\.json$/.test(name))
			.sort()
	: [];
const pages = new Map<string, number>();
const pageTests = new Map<string, number>();
const flows = new Map<string, number>();
const flowTests: Array<{ name: string; ms: number }> = [];
const variants = new Map<string, number>();
const variantCounts = new Map<string, number>();
const flakyTests: string[] = [];
const stats = { tests: 0, flaky: 0, failed: 0, retries: 0, testSeconds: 0, shardSeconds: [] as number[] };

function collect(suite: PwSuite, trail: string[], file: string) {
	const here = suite.title && suite.title !== file ? [...trail, suite.title] : trail;
	for (const spec of suite.specs ?? []) {
		for (const test of spec.tests) {
			const ms = test.results.reduce((sum, result) => sum + result.duration, 0);
			stats.tests += 1;
			stats.testSeconds += ms / 1000;
			stats.retries += test.results.length - 1;
			if (test.status === "flaky") {
				stats.flaky += 1;
				flakyTests.push([file, ...here, spec.title].join(" › "));
			}
			if (test.status === "unexpected") stats.failed += 1;
			if (test.projectName === "review") {
				// review.spec.ts: <route> › <theme width> › <locale>
				const route = here[0] ?? "?";
				add(pages, route, ms);
				pageTests.set(route, (pageTests.get(route) ?? 0) + 1);
				const variant = `${here[1] ?? "?"} ${spec.title}`;
				add(variants, variant, ms);
				variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
			} else {
				add(flows, file, ms);
				flowTests.push({ name: `${file} › ${[...here, spec.title].join(" › ")}`, ms });
			}
		}
	}
	for (const child of suite.suites ?? []) collect(child, here, file);
}
for (const shard of shards) {
	const report = JSON.parse(read(`${DIR}/${shard}`)) as PwReport;
	stats.shardSeconds.push(Math.round(report.stats.duration / 1000));
	for (const suite of report.suites) collect(suite, [], suite.file ?? suite.title);
}

const unit = vitest("vitest-unit");
const storybook = vitest("vitest-storybook");
const storybookNe = vitest("vitest-storybook-ne");

if (shards.length > 0) {
	const reviewMs = [...pages.values()].reduce((sum, ms) => sum + ms, 0);
	const flowMs = [...flows.values()].reduce((sum, ms) => sum + ms, 0);
	print(`e2e: ${shards.length} shards, ${stats.tests} tests`, {
		"wall time, all shards": `${Math.round(stats.shardSeconds.reduce((sum, value) => sum + value, 0) / 6) / 10} min`,
		"inside the tests (summed over workers)": `${Math.round(stats.testSeconds / 6) / 10} min`,
		"…the review": `${Math.round(reviewMs / 6000) / 10} min for ${pages.size} pages`,
		"…the flows": `${Math.round(flowMs / 6000) / 10} min for ${flows.size} files`,
		flaky: stats.flaky,
		failed: stats.failed,
		retries: stats.retries,
	});
	print("  review: slowest pages (all 12 variants)", top(pages, 20));
	print(
		"  review: seconds per check, by variant",
		Object.fromEntries(
			sortDesc(variants).map(([variant, ms]) => [
				variant,
				`${Math.round(ms / (variantCounts.get(variant) ?? 1) / 10) / 100} s`,
			]),
		),
	);
	print("  flows by file", top(flows, 20));
}

save("times", {
	generated: "node scripts/audit/times.ts",
	unit,
	storybook,
	storybookNe,
	e2e: {
		shards: shards.length,
		shardSeconds: stats.shardSeconds,
		tests: stats.tests,
		flaky: stats.flaky,
		flakyTests,
		failed: stats.failed,
		retries: stats.retries,
		testMinutes: Math.round(stats.testSeconds / 6) / 10,
		reviewPages: sortDesc(pages).map(([route, ms]) => ({
			route,
			checks: pageTests.get(route) ?? 0,
			seconds: seconds(ms),
		})),
		reviewVariants: Object.fromEntries(
			sortDesc(variants).map(([variant, ms]) => [variant, Math.round(ms / (variantCounts.get(variant) ?? 1)) / 1000]),
		),
		flows: sortDesc(flows).map(([file, ms]) => ({ file, seconds: seconds(ms) })),
		slowestFlowTests: flowTests
			.sort((a, b) => b.ms - a.ms)
			.slice(0, 30)
			.map((test) => ({ ...test, ms: Math.round(test.ms) })),
	},
});
