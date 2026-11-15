/**
 * The editor hook (.claude/settings.json, PostToolUse on Edit and Write): after a session edits a
 * file, Biome formats and lints it, and the standard's rules check it (decision 0297). What is
 * left is handed back to the session as the reason to fix the file before going on.
 *
 * It reads the hook's JSON from stdin (`tool_input.file_path`) and answers on stdout with
 * `{ "decision": "block", "reason": … }` when there is something to fix. It never fails the
 * session: any error of its own is a silent exit.
 *
 *   echo '{"tool_input":{"file_path":"src/lib/utils.ts"}}' | node scripts/standard/hook.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** What Biome reads here, and what the standard's rules read. */
const LINTED = /\.(ts|tsx|mts|mjs|js|jsx|json|css)$/;
const CHECKED = /^(src|tests|drizzle|messages)\//;
/** Enough of an answer to act on; the commands print the rest. */
const LIMIT = 4000;

function editedFile(): string | undefined {
	try {
		const input = JSON.parse(readFileSync(0, "utf8")) as { tool_input?: { file_path?: string } };
		const file = input.tool_input?.file_path;
		if (!file) return undefined;
		const relative = path.relative(root, path.resolve(root, file)).replaceAll("\\", "/");
		return relative.startsWith("..") || path.isAbsolute(relative) ? undefined : relative;
	} catch {
		return undefined;
	}
}

const run = (...args: string[]) => {
	const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
	return { failed: result.status !== 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
};

const file = editedFile();
if (!file || !existsSync(path.join(root, file)) || file.startsWith(".claude/")) process.exit(0);

const problems: string[] = [];
if (LINTED.test(file)) {
	const biome = run(
		"node_modules/@biomejs/biome/bin/biome",
		"check",
		"--write",
		"--error-on-warnings",
		"--no-errors-on-unmatched",
		"--files-ignore-unknown=true",
		"--colors=off",
		file,
	);
	if (biome.failed) problems.push(`Biome (pnpm check) on ${file}:\n${biome.output}`);
}
if (CHECKED.test(file)) {
	const standard = run("scripts/standard.ts", file);
	if (standard.failed) problems.push(`The standard (pnpm standard) on ${file}:${standard.output}`);
}

if (problems.length > 0) {
	const reason = problems.join("\n\n");
	console.log(
		JSON.stringify({
			decision: "block",
			reason: reason.length > LIMIT ? `${reason.slice(0, LIMIT)}\n… (run the command for the rest)` : reason,
		}),
	);
}
