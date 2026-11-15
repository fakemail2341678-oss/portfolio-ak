/**
 * How many workers a test suite may start on this machine, from its free memory and its
 * processors, so no run needs a `--maxWorkers` or `--workers` flag (Part 9 Task 99, decision 0296).
 *
 * The suites are bound by memory, not by processors: with Vitest's and Playwright's own defaults
 * (one worker per processor, or half of them) a 12-thread laptop with 11.7 GB ran out of memory
 * and the runs were killed, leaving their browsers behind. Each suite's numbers below are its
 * measured peak (docs/guides/testing.md, "How long the gates take").
 *
 * `GATE_WORKERS=<n>` overrides the answer for every suite; a `--maxWorkers`/`--workers` flag
 * still overrides the config.
 */
import os from "node:os";

type Suite = "unit" | "components" | "server" | "storybook" | "e2e";

const MB = 1024 * 1024;

/**
 * `base`: what the suite holds whatever the worker count (the runner, Vite, the production server
 * and its database). `each`: one more worker at its peak. `most`: no gain was measured beyond it.
 */
const COST: Record<Suite, { base: number; each: number; most: number }> = {
	// Measured on worker threads at two workers and at the most (MB, seconds):
	// unit 1,293 and 2,057 at eight (12 s and 11 s: four is enough);
	unit: { base: 1100, each: 150, most: 4 },
	// components 1,122 and 2,307 at six (49 s and 24 s);
	components: { base: 600, each: 300, most: 6 },
	// server 1,783 and 3,815 at six (106 s and 60 s).
	server: { base: 800, each: 520, most: 6 },
	// One pass of the stories, by how far the machine's free memory fell: 3.6 GB at one page, 4.5 GB
	// at two, about 5.4 GB at three (84 s, 50 s and 48 s; four gained nothing). The base is large
	// because a page keeps what its story files loaded until Chrome collects it: one page that runs
	// all 77 files grows to 2.3 GB, each of two to 1.6 GB. Three pages started with 5.4 GB free left
	// 374 MB, and a story failed for it.
	storybook: { base: 2700, each: 900, most: 3 },
	// e2e: the production server 510, the harness 270 and the runner 250; a worker is a Node process
	// (up to 650) and its Chrome (700). Four is what CI's runners have processors for.
	e2e: { base: 1000, each: 1150, most: 4 },
};

/** Left for the editor, the browser and the system, so a run never takes the last of the memory. */
const KEEP_FREE_MB = 1024;

export function workersFor(suite: Suite): number {
	const forced = Number(process.env.GATE_WORKERS);
	if (Number.isInteger(forced) && forced >= 1) return forced;
	const { base, each, most } = COST[suite];
	const byMemory = Math.floor((os.freemem() / MB - KEEP_FREE_MB - base) / each);
	// Vitest's main thread transforms what its workers import, so one processor stays with it. An e2e
	// worker waits on its browser most of the time: CI's four processors run four.
	const byProcessors = suite === "e2e" ? os.availableParallelism() : os.availableParallelism() - 1;
	return Math.max(1, Math.min(byMemory, byProcessors, most));
}
