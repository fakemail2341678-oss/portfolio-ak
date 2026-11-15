/**
 * The codemod's view of the repository (Part 9 Task 101): every file's text in memory over the
 * disk, and TypeScript's language service on top of it, so a rename or a moved declaration is
 * found by meaning and not by spelling. Nothing is written until `flush()`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
import ts from "typescript";

const slash = (path: string) => path.replaceAll("\\", "/");

/** A top-level declaration, named by its file (from the repository's root) and its name. */
export type Symbol = { file: string; name: string };

const FORMAT: ts.FormatCodeSettings = {
	convertTabsToSpaces: false,
	indentSize: 4,
	tabSize: 4,
	newLineCharacter: "\n",
	semicolons: ts.SemicolonPreference.Insert,
};
const PREFERENCES: ts.UserPreferences = {
	quotePreference: "double",
	importModuleSpecifierPreference: "shortest",
	allowTextChangesInNewFiles: true,
	providePrefixAndSuffixTextForRename: true,
};

/** Folders the codemod never reads. */
const SKIPPED = new Set(["node_modules", ".git", ".output", ".vercel", ".nitro", ".tanstack", "dist", "coverage"]);

export class Workspace {
	readonly root: string;
	private readonly overlay = new Map<string, { text: string | undefined; version: number }>();
	private readonly roots: Set<string>;
	private readonly options: ts.CompilerOptions;
	private service: ts.LanguageService | undefined;
	private projectVersion = 0;

