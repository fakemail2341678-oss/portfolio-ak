/**
 * `pnpm test:storybook [vitest arguments]`: every story in real Chrome, twice. English with the
 * light theme, then Nepali with the dark theme (the two browser instances in vitest.config.ts).
 *
 *   pnpm test:storybook                          # both passes
 *   pnpm test:storybook src/features/kharcha     # both passes, those stories only
 *
 * One Vitest process per pass (Part 9 Task 99, decision 0296). In one process the second pass
 * starts while the first one's pages are still open, about 1 GB each: the two together held
 * 8.9 GB and left 15 MB of an 11.7 GB machine free. Apart, the peak is one pass's. Both passes
 * read one dependency cache, so the second starts warm.
 *
 * Both passes always run; the exit code is the first failure's.
 */
import { spawnSync } from "node:child_process";

const PASSES = ["storybook", "storybook-dark-ne"];
const args = process.argv.slice(2);

let exitCode = 0;
for (const pass of PASSES) {
	const run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--project", pass, ...args], {
		stdio: "inherit",
	});
	if (run.status !== 0 && exitCode === 0) exitCode = run.status ?? 1;
}
process.exit(exitCode);
