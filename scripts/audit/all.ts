/**
 * Runs the audits that only read the source, one after another, and refreshes their data files
 * in docs/history/part9-audit/ (about a minute in all).
 *
 *   node scripts/audit/all.ts
 *
 * Not run here, because they need a build, a server, the network or minutes of processor time
 * (each file's header has its command): measure.ts, times.ts, coverage.ts, deprecated.ts,
 * libraries.ts, copies.ts, lighthouse.ts, ux.ts. `old-plan.ts` runs last: it reads the others.
 *
 * Part 9 Task 98.
 */
import { spawnSync } from "node:child_process";

const AUDITS = ["structure", "functions", "names", "writes", "reads", "errors", "code", "docs", "modules", "old-plan"];

for (const audit of AUDITS) {
	console.log(`\n━━ ${audit} ${"━".repeat(60 - audit.length)}`);
	const run = spawnSync(process.execPath, [`scripts/audit/${audit}.ts`], { stdio: "inherit" });
	if (run.status !== 0) process.exit(run.status ?? 1);
}
