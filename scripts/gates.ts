/**
 * `pnpm gates`: every gate of CLAUDE.md in one command, cheapest first, with a table of times at
 * the end (Part 9 Task 99, decision 0296).
 *
 *   pnpm gates                 # narrowed to what changed (the changed-files rule, decision 0280)
 *   pnpm gates --full          # every suite whole: a Part's last task, and what CI runs
 *   pnpm gates --list          # print what would run, and run nothing
 *   pnpm gates --only=test,e2e # some gates (names as in the table); --skip=<names> for the opposite
 *   pnpm gates --base=main     # "changed" means changed since that commit (default: not yet committed,
 *                              #   or the last commit when the tree is clean)
 *   pnpm gates --e2e="kharcha" # the e2e gate's --grep, in place of the one worked out from the changes
 *   pnpm gates --keep-going    # don't stop at the first gate that fails
 *   pnpm gates:clean           # stop what a killed run left behind: runners, servers, automated Chromes
 *
 * What "narrowed" means for each gate is in docs/guides/testing.md ("pnpm gates"). Worker counts come
 * from the machine's free memory (scripts/lib/workers.ts), so no gate needs a flag.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCache } from "../e2e/harness/build-hash.ts";
import { E2E, E2E_PUBLIC_ENV } from "../e2e/harness/config.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) =>
	args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? undefined;
const list = (name: string) =>
	(option(name) ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

// ---------------------------------------------------------------------------------------------
// gates:clean
// ---------------------------------------------------------------------------------------------

type Running = { pid: number; parent: number; command: string };

function processes(): Running[] {
	if (process.platform === "win32") {
		const script =
			"$ProgressPreference = 'SilentlyContinue'; Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CommandLine | ForEach-Object { '' + $_.ProcessId + ' ' + $_.ParentProcessId + ' ' + $_.CommandLine }";
		const out = execFileSync(
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
		);
		return out.split(/\r?\n/).flatMap((line) => {
			const match = /^(\d+) (\d+) (.*)$/.exec(line);
			return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] ?? "" }] : [];
		});
	}
	const out = execFileSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	return out.split("\n").flatMap((line) => {
		const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
		return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] ?? "" }] : [];
	});
}

/** What a test run starts, by its command line. A browser counts only with Playwright's throwaway profile. */
const LEFTOVERS: Array<[name: string, pattern: RegExp]> = [
	["the Playwright runner", /playwright[\\/](test[\\/])?cli\.js"? test/],
	["a Playwright worker", /playwright[\\/]lib[\\/]worker[\\/]workerProcessEntry/],
	["the e2e harness", /e2e[\\/]harness[\\/]server\.ts/],
	["the e2e server", /\.output[\\/]server[\\/]index\.mjs/],
	["Vitest", /vitest[\\/](vitest\.mjs|dist[\\/])/],
	["the story tests", /scripts[\\/]test-storybook\.ts/],
	["a Storybook build", /storybook[\\/].*(bin|dist)[\\/].* build/],
	["another gates run", /scripts[\\/]gates\.ts/],
	["an automated browser", /playwright_chromiumdev_profile/],
];

function clean({ quiet = false, only }: { quiet?: boolean; only?: RegExp } = {}) {
	const all = processes();
	const byPid = new Map(all.map((each) => [each.pid, each]));
	// This command, and whatever started it, are not leftovers.
	const mine = new Set<number>();
	for (let pid: number | undefined = process.pid; pid && !mine.has(pid); pid = byPid.get(pid)?.parent) mine.add(pid);
	const stopped: Record<string, number> = {};
	for (const each of all) {
		if (mine.has(each.pid)) continue;
		const kind = LEFTOVERS.find(([, pattern]) => pattern.test(each.command));
		if (!kind || (only && !only.test(each.command))) continue;
		try {
			process.kill(each.pid, "SIGKILL");
			stopped[kind[0]] = (stopped[kind[0]] ?? 0) + 1;
		} catch {
			// Gone already (its parent was stopped a moment ago).
		}
	}
	const names = Object.entries(stopped).map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
	if (!quiet)
		console.log(names.length > 0 ? `[gates] stopped: ${names.join(", ")}` : "[gates] nothing was left running");
	return names.length;
}

if (flag("clean")) {
	clean();
	process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------------------------

const git = (...gitArgs: string[]) =>
	execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
		.split(/\r?\n/)
		.filter(Boolean);

function changedFiles(): { files: string[]; since: string } {
	const untracked = git("ls-files", "--others", "--exclude-standard");
	const base = option("base");
	if (base) return { files: [...new Set([...git("diff", "--name-only", base), ...untracked])], since: base };
	const uncommitted = [...new Set([...git("diff", "--name-only", "HEAD"), ...untracked])];
	if (uncommitted.length > 0) return { files: uncommitted, since: "the last commit (not yet committed)" };
	return {
		files: git("diff", "--name-only", "HEAD~1", "HEAD"),
		since: "the commit before the last (the tree is clean)",
	};
}

const full = flag("full");
const changed = full ? { files: [], since: "" } : changedFiles();
const files = changed.files.map((file) => file.replaceAll("\\", "/"));
const present = files.filter((file) => existsSync(file));
const any = (pattern: RegExp) => files.some((file) => pattern.test(file));

// ---------------------------------------------------------------------------------------------
// Each gate's scope
// ---------------------------------------------------------------------------------------------

type Step = { command: string[]; env?: Record<string, string> };
type Plan = { scope: string; steps: Step[] } | { scope: string; skip: true };
const whole = (...command: string[]): Plan => ({ scope: "everything", steps: [{ command }] });
const pnpm = (...command: string[]) => ["pnpm", ...command];

/** Anything here changes what every test of its kind does, so the suite runs whole. */
const TEST_SETUP =
	/^(vitest\.config\.ts|package\.json|pnpm-lock\.yaml|tsconfig\.json|drizzle\/|tests\/(setup|utils)\/|scripts\/lib\/workers\.ts)/;
const CODE = /\.(ts|tsx|mts|mjs|js|jsx|css|json)$/;
const NODE_PROJECTS = ["--project", "unit", "--project", "components", "--project", "server"];

/** Tests that read the source as files (the guards): no import leads to them, so they always run. */
function guardTests(): string[] {
	const found: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const file = `${dir}/${entry.name}`;
			if (entry.isDirectory()) walk(file);
			else if (
				/\.test\.tsx?$/.test(entry.name) &&
				/from "node:fs"|import\.meta\.glob/.test(readFileSync(file, "utf8"))
			) {
				found.push(file);
			}
		}
	};
	walk("tests");
	return found;
}

