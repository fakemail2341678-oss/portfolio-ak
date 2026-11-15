/**
 * The standard's rules for names: files, components' roles, hooks, exports, tables, migrations
 * and messages (docs/guides/conventions.md, "The standard").
 */
import ts from "typescript";
import {
	base,
	type Deviation,
	exportsOf,
	isStory,
	lastWord,
	type Rule,
	sourceFiles,
	stem,
	type Tree,
} from "../tree.ts";
import {
	EXPORT_SUFFIXES,
	FEATURE_FILES,
	LAST_UNNAMED_MIGRATION,
	MIGRATION_LAYERS,
	PRODUCTS,
	ROLES,
	SHARED_MESSAGE_WORDS,
	TABLE_PREFIXES,
} from "../vocabulary.ts";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*(\.(stories|test|server|client|browser))?$/;

const fileName: Rule = {
	id: "file-name",
	rule: "Files are kebab-case (routes follow the router's grammar).",
	check: (tree) =>
		sourceFiles(tree, { stories: true })
			.filter((file) => !file.startsWith("src/routes/") && !KEBAB.test(stem(file)))
			.map((file) => ({ key: file, message: "rename it in kebab-case" })),
};

const componentRole: Rule = {
	id: "component-role",
	rule: "A feature's component file is <thing>-<role>.tsx, with a role from the list.",
	check: (tree) =>
		tree.files
			.filter(
				(file) =>
					file.startsWith("src/features/") && file.endsWith(".tsx") && !isStory(file) && !(base(file) in FEATURE_FILES),
			)
			.filter((file) => !ROLES.has(lastWord(stem(file))))
			.map((file) => ({
				key: file,
				message: `"${lastWord(stem(file))}" is not a role: end the name with what it renders (scripts/standard/vocabulary.ts, COMPONENT_ROLES)`,
			})),
};

const hookFile: Rule = {
	id: "hook-file",
	rule: "An exported hook lives in a use-<thing> file.",
	check: (tree) =>
		sourceFiles(tree)
			.filter((file) => !base(file).startsWith("use-"))
			.flatMap((file) =>
				exportsOf(tree, file)
					.filter((item) => item.kind === "value" && /^use[A-Z]/.test(item.name))
					.map((item) => ({
						key: `${file}#${item.name}`,
						line: item.line,
						message: "move the hook to a use-<thing>.ts file (a feature's hooks/, or src/hooks)",
					})),
			),
};

const isFunction = (initializer: ts.Expression | undefined) =>
	initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
const isConstant = (name: string) => /^[A-Z0-9_]+$/.test(name);

const exportName: Rule = {
	id: "export-name",
	rule: "keys.ts exports <feature>Keys; queries.ts exports <thing>QueryOptions and <feature>Mutations; collection.ts exports <feature>Rows; a schema in schema.ts ends in Schema.",
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of tree.files) {
			if (!file.startsWith("src/features/")) continue;
			const name = base(file);
			const suffixes = EXPORT_SUFFIXES[name];
			const values =
				suffixes || name === "schema.ts" ? exportsOf(tree, file).filter((item) => item.kind === "value") : [];
			for (const item of values) {
				if (suffixes) {
					if (suffixes.some((suffix) => item.name.endsWith(suffix))) continue;
					found.push({
						key: `${file}#${item.name}`,
						line: item.line,
						message: `an export of ${name} ends in ${suffixes.join(" or ")}; anything else belongs in another file`,
					});
				} else if (
					item.initializer &&
					!isFunction(item.initializer) &&
					!isConstant(item.name) &&
					!item.name.endsWith("Schema")
				) {
					found.push({
						key: `${file}#${item.name}`,
						line: item.line,
						message: `a schema is named <thing>Schema (its type is the name without "Schema"); a value that is not a schema belongs in constants.ts`,
					});
				}
			}
		}
		return found;
	},
};

const SCHEMA = "src/server/db/schema/";

