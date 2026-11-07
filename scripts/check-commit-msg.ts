/**
 * Recipe (docs/guides/recipes.md, "Changelog"; decision 0150): checks that a
 * commit message follows Conventional Commits, so a changelog can be generated
 * from history. Not on by default; turn it on in lefthook.yml:
 *
 *   commit-msg:
 *     commands:
 *       conventional:
 *         run: node scripts/check-commit-msg.ts {1}
 *
 *   node scripts/check-commit-msg.ts .git/COMMIT_EDITMSG
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const COMMIT_TYPES = [
	"feat",
	"fix",
	"docs",
	"style",
	"refactor",
	"perf",
	"test",
	"build",
	"ci",
	"chore",
	"revert",
];

const HEADER = new RegExp(`^(?:${COMMIT_TYPES.join("|")})(?:\\([a-z0-9-]+\\))?!?: \\S.{0,99}$`);
/** Merges, reverts and fixups that git writes itself are let through. */
const GENERATED = /^(?:Merge |Revert "|fixup! |squash! )/;

/** null when the message is fine, otherwise why it isn't. */
export function checkCommitMessage(message: string): string | null {
	const header = message.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
	if (GENERATED.test(header)) return null;
	if (HEADER.test(header)) return null;
	return `"${header}" isn't a Conventional Commit: <type>(<scope>)?: <summary>, type one of ${COMMIT_TYPES.join(", ")} (up to 100 characters).`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const file = process.argv[2];
	if (!file) {
		console.error("usage: node scripts/check-commit-msg.ts <message file>");
		process.exit(2);
	}
	const problem = checkCommitMessage(readFileSync(file, "utf8"));
	if (problem) {
		console.error(problem);
		process.exit(1);
	}
}
