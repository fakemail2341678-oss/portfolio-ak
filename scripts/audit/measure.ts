/**
 * Runs one command and records its wall time and the peak memory of its process tree.
 *
 *   node scripts/audit/measure.ts <label> [--out=<file.json>] [--with-pid=<pid>]… -- <command…>
 *
 * - The record goes into docs/history/part9-audit/gates.json (or --out), replacing an earlier
 *   record with the same label.
 * - The command's output goes to .data/audit/logs/<label>.log; only its last lines are printed.
 * - `--with-pid` adds a process that is already running (the e2e harness server) to the tree.
 * - Exits with the command's exit code.
 *
 * Memory is the sum of the working sets (resident sizes) of the command and every process it
 * started, sampled every 1.5 s, so pages shared between processes are counted more than once.
 * "Least free" is the machine's free physical memory at its lowest sample.
 *
 * Part 9 Task 98 (the baseline every later number is compared with).
 */
import { execFile, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** `created`: when the process started, in ms. It tells a process from a later one that got the same pid. */
type Process = { pid: number; parent: number; bytes: number; created: number };
type GateRecord = {
	label: string;
	command: string;
	startedAt: string;
	wallMs: number;
	exitCode: number;
	peakTreeMb: number;
	peakProcesses: number;
	leastFreeMb: number;
	/** How busy the machine's processors were in the second before the command started, in percent. */
	busyBeforePercent: number;
	samples: number;
	machine: { platform: string; node: string; threads: number; memoryMb: number };
};

const SAMPLE_MS = 1500;
/** Above this, something else is using the machine and the time measured is not the command's own. */
const BUSY_WARNING_PERCENT = 15;
const TAIL_LINES = 15;
const MB = 1024 * 1024;

const args = process.argv.slice(2);
const split = args.indexOf("--");
const label = args[0];
if (!label || label.startsWith("--") || split < 1 || split === args.length - 1) {
	console.error("Usage: node scripts/audit/measure.ts <label> [--out=<file.json>] [--with-pid=<pid>] -- <command…>");
	process.exit(2);
}
const options = args.slice(1, split);
const option = (name: string) =>
	options.filter((item) => item.startsWith(`--${name}=`)).map((item) => item.slice(name.length + 3));
const outFile = option("out")[0] ?? "docs/history/part9-audit/gates.json";
const extraRoots = option("with-pid").map(Number).filter(Number.isInteger);
const command = args.slice(split + 1).join(" ");

const logFile = path.join(".data", "audit", "logs", `${label}.log`);
mkdirSync(path.dirname(logFile), { recursive: true });
mkdirSync(path.dirname(outFile), { recursive: true });

/** Every process on the machine: Windows asks CIM in one long-lived PowerShell, the rest ask `ps`. */
function watchProcesses(onSample: (processes: Process[]) => void) {
	if (process.platform === "win32") {
		const script = [
			"while ($true) {",
			"  Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,CreationDate |",
			"    ForEach-Object {",
			"      $created = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }",
			"      'P ' + $_.ProcessId + ' ' + $_.ParentProcessId + ' ' + $_.WorkingSetSize + ' ' + $created",
			"    }",
			"  'E'",
			`  Start-Sleep -Milliseconds ${SAMPLE_MS}`,
			"}",
		].join("\n");
		const shell = spawn(
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
			{ stdio: ["ignore", "pipe", "ignore"] },
		);
		let pending = "";
		let current: Process[] = [];
		shell.stdout.setEncoding("utf8");
		shell.stdout.on("data", (chunk: string) => {
			const lines = (pending + chunk).split(/\r?\n/);
			pending = lines.pop() ?? "";
			for (const line of lines) {
				if (line === "E") {
					onSample(current);
					current = [];
					continue;
				}
				const [kind, pid, parent, bytes, created] = line.split(" ");
				if (kind === "P") {
					current.push({ pid: Number(pid), parent: Number(parent), bytes: Number(bytes), created: Number(created) });
				}
			}
		});
		return () => shell.kill();
	}
	const timer = setInterval(() => {
		execFile("ps", ["-eo", "pid=,ppid=,rss="], (error, stdout) => {
			if (error) return;
			onSample(
				stdout
					.split("\n")
					.map((line) => line.trim().split(/\s+/).map(Number))
					.filter((cells) => cells.length === 3)
					.map(([pid = 0, parent = 0, kb = 0]) => ({ pid, parent, bytes: kb * 1024, created: 0 })),
			);
		});
	}, SAMPLE_MS);
	return () => clearInterval(timer);
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
const busyBeforePercent = await busyPercent();
if (busyBeforePercent > BUSY_WARNING_PERCENT) {
	console.warn(
		`[measure] the machine is ${busyBeforePercent}% busy before the command starts: the time below includes that load`,
	);
}

const started = Date.now();
const startedAt = new Date(started).toISOString();
const log = createWriteStream(logFile);
const tail: string[] = [];
const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] });

