import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	LAYERS,
	LEGACY_MARKER,
	markerProblems,
	RECORDS,
	stripLayer,
	TEXT,
	TOOL,
} from "../../scripts/lib/strip-markers";

/** Every tracked text file `pnpm strip-demo` would read (scripts/strip-demo.ts). */
const files = () =>
	execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
		.split("\0")
		.filter((file) => file && TEXT.test(file) && !RECORDS.test(file) && existsSync(file) && statSync(file).isFile())
		.map((file) => ({ file, content: readFileSync(file, "utf8") }));

describe("strip-demo markers", () => {
	it("every block is balanced, per layer (and the script's own)", () => {
		const problems = files().flatMap(({ file, content }) =>
			[...LAYERS, TOOL].flatMap((layer) => markerProblems(content, layer).map((problem) => `${file} ${problem}`)),
		);
		expect(problems).toEqual([]);
	});

	it("no Part 3 `demo` marker is left (they became portfolio markers, or core)", () => {
		expect(
			files()
				.filter(({ content }) => LEGACY_MARKER.test(content))
				.map(({ file }) => file),
		).toEqual([]);
	});

	it("removes a layer's blocks and lines, and leaves prose and other layers alone", () => {
		const source = [
			'import { a } from "a";',
			'import { b } from "b"; // @portfolio',
			"// portfolio:start",
			"const onlyPortfolio = 1;",
			"// portfolio:end",
			"{/* apps:start */}",
			"<Apps />",
			"{/* apps:end */}",
			"A mention of `portfolio:start` in prose stays.",
			"| row | <!-- @portfolio -->",
		].join("\n");
		expect(stripLayer(source, "portfolio")).toBe(
			[
				'import { a } from "a";',
				"{/* apps:start */}",
				"<Apps />",
				"{/* apps:end */}",
				"A mention of `portfolio:start` in prose stays.",
			].join("\n"),
		);
		expect(stripLayer('import { a } from "a";', "portfolio")).toBeNull();
		expect(markerProblems("// portfolio:start\n// portfolio:start\n// portfolio:end", "portfolio")).toHaveLength(1);
		expect(markerProblems("// apps:end", "apps")).toHaveLength(1);
	});
});