/** What a table's name starts with, from the file that declares it; undefined for the core's tables. */
function tablePrefix(file: string): string | undefined {
	const [first = "", second = ""] = file.slice(SCHEMA.length).split("/");
	const layer = first.replace(/\.ts$/, "");
	if (layer in TABLE_PREFIXES) return TABLE_PREFIXES[layer];
	if (layer.startsWith("portfolio")) return TABLE_PREFIXES.portfolio;
	// An app's tables carry the app's name in the singular: forms.ts holds form and form_response.
	if (layer === "apps" && second) return second.replace(/s?\.ts$/, "");
	return undefined;
}

const tableName: Rule = {
	id: "table-name",
	rule: "A table carries its layer's prefix (tl_, pd_, ch_, kh_, portfolio_, an app's name); the core's tables have none.",
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of tree.files) {
			if (!file.startsWith(SCHEMA) || !file.endsWith(".ts")) continue;
			const prefix = tablePrefix(file);
			if (prefix === undefined) continue;
			for (const match of tree.read(file).matchAll(/pgTable\(\s*"([^"]+)"/g)) {
				const table = match[1] ?? "";
				const fits = prefix.endsWith("_")
					? table.startsWith(prefix)
					: table === prefix || table.startsWith(`${prefix}_`);
				if (!fits) found.push({ key: `${file}#${table}`, message: `the table's name starts with "${prefix}"` });
			}
		}
		return found;
	},
};

const migrationName: Rule = {
	id: "migration-name",
	rule: `A migration is NNNN_<layer>_<what>.sql, where the layer is ${MIGRATION_LAYERS.join(", ")}.`,
	check: (tree) =>
		tree.files
			.filter((file) => /^drizzle\/\d{4}_[^/]+\.sql$/.test(file))
			.filter((file) => {
				const [, number = "0", first = ""] = /^drizzle\/(\d{4})_([a-z0-9]+)/.exec(file) ?? [];
				return Number(number) > LAST_UNNAMED_MIGRATION && !(MIGRATION_LAYERS as ReadonlyArray<string>).includes(first);
			})
			.map((file) => ({
				key: file,
				message: "start the name with the layer whose tables it changes (drizzle-kit generate --name <layer>_<what>)",
			})),
};

/** The names a message may start with: every folder in src/features, in snake_case. */
function featureWords(tree: Tree): string[] {
	const names = new Set<string>();
	for (const file of tree.files) {
		if (!file.startsWith("src/features/")) continue;
		const [, , feature, app, ...rest] = file.split("/");
		if (feature && app) names.add(feature.replaceAll("-", "_"));
		// The showcase apps are features one folder down (src/features/apps/<app>).
		if (feature === "apps" && app && rest.length > 0) names.add(app.replaceAll("-", "_"));
	}
	return [...names];
}

const messageName: Rule = {
	id: "message-name",
	rule: "A message is <feature>_<part>_<name>: it starts with a feature's name, spelled out, or with a word of the shared kit.",
	check: (tree) => {
		if (!tree.files.includes("messages/en.json")) return [];
		const features = featureWords(tree);
		const strangers = new Map<string, number>();
		for (const key of Object.keys(JSON.parse(tree.read("messages/en.json")) as Record<string, string>)) {
			if (key.startsWith("$")) continue;
			const first = key.split("_")[0] ?? key;
			if (SHARED_MESSAGE_WORDS.has(first)) continue;
			if (features.some((feature) => key === feature || key.startsWith(`${feature}_`))) continue;
			strangers.set(first, (strangers.get(first) ?? 0) + 1);
		}
		return [...strangers].map(([first, count]) => {
			const product = PRODUCTS.find((name) => TABLE_PREFIXES[name] === `${first}_`);
			return {
				key: first,
				message: product
					? `${count} messages start with "${first}_": spell the product's name, "${product}_"`
					: `${count} messages start with "${first}_", which is no feature's name and no shared word (scripts/standard/vocabulary.ts, SHARED_MESSAGE_WORDS)`,
			};
		});
	},
};

export const nameRules: Rule[] = [fileName, componentRole, hookFile, exportName, tableName, migrationName, messageName];
