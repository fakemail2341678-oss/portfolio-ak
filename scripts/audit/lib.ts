/**
 * Shared by the audit scripts (scripts/audit/*.ts, Part 9 Task 98): the file list, the layer of
 * a path, one TypeScript parse per file, and the data files in docs/history/part9-audit/.
 *
 * The scripts read the source as text and as syntax trees. They never import app code, so they
 * run with plain `node` and cannot be broken by it.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

export const OUT_DIR = "docs/history/part9-audit";

export const PRODUCTS = ["taskline", "parda", "chaal", "kharcha"] as const;
export const LAYERS = ["core", "portfolio", "apps", "dev", ...PRODUCTS] as const;
export type Layer = (typeof LAYERS)[number];

const SKIPPED_FOLDERS = new Set(["node_modules", "paraglide", ".output", "storybook-static"]);

/** Every file under `dir` with one of the extensions, as repo-relative paths with forward slashes. */
export function walk(dir: string, extensions: ReadonlyArray<string> = [".ts", ".tsx"]): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			if (!SKIPPED_FOLDERS.has(entry.name)) found.push(...walk(full, extensions));
		} else if (extensions.some((extension) => entry.name.endsWith(extension))) {
			found.push(full);
		}
	}
	return found.sort();
}

/** The app's own source: no generated route tree, no stories unless asked, no shadcn files (vendored). */
export function sourceFiles({ stories = false, ui = false }: { stories?: boolean; ui?: boolean } = {}): string[] {
	return walk("src").filter(
		(file) =>
			file !== "src/routeTree.gen.ts" &&
			!file.endsWith(".d.ts") &&
			(stories || !file.endsWith(".stories.tsx")) &&
			(ui || !file.startsWith("src/components/ui/")),
	);
}

/** The layer a path belongs to, by the names the layers use for their folders, routes and tests. */
export function layerOf(file: string): Layer {
	const lower = file.toLowerCase();
	for (const product of PRODUCTS) {
		if (new RegExp(`(^|[/_.-])${product}([/_.-]|$)`).test(lower)) return product;
	}
	if (/(^|[/_.-])(portfolio|himal)([/_.-]|$)|routes\/_site[/.]/.test(lower)) return "portfolio";
	if (/(^|[/_])apps([/_.-]|$)|routes\/(f|l)\/|(^|[/_.-])(notes?|links?|habits?|guests?)([/_.-]|$)/.test(lower)) {
		return "apps";
	}
	if (/(^|\/)dev([/_.-]|$)|features\/stack\/|functions\/(examples|stack)/.test(lower)) return "dev";
	return "core";
}

const cache = new Map<string, ts.SourceFile>();
export const read = (file: string) => readFileSync(file, "utf8");

/** The file's syntax tree (parsed once). */
export function parse(file: string): ts.SourceFile {
	let source = cache.get(file);
	if (!source) {
		const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
		source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, kind);
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

export type Exported = { name: string; kind: "value" | "type" | "default"; line: number };

/** What a file exports from its top level (`export { a } from` lists count as values). */
export function exportsOf(file: string): Exported[] {
	const source = parse(file);
	const found: Exported[] = [];
	for (const statement of source.statements) {
		const line = lineOf(source, statement);
		if (ts.isExportAssignment(statement)) {
			found.push({ name: "default", kind: "default", line });
			continue;
		}
		if (ts.isExportDeclaration(statement)) {
			const clause = statement.exportClause;
			if (clause && ts.isNamedExports(clause)) {
				for (const element of clause.elements) {
					const isType = statement.isTypeOnly || element.isTypeOnly;
					found.push({ name: element.name.text, kind: isType ? "type" : "value", line });
				}
			}
			continue;
		}
		const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
		if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
			found.push({ name: "default", kind: "default", line });
		} else if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) found.push({ name: declaration.name.text, kind: "value", line });
			}
		} else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
			found.push({ name: statement.name.text, kind: "value", line });
		} else if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
			found.push({ name: statement.name.text, kind: "type", line });
		} else if (ts.isEnumDeclaration(statement)) {
			found.push({ name: statement.name.text, kind: "value", line });
		}
	}
	return found;
}

/** The comment lines right above a node, joined ("" when there are none). */
export function commentAbove(source: ts.SourceFile, node: ts.Node): string {
	const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	return ranges
		.map((range) => source.text.slice(range.pos, range.end))
		.join(" ")
		.replace(/^\s*(\/\/|\/\*+|\*+\/?)\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** How many items share each key, largest first. */
export function tally<T>(items: Iterable<T>, key: (item: T) => string | undefined): Record<string, number> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const name = key(item);
		if (name !== undefined) counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** Writes docs/history/part9-audit/<name>.json. */
export function save(name: string, data: unknown) {
	mkdirSync(OUT_DIR, { recursive: true });
	writeFileSync(`${OUT_DIR}/${name}.json`, `${JSON.stringify(data, null, "\t")}\n`);
}

/** Prints a heading with its counts, one per line, largest first as `tally` gives them. */
export function print(title: string, counts: Record<string, number | string>, limit = 40) {
	console.log(`\n${title}`);
	const entries = Object.entries(counts);
	for (const [name, value] of entries.slice(0, limit)) console.log(`  ${String(value).padStart(6)}  ${name}`);
	if (entries.length > limit) console.log(`          … ${entries.length - limit} more in the data file`);
}