function testPlan(): Plan {
	if (full || any(TEST_SETUP)) return whole(...pnpm("test"));
	const code = present.filter(
		(file) => CODE.test(file) && /^(src|tests|scripts|e2e|messages|\.storybook)\//.test(file),
	);
	const guards = guardTests();
	return {
		scope: `tests that import ${code.length} changed file${code.length === 1 ? "" : "s"}, and the ${guards.length} that read the source`,
		steps: [
			{ command: pnpm("exec", "vitest", "related", ...new Set([...code, ...guards]), "--run", ...NODE_PROJECTS) },
		],
	};
}

/** Shared by every story: a change here runs them all. */
const STORY_SETUP =
	/^(\.storybook\/|vitest\.config\.ts|package\.json|pnpm-lock\.yaml|src\/(styles|lib|hooks|paraglide)\/|src\/components\/ui\/|messages\/)/;

/** The folders whose stories a change is near: its feature, or its folder under src/components. */
function storyFolders(): string[] | "all" {
	if (full || any(STORY_SETUP)) return "all";
	const folders = new Set<string>();
	for (const file of present) {
		const match = /^(src\/(?:features|components)\/[^/]+)\//.exec(file);
		if (match?.[1] && hasStories(match[1])) folders.add(match[1]);
	}
	return [...folders].sort();
}
function hasStories(dir: string): boolean {
	return readdirSync(dir, { withFileTypes: true }).some((entry) =>
		entry.isDirectory() ? hasStories(`${dir}/${entry.name}`) : /\.stories\.tsx?$/.test(entry.name),
	);
}

function storyPlan(command: string[]): Plan {
	const folders = storyFolders();
	if (folders === "all") return whole(...command);
	if (folders.length === 0) return { scope: "no story is near a changed file", skip: true };
	return { scope: folders.join(", "), steps: [{ command, env: { STORIES_ONLY: folders.join(",") } }] };
}

/** A change here can show on any page. */
const PAGE_SETUP =
	/^(src\/(components|lib|hooks|styles|server\/(?!taskline|parda|chaal|kharcha|portfolio|apps))|src\/(router|routes\/__root|start|server)\.tsx?$|e2e\/(support|harness)\/|playwright\.config\.ts|messages\/|vite\.config\.ts|vite\/|package\.json|pnpm-lock\.yaml|drizzle\/)/;

