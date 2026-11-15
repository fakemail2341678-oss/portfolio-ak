/**
 * node scripts/codemods/part9-structure.ts [--dry]
 *
 * Part 9 Task 101 (decision 0298): every file in its standard place with its standard name, in one
 * move. Kept for reference: it ran once, on the commit before Task 101's, and is not a tool to run
 * again. What it renames is data in ./part9-structure/plan.ts; what the standard's rules decide
 * by themselves (a loose component goes to components/, a schema gets `Schema`) is worked out here
 * from the rules (scripts/standard/).
 *
 * The steps, in order:
 * 1. the edits by hand the moves depend on (PATCHES);
 * 2. names, by meaning (TypeScript's language service): guards, server function verbs, exports;
 * 3. single writes folded into their feature's `<feature>Mutations` object;
 * 4. declarations that change file: query keys, loaders, hooks ("Move to file");
 * 5. files: every move the rules ask for, with the imports and the paths written as text;
 * 6. messages: `ch_` and `pd_` spelled out.
 * Biome formats afterwards. Then ./part9-structure/names-in-text.ts renames what the language
 * service does not see (mocks, test lists, comments, guides), ./part9-structure/paths-in-guides.ts
 * the guides' short paths, and `pnpm standard --rewrite` writes the list of known deviations.
 * What was done by hand, before and after, is listed at the top of plan.ts.
 */
import { mkdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import ts from "typescript";
import { RULES } from "../standard/rules.ts";
import { base, dirOf, diskTree, isStory } from "../standard/tree.ts";
import {
	EXPORT_RENAMES,
	FILE_MOVES,
	FOLDS,
	GUARD_RENAMES,
	MESSAGE_PREFIXES,
	NOT_A_SCHEMA,
	PATCHES,
	RECORDS,
	RELOCATIONS,
	ROLE_NAMES,
	VERB_RENAMES,
} from "./part9-structure/plan.ts";
import { relativeSpecifier, Workspace } from "./part9-structure/workspace.ts";

const DRY = process.argv.includes("--dry");
const FEATURES = "src/features/";
const started = Date.now();
const say = (text: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0).padStart(3)}s] ${text}`);

const deviations = (rule: string) =>
	(RULES.find((item) => item.id === rule) ?? { check: () => [] }).check(diskTree()).map((deviation) => deviation.key);

// --- 1 to 4: names and declarations, in memory -------------------------------------------------

const workspace = new Workspace(".");

for (const [file, find, replacement] of PATCHES) {
	const text = workspace.read(file);
	if (text.split(find).length !== 2) throw new Error(`${file}: "${find}" must match exactly once`);
	workspace.write(
		file,
		text.replace(find, () => replacement),
	);
}
say(`patches: ${PATCHES.length}`);

const schemaRenames = deviations("export-name")
	.filter((key) => key.split("#")[0]?.endsWith("/schema.ts") && !NOT_A_SCHEMA.has(key))
	.map((key) => {
		const [file = "", name = ""] = key.split("#");
		return [file, name, `${name}Schema`] as const;
	});
const renames = [...GUARD_RENAMES, ...VERB_RENAMES, ...EXPORT_RENAMES, ...schemaRenames];
workspace.rename(renames.map(([file, name, to]) => ({ file, name, to })));
say(`renames: ${renames.length} (${schemaRenames.length} schemas)`);

workspace.fold(FOLDS.map(([file, name, object, key]) => ({ file, name, object, key })));
say(`folds: ${FOLDS.length}`);

const failed: string[] = [];
for (const [file, names, target] of RELOCATIONS) {
	try {
		workspace.relocate(file, names, target);
	} catch (error) {
		const reason = error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);
		failed.push(`${file} [${names.join(", ")}]: ${reason}`);
	}
}
say(`relocations: ${RELOCATIONS.length}`);
if (failed.length > 0) throw new Error(`TypeScript could not move:\n${failed.join("\n")}`);

const touched = workspace.changed();
if (DRY) {
	say(`dry run: ${touched.length} files would change before the moves`);
	process.exit(0);
}
workspace.flush();

// --- 5: files ------------------------------------------------------------------------------------

const moves = new Map<string, string>(FILE_MOVES);
const tree = diskTree();
const everyFile = new Set(workspace.walk(""));

/** The feature folder a loose file sits in, with the file's new name in one of its subfolders. */
const into = (file: string, folder: string, name = base(file)) => `${dirOf(file)}/${folder}/${name}`;
const roleName = (file: string) => {
	const key = file.slice(FEATURES.length).replace(/(\.stories)?\.tsx$/, "");
	const name = ROLE_NAMES[key];
	return name ? `${name}${isStory(file) ? ".stories" : ""}.tsx` : base(file);
};

for (const file of deviations("feature-component")) {
	if (!moves.has(file)) moves.set(file, into(file, "components", roleName(file)));
}
// Stories sit beside their components: a loose story file follows them into components/.
for (const file of tree.files) {
	if (!file.startsWith(FEATURES) || !isStory(file) || moves.has(file)) continue;
	const inSubfolder = file
		.slice(FEATURES.length)
		.split("/")
		.slice(0, -1)
		.some((part) => ["components", "hooks", "lib"].includes(part));
	if (!inSubfolder) moves.set(file, into(file, "components", roleName(file)));
	else if (roleName(file) !== base(file)) moves.set(file, `${dirOf(file)}/${roleName(file)}`);
}
for (const file of deviations("component-role")) {
	if (!moves.has(file)) moves.set(file, `${dirOf(file)}/${roleName(file)}`);
}
for (const file of deviations("feature-file")) {
	if (moves.has(file)) continue;
	if (base(file) === "collections.ts") moves.set(file, `${dirOf(file)}/collection.ts`);
	else moves.set(file, into(file, base(file).startsWith("use-") ? "hooks" : "lib"));
}

const unused = Object.keys(ROLE_NAMES).filter((key) => !everyFile.has(`${FEATURES}${key}.tsx`));
if (unused.length > 0) throw new Error(`ROLE_NAMES names files that do not exist: ${unused.join(", ")}`);
const targets = new Map<string, string>();
for (const [from, to] of moves) {
	if (!everyFile.has(from)) throw new Error(`${from} does not exist`);
	if (everyFile.has(to) && !moves.has(to)) throw new Error(`${from} -> ${to}: the target exists`);
	if (targets.has(to)) throw new Error(`${from} and ${targets.get(to)} both move to ${to}`);
	targets.set(to, from);
}
say(`moves: ${moves.size} files`);

const TEXT = /\.(tsx?|mts|mjs|cjs|js|json|md|ya?ml|css|grit)$/;
const LEFT_OUT = [
	"messages/",
	"public/",
	"src/paraglide/",
	"src/routeTree.gen.ts",
	"storybook-static/",
	"playwright-report/",
	"test-results/",
	".data/",
	"security-review.local/",
	".claude/settings.local.json",
];
const rewritten = [...everyFile].filter(
	(file) => TEXT.test(file) && ![...RECORDS, ...LEFT_OUT].some((prefix) => file.startsWith(prefix)),
);

/** The file a module specifier names, and how it names it. */
function resolveModule(path: string): { file: string; form: "exact" | "bare" | "index" } | undefined {
	if (everyFile.has(path)) return { file: path, form: "exact" };
	for (const extension of [".ts", ".tsx"])
		if (everyFile.has(path + extension)) return { file: path + extension, form: "bare" };
	for (const extension of [".ts", ".tsx"]) {
		if (everyFile.has(`${path}/index${extension}`)) return { file: `${path}/index${extension}`, form: "index" };
	}
	return undefined;
}
const named = (file: string, form: "exact" | "bare" | "index") =>
	form === "exact"
		? file
		: form === "index" && /\/index\.tsx?$/.test(file)
			? file.replace(/\/index\.tsx?$/, "")
			: file.replace(/\.tsx?$/, "");

/** A module specifier after the moves, or undefined when it stays as written. */
function movedSpecifier(importer: string, specifier: string): string | undefined {
	const alias = specifier.startsWith("@/");
	if (!alias && !specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
	const found = resolveModule(alias ? `src/${specifier.slice(2)}` : posix.join(dirOf(importer), specifier));
	if (!found) return undefined;
	const target = moves.get(found.file) ?? found.file;
	const newImporter = moves.get(importer) ?? importer;
	if (target === found.file && (alias || newImporter === importer)) return undefined;
	const path = named(target, found.form);
	const next = alias ? `@/${path.slice("src/".length)}` : relativeSpecifier(newImporter, path);
	return next === specifier ? undefined : next;
}

/** A path written in a comment, a string or a document, after the moves. */
function movedPath(token: string): string | undefined {
	const moved = moves.get(token);
	if (moved) return moved;
	for (const extension of [".ts", ".tsx"]) {
		const to = moves.get(token + extension);
		if (to) return to.replace(/\.tsx?$/, "");
	}
	return undefined;
}
const PATH_TOKEN = /(?<![\w@/.-])(@\/|src\/|tests\/|e2e\/|scripts\/)([\w./[\]$-]*[\w\]])/g;

let specifiers = 0;
let paths = 0;
for (const file of rewritten) {
	const original = readFileSync(file, "utf8");
	let text = original;
	if (/\.(tsx?|mts)$/.test(file)) {
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		const edits: Array<{ start: number; end: number; text: string }> = [];
		const visit = (node: ts.Node) => {
			if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
				const next = movedSpecifier(file, node.text);
				if (next) edits.push({ start: node.getStart(source) + 1, end: node.getEnd() - 1, text: next });
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		specifiers += edits.length;
		for (const edit of edits.sort((a, b) => b.start - a.start)) {
			text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
		}
	}
	text = text.replace(PATH_TOKEN, (whole, root: string, rest: string) => {
		const moved = movedPath(root === "@/" ? `src/${rest}` : `${root}${rest}`);
		if (!moved) return whole;
		paths++;
		return root === "@/" ? `@/${moved.slice("src/".length)}` : moved;
	});
	if (text !== original) writeFileSync(file, text);
}
for (const [from, to] of moves) {
	mkdirSync(dirname(to), { recursive: true });
	renameSync(from, to);
}
// Folders the moves emptied.
for (const folder of new Set([...moves.keys()].map(dirOf))) {
	try {
		rmdirSync(folder);
	} catch {
		// Not empty: it still holds files.
	}
}
say(`imports rewritten: ${specifiers}; paths in text: ${paths}`);

// --- 6: messages -----------------------------------------------------------------------------------

const renamedKey = (key: string) => {
	for (const [from, to] of MESSAGE_PREFIXES) if (key.startsWith(from)) return to + key.slice(from.length);
	return key;
};
const keys = new Set<string>();
for (const locale of ["en", "ne"]) {
	const file = `messages/${locale}.json`;
	const messages = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(messages)) {
		const to = renamedKey(key);
		if (to !== key) keys.add(key);
		if (to in next || (to !== key && to in messages)) throw new Error(`${file}: ${to} exists twice`);
		next[to] = value;
	}
	writeFileSync(file, `${JSON.stringify(next, null, "\t")}\n`);
}
let uses = 0;
for (const file of workspace.walk("")) {
	if (!TEXT.test(file) || [...RECORDS, ...LEFT_OUT].some((prefix) => file.startsWith(prefix))) continue;
	const original = readFileSync(file, "utf8");
	const text = original.replace(/\bm\.((?:ch|pd)_\w+)/g, (whole, key: string) => {
		if (!keys.has(key)) return whole;
		uses++;
		return `m.${renamedKey(key)}`;
	});
	if (text !== original) writeFileSync(file, text);
}
say(`messages: ${keys.size} keys, ${uses} uses`);
say("done: run pnpm check:fix, pnpm typecheck, then pnpm standard --summary");
