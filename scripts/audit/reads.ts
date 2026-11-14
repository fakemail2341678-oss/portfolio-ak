/**
 * Audit: how pages get their data (docs/PLAN.md 15.5: the loader awaits `ensureQuery`, the
 * component calls `useSuspenseQuery`; `useQuery` only with a reason; lists under a contract).
 *
 *   node scripts/audit/reads.ts
 *
 * - **Every `useQuery`** with the reason the code gives: `enabled` (asked for after an
 *   interaction), `refetchInterval` (live), a comment above it, or none.
 * - **Every route:** its loader, search schema, head and own states, what its loader calls, and
 *   whether its page component reads data while the route has no loader. A parent route's
 *   loader may have loaded that data: the browser check in `screens.spec.ts` is the proof
 *   ("the first load asks for nothing"); this is the list to look at.
 * - **Every `list…` server function** and the contract its input follows.
 *
 * Prints counts and writes docs/history/part9-audit/reads.json.
 * Part 9 Task 98.
 */
import { existsSync } from "node:fs";
import ts from "typescript";
import {
	calleeName,
	commentAbove,
	type Layer,
	layerOf,
	lineOf,
	parse,
	print,
	save,
	sourceFiles,
	tally,
	visit,
	walk,
} from "./lib.ts";

const READ_HOOKS = [
	"useQuery",
	"useSuspenseQuery",
	"useInfiniteQuery",
	"useSuspenseInfiniteQuery",
	"useQueries",
	"useSuspenseQueries",
	"useLiveQuery",
];

const files = sourceFiles();

/** The statement a node sits in: its comment is the node's reason. */
const statementOf = (node: ts.Node): ts.Node => {
	let current = node;
	while (current.parent && !ts.isStatement(current)) current = current.parent;
	return current;
};

// --- Hooks -------------------------------------------------------------------------------------

type Read = { file: string; line: number; layer: Layer; hook: string; reason: string; comment: string };
const reads: Read[] = [];
for (const file of files) {
	const source = parse(file);
	if (!READ_HOOKS.some((hook) => source.text.includes(hook))) continue;
	visit(source, (node) => {
		if (!ts.isCallExpression(node)) return;
		const hook = calleeName(node);
		if (!READ_HOOKS.includes(hook)) return;
		const text = node.getText(source);
		const comment = commentAbove(source, statementOf(node));
		const reason = /\benabled\b/.test(text)
			? "enabled: after an interaction"
			: /\brefetchInterval\b/.test(text)
				? "refetchInterval: live"
				: comment
					? "a comment"
					: "none";
		reads.push({
			file,
			line: lineOf(source, node),
			layer: layerOf(file),
			hook,
			reason,
			comment: comment.slice(0, 160),
		});
	});
}
const queries = reads.filter((read) => read.hook === "useQuery");

print(
	"Read hooks",
	tally(reads, (read) => read.hook),
);
print(
	"useQuery by layer",
	tally(queries, (read) => read.layer),
);
print(
	"useQuery by the reason the code gives",
	tally(queries, (read) => read.reason),
);
print(
	"useQuery with no reason, by layer",
	tally(
		queries.filter((read) => read.reason === "none"),
		(read) => read.layer,
	),
);

// --- Routes ------------------------------------------------------------------------------------

type Route = {
	file: string;
	layer: Layer;
	loader: boolean;
	loaderCalls: string[];
	search: boolean;
	head: boolean;
	states: string[];
	/** Static imports of a feature's queries, schema or collection (0151, 0194: they belong in the loader's `await import`). */
	heavyImports: string[];
	/** Read hooks in the page components this route file imports. */
	pageReads: Record<string, number>;
};

const resolveImport = (specifier: string) => {
	if (!specifier.startsWith("@/")) return undefined;
	const start = `src/${specifier.slice(2)}`;
	return [`${start}.tsx`, `${start}.ts`, `${start}/index.tsx`, `${start}/index.ts`].find((candidate) =>
		existsSync(candidate),
	);
};

