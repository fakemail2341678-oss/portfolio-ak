/**
 * Audit: folders, file names, exports and tests against the standard (docs/PLAN.md 15.5).
 *
 *   node scripts/audit/structure.ts
 *
 * Prints counts and writes docs/history/part9-audit/structure.json with the full lists.
 * Part 9 Task 98; Task 100 turns these checks into tests with a list of known deviations.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { exportsOf, type Layer, layerOf, print, save, sourceFiles, tally, walk } from "./lib.ts";

/** The files a feature folder may hold beside `components/` and `lib/` (15.5). */
const FEATURE_FILES = new Set([
	"schema.ts",
	"search.ts",
	"keys.ts",
	"queries.ts",
	"collection.ts",
	"columns.tsx",
	"filters.tsx",
	"labels.ts",
	"constants.ts",
	"types.ts",
	"links.ts",
	"commands.ts",
]);
const COMPONENT_ROLES = ["page", "list", "detail", "form", "dialog", "sheet", "panel", "card", "field", "menu"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*(\.(stories|test|server|client|browser))?$/;

const files = sourceFiles({ stories: true });
const base = (file: string) => path.posix.basename(file);
const stem = (file: string) => base(file).replace(/\.(tsx?|mts)$/, "");
const lastWord = (name: string) => name.split("-").at(-1) ?? name;
/** The last word of a camel-case name; "CONSTANT" for `UPPER_CASE` names. */
const camelTail = (name: string) =>
	/^[A-Z0-9_]+$/.test(name) ? "CONSTANT" : (name.match(/[A-Z][a-z0-9]*$/)?.[0] ?? name);

// --- Feature folders ---------------------------------------------------------------------------

type Folder = { folder: string; layer: Layer; odd: string[]; looseComponents: string[]; components: boolean };

/** Every folder under src/features that is a feature or a module: not `components/`, `lib/` or inside one. */
function featureFolders(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "components" || entry.name === "lib") continue;
		found.push(`${dir}/${entry.name}`, ...featureFolders(`${dir}/${entry.name}`));
	}
	return found;
}

const folders: Folder[] = featureFolders("src/features").map((folder) => {
	const own = readdirSync(folder, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name);
	return {
		folder,
		layer: layerOf(folder),
		odd: own.filter((name) => name.endsWith(".ts") && !FEATURE_FILES.has(name)),
		looseComponents: own.filter((name) => name.endsWith(".tsx") && !FEATURE_FILES.has(name)),
		components: existsSync(`${folder}/components`),
	};
});
const inShape = (folder: Folder) => folder.odd.length === 0 && folder.looseComponents.length === 0;

print(
	"Feature folders in the 15.5 shape, of all, by layer",
	Object.fromEntries(
		[...new Set(folders.map((folder) => folder.layer))].map((layer) => {
			const own = folders.filter((folder) => folder.layer === layer);
			return [layer, `${own.filter(inShape).length}/${own.length}`];
		}),
	),
);
print(
	"Components (.tsx, stories too) beside the data files instead of in components/, by layer",
	tally(
		folders.flatMap((folder) => folder.looseComponents.map(() => folder.layer)),
		(layer) => layer,
	),
);
const oddNames = tally(
	folders.flatMap((folder) => folder.odd),
	(name) => name,
);
print("File names in feature folders outside the list (.ts)", oddNames, 30);

// --- File names --------------------------------------------------------------------------------

const notKebab = files.filter((file) => !file.startsWith("src/routes/") && !KEBAB.test(stem(file)));
print("Files not in kebab-case (routes have their own grammar)", { total: notKebab.length });

const featureComponents = files.filter(
	(file) => file.startsWith("src/features/") && file.endsWith(".tsx") && !file.endsWith(".stories.tsx"),
);
const withRole = featureComponents.filter((file) => COMPONENT_ROLES.includes(lastWord(stem(file))));
print("Feature components named <thing>-<role>.tsx", {
	"with a role from the list": withRole.length,
	"all feature components": featureComponents.length,
});
const lastWords = tally(
	featureComponents.filter((file) => !withRole.includes(file)),
	(file) => lastWord(stem(file)),
);
print("Last word of the other component file names", lastWords, 30);

// --- Hooks -------------------------------------------------------------------------------------

const hookExports = files
	.filter((file) => !file.endsWith(".stories.tsx"))
	.flatMap((file) =>
		exportsOf(file)
			.filter((item) => item.kind === "value" && /^use[A-Z]/.test(item.name))
			.map((item) => ({ file, name: item.name, line: item.line })),
	);
const hooksElsewhere = hookExports.filter((hook) => !base(hook.file).startsWith("use-"));
print("Exported hooks", {
	"in a use-<thing> file": hookExports.length - hooksElsewhere.length,
	"in a file with another name": hooksElsewhere.length,
});

// --- Exports -----------------------------------------------------------------------------------

type Naming = { file: string; name: string };
const named = (fileName: string | RegExp, kind: "value" | "type") =>
	files
		.filter((file) => (typeof fileName === "string" ? base(file) === fileName : fileName.test(base(file))))
		.flatMap((file) =>
			exportsOf(file)
				.filter((item) => item.kind === kind)
				.map((item): Naming => ({ file, name: item.name })),
		);

