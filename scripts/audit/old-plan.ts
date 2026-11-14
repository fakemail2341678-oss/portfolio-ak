/**
 * Audit: each deliverable of the first four parts of the plan (docs/PLAN.md sections 4 to 10)
 * against today's standard: where its code is now, how much of it there is, how much the unit
 * tests cover, what the other audits count in it, and the Part 9 task that closes the gap.
 *
 *   node scripts/audit/old-plan.ts      (after the other audits and `pnpm test:coverage`)
 *
 * It reads the other audits' data files, so every number here is one of theirs, counted for the
 * deliverable's paths. Prints a Markdown table and writes docs/history/part9-audit/old-plan.json.
 * Part 9 Task 98.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { OUT_DIR, read, save, sourceFiles, walk } from "./lib.ts";

type Deliverable = { part: string; task: string; name: string; paths: RegExp; closes: string };

/** The plan's deliverables, with the paths that hold them today and the task of 15.3 that brings them to the standard. */
const DELIVERABLES: Deliverable[] = [
	{
		part: "1",
		task: "1",
		name: "Scaffold and tooling",
		paths: /^(scripts\/(?!audit\/)|vite\/|src\/(router|client|start|server)\.tsx?$)/,
		closes: "99, 100, 103",
	},
	{ part: "1", task: "2", name: "Environment validation", paths: /^src\/(server\/env\.ts|lib\/env\/)/, closes: "103" },
	{ part: "1", task: "3", name: "Database", paths: /^src\/server\/db\//, closes: "104" },
	{ part: "1", task: "4", name: "Internationalisation", paths: /^src\/lib\/i18n\//, closes: "100, 110" },
	{
		part: "1",
		task: "5",
		name: "Router, SSR and server functions",
		paths: /^src\/(routes\/__root\.tsx|lib\/(query|start\/|http\/|session|errors)|functions\/_lib\/|middleware\/)/,
		closes: "103, 106",
	},
	{ part: "1", task: "6", name: "Email", paths: /^src\/server\/email\//, closes: "103, 110" },
	{
		part: "1",
		task: "7",
		name: "Authentication",
		paths: /^src\/(features\/auth\/|server\/auth\/|functions\/auth\.ts|routes\/_auth|lib\/auth-client)/,
		closes: "103, 110",
	},
	{ part: "1", task: "8–9", name: "Form system", paths: /^src\/components\/forms\//, closes: "107" },
	{
		part: "1",
		task: "10",
		name: "State and reactive data",
		paths: /^src\/(lib\/(stores\/|tanstack-db|crud\/|concurrency)|hooks\/)/,
		closes: "105, 106",
	},
	{
		part: "1",
		task: "11–12",
		name: "Test CRUD",
		paths: /^src\/(features\/test-crud\/|server\/test-crud\/|functions\/test-crud|routes\/_admin\/admin\/test-crud)/,
		closes: "110",
	},
	{
		part: "1",
		task: "13",
		name: "Observability",
		paths: /^src\/(server\/(log|analytics\/|plugins\/)|lib\/observability\/|instrument\.server)/,
		closes: "103",
	},
	{
		part: "1",
		task: "14–15",
		name: "Storybook and tests",
		paths: /^(tests\/(setup|utils)\/|\.storybook\/)/,
		closes: "99, 123",
	},
	{
		part: "2",
		task: "18",
		name: "Page building blocks",
		paths: /^src\/components\/(page|data-display|navigation|dialogs|layout|errors|charts)\//,
		closes: "107",
	},
	{
		part: "2",
		task: "19",
		name: "Filters, search params, tables",
		paths: /^src\/(lib\/list\/|components\/(filters|data-table)\/)/,
		closes: "106",
	},
	{
		part: "2",
		task: "20",
		name: "RBAC",
		paths: /^src\/(features\/rbac\/|server\/rbac\/|functions\/rbac\.ts)/,
		closes: "110",
	},
	{
		part: "2",
		task: "21",
		name: "Attachments",
		paths: /^src\/(features\/attachments\/|server\/attachments\/|functions\/attachments\.ts)/,
		closes: "110",
	},
	{
		part: "2",
		task: "22",
		name: "SEO",
		paths: /^src\/(lib\/(seo|structured-data)|server\/seo\/|routes\/(robots|sitemap))/,
		closes: "106, 110",
	},
	{
		part: "2",
		task: "23",
		name: "Module examples and /dev",
		paths: /^src\/(features\/(dev|stack)\/|routes\/dev|functions\/(examples|dev|stack))/,
		closes: "109",
	},
	{
		part: "3",
		task: "28",
		name: "Server routes, health, request tracing",
		paths: /^src\/(server\/(routes\/|http\/)|routes\/api\/|functions\/health)/,
		closes: "103",
	},
	{
		part: "3",
		task: "29–30",
		name: "Account, audit log, admin users",
		paths:
			/^src\/(features\/(audit|admin|flags)\/|server\/(audit|admin|users)\/|functions\/(audit|admin|feature-flags)\.ts|routes\/_authed)/,
		closes: "110",
	},
	{
		part: "4",
		task: "36–37",
		name: "Shells and the admin kit",
		paths: /^src\/components\/(admin-shell|auth-shell|app-header|brand)\//,
		closes: "107",
	},
	{ part: "4", task: "38", name: "The CRUD standard", paths: /^src\/components\/crud\//, closes: "100, 105" },
	{
		part: "4",
		task: "39–40",
		name: "Portfolio and media",
		paths: /(^|[/_.-])(portfolio|himal|media)([/_.-]|$)|routes\/_site/,
		closes: "120–122",
	},
	{
		part: "4",
		task: "41–44",
		name: "Apps platform, Notes, Links, Habits, Forms",
		paths: /^src\/(features\/apps\/|server\/apps\/|functions\/(apps\/|guests)|routes\/(_apps|f\/|l\/)|lib\/guests)/,
		closes: "111",
	},
];

type Located = { file: string };
const data = <T>(name: string): T | undefined =>
	existsSync(`${OUT_DIR}/${name}.json`) ? (JSON.parse(read(`${OUT_DIR}/${name}.json`)) as T) : undefined;

const structure = data<{ featureFolders: { outOfShape: Array<{ folder: string; looseComponents: string[] }> } }>(
	"structure",
);
const functions = data<{ functions: Array<Located & { verbClass: string; validator: string; method: string }> }>(
	"functions",
);
const writes = data<{ sites: Array<Located & { optimistic: boolean; class: string }> }>("writes");
const reads = data<{
	useQuery: { list: Array<Located & { reason: string }> };
	routes: { readingWithoutLoader: Located[] };
}>("reads");
const errors = data<{ throws: { bare: Located[] }; catches: { silent: Array<Located & { comment: boolean }> } }>(
	"errors",
);
const code = data<{
	effects: { list: Located[] };
	casts: { doubleCasts: Located[] };
	patterns: Record<string, { files: string[] }>;
}>("code");

type Coverage = Record<string, { lines: { covered: number; total: number } }>;
const coverage: Coverage = existsSync("coverage/coverage-summary.json")
	? (JSON.parse(read("coverage/coverage-summary.json")) as Coverage)
	: {};
const covered = new Map(
	Object.entries(coverage)
		.filter(([file]) => file !== "total")
		.map(([file, summary]) => [path.relative(process.cwd(), file).split(path.sep).join("/"), summary.lines]),
);

const all = [
	...sourceFiles(),
	...walk("scripts"),
	...walk("vite"),
	...walk("tests/setup"),
	...walk("tests/utils"),
	...walk(".storybook"),
];
const lineCount = (file: string) => read(file).split("\n").length;

const rows = DELIVERABLES.map((deliverable) => {
	const inPaths = (item: Located) => deliverable.paths.test(item.file);
	const files = all.filter((file) => deliverable.paths.test(file));
	const lines = { covered: 0, total: 0 };
	for (const file of files) {
		const own = covered.get(file);
		if (own) {
			lines.covered += own.covered;
			lines.total += own.total;
		}
	}
	const counts: Record<string, number> = {
		"loose components": (structure?.featureFolders.outOfShape ?? [])
			.filter((folder) => deliverable.paths.test(`${folder.folder}/`))
			.reduce((sum, folder) => sum + folder.looseComponents.length, 0),
		"folded verbs": (functions?.functions ?? []).filter((item) => inPaths(item) && item.verbClass === "folded").length,
		"POST without a validator": (functions?.functions ?? []).filter(
			(item) => inPaths(item) && item.method === "POST" && item.validator === "none",
		).length,
		"writes to make optimistic": (writes?.sites ?? []).filter(
			(item) => inPaths(item) && item.class === "optimistic" && !item.optimistic,
		).length,
		"useQuery with no reason": (reads?.useQuery.list ?? []).filter((item) => inPaths(item) && item.reason === "none")
			.length,
		"routes reading with no loader": (reads?.routes.readingWithoutLoader ?? []).filter(inPaths).length,
		"bare errors": (errors?.throws.bare ?? []).filter(inPaths).length,
		"silent catches": (errors?.catches.silent ?? []).filter((item) => inPaths(item) && !item.comment).length,
		effects: (code?.effects.list ?? []).filter(inPaths).length,
		"double casts": (code?.casts.doubleCasts ?? []).filter(inPaths).length,
		"files with timers": [
			...new Set([...(code?.patterns["setTimeout("]?.files ?? []), ...(code?.patterns["setInterval("]?.files ?? [])]),
		].filter((file) => deliverable.paths.test(file)).length,
		"files with key handlers": [
			...new Set([
				...(code?.patterns["onKeyDown="]?.files ?? []),
				...(code?.patterns['addEventListener("keydown"']?.files ?? []),
			]),
		].filter((file) => deliverable.paths.test(file)).length,
	};
	const found = Object.entries(counts).filter(([, count]) => count > 0);
	return {
		part: deliverable.part,
		task: deliverable.task,
		name: deliverable.name,
		files: files.length,
		lines: files.reduce((sum, file) => sum + lineCount(file), 0),
		coverage: lines.total === 0 ? null : Math.round((lines.covered / lines.total) * 1000) / 10,
		counts: Object.fromEntries(found),
		closes: deliverable.closes,
	};
});

console.log(
	"| Part | Tasks | Deliverable | Files | Lines | Unit coverage | Counted against the standard | Closed by |",
);
console.log("| --- | --- | --- | ---: | ---: | ---: | --- | --- |");
for (const row of rows) {
	const counted = Object.entries(row.counts)
		.map(([name, count]) => `${name} ${count}`)
		.join(", ");
	console.log(
		`| ${row.part} | ${row.task} | ${row.name} | ${row.files} | ${row.lines} | ${row.coverage === null ? "–" : `${row.coverage}%`} | ${counted || "nothing"} | ${row.closes} |`,
	);
}

save("old-plan", { generated: "node scripts/audit/old-plan.ts", rows });
