/**
 * Audit: the hand-written shared modules (the core's libraries, hooks and server helpers), each
 * with its size and how many files import it. The package verdicts in
 * docs/history/part9-audit.md (replace or keep) are written from this list.
 *
 *   node scripts/audit/modules.ts
 *
 * Prints the largest and writes docs/history/part9-audit/modules.json.
 * Part 9 Task 98.
 */
import { exportsOf, print, read, save, sourceFiles } from "./lib.ts";

const SHARED =
	/^src\/(lib|hooks|server\/(http|cache|jobs)|middleware)\/|^src\/server\/[\w-]+\.ts$|^src\/server\/chaal\/lichess\//;

const all = sourceFiles({ stories: true });
const importers = new Map<string, number>();
for (const file of all) {
	const seen = new Set<string>();
	for (const match of read(file).matchAll(/(?:from|import)\s*\(?\s*"(@\/[^"]+)"/g))
		seen.add(`src/${(match[1] ?? "").slice(2)}`);
	for (const target of seen) importers.set(target, (importers.get(target) ?? 0) + 1);
}

const modules = all
	.filter((file) => SHARED.test(file) && !file.endsWith(".stories.tsx"))
	.map((file) => {
		const source = read(file);
		const base = file.replace(/\.tsx?$/, "");
		return {
			file,
			lines: source.split("\n").length,
			exports: exportsOf(file).filter((item) => item.kind === "value").length,
			importedBy: importers.get(base.replace(/\/index$/, "")) ?? 0,
			timers: (source.match(/\bset(Timeout|Interval)\(/g) ?? []).length,
		};
	})
	.sort((a, b) => b.lines - a.lines);

print("Shared hand-written modules", {
	files: modules.length,
	lines: modules.reduce((sum, item) => sum + item.lines, 0),
	"imported by no file through @/ (relative imports are not counted)": modules.filter((item) => item.importedBy === 0)
		.length,
});
print(
	"Largest (lines, then files that import it)",
	Object.fromEntries(modules.slice(0, 45).map((item) => [`${item.file} (${item.importedBy})`, item.lines])),
	45,
);

save("modules", { generated: "node scripts/audit/modules.ts", modules });