/** Stories and unit tests are in no page. */
const NOT_A_PAGE = /\.(stories|test)\.tsx?$/;

/** Words that name a changed layer or flow; Playwright's --grep finds them in page paths, titles and file names. */
function e2eWords(): string[] {
	const words = new Set<string>();
	for (const file of files.filter((each) => !NOT_A_PAGE.test(each))) {
		const layer = /^src\/(?:features|functions|server)\/([a-z0-9-]+)\//.exec(file)?.[1];
		if (layer && !/^(db|auth|email|attachments|routes|plugins)$/.test(layer)) words.add(layer.replace(/-admin$/, ""));
		const route = /^src\/routes\/(?:_[a-z]+\/)*_?([a-z0-9-]+)/.exec(file)?.[1];
		if (route) words.add(route);
		const flow = /^e2e\/flows\/([a-z0-9-]+)\.spec\.ts$/.exec(file)?.[1];
		if (flow) words.add(`flows.${flow}\\.spec`);
	}
	return [...words].sort();
}

function e2ePlan(): Plan {
	const playwright = pnpm("exec", "playwright", "test");
	if (full) return whole(...pnpm("test:e2e"));
	const asked = option("e2e");
	if (asked) return { scope: `--grep "${asked}"`, steps: [{ command: [...playwright, "--grep", asked] }] };
	const words = e2eWords();
	const steps: Step[] = [];
	const scope: string[] = [];
	if (words.length > 0) {
		// In brackets, so Git Bash doesn't take a leading slash for a path; here there is none, but the rule holds.
		steps.push({ command: [...playwright, "--grep", `(${words.join("|")})`] });
		scope.push(`pages and flows matching ${words.join(", ")}`);
	}
	if (files.some((file) => PAGE_SETUP.test(file) && !NOT_A_PAGE.test(file))) {
		// Shared code: every page once (English, light, 1280), not in its twelve variants.
		steps.push({ command: [...playwright, "--project", "review", "--grep", "light 1280 en$"] });
		scope.push("every page once (shared code changed)");
	}
	if (steps.length === 0) return { scope: "no changed file is part of a page or a flow", skip: true };
	return { scope: scope.join("; "), steps };
}

function checkPlan(): Plan {
	if (full) return whole(...pnpm("check"));
	// A long list overflows Windows' command line; Biome is quick over everything anyway.
	if (present.length === 0 || present.length > 150) return whole(...pnpm("check"));
	return {
		scope: `${present.length} changed file${present.length === 1 ? "" : "s"}`,
		steps: [{ command: pnpm("check", "--no-errors-on-unmatched", "--files-ignore-unknown=true", ...present) }],
	};
}

const GATES: Array<[name: string, plan: () => Plan]> = [
	[
		"typecheck",
		() => ({ scope: full ? "everything" : "what changed (incremental)", steps: [{ command: pnpm("typecheck") }] }),
	],
	["check", checkPlan],
	["knip", () => whole(...pnpm("knip"))],
	["i18n", () => whole(...pnpm("i18n:check"))],
	["test", testPlan],
	["storybook", () => storyPlan(pnpm("test:storybook"))],
	["build", () => whole(...pnpm("build"))],
	["bundle", () => whole("node", "scripts/check-bundle.ts")],
	["build-storybook", () => storyPlan(pnpm("build-storybook"))],
	["e2e", e2ePlan],
];

const only = list("only");
const skipped = list("skip");
const unknown = [...only, ...skipped].filter((name) => !GATES.some(([gate]) => gate === name));
if (unknown.length > 0) {
	console.error(
		`[gates] no gate is called ${unknown.join(", ")}. The gates: ${GATES.map(([name]) => name).join(", ")}.`,
	);
	process.exit(2);
}
const chosen = GATES.filter(([name]) => (only.length === 0 || only.includes(name)) && !skipped.includes(name));

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

