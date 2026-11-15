/**
 * What the standard's rules read: a tree of files, on disk or in memory (the rules' own tests and
 * the generator's templates are checked as in-memory trees), and the syntax helpers over it.
 *
 * The rules read the source as text and as syntax trees. They never import app code.
 */
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

export type Tree = {
	/** Every file, relative to the root, with forward slashes, sorted. */
	readonly files: ReadonlyArray<string>;
	read(file: string): string;
};

/** The folders the rules read. Recorded fixtures, templates and generated code are left out. */
const ROOTS = ["src", "tests", "scripts", "e2e", "drizzle", "messages"];
const SKIPPED = new Set(["src/paraglide", "tests/fixtures", "scripts/templates", "drizzle/meta"]);

/** The repository at `root` (the working directory by default). */
export function diskTree(root = "."): Tree {
	const files: string[] = [];
	const walk = (dir: string) => {
		let entries: import("node:fs").Dirent[];
		try {
			entries = readdirSync(`${root}/${dir}`, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && !SKIPPED.has(`${dir}/${entry.name}`)) walk(`${dir}/${entry.name}`);
			} else files.push(`${dir}/${entry.name}`);
		}
	};
	for (const folder of ROOTS) walk(folder);
	const texts = new Map<string, string>();
	return {
		files: files.sort(),
		read(file) {
			let text = texts.get(file);
			if (text === undefined) {
				text = readFileSync(`${root}/${file}`, "utf8");
				texts.set(file, text);
			}
			return text;
		},
	};
}

/** A tree from `{ path: content }`. */
export function memoryTree(contents: Record<string, string>): Tree {
	return {
		files: Object.keys(contents).sort(),
		read: (file) => contents[file] ?? "",
	};
}

export const base = (file: string) => file.slice(file.lastIndexOf("/") + 1);
export const dirOf = (file: string) => file.slice(0, Math.max(0, file.lastIndexOf("/")));
/** The file's name without `.ts`, `.tsx` and a `.stories` or `.test` before it. */
export const stem = (file: string) => base(file).replace(/\.(tsx?|mts|mjs)$/, "");
export const lastWord = (name: string) => name.split("-").at(-1) ?? name;
export const isStory = (file: string) => file.endsWith(".stories.tsx");
export const isCode = (file: string) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts");

/** The app's own source: no generated route tree, no shadcn files (vendored), no stories unless asked. */
export function sourceFiles(tree: Tree, { stories = false }: { stories?: boolean } = {}): string[] {
	return tree.files.filter(
		(file) =>
			file.startsWith("src/") &&
			isCode(file) &&
			file !== "src/routeTree.gen.ts" &&
			!file.startsWith("src/components/ui/") &&
			(stories || !isStory(file)),
	);
}

const parsed = new WeakMap<Tree, Map<string, ts.SourceFile>>();

/** The file's syntax tree (parsed once per tree). */
export function parse(tree: Tree, file: string): ts.SourceFile {
	let cache = parsed.get(tree);
	if (!cache) {
		cache = new Map();
		parsed.set(tree, cache);
	}
	let source = cache.get(file);
	if (!source) {
		const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
		source = ts.createSourceFile(file, tree.read(file), ts.ScriptTarget.Latest, true, kind);
		cache.set(file, source);
	}
	return source;
}

/** Calls `each` for the node and everything under it. */
export function visit(node: ts.Node, each: (node: ts.Node) => void) {
	each(node);
	node.forEachChild((child) => visit(child, each));
}

export const lineOf = (source: ts.SourceFile, node: ts.Node) =>
	source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** `foo(…)` gives "foo", `a.b.foo(…)` gives "foo". */
export function calleeName(call: ts.CallExpression): string {
	if (ts.isIdentifier(call.expression)) return call.expression.text;
	if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
	return "";
}

export type Exported = {
	name: string;
	kind: "value" | "type";
	line: number;
	/** The declaration, when the export is one (not a name in an `export { … }` list). */
	node?: ts.Node;
	/** A value's initializer (`export const a = <this>`). */
	initializer?: ts.Expression;
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
	ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

/** What a file declares and exports from its top level. `export { a } from "…"` lists are left out. */
export function exportsOf(tree: Tree, file: string): Exported[] {
	const source = parse(tree, file);
	const found: Exported[] = [];
	for (const statement of source.statements) {
		if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
		if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) continue;
		const line = lineOf(source, statement);
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) continue;
				const initializer = declaration.initializer;
				found.push({ name: declaration.name.text, kind: "value", line, node: statement, initializer });
			}
		} else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
			found.push({ name: statement.name.text, kind: "value", line, node: statement });
		} else if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
			found.push({ name: statement.name.text, kind: "type", line, node: statement });
		} else if (ts.isEnumDeclaration(statement)) {
			found.push({ name: statement.name.text, kind: "value", line, node: statement });
		}
	}
	return found;
}

/** The comments right above a node, as one line of text ("" when there are none). */
export function commentAbove(source: ts.SourceFile, node: ts.Node): string {
	const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	return ranges
		.map((range) => source.text.slice(range.pos, range.end))
		.join(" ")
		.replace(/^\s*(\/\/|\/\*+|\*+\/?)\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** The statement a node sits in (or the node itself at the top). */
export function statementOf(node: ts.Node): ts.Node {
	let current = node;
	while (current.parent && !ts.isStatement(current) && !ts.isSourceFile(current.parent)) current = current.parent;
	return current;
}

/**
 * Whether the code gives its reason: a comment `<word>: <reason>` right above the node, above the
 * JSX attribute it sits in, or above its statement.
 */
export function hasReason(source: ts.SourceFile, node: ts.Node, word: string): boolean {
	const marker = new RegExp(`(^|[\\s*/])${word}:\\s*\\S{3,}`);
	const places: ts.Node[] = [node, statementOf(node)];
	for (let current: ts.Node | undefined = node; current; current = current.parent) {
		if (ts.isJsxAttribute(current) || ts.isPropertyAssignment(current) || ts.isVariableDeclaration(current)) {
			places.push(current);
		}
		if (ts.isStatement(current)) break;
	}
	return places.some((place) => marker.test(commentAbove(source, place)));
}

/** A file's imports: the specifier and whether the whole import is types only. */
export function importsOf(tree: Tree, file: string): Array<{ from: string; typeOnly: boolean; line: number }> {
	const source = parse(tree, file);
	const found: Array<{ from: string; typeOnly: boolean; line: number }> = [];
	for (const statement of source.statements) {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			const clause = statement.importClause;
			const named = clause?.namedBindings;
			const typeOnly =
				clause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
				(Boolean(named) &&
					!clause?.name &&
					named !== undefined &&
					ts.isNamedImports(named) &&
					named.elements.length > 0 &&
					named.elements.every((element) => element.isTypeOnly));
			found.push({ from: statement.moduleSpecifier.text, typeOnly, line: lineOf(source, statement) });
		} else if (
			ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier &&
			ts.isStringLiteral(statement.moduleSpecifier)
		) {
			found.push({
				from: statement.moduleSpecifier.text,
				typeOnly: statement.isTypeOnly,
				line: lineOf(source, statement),
			});
		}
	}
	return found;
}

/** One place where the code and the standard differ. */
export type Deviation = {
	/** What the list of known deviations holds: a path, or `path#name`. Several may share a key (they are counted). */
	key: string;
	line?: number;
	/** What is wrong and what to do. */
	message: string;
};

export type Rule = {
	id: string;
	/** The rule in one sentence, as the guide states it. */
	rule: string;
	check(tree: Tree): Deviation[];
};
