/**
 * node scripts/codemods/part9-structure/paths-in-guides.ts [--write]
 *
 * Part 9 Task 101: the guides name files in short (`board/clock.tsx`, `saved-repository.ts`), which
 * the codemod's path step does not see (it reads whole paths from `src/`). This reads the moves
 * back from git (renames since the commit the codemod ran on) and rewrites a short path when
 * exactly one moved file ends in it, preferring the files of the guide's own layer. What stays
 * ambiguous is printed for a person.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "736a784";
const WRITE = process.argv.includes("--write");

const moves = new Map<string, string>();
const status = execSync(`git diff -M40% -l0 --name-status ${BASE} HEAD`, { encoding: "utf8", maxBuffer: 1e8 });
for (const line of status.split("\n")) {
	const [kind = "", from = "", to = ""] = line.split("\t");
	if (kind.startsWith("R") && /\.tsx?$/.test(from)) moves.set(from, to);
}
const current = new Set(
	execSync("git ls-files src tests e2e scripts", { encoding: "utf8", maxBuffer: 1e8 }).split("\n"),
);
const arrived = new Set(moves.values());
const unmoved = [...current].filter((file) => !arrived.has(file));

/** The layer a guide is about, as the folder name its files carry. */
const layerOf = (guide: string) => guide.replace(/\.md$/, "").replace("portfolio", "portfolio").replace("apps", "apps");

const TOKEN = /`([\w$[\].-]+(?:\/[\w$[\].-]+)*\.tsx?)`/g;
let rewritten = 0;
const open: string[] = [];
for (const guide of [
	...readdirSync("docs/guides").map((name) => `docs/guides/${name}`),
	"CLAUDE.md",
	"AGENTS.md",
	"README.md",
]) {
	if (!guide.endsWith(".md")) continue;
	const layer = layerOf(guide.split("/").at(-1) ?? "");
	const original = readFileSync(guide, "utf8");
	const text = original.replace(TOKEN, (whole, token: string) => {
		// A file that did not move and ends in the same words: the guide may mean that one.
		if (unmoved.some((file) => file === token || file.endsWith(`/${token}`))) return whole;
		let candidates = [...moves.keys()].filter((from) => from === token || from.endsWith(`/${token}`));
		if (candidates.length > 1) {
			const own = candidates.filter((from) => from.split("/").includes(layer));
			if (own.length > 0) candidates = own;
		}
		const targets = new Set(
			candidates.map((from) => {
				const to = moves.get(from) as string;
				const base = from.slice(0, from.length - token.length);
				// Keep as much of the short form as the new path allows: the same number of folders, at least.
				if (to.startsWith(base)) return to.slice(base.length);
				const depth = token.split("/").length;
				return to.split("/").slice(-Math.max(depth, 2)).join("/");
			}),
		);
		if (targets.size === 1) {
			rewritten++;
			return `\`${[...targets][0]}\``;
		}
		if (candidates.length > 0) open.push(`${guide}: \`${token}\` could be ${[...targets].join(" or ")}`);
		return whole;
	});
	if (WRITE && text !== original) writeFileSync(guide, text);
}
console.log(
	`${moves.size} moves read from git; ${rewritten} short paths ${WRITE ? "rewritten" : "would be rewritten"}`,
);
for (const line of open) console.log(line);