const quote = (word: string) => (/[\s"|()$^&<>]/.test(word) ? `"${word.replaceAll('"', '\\"')}"` : word);
const show = (step: Step) =>
	[...Object.entries(step.env ?? {}).map(([key, value]) => `${key}=${value}`), ...step.command.map(quote)].join(" ");

function run(step: Step): Promise<number> {
	return new Promise((resolve) => {
		// Through the shell: `pnpm` is a script on Windows. Every word is quoted for it.
		const child = spawn(step.command.map(quote).join(" "), {
			stdio: "inherit",
			shell: true,
			env: { ...process.env, ...step.env },
		});
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}

/** The share of processor time that was not idle over one second, all threads together. */
async function busyPercent() {
	const read = () =>
		os.cpus().reduce(
			(sum, cpu) => ({
				idle: sum.idle + cpu.times.idle,
				all: sum.all + Object.values(cpu.times).reduce((a, b) => a + b, 0),
			}),
			{ idle: 0, all: 0 },
		);
	const before = read();
	await new Promise((resolve) => setTimeout(resolve, 1000));
	const after = read();
	const all = after.all - before.all;
	return all === 0 ? 0 : Math.round((1 - (after.idle - before.idle) / all) * 100);
}

/**
 * An e2e server left on its port is reused by Playwright (and wanted, between runs). When it was
 * built from other source than today's, the suite would test the old build: stop it first.
 */
async function stopStaleServer() {
	let run: { build?: string } | undefined;
	try {
		run = (await (await fetch(`${E2E.harnessURL}/e2e/run`, { signal: AbortSignal.timeout(2000) })).json()) as {
			build?: string;
		};
	} catch {
		return; // Nothing is listening: Playwright starts one.
	}
	if (run.build === buildCache(E2E_PUBLIC_ENV).hash) return;
	console.log("[gates] the e2e server on the port was built from older source: stopping it, a new one will be built");
	clean({ quiet: true, only: /e2e[\\/]harness[\\/]server\.ts|\.output[\\/]server[\\/]index\.mjs/ });
	await new Promise((resolve) => setTimeout(resolve, 1500));
}

const seconds = (ms: number) =>
	ms >= 60_000 ? `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;

type Row = { gate: string; scope: string; result: "passed" | "FAILED" | "nothing to run" | "not run"; ms: number };
const rows: Row[] = [];
const plans = chosen.map(([name, plan]) => [name, plan()] as const);

console.log(
	full
		? "[gates] every suite in full"
		: `[gates] narrowed to ${files.length} file${files.length === 1 ? "" : "s"} changed since ${changed.since}`,
);
if (flag("list")) {
	for (const [name, plan] of plans) {
		console.log(`\n${name}: ${plan.scope}`);
		if (!("skip" in plan)) for (const step of plan.steps) console.log(`  ${show(step)}`);
	}
	process.exit(0);
}

const busy = await busyPercent();
if (busy > 15)
	console.warn(`[gates] the machine is ${busy}% busy before the first gate: the times below include that load`);
const freeMb = Math.round(os.freemem() / 1024 / 1024);
if (freeMb < 3000)
	console.warn(`[gates] ${freeMb} MB of memory is free: the suites will run on fewer workers (scripts/lib/workers.ts)`);

let failed = false;
for (const [name, plan] of plans) {
	if (failed && !flag("keep-going")) {
		rows.push({ gate: name, scope: plan.scope, result: "not run", ms: 0 });
		continue;
	}
	if ("skip" in plan) {
		rows.push({ gate: name, scope: plan.scope, result: "nothing to run", ms: 0 });
		continue;
	}
	console.log(`\n[gates] ${name}: ${plan.scope}`);
	if (name === "e2e") await stopStaleServer();
	const started = performance.now();
	let exitCode = 0;
	for (const step of plan.steps) {
		console.log(`[gates] $ ${show(step)}`);
		exitCode = await run(step);
		if (exitCode !== 0) break;
	}
	const ms = performance.now() - started;
	rows.push({ gate: name, scope: plan.scope, result: exitCode === 0 ? "passed" : "FAILED", ms });
	if (exitCode !== 0) failed = true;
}

const total = rows.reduce((sum, row) => sum + row.ms, 0);
const width = (key: "gate" | "result") => Math.max(...rows.map((row) => row[key].length), key.length);
console.log(`\n${"gate".padEnd(width("gate"))}  ${"result".padEnd(width("result"))}  ${"time".padStart(12)}  scope`);
for (const row of rows) {
	console.log(
		`${row.gate.padEnd(width("gate"))}  ${row.result.padEnd(width("result"))}  ${(row.ms ? seconds(row.ms) : "").padStart(12)}  ${row.scope}`,
	);
}
console.log(`${"total".padEnd(width("gate"))}  ${"".padEnd(width("result"))}  ${seconds(total).padStart(12)}`);

mkdirSync(path.join(".data", "gates"), { recursive: true });
writeFileSync(
	path.join(".data", "gates", "last.json"),
	`${JSON.stringify({ at: new Date().toISOString(), full, changed: files.length, rows }, null, "\t")}\n`,
);
process.exit(failed ? 1 : 0);
