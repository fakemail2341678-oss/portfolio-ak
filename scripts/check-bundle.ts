/**
 * Bundle budget for a production build (`pnpm build` first). Fails when:
 *  - the JavaScript every page loads (the root route's preloads and every chunk they import
 *    statically, decision 0217) is over ENTRY_BUDGET_KB gzip;
 *  - a chunk only some pages need is preloaded by every page (NOT_IN_ENTRY: TanStack DB, which
 *    only the apps and one example use, decision 0189);
 *  - any route adds more than ROUTE_BUDGET_KB gzip on top of the root;
 *  - a font preloaded by a `fonts.ts` module is over FONT_BUDGET_KB.
 *
 *   node scripts/check-bundle.ts            check and print the table
 *   node scripts/check-bundle.ts --report   print only, never fail
 *   node scripts/check-bundle.ts --routes=chaal   also list every route whose id contains "chaal"
 *
 * Decision 0151. The numbers it prints are the ones recorded there.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// 240 until Task 41, plus a separate 105 kB line for TanStack DB. DB left every page then (0189),
// and TanStack Query's core, which DB's chunk group used to hold, came back into the entry: every
// page went from 338.5 to 245.6 kB.
// Task 52 (0217): counted as the closure of what every page loads (265.7 kB then; 249.9 by the old
// count of the root's direct preloads), with room for Tasks 53–57's routes. Routes are counted the
// same way, so their line rose too (the heaviest, the portfolio's project editor, 266.5 kB).
// Task 63 (0235): 280. Every route definition is in the entry (0151), and Parda's title, credits,
// person, collection and surprise routes took it to 276.0 kB; the rest of Part 6 is measured in Task 70.
// Task 67 (0240): 285. The library and profiles routes took it to 280.9 kB; Tasks 68 to 69a added their
// routes (283.7 kB after 69a, about 0.3 kB each), and Task 70 measures and trims.
// Part 7 Task 73 (0260): 290. Chaal's layout and first six pages took it from 284.4 to 286.3 kB;
// the room is for Tasks 74–84's routes, and Task 85 measures and trims.
// Task 80 (0270): 295. Tasks 74–79 used that room (289.9 kB); the puzzles' two routes took it to
// 290.5 kB after sharing Chaal's page heads; the rest is for Tasks 81–84, and Task 85 trims.
// Part 8 Task 86 (0279): 300. Part 7 left 294.6 kB and Kharcha's catalogue entries 295.0; the room
// is for Kharcha's routes (about 16 at 0.3 kB, less Expenses' 3, Task 95), and Task 97 trims.
// Task 94 (0288): 305, the owner's choice. Tasks 88 to 93 used that room (300.0 kB); Insights' route
// with its address and the Recurring tab's loader took it to 301.3; Tasks 95 and 96 add the old
// addresses and the admin's routes, and Task 97 trims.
// Task 95 (0289): 300.5 kB, Expenses' three routes out and its old addresses' one redirect in.
const ENTRY_BUDGET_KB = 305;
const ROUTE_BUDGET_KB = 300;
const FONT_BUDGET_KB = 150;
/** Code that must never be preloaded by every page, found by a string it always contains: its pages load it. */
const NOT_IN_ENTRY: ReadonlyArray<{ name: string; contains: string }> = [
	{ name: "TanStack DB", contains: "[Live Query Error]" },
];

/**
 * Preloaded fonts allowed over budget for now, with the reason. An entry that no longer
 * matches a preloaded font fails the check, so the exemption is removed with the font.
 */
const FONT_EXEMPTIONS: ReadonlyMap<string, string> = new Map<string, string>([]);

const ROOT = resolve(import.meta.dirname, "..");
const OUTPUT = join(ROOT, ".output");
const reportOnly = process.argv.includes("--report");
/** `--routes=<text>`: also list every route whose id contains it (Task 85: `--routes=chaal`). */
const listed = process.argv.find((arg) => arg.startsWith("--routes="))?.slice("--routes=".length);

type Manifest = { routes: Record<string, { preloads?: string[] }> };

const loadManifest = async (): Promise<Manifest> => {
	const dir = join(OUTPUT, "server");
	const file = readdirSync(dir).find((name) => name.startsWith("_tanstack-start-manifest") && name.endsWith(".mjs"));
	if (!file) throw new Error("No build found: run `pnpm build` first (.output/server has no Start manifest).");
	const module = (await import(pathToFileURL(join(dir, file)).href)) as { tsrStartManifest: () => Manifest };
	return module.tsrStartManifest();
};

/**
 * The release snippet Sentry's build plugin puts at the top of every chunk when the build has
 * SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT (a local `.env` may): about 0.2 kB gzip a
 * chunk, 15 kB over the entry's 70. It is left out, so a build measures the same with or
 * without them (decision 0279).
 */
const SENTRY_SNIPPET = /^\(function\(\)\{try\{var e=typeof window[\s\S]*?_sentryDebugIds[\s\S]*?\}catch\{\}\}\)\(\);/;