const keyExports = named("keys.ts", "value");
const queryExports = named("queries.ts", "value");
const collectionExports = named(/^collections?\.ts$/, "value");
const schemaExports = named("schema.ts", "value");
const typeExports = [...named("schema.ts", "type"), ...named("types.ts", "type")];
const suffixes = (items: Naming[]) => tally(items, (item) => camelTail(item.name));

print("Exports of keys.ts by last word (the standard: <feature>Keys)", suffixes(keyExports), 12);
print(
	"Exports of queries.ts by last word (the standard: <feature>Queries, <feature>Mutations)",
	suffixes(queryExports),
	15,
);
print("Exports of collection(s).ts by last word (the standard: <feature>Rows)", suffixes(collectionExports), 12);
print("Exports of schema.ts by last word (the standard: …InputSchema, …UpdateSchema)", suffixes(schemaExports), 15);
print(
	"Exported types of schema.ts and types.ts by last word (the standard: ListItem, Detail, Input)",
	suffixes(typeExports),
	20,
);
print(
	"collection.ts and collections.ts",
	tally(
		files.filter((file) => /\/collections?\.ts$/.test(file)),
		base,
	),
);

// --- Server folders ----------------------------------------------------------------------------

const serverFiles = files.filter((file) => file.startsWith("src/server/"));
const serverFolders = [...new Set(serverFiles.map((file) => path.posix.dirname(file)))];
const pairs = serverFolders.filter(
	(folder) => existsSync(`${folder}/repository.ts`) && existsSync(`${folder}/service.ts`),
);
const serviceOnly = serverFolders.filter(
	(folder) => !existsSync(`${folder}/repository.ts`) && existsSync(`${folder}/service.ts`),
);
const prefixed = serverFiles.filter((file) => /-(repository|service)\.ts$/.test(file));
print("src/server folders", {
	folders: serverFolders.length,
	"with repository.ts and service.ts": pairs.length,
	"with service.ts only": serviceOnly.length,
	"files named <thing>-repository.ts or <thing>-service.ts": prefixed.length,
});
const serverNames = tally(
	serverFiles.filter((file) => !/(^|\/)(repository|service)\.ts$/.test(file)),
	(file) => `${layerOf(file)}: ${/\.test\.|\.server\./.test(file) ? base(file) : lastWord(stem(file))}`,
);
print("Other file names in src/server, by layer and last word", serverNames, 40);

// --- Tests -------------------------------------------------------------------------------------

const featureNames = new Set(
	[...folders.map((folder) => base(folder.folder)), ...readdirSync("src/server"), ...readdirSync("src/lib")].map(
		(name) => name.replace(/\.tsx?$/, ""),
	),
);
const tests = walk("tests").filter((file) => /\.test\.tsx?$/.test(file));
const testFolder = (file: string) => file.split("/").slice(0, 2).join("/");
/** The longest leading part of a test's name that is a feature, a module or a core library. */
const subject = (file: string) => {
	const words = stem(file)
		.replace(/\.test$/, "")
		.split("-");
	for (let length = words.length; length > 0; length -= 1) {
		const candidate = words.slice(0, length).join("-");
		if (featureNames.has(candidate)) return candidate;
	}
	return undefined;
};
const unnamed = tests.filter((file) => subject(file) === undefined);
print("Test files by folder", tally(tests, testFolder));
print("Test files whose name starts with a feature, a module or a core library", {
	yes: tests.length - unnamed.length,
	no: unnamed.length,
});

save("structure", {
	generated: "node scripts/audit/structure.ts",
	featureFolders: {
		total: folders.length,
		inShape: folders.filter(inShape).length,
		byLayer: Object.fromEntries(
			[...new Set(folders.map((folder) => folder.layer))].map((layer) => {
				const own = folders.filter((folder) => folder.layer === layer);
				return [
					layer,
					{
						folders: own.length,
						inShape: own.filter(inShape).length,
						withComponentsFolder: own.filter((folder) => folder.components).length,
						looseComponents: own.reduce((sum, folder) => sum + folder.looseComponents.length, 0),
						oddFiles: own.reduce((sum, folder) => sum + folder.odd.length, 0),
					},
				];
			}),
		),
		oddNames,
		outOfShape: folders.filter((folder) => !inShape(folder)),
	},
	fileNames: { notKebab },
	components: {
		total: featureComponents.length,
		withRole: withRole.length,
		byRole: tally(withRole, (file) => lastWord(stem(file))),
		otherLastWords: lastWords,
	},
	hooks: { total: hookExports.length, elsewhere: hooksElsewhere },
	exports: {
		keys: { suffixes: suffixes(keyExports), other: keyExports.filter((item) => !item.name.endsWith("Keys")) },
		queries: {
			suffixes: suffixes(queryExports),
			other: queryExports.filter((item) => !/(Queries|Mutations)$/.test(item.name)),
		},
		collections: {
			suffixes: suffixes(collectionExports),
			other: collectionExports.filter((item) => !item.name.endsWith("Rows")),
			files: files.filter((file) => /\/collections?\.ts$/.test(file)),
		},
		schemas: { suffixes: suffixes(schemaExports) },
		types: { suffixes: suffixes(typeExports) },
	},
	server: { folders: serverFolders.length, pairs, serviceOnly, prefixed, otherNames: serverNames },
	tests: { total: tests.length, byFolder: tally(tests, testFolder), notNamedAfterAFeature: unnamed },
});