const routeFiles = walk("src/routes").filter(
	(file) => !file.startsWith("src/routes/api/") && /createFileRoute|createRootRoute/.test(parse(file).text),
);
const routes: Route[] = routeFiles.map((file) => {
	const source = parse(file);
	const text = source.text;
	const pageReads: Record<string, number> = {};
	const heavyImports: string[] = [];
	for (const statement of source.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		if (statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
		const specifier = statement.moduleSpecifier.text;
		if (/^@\/features\/.*\/(queries|schema|collections?)$/.test(specifier)) heavyImports.push(specifier);
		const target = resolveImport(specifier);
		if (!target?.endsWith(".tsx")) continue;
		const page = parse(target).text;
		for (const hook of READ_HOOKS) {
			const count = page.match(new RegExp(`\\b${hook}\\(`, "g"))?.length ?? 0;
			if (count > 0) pageReads[hook] = (pageReads[hook] ?? 0) + count;
		}
	}
	return {
		file,
		layer: layerOf(file),
		loader: /\bloader\s*[:(]/.test(text),
		loaderCalls: [
			"ensureQuery",
			"listLoader",
			"loadList",
			"ensureQueryData",
			"prefetchQuery",
			"fetchQuery",
			"ensureInfiniteQueryData",
		].filter((name) => new RegExp(`\\b${name}\\(`).test(text)),
		search: /\bvalidateSearch\b/.test(text),
		head: /\bhead\s*[:(]/.test(text),
		states: ["pendingComponent", "errorComponent", "notFoundComponent"].filter((name) => text.includes(name)),
		heavyImports,
		pageReads,
	};
});
const readsData = (route: Route) => Object.keys(route.pageReads).length > 0;
const noLoader = routes.filter((route) => !route.loader && readsData(route));

print("Routes (pages and layouts, not /api)", {
	files: routes.length,
	"with a loader": routes.filter((route) => route.loader).length,
	"with a search schema": routes.filter((route) => route.search).length,
	"with head": routes.filter((route) => route.head).length,
	"with a state of their own (pending, error, not found)": routes.filter((route) => route.states.length > 0).length,
	"importing a feature's queries, schema or collection statically": routes.filter(
		(route) => route.heavyImports.length > 0,
	).length,
});
print(
	"What loaders call",
	tally(
		routes.flatMap((route) => route.loaderCalls),
		(name) => name,
	),
);
print(
	"Routes whose page reads data and that have no loader of their own, by layer",
	tally(noLoader, (route) => route.layer),
);

// --- Lists -------------------------------------------------------------------------------------

/** The source text of every top-level `const name = …` in the app, to follow a schema's name to its definition. */
const definitions = new Map<string, string>();
for (const file of files) {
	for (const statement of parse(file).statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.initializer && !definitions.has(declaration.name.text)) {
				definitions.set(declaration.name.text, declaration.initializer.getText());
			}
		}
	}
}

type ListFunction = { name: string; file: string; layer: Layer; input: string; contract: string };
const lists: ListFunction[] = [];
for (const file of walk("src/functions")) {
	const text = parse(file).text;
	for (const match of text.matchAll(/export const (list[A-Z]\w*) = createServerFn\([^)]*\)([\s\S]*?)\.handler\(/g)) {
		const input = match[2]?.match(/\.validator\(zodInput\(([^)]+)\)\)/)?.[1]?.trim() ?? "";
		const root = input.split(".")[0] ?? "";
		const definition = definitions.get(root) ?? "";
		const contract =
			input === ""
				? "no input"
				: input.endsWith(".input") && definition.includes("listSchema(")
					? "the list contract (listSchema)"
					: /cursor/i.test(`${input} ${definition}`)
						? "a cursor"
						: /\bpage\b|pageParam|pageSize/i.test(`${input} ${definition}`)
							? "paging of its own"
							: "no paging";
		lists.push({ name: match[1] ?? "", file, layer: layerOf(file), input, contract });
	}
}
print(
	"`list…` server functions by the contract of their input",
	tally(lists, (list) => list.contract),
);
print(
	"`list…` functions with no paging or paging of their own, by layer",
	tally(
		lists.filter((list) => !/listSchema|cursor/.test(list.contract)),
		(list) => list.layer,
	),
);
const listPages = files.filter((file) => /\buseListPage\(/.test(parse(file).text));
const tables = files.filter((file) => /<DataTable\b/.test(parse(file).text));
print("List pages", {
	"components calling useListPage": listPages.length,
	"components rendering <CrudListPage>": files.filter((file) => /<CrudListPage\b/.test(parse(file).text)).length,
	"components rendering <DataTable>": tables.length,
	"…of those without useListPage or CrudListPage": tables.filter(
		(file) => !/useListPage\(|<CrudListPage\b/.test(parse(file).text),
	).length,
});

save("reads", {
	generated: "node scripts/audit/reads.ts",
	hooks: tally(reads, (read) => read.hook),
	useQuery: {
		total: queries.length,
		byLayer: tally(queries, (read) => read.layer),
		byReason: tally(queries, (read) => read.reason),
		list: queries,
	},
	routes: {
		total: routes.length,
		withLoader: routes.filter((route) => route.loader).length,
		readingWithoutLoader: noLoader.map((route) => ({ file: route.file, pageReads: route.pageReads })),
		heavyImports: routes
			.filter((route) => route.heavyImports.length > 0)
			.map((route) => ({ file: route.file, imports: route.heavyImports })),
		list: routes,
	},
	lists: { byContract: tally(lists, (list) => list.contract), list: lists },
});