const gzipCache = new Map<string, number>();
const gzipKb = (asset: string): number => {
	const cached = gzipCache.get(asset);
	if (cached !== undefined) return cached;
	const content = readFileSync(join(OUTPUT, "public", asset));
	const code = asset.endsWith(".js") ? Buffer.from(content.toString("utf8").replace(SENTRY_SNIPPET, "")) : content;
	const size = gzipSync(code).length / 1024;
	gzipCache.set(asset, size);
	return size;
};

const sum = (assets: Iterable<string>) => [...assets].reduce((total, asset) => total + gzipKb(asset), 0);

/**
 * Every chunk the browser loads before the page runs: the preloads, and every chunk
 * they import statically, recursively (decision 0217). `import "./x.js"` and
 * `… from "./x.js"` are static; `import("./x.js")` loads on demand and isn't followed.
 */
const closure = (assets: Iterable<string>): Set<string> => {
	const seen = new Set<string>();
	const queue = [...assets];
	while (queue.length > 0) {
		const asset = queue.pop() as string;
		if (seen.has(asset)) continue;
		seen.add(asset);
		if (!asset.endsWith(".js")) continue;
		const source = readFileSync(join(OUTPUT, "public", asset), "utf8");
		const dir = asset.slice(0, asset.lastIndexOf("/") + 1);
		for (const [, specifier] of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.{1,2}\/[^"']+\.js)["']/g)) {
			queue.push(posix.normalize(`${dir}${specifier}`));
		}
	}
	return seen;
};
const kb = (value: number) => `${value.toFixed(1)} kB`;

/** Fonts imported with `?url` by a fonts.ts module: the files the app preloads. */
const preloadedFonts = (): Array<{ file: string; kb: number }> => {
	const sources: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.name === "fonts.ts") sources.push(path);
		}
	};
	walk(join(ROOT, "src"));
	const fonts: Array<{ file: string; kb: number }> = [];
	for (const source of sources) {
		for (const [, specifier] of readFileSync(source, "utf8").matchAll(/from "([^"]+\.woff2)\?url"/g)) {
			const file = join(ROOT, "node_modules", specifier ?? "");
			fonts.push({ file: specifier ?? "", kb: statSync(file).size / 1024 });
		}
	}
	return fonts;
};

const manifest = await loadManifest();
const rootPreloads = closure(manifest.routes.__root__?.preloads ?? []);
const failures: string[] = [];

const entry = sum(rootPreloads);
console.log(
	`Entry JS (every page, with what it imports): ${kb(entry)} gzip in ${rootPreloads.size} files (budget ${ENTRY_BUDGET_KB} kB)`,
);
if (entry > ENTRY_BUDGET_KB) failures.push(`entry JS is ${kb(entry)}, over ${ENTRY_BUDGET_KB} kB`);
for (const { name, contains } of NOT_IN_ENTRY) {
	const assets = [...rootPreloads].filter((asset) =>
		readFileSync(join(OUTPUT, "public", asset), "utf8").includes(contains),
	);
	if (assets.length > 0) failures.push(`${name} (${kb(sum(assets))}) is preloaded by every page`);
}

const routes = Object.entries(manifest.routes)
	.filter(([id]) => id !== "__root__")
	.map(([id, route]) => ({
		id,
		extra: sum([...closure(route.preloads ?? [])].filter((asset) => !rootPreloads.has(asset))),
	}))
	.sort((a, b) => b.extra - a.extra);
console.log("\nHeaviest routes (JS added on top of the root):");
for (const { id, extra } of routes.slice(0, 8)) console.log(`  ${kb(extra).padStart(10)}  ${id}`);
if (listed) {
	console.log(`\nEvery route whose id contains "${listed}":`);
	for (const { id, extra } of routes.filter((route) => route.id.includes(listed))) {
		console.log(`  ${kb(extra).padStart(10)}  ${id}`);
	}
}
for (const { id, extra } of routes) {
	if (extra > ROUTE_BUDGET_KB) failures.push(`route ${id} adds ${kb(extra)}, over ${ROUTE_BUDGET_KB} kB`);
}

console.log("\nPreloaded fonts:");
const fonts = preloadedFonts();
for (const { file, kb: size } of fonts) {
	const exemption = FONT_EXEMPTIONS.get(file);
	console.log(`  ${kb(size).padStart(10)}  ${file}${exemption ? `  (exempt: ${exemption})` : ""}`);
	if (size > FONT_BUDGET_KB && !exemption) {
		failures.push(`preloaded font ${file} is ${kb(size)}, over ${FONT_BUDGET_KB} kB`);
	}
}
for (const file of FONT_EXEMPTIONS.keys()) {
	if (!fonts.some((font) => font.file === file)) failures.push(`stale exemption: ${file} isn't preloaded any more`);
}

if (failures.length > 0) {
	console.error(`\nBundle budget exceeded:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
	if (!reportOnly) process.exit(1);
}