const keep = (chunk: Buffer) => {
	log.write(chunk);
	for (const line of chunk.toString("utf8").split(/\r?\n/)) {
		if (line.trim() === "") continue;
		tail.push(line);
		if (tail.length > TAIL_LINES) tail.shift();
	}
};
child.stdout.on("data", keep);
child.stderr.on("data", keep);

/**
 * The command's tree so far, as pid and start time. A process stays in it after its parent exits.
 * A pid that comes back with another start time is another program (Windows reuses pids within
 * seconds), and a process older than its parent is not its child: both stay out.
 */
const tree = new Map<number, number>();
const roots = new Set<number>([...(child.pid ? [child.pid] : []), ...extraRoots]);
let peakBytes = 0;
let peakProcesses = 0;
let leastFree = os.freemem();
let samples = 0;

const stopWatching = watchProcesses((processes) => {
	const alive = new Map(processes.map((item) => [item.pid, item.created]));
	for (const [pid, created] of tree) if (alive.get(pid) !== created) tree.delete(pid);
	// A root is taken the first time it is seen, never again: its pid may be another program's later.
	for (const pid of roots) {
		const created = alive.get(pid);
		if (created === undefined) continue;
		tree.set(pid, created);
		roots.delete(pid);
	}
	let grew = true;
	while (grew) {
		grew = false;
		for (const item of processes) {
			const parentCreated = tree.get(item.parent);
			if (parentCreated !== undefined && !tree.has(item.pid) && item.created >= parentCreated) {
				tree.set(item.pid, item.created);
				grew = true;
			}
		}
	}
	let bytes = 0;
	for (const item of processes) if (tree.has(item.pid)) bytes += item.bytes;
	peakBytes = Math.max(peakBytes, bytes);
	peakProcesses = Math.max(peakProcesses, tree.size);
	leastFree = Math.min(leastFree, os.freemem());
	samples += 1;
});

const duration = (ms: number) => {
	const seconds = Math.round(ms / 1000);
	return seconds < 60 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

child.on("close", (code) => {
	stopWatching();
	log.end();
	const record: GateRecord = {
		label,
		command,
		startedAt,
		wallMs: Date.now() - started,
		exitCode: code ?? 1,
		peakTreeMb: Math.round(peakBytes / MB),
		peakProcesses,
		leastFreeMb: Math.round(leastFree / MB),
		busyBeforePercent,
		samples,
		machine: {
			platform: `${process.platform} ${os.release()}`,
			node: process.version,
			threads: os.availableParallelism(),
			memoryMb: Math.round(os.totalmem() / MB),
		},
	};
	const earlier = existsSync(outFile) ? (JSON.parse(readFileSync(outFile, "utf8")) as GateRecord[]) : [];
	const records = [...earlier.filter((item) => item.label !== label), record];
	writeFileSync(outFile, `${JSON.stringify(records, null, "\t")}\n`);

	console.log(tail.join("\n"));
	console.log(
		`\n[measure] ${label}: ${duration(record.wallMs)}, peak ${record.peakTreeMb} MB in ${peakProcesses} processes, ` +
			`least free ${record.leastFreeMb} MB, ${busyBeforePercent}% busy before, exit ${record.exitCode} (log ${logFile})`,
	);
	process.exit(record.exitCode);
});
