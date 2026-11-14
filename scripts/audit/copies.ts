/**
 * Audit: code that exists twice, within a layer and across layers (jscpd). The copies across
 * layers are the candidates for the core (Task 108).
 *
 *   node scripts/audit/copies.ts      (downloads jscpd with `pnpm dlx` the first time)
 *
 * A copy is 12 lines and 90 tokens or more that match exactly. Stories, generated code and the
 * shadcn files are left out.
 *
 * Prints counts and writes docs/history/part9-audit/copies.json.
 * Part 9 Task 98.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { layerOf, PRODUCTS, print, read, save, tally, walk } from "./lib.ts";

const OUT = ".data/audit/jscpd";
const MIN_LINES = 12;
const MIN_TOKENS = 90;

type Side = { name: string; start: number; end: number };
type Report = {
	duplicates: Array<{ lines: number; tokens: number; firstFile: Side; secondFile: Side }>;
	statistics: {
		total: { lines: number; sources: number; clones: number; duplicatedLines: number; percentage: number };
	};
};

if (!process.argv.includes("--reuse") || !existsSync(`${OUT}/jscpd-report.json`)) {
	const ignore = ["**/*.stories.tsx", "**/paraglide/**", "**/routeTree.gen.ts", "**/components/ui/**"].join(",");
	const command = `pnpm dlx jscpd@4 src --min-lines ${MIN_LINES} --min-tokens ${MIN_TOKENS} --format "typescript,tsx" --ignore "${ignore}" --reporters json --output ${OUT} --silent`;
	const run = spawnSync(command, { shell: true, stdio: "inherit" });
	if (run.status !== 0) process.exit(run.status ?? 1);
}

const report = JSON.parse(read(`${OUT}/jscpd-report.json`)) as Report;
const tidy = (name: string) => name.split("\\").join("/");
const copies = report.duplicates
	.map((copy) => {
		const first = tidy(copy.firstFile.name);
		const second = tidy(copy.secondFile.name);
		const layers = [layerOf(first), layerOf(second)].sort();
		return {
			lines: copy.lines,
			tokens: copy.tokens,
			first: `${first}:${copy.firstFile.start}-${copy.firstFile.end}`,
			second: `${second}:${copy.secondFile.start}-${copy.secondFile.end}`,
			pair: layers[0] === layers[1] ? `within ${layers[0]}` : `${layers[0]} and ${layers[1]}`,
			across: layers[0] !== layers[1],
			sameFile: first === second,
		};
	})
	.sort((a, b) => b.lines - a.lines);
const across = copies.filter((copy) => copy.across);
const lines = (items: typeof copies) => items.reduce((sum, copy) => sum + copy.lines, 0);
/** `src/features/kharcha/settle/x.tsx` gives `kharcha/settle`: which modules repeat each other. */
const moduleOf = (location: string) => location.split(":")[0]?.split("/").slice(2, 4).join("/") ?? "";

const total = report.statistics.total;
print("Copies (jscpd)", {
	"files read": total.sources,
	"lines read": total.lines,
	copies: copies.length,
	"copied lines": total.duplicatedLines,
	"share of all lines": `${total.percentage}%`,
	"copies across two layers": across.length,
	"…their lines": lines(across),
});
print(
	"Copies by layers",
	tally(copies, (copy) => copy.pair),
	40,
);
print(
	"Copied lines by layers",
	Object.fromEntries(
		Object.keys(tally(copies, (copy) => copy.pair))
			.map((pair): [string, number] => [pair, lines(copies.filter((copy) => copy.pair === pair))])
			.sort((a, b) => b[1] - a[1]),
	),
	40,
);
print(
	"Across layers: which modules repeat each other",
	tally(across, (copy) => [moduleOf(copy.first), moduleOf(copy.second)].sort().join(" = ")),
	30,
);

// The same pattern under other names: a file that three or four products each have under the same path
// (the product's name in a file name counts as the same).
const paths = new Map<string, Set<string>>();
for (const product of PRODUCTS) {
	for (const root of [`src/features/${product}`, `src/server/${product}`]) {
		if (!existsSync(root)) continue;
		for (const file of walk(root)) {
			if (file.endsWith(".stories.tsx")) continue;
			const kind = root.startsWith("src/server") ? "server" : "features";
			const key = `src/${kind}/<product>/${file
				.slice(root.length + 1)
				.split(product)
				.join("<product>")}`;
			paths.set(key, (paths.get(key) ?? new Set()).add(product));
		}
	}
}
const samePath = [...paths]
	.filter(([, products]) => products.size >= 3)
	.map(([path, products]) => ({ path, products: [...products] }))
	.sort((a, b) => a.path.localeCompare(b.path));
print("Files three or four products each have under the same path", { total: samePath.length });

save("copies", {
	generated: "node scripts/audit/copies.ts",
	minLines: MIN_LINES,
	minTokens: MIN_TOKENS,
	total,
	byLayers: tally(copies, (copy) => copy.pair),
	acrossLayers: { copies: across.length, lines: lines(across), list: across },
	largestWithinALayer: copies.filter((copy) => !copy.across).slice(0, 80),
	samePathAcrossProducts: samePath,
});
