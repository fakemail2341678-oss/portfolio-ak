/**
 * The standard's rules for where files live: a feature folder's shape, the server's file pairs,
 * and the tests' folders and names (docs/guides/conventions.md, "The standard").
 */
import { base, type Deviation, dirOf, isCode, isStory, parse, type Rule, stem, type Tree } from "../tree.ts";
import { FEATURE_FILES, FEATURE_SUBFOLDERS } from "../vocabulary.ts";

const FEATURES = "src/features/";
const SUBFOLDERS: ReadonlySet<string> = new Set(FEATURE_SUBFOLDERS);

/** The part of a feature file's path that is its `components/`, `hooks/` or `lib/` folder, if it is in one. */
function subfolderOf(file: string): string | undefined {
	return file
		.slice(FEATURES.length)
		.split("/")
		.slice(0, -1)
		.find((part) => SUBFOLDERS.has(part));
}

/** Code files that sit directly in a feature folder: beside the data files, in no subfolder. */
const looseFiles = (tree: Tree) =>
	tree.files.filter((file) => file.startsWith(FEATURES) && isCode(file) && subfolderOf(file) === undefined);

const featureFile: Rule = {
	id: "feature-file",
	rule: `A feature folder holds only ${Object.keys(FEATURE_FILES).join(", ")}, and the folders ${FEATURE_SUBFOLDERS.join("/, ")}/.`,
	check: (tree) =>
		looseFiles(tree)
			.filter((file) => file.endsWith(".ts") && !(base(file) in FEATURE_FILES))
			.map((file) => ({
				key: file,
				message: base(file).startsWith("use-")
					? "a hook: move it to the feature's hooks/"
					: "not a file of the standard: move it to the feature's lib/ (no React), or to hooks/ as use-<thing>.ts",
			})),
};

const featureComponent: Rule = {
	id: "feature-component",
	rule: "A feature's components are in its components/ folder; only columns.tsx and filters.tsx sit beside the data files.",
	check: (tree) =>
		looseFiles(tree)
			.filter((file) => file.endsWith(".tsx") && !isStory(file) && !(base(file) in FEATURE_FILES))
			.map((file) => ({ key: file, message: "move it (and its stories) to the feature's components/" })),
};

const featureLib: Rule = {
	id: "feature-lib",
	rule: "A feature's lib/ holds no React, and its hooks/ holds only use-<thing> files.",
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of tree.files) {
			if (!file.startsWith(FEATURES) || !isCode(file)) continue;
			const folder = subfolderOf(file);
			if (folder === "lib") {
				const react = file.endsWith(".tsx") || /from "react(\/[^"]*)?"/.test(parse(tree, file).text);
				if (react)
					found.push({
						key: file,
						message: "lib/ is for code without React: a hook goes to hooks/, a component to components/",
					});
			} else if (folder === "hooks" && !base(file).startsWith("use-")) {
				found.push({ key: file, message: "hooks/ holds use-<thing>.ts files only" });
			}
		}
		return found;
	},
};

const serverFile: Rule = {
	id: "server-file",
	rule: "A server module is a folder with repository.ts and service.ts, never <thing>-repository.ts or <thing>-service.ts.",
	check: (tree) =>
		tree.files
			.filter((file) => file.startsWith("src/server/") && /-(repository|service)\.ts$/.test(file))
			.map((file) => {
				const [, thing, kind] = /([^/]+)-(repository|service)\.ts$/.exec(file) ?? [];
				return { key: file, message: `move it to ${dirOf(file)}/${thing}/${kind}.ts` };
			}),
};

const TEST_FOLDERS = ["tests/unit/", "tests/server/", "tests/components/"];
const isTest = (file: string) => file.startsWith("tests/") && /\.test\.tsx?$/.test(file);

const testPlace: Rule = {
	id: "test-place",
	rule: "Tests live in tests/unit, tests/server or tests/components.",
	check: (tree) =>
		tree.files
			.filter((file) => isTest(file) && !TEST_FOLDERS.some((folder) => file.startsWith(folder)))
			.map((file) => ({
				key: file,
				message: "move it to tests/unit (pure logic), tests/server (PGlite) or tests/components (jsdom)",
			})),
};

/** Every name a test can be about: a file or a folder of the source, the scripts or the e2e suite. */
function subjects(tree: Tree): Set<string> {
	const names = new Set<string>();
	for (const file of tree.files) {
		if (!/^(src|scripts|e2e)\//.test(file)) continue;
		names.add(stem(file).replace(/\.(stories|server|client|config)$/, ""));
		for (const part of file.split("/").slice(1, -1)) names.add(part.replace(/^_/, ""));
	}
	return names;
}

const testName: Rule = {
	id: "test-name",
	rule: "A test file is <subject>[-<topic>].test.ts, where the subject is a feature, a module or a file of the source.",
	check: (tree) => {
		const known = subjects(tree);
		const found: Deviation[] = [];
		for (const file of tree.files.filter(isTest)) {
			// A folder of tests is named after its subject too (tests/components/forms/, tests/unit/standard/).
			const folders = file.split("/").slice(2, -1);
			if (folders.some((folder) => known.has(folder))) continue;
			const words = stem(file)
				.replace(/\.test$/, "")
				.split("-");
			const named = words.some((_, index) => known.has(words.slice(0, words.length - index).join("-")));
			if (!named) found.push({ key: file, message: "name it after what it tests: <feature>[-<topic>].test.ts" });
		}
		return found;
	},
};

export const structureRules: Rule[] = [featureFile, featureComponent, featureLib, serverFile, testPlace, testName];
