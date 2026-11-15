import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { featureNames, renderTemplates } from "../../../scripts/lib/feature-templates";
import { RULES } from "../../../scripts/standard/rules";
import { memoryTree } from "../../../scripts/standard/tree";
import { FORBIDDEN_IMPORTS } from "../../../scripts/standard/vocabulary";

/** `pnpm new:feature` emits the standard exactly (PLAN Task 100): what its templates make has no deviation. */
describe("the generator's templates follow the standard", () => {
	const variants = [
		{ label: "an admin section", flags: { public: false, localized: false } },
		{ label: "--public --localized", flags: { public: true, localized: true } },
	];

	it.each(variants)("$label", ({ flags }) => {
		const files = renderTemplates("scripts/templates/feature", featureNames("event-logs", "Event logs"), flags);
		expect(files.length).toBeGreaterThan(20);
		const tree = memoryTree(Object.fromEntries(files.map((file) => [file.target, file.content])));
		const found = RULES.flatMap((rule) =>
			rule.check(tree).map((deviation) => `${rule.id}: ${deviation.key}: ${deviation.message}`),
		);
		expect(found).toEqual([]);
	});

	it("names its migration after the layer", () => {
		expect(readFileSync("scripts/new-feature.ts", "utf8")).toMatch(/"--name", `core_\$\{s\}`/);
	});
});

type Override = {
	includes?: string[];
	linter?: { rules?: { style?: { noRestrictedImports?: { options?: { patterns?: Array<{ group: string[] }> } } } } };
};

/** Biome shows a forbidden import on its line in the editor; the standard's test is the authority. They must agree. */
describe("biome.json's import boundaries", () => {
	const overrides = (JSON.parse(readFileSync("biome.json", "utf8")) as { overrides: Override[] }).overrides;
	const folderOf = (include: string) => (include.includes("/components/") ? "components" : include.split("/")[1]);

	it("forbid only what the standard forbids", () => {
		const extra: string[] = [];
		for (const override of overrides) {
			const patterns = override.linter?.rules?.style?.noRestrictedImports?.options?.patterns ?? [];
			for (const include of (override.includes ?? []).filter((item) => !item.startsWith("!"))) {
				const folder = folderOf(include) ?? "";
				for (const group of patterns.flatMap((pattern) => pattern.group)) {
					// src/lib/start needs the Start runtime (0158): a rule of its own, for code that runs in Storybook.
					if (group === "@/lib/start/**") continue;
					const target = group.split("/")[1] ?? "";
					if (!FORBIDDEN_IMPORTS[folder]?.includes(target)) extra.push(`${include} forbids ${group}`);
				}
			}
		}
		expect(extra).toEqual([]);
	});

	it("load plugins that exist", () => {
		const config = JSON.parse(readFileSync("biome.json", "utf8")) as {
			plugins?: string[];
			overrides: Array<{ plugins?: string[] }>;
		};
		const plugins = [...(config.plugins ?? []), ...config.overrides.flatMap((override) => override.plugins ?? [])];
		expect(plugins.length).toBeGreaterThan(0);
		for (const plugin of plugins) expect(readFileSync(plugin, "utf8")).toContain("register_diagnostic");
	});
});