	constructor(root: string) {
		this.root = slash(resolve(root));
		const config = ts.readConfigFile(`${this.root}/tsconfig.json`, ts.sys.readFile);
		const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, this.root);
		this.options = parsed.options;
		this.roots = new Set(parsed.fileNames.map(slash));
		// TypeScript's globs skip dot folders; Storybook's mocks name guards and functions too.
		for (const file of this.walk(".storybook")) if (/\.tsx?$/.test(file)) this.roots.add(this.abs(file));
	}

	abs(file: string): string {
		return file.startsWith(this.root) ? file : `${this.root}/${file}`;
	}
	rel(file: string): string {
		return slash(file).startsWith(`${this.root}/`) ? slash(file).slice(this.root.length + 1) : slash(file);
	}

	/** Every file under a folder, as paths from the root. */
	walk(folder: string): string[] {
		const found: string[] = [];
		const visit = (dir: string) => {
			if (!existsSync(this.abs(dir))) return;
			for (const entry of readdirSync(this.abs(dir), { withFileTypes: true })) {
				const path = dir === "" ? entry.name : `${dir}/${entry.name}`;
				if (entry.isDirectory()) {
					if (!SKIPPED.has(entry.name)) visit(path);
				} else found.push(path);
			}
		};
		visit(folder);
		return found;
	}

	exists(file: string): boolean {
		const entry = this.overlay.get(this.abs(file));
		if (entry) return entry.text !== undefined;
		return existsSync(this.abs(file)) && statSync(this.abs(file)).isFile();
	}
	read(file: string): string {
		const entry = this.overlay.get(this.abs(file));
		if (entry) {
			if (entry.text === undefined) throw new Error(`${file} was removed`);
			return entry.text;
		}
		return readFileSync(this.abs(file), "utf8");
	}
	write(file: string, text: string) {
		const path = this.abs(file);
		const version = (this.overlay.get(path)?.version ?? 0) + 1;
		this.overlay.set(path, { text, version });
		if (/\.tsx?$/.test(path)) this.roots.add(path);
		this.projectVersion++;
	}
	remove(file: string) {
		const path = this.abs(file);
		this.overlay.set(path, { text: undefined, version: (this.overlay.get(path)?.version ?? 0) + 1 });
		this.roots.delete(path);
		this.projectVersion++;
	}
	/** Files changed or removed since the start, as paths from the root. */
	changed(): string[] {
		return [...this.overlay.keys()].map((path) => this.rel(path));
	}

	/** Writes every change to the disk. */
	flush() {
		for (const [path, entry] of this.overlay) {
			if (entry.text === undefined) rmSync(path, { force: true });
			else {
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, entry.text);
			}
		}
	}

	get ls(): ts.LanguageService {
		if (this.service) return this.service;
		const host: ts.LanguageServiceHost = {
			getScriptFileNames: () => [...this.roots],
			getScriptVersion: (path) => String(this.overlay.get(slash(path))?.version ?? 0),
			getScriptSnapshot: (path) => {
				const entry = this.overlay.get(slash(path));
				if (entry) return entry.text === undefined ? undefined : ts.ScriptSnapshot.fromString(entry.text);
				const text = ts.sys.readFile(path);
				return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
			},
			getProjectVersion: () => String(this.projectVersion),
			getCurrentDirectory: () => this.root,
			getCompilationSettings: () => this.options,
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
			fileExists: (path) => {
				const entry = this.overlay.get(slash(path));
				return entry ? entry.text !== undefined : ts.sys.fileExists(path);
			},
			readFile: (path) => {
				const entry = this.overlay.get(slash(path));
				return entry ? entry.text : ts.sys.readFile(path);
			},
			readDirectory: ts.sys.readDirectory,
			// A folder that exists only in memory (a new hooks/ or lib/) must resolve too.
			directoryExists: (path) =>
				ts.sys.directoryExists(path) ||
				[...this.overlay].some(([file, entry]) => entry.text !== undefined && file.startsWith(`${slash(path)}/`)),
			getDirectories: ts.sys.getDirectories,
			useCaseSensitiveFileNames: () => false,
		};
		this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
		return this.service;
	}

	source(file: string): ts.SourceFile {
		const source = this.ls.getProgram()?.getSourceFile(this.abs(file));
		if (!source) throw new Error(`${file} is not in the program`);
		return source;
	}

	/** The top-level statement that declares a name, and the name's own node. */
	declaration(symbol: Symbol): { statement: ts.Statement; name: ts.Identifier; source: ts.SourceFile } {
		const source = this.source(symbol.file);
		for (const statement of source.statements) {
			if (ts.isVariableStatement(statement)) {
				for (const declaration of statement.declarationList.declarations) {
					if (ts.isIdentifier(declaration.name) && declaration.name.text === symbol.name) {
						return { statement, name: declaration.name, source };
					}
				}
			} else if (
				(ts.isFunctionDeclaration(statement) ||
					ts.isClassDeclaration(statement) ||
					ts.isTypeAliasDeclaration(statement) ||
					ts.isInterfaceDeclaration(statement)) &&
				statement.name?.text === symbol.name
			) {
				return { statement, name: statement.name, source };
			}
		}
		throw new Error(`${symbol.file} declares no "${symbol.name}" at the top`);
	}

	/** Applies TypeScript's edits to the texts in memory. */
	apply(changes: ReadonlyArray<ts.FileTextChanges>) {
		for (const change of changes) {
			const file = this.rel(change.fileName);
			let text = change.isNewFile && !this.exists(file) ? "" : this.read(file);
			// Last first. At one position a replaced span goes before an insertion, or it would eat it.
			const ordered = change.textChanges
				.map((edit, index) => ({ edit, index }))
				.sort(
					(a, b) =>
						b.edit.span.start - a.edit.span.start || b.edit.span.length - a.edit.span.length || b.index - a.index,
				);
			for (const { edit } of ordered) {
				text = text.slice(0, edit.span.start) + edit.newText + text.slice(edit.span.start + edit.span.length);
			}
			this.write(file, text);
		}
	}

	/** Every place a declaration is named, in the repository's own files. */
	references(symbol: Symbol): ReadonlyArray<ts.RenameLocation> {
		const { name } = this.declaration(symbol);
		const found = this.ls.findRenameLocations(this.abs(symbol.file), name.getStart(), false, false, PREFERENCES) ?? [];
		return found.filter((location) => !location.fileName.includes("/node_modules/"));
	}

	/**
	 * Renames declarations everywhere they are used. All of them are looked up before any text
	 * changes, so one pass over the program serves the whole list.
	 */
	rename(renames: ReadonlyArray<Symbol & { to: string }>) {
		const edits = new Map<string, Array<{ start: number; length: number; text: string }>>();
		for (const item of renames) {
			for (const location of this.references(item)) {
				const list = edits.get(location.fileName) ?? [];
				list.push({
					start: location.textSpan.start,
					length: location.textSpan.length,
					text: `${location.prefixText ?? ""}${item.to}${location.suffixText ?? ""}`,
				});
				edits.set(location.fileName, list);
			}
		}
		this.edit(edits);
	}

	/** Applies spans of text per file, last first. Two edits of one span must agree. */
	edit(edits: Map<string, Array<{ start: number; length: number; text: string }>>) {
		for (const [path, list] of edits) {
			const file = this.rel(path);
			let text = this.read(file);
			let last: { start: number; text: string } | undefined;
			for (const edit of list.sort((a, b) => b.start - a.start)) {
				if (last && last.start === edit.start) {
					if (last.text !== edit.text) throw new Error(`${file}: two edits of one place (${last.text}, ${edit.text})`);
					continue;
				}
				if (last && edit.start + edit.length > last.start)
					throw new Error(`${file}: overlapping edits at ${edit.start}`);
				text = text.slice(0, edit.start) + edit.text + text.slice(edit.start + edit.length);
				last = edit;
			}
			this.write(file, text);
		}
	}

	/**
	 * Moves top-level declarations to another file with TypeScript's "Move to file" refactor: the
	 * target gets the imports they need, the source imports them back if it still uses them, and
	 * every importer follows.
	 */
	relocate(file: string, names: ReadonlyArray<string>, target: string) {
		// One move of one range: the refactor merges imports wrongly when it runs once per name. So
		// the declarations go to the end of their file first, each with its own comment (the file's
		// header stays), and leave from there together.
		const source = this.source(file);
		const spans = names
			.map((name) => {
				const { statement } = this.declaration({ file, name });
				const docs = (statement as ts.Statement & { jsDoc?: ts.JSDoc[] }).jsDoc;
				return { start: docs?.at(-1)?.getStart(source) ?? statement.getStart(source), end: statement.getEnd() };
			})
			.sort((a, b) => a.start - b.start);
		let text = source.text;
		const moved = spans.map((span) => text.slice(span.start, span.end)).join("\n\n");
		for (const span of [...spans].reverse()) text = text.slice(0, span.start) + text.slice(span.end);
		const tail = `${text.trimEnd()}\n\n`;
		this.write(file, `${tail}${moved}\n`);

		const edits = this.ls.getEditsForRefactor(
			this.abs(file),
			FORMAT,
			{ pos: tail.length, end: tail.length + moved.length },
			"Move to file",
			"Move to file",
			PREFERENCES,
			{ targetFile: this.abs(target) },
		);
		if (!edits || edits.edits.length === 0) throw new Error(`${file}#${names.join(",")}: no move to ${target}`);
		this.apply(edits.edits);
		// The refactor leaves a blank line between a comment and its declaration.
		this.write(
			target,
			this.read(target).replace(/\*\/\n\n(?=export |const |function |async |type |interface )/g, "*/\n"),
		);
	}

	/**
	 * Makes exported consts the keys of one exported object of their file (`saveThing` becomes
	 * `thingMutations.save`), and writes every use that way. The object is added to if it exists.
	 */
	fold(folds: ReadonlyArray<Symbol & { object: string; key: string }>) {
		const edits = new Map<string, Array<{ start: number; length: number; text: string }>>();
		const push = (path: string, start: number, length: number, text: string) => {
			const list = edits.get(path) ?? [];
			list.push({ start, length, text });
			edits.set(path, list);
		};
		const groups = new Map<string, Array<Symbol & { object: string; key: string }>>();
		for (const item of folds) {
			const id = `${item.file}#${item.object}`;
			groups.set(id, [...(groups.get(id) ?? []), item]);
		}
		for (const group of groups.values()) {
			const { file, object } = group[0] as Symbol & { object: string };
			const source = this.source(file);
			const members: string[] = [];
			const removed: Array<{ start: number; end: number }> = [];
			for (const item of group) {
				const { statement, name } = this.declaration(item);
				const declaration = ts.isVariableStatement(statement) ? statement.declarationList.declarations[0] : undefined;
				if (
					!declaration?.initializer ||
					!ts.isVariableStatement(statement) ||
					statement.declarationList.declarations.length > 1
				) {
					throw new Error(`${file}#${item.name}: only a single const can become a key`);
				}
				const docs = (statement as ts.Statement & { jsDoc?: ts.JSDoc[] }).jsDoc?.at(-1);
				const start = docs?.getStart(source) ?? statement.getStart(source);
				members.push(
					`${docs ? `${docs.getText(source)}\n` : ""}${item.key}: ${declaration.initializer.getText(source)},`,
				);
				removed.push({ start, end: statement.getEnd() });
				for (const location of this.references(item)) {
					const path = slash(location.fileName);
					const at = location.textSpan.start;
					if (path === this.abs(file) && at === name.getStart(source)) continue;
					if (path === this.abs(file) && removed.some((span) => at >= span.start && at < span.end)) {
						throw new Error(`${file}#${item.name}: used inside a declaration that is folded too`);
					}
					const parent = nodeAt(this.source(this.rel(path)), at).parent;
					if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) {
						if (parent.propertyName) throw new Error(`${this.rel(path)}: ${item.name} is imported under another name`);
						push(path, at, location.textSpan.length, object);
					} else {
						push(
							path,
							at,
							location.textSpan.length,
							`${location.prefixText ?? ""}${object}.${item.key}${location.suffixText ?? ""}`,
						);
					}
				}
			}
			let existing: ts.ObjectLiteralExpression | undefined;
			try {
				const { statement } = this.declaration({ file, name: object });
				const initializer = ts.isVariableStatement(statement)
					? statement.declarationList.declarations[0]?.initializer
					: undefined;
				if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
					throw new Error(`${file}#${object} exists and is not an object literal`);
				}
				existing = initializer;
			} catch (error) {
				if (!(error instanceof Error) || !error.message.includes("declares no")) throw error;
			}
			const last = removed.at(-1) as { start: number; end: number };
			for (const span of removed) {
				const becomesObject = !existing && span === last;
				push(
					this.abs(file),
					span.start,
					span.end - span.start,
					becomesObject ? `export const ${object} = {\n${members.join("\n")}\n};` : "",
				);
			}
			if (existing) {
				const comma = existing.properties.length > 0 && !existing.properties.hasTrailingComma ? "," : "";
				push(this.abs(file), existing.getEnd() - 1, 0, `${comma}\n${members.join("\n")}\n`);
			}
		}
		this.edit(edits);
		for (const path of edits.keys()) this.dedupeImports(this.rel(path));
	}

	/** `import { a, a }` becomes `import { a }` (what a fold leaves where two names became one). */
	private dedupeImports(file: string) {
		const text = this.read(file);
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		const spans: Array<{ start: number; length: number; text: string }> = [];
		for (const statement of source.statements) {
			const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
			if (!bindings || !ts.isNamedImports(bindings)) continue;
			const names = bindings.elements.map((element) => element.getText(source));
			const unique = [...new Set(names)];
			if (unique.length === names.length) continue;
			spans.push({
				start: bindings.getStart(source),
				length: bindings.getWidth(source),
				text: `{ ${unique.join(", ")} }`,
			});
		}
		if (spans.length > 0) this.edit(new Map([[this.abs(file), spans]]));
	}
}

/** The innermost node that starts at a position. */
function nodeAt(source: ts.SourceFile, position: number): ts.Node {
	let found: ts.Node = source;
	const visit = (node: ts.Node) => {
		if (position < node.getFullStart() || position >= node.getEnd()) return;
		found = node;
		ts.forEachChild(node, visit);
	};
	ts.forEachChild(source, visit);
	return found;
}

/** `a/b/c.ts` and `a/d/e.ts` give `../d/e.ts`. */
export function relativeSpecifier(from: string, to: string): string {
	// By the folders: `to` has no extension, and may be spelled like a folder above `from` (search.ts beside search/).
	const folder = posix.relative(posix.dirname(from), posix.dirname(to));
	const path = `${folder === "" ? "." : folder}/${posix.basename(to)}`;
	return path.startsWith(".") ? path : `./${path}`;
}
