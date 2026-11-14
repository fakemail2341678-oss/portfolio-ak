/**
 * Audit: every dependency's installed version against the registry's latest, and how much of
 * the app imports it.
 *
 *   node scripts/audit/libraries.ts      (asks the npm registry: needs the network)
 *
 * Deprecated APIs in use are `deprecated.ts`'s job; whether our use matches each library's
 * docs is written by hand in docs/history/part9-audit.md from these two lists.
 *
 * Prints counts and writes docs/history/part9-audit/libraries.json.
 * Part 9 Task 98.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { print, read, save, sourceFiles, tally } from "./lib.ts";

type Outdated = Record<
	string,
	{ current?: string; latest?: string; wanted?: string; isDeprecated?: boolean; dependencyType?: string }
>;
type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const manifest = JSON.parse(read("package.json")) as Manifest;
const declared = { ...manifest.dependencies, ...manifest.devDependencies };

// `pnpm outdated` exits 1 when anything is outdated: its JSON is still the answer.
const run = spawnSync("pnpm outdated --format json", { shell: true, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
// A slow registry answer prints a warning line first: the JSON starts at the first line that is "{".
const start = run.stdout.search(/^\{/m);
const outdated = JSON.parse(start === -1 ? "{}" : run.stdout.slice(start)) as Outdated;

const installed = (name: string) => {
	const file = `node_modules/${name}/package.json`;
	return existsSync(file) ? ((JSON.parse(read(file)) as { version?: string }).version ?? "?") : "?";
};
const major = (version: string) => Number(version.replace(/^[^\d]*/, "").split(".")[0] ?? 0);
const minor = (version: string) => Number(version.replace(/^[^\d]*/, "").split(".")[1] ?? 0);

/** How many source files import each package (`@scope/name/sub` counts for `@scope/name`). */
const importers = new Map<string, number>();
for (const file of sourceFiles({ stories: true, ui: true })) {
	const seen = new Set<string>();
	for (const match of read(file).matchAll(/from\s+"([^".][^"]*)"|import\("([^".][^"]*)"\)/g)) {
		const specifier = match[1] ?? match[2] ?? "";
		if (specifier.startsWith("@/") || specifier.startsWith("node:")) continue;
		const parts = specifier.split("/");
		seen.add(specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? ""));
	}
	for (const name of seen) importers.set(name, (importers.get(name) ?? 0) + 1);
}

const rows = Object.keys(declared)
	.sort()
	.map((name) => {
		const current = installed(name);
		const latest = outdated[name]?.latest ?? current;
		const behind =
			latest === current
				? "current"
				: major(latest) > major(current)
					? "major"
					: minor(latest) > minor(current)
						? "minor"
						: "patch";
		return {
			name,
			declared: declared[name] ?? "",
			installed: current,
			latest,
			behind,
			deprecated: outdated[name]?.isDeprecated ?? false,
			dev: Boolean(manifest.devDependencies?.[name]),
			importedBy: importers.get(name) ?? 0,
		};
	});

print("Dependencies", {
	declared: rows.length,
	runtime: rows.filter((row) => !row.dev).length,
	dev: rows.filter((row) => row.dev).length,
	"marked deprecated by the registry": rows.filter((row) => row.deprecated).length,
});
print(
	"Behind the latest release",
	tally(rows, (row) => row.behind),
);
print(
	"A major version behind",
	Object.fromEntries(
		rows.filter((row) => row.behind === "major").map((row) => [row.name, `${row.installed} -> ${row.latest}`]),
	),
	40,
);
print(
	"A minor version behind",
	Object.fromEntries(
		rows.filter((row) => row.behind === "minor").map((row) => [row.name, `${row.installed} -> ${row.latest}`]),
	),
	60,
);
print(
	"Runtime dependencies no source file imports (used by config, CSS or the build)",
	Object.fromEntries(rows.filter((row) => !row.dev && row.importedBy === 0).map((row) => [row.name, row.installed])),
	40,
);

save("libraries", { generated: "node scripts/audit/libraries.ts", behind: tally(rows, (row) => row.behind), rows });
