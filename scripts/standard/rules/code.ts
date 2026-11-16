/**
 * The standard's "one way for each thing" rules: writes, reads, thin routes, key handlers, timers,
 * refusals, import boundaries and documented exports (docs/guides/conventions.md, "The standard").
 *
 * Most of these are counted per file: the list of known deviations holds how many a file has, so a
 * new one fails and a fixed one must be taken off the list.
 */
import ts from "typescript";
import {
	calleeName,
	commentAbove,
	type Deviation,
	dirOf,
	exportsOf,
	hasReason,
	importsOf,
	lineOf,
	parse,
	type Rule,
	sourceFiles,
	type Tree,
	visit,
} from "../tree.ts";
import { DOCUMENTED_FOLDERS, FORBIDDEN_IMPORTS, REASON_WORDS } from "../vocabulary.ts";

/** Every call in the files, with its file's syntax tree. */
function calls(
	tree: Tree,
	files: string[],
	each: (call: ts.CallExpression, source: ts.SourceFile, file: string) => void,
) {
	for (const file of files) {
		const source = parse(tree, file);
		visit(source, (node) => {
			if (ts.isCallExpression(node)) each(node, source, file);
		});
	}
}

const isNamed = (call: ts.CallExpression, name: string) =>
	ts.isIdentifier(call.expression) && call.expression.text === name;

const writePath: Rule = {
	id: "write-path",
	rule: "A write goes through the write hook (useCrudMutation; a form through useCrudForm), never a raw useMutation.",
	check: (tree) => {
		const found: Deviation[] = [];
		// src/components/crud is where the hook itself is built.
		const files = sourceFiles(tree).filter((file) => !file.startsWith("src/components/crud/"));
		calls(tree, files, (call, source, file) => {
			if (isNamed(call, "useMutation")) {
				found.push({
					key: file,
					line: lineOf(source, call),
					message: "useMutation: write through useCrudMutation or useCrudForm",
				});
			}
		});
		return found;
	},
};

const readPath: Rule = {
	id: "read-path",
	rule: `Page data is read with useSuspenseQuery after the loader's ensureQuery; useQuery needs enabled (asked for after an interaction) or a "// ${REASON_WORDS.read}: <reason>" comment.`,
	check: (tree) => {
		const found: Deviation[] = [];
		calls(tree, sourceFiles(tree), (call, source, file) => {
			if (!isNamed(call, "useQuery")) return;
			if (/\benabled\b/.test(call.getText(source)) || hasReason(source, call, REASON_WORDS.read)) return;
			found.push({
				key: file,
				line: lineOf(source, call),
				message: `useQuery with no reason: load it in the loader and read it with useSuspenseQuery, or say why in "// ${REASON_WORDS.read}: …"`,
			});
		});
		return found;
	},
};

const routeFiles = (tree: Tree) => sourceFiles(tree).filter((file) => file.startsWith("src/routes/"));

/**
 * The /dev examples are one file each on purpose: the page names that file as its source, so its
 * component is in it, with the hooks and the queries it reads (the router splits the component out).
 */
const EXAMPLES = /^src\/routes\/dev\//;

const routeImport: Rule = {
	id: "route-import",
	rule: "A route file imports a feature's search.ts statically, never its queries, schema or collection (a loader imports those with await import).",
	check: (tree) =>
		routeFiles(tree)
			.filter((file) => !EXAMPLES.test(file))
			.flatMap((file) =>
				importsOf(tree, file)
					.filter((item) => !item.typeOnly && /^@\/features\/.*\/(queries|schema|collections?)$/.test(item.from))
					.map((item) => ({
						key: file,
						line: item.line,
						message: `${item.from}: import it inside the loader with await import, or import the type only`,
					})),
			),
};

/** Hooks a thin route may call: what it reads from the router. */
const ROUTER_HOOKS = /^use(Search|Params|LoaderData|LoaderDeps|RouteContext|Match|Navigate)$/;

/** The root route renders the document itself: it reads the theme and the section's brand for <html>. */
const ROOT = "src/routes/__root.tsx";

const routeThin: Rule = {
	id: "route-thin",
	rule: "A route file holds its loader, search, head and a component that renders one feature component: it calls no hook but the router's.",
	check: (tree) => {
		const found: Deviation[] = [];
		const files = routeFiles(tree).filter((file) => file !== ROOT && !EXAMPLES.test(file));
		calls(tree, files, (call, source, file) => {
			const name = calleeName(call);
			if (!/^use[A-Z]/.test(name) || ROUTER_HOOKS.test(name)) return;
			found.push({
				key: file,
				line: lineOf(source, call),
				message: `${name}: a route's component renders one component from src/features and passes it what came from the URL`,
			});
		});
		return found;
	},
};

const KEY_EVENTS = new Set(["keydown", "keyup", "keypress"]);
const KEY_PROPS = new Set(["onKeyDown", "onKeyUp", "onKeyPress", "onKeyDownCapture", "onKeyUpCapture"]);

const keyHandler: Rule = {
	id: "key-handler",
	rule: `A shortcut is registered with useShortcuts (TanStack Hotkeys); a raw key listener or onKeyDown needs a "// ${REASON_WORDS.keys}: <reason>" comment.`,
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of sourceFiles(tree)) {
			const source = parse(tree, file);
			visit(source, (node) => {
				const first = ts.isCallExpression(node) ? node.arguments[0] : undefined;
				const listens =
					ts.isCallExpression(node) &&
					calleeName(node) === "addEventListener" &&
					first !== undefined &&
					ts.isStringLiteral(first) &&
					KEY_EVENTS.has(first.text);
				const prop = ts.isJsxAttribute(node) && KEY_PROPS.has(node.name.getText(source));
				if ((listens || prop) && !hasReason(source, node, REASON_WORDS.keys)) {
					found.push({
						key: file,
						line: lineOf(source, node),
						message: `a key handler: register a shortcut with useShortcuts, or say why it is not one in "// ${REASON_WORDS.keys}: …"`,
					});
				}
			});
		}
		return found;
	},
};

const TIMERS = new Set(["setTimeout", "setInterval"]);

const timer: Rule = {
	id: "timer",
	rule: `Debouncing, throttling, queuing and batching go through TanStack Pacer; any other setTimeout or setInterval needs a "// ${REASON_WORDS.timer}: <reason>" comment.`,
	check: (tree) => {
		const found: Deviation[] = [];
		calls(tree, sourceFiles(tree), (call, source, file) => {
			const name = calleeName(call);
			if (!TIMERS.has(name) || hasReason(source, call, REASON_WORDS.timer)) return;
			found.push({
				key: file,
				line: lineOf(source, call),
				message: `${name}: use TanStack Pacer, or say why it is not a debounce or a throttle in "// ${REASON_WORDS.timer}: …"`,
			});
		});
		return found;
	},
};

const SERVER_SIDE = /^src\/(server|functions|middleware)\//;

const bareError: Rule = {
	id: "bare-error",
	rule: "Server code refuses with an AppError (new AppError, ruleError, notFound), never a bare Error.",
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of sourceFiles(tree).filter((name) => SERVER_SIDE.test(name))) {
			const source = parse(tree, file);
			visit(source, (node) => {
				if (
					ts.isThrowStatement(node) &&
					ts.isNewExpression(node.expression) &&
					ts.isIdentifier(node.expression.expression) &&
					node.expression.expression.text === "Error"
				) {
					found.push({
						key: file,
						line: lineOf(source, node),
						message:
							"throw new Error: a refusal is an AppError (src/lib/errors.ts: AppError, ruleError; src/server/db/crud.ts: notFound)",
					});
				}
			});
		}
		return found;
	},
};

/** Where server routes live: Nitro's (registered in vite.config.ts) and Start's under /api. */
const SERVER_ROUTE = /^src\/(server\/routes\/[^/]+\.ts|routes\/api\/.+\.ts)$/;

const serverRoute: Rule = {
	id: "server-route",
	rule: "A server route is defineApiRoute or defineCron (src/server/http/api-route.ts, cron.ts), never a handler of its own.",
	check: (tree) => {
		const found: Deviation[] = [];
		for (const file of sourceFiles(tree).filter((name) => SERVER_ROUTE.test(name))) {
			const source = parse(tree, file);
			let defined = false;
			visit(source, (node) => {
				if (ts.isCallExpression(node) && ["defineApiRoute", "defineCron"].includes(calleeName(node))) {
					defined = true;
				}
			});
			const own = importsOf(tree, file).find((entry) => entry.from === "nitro" || entry.from === "h3");
			if (!defined || own) {
				found.push({
					key: file,
					line: own?.line ?? 1,
					message: own
						? `imports ${own.from}: a route is defineApiRoute or defineCron`
						: "no defineApiRoute or defineCron: a route says its methods, guards and limits through them",
				});
			}
		}
		return found;
	},
};

/** The folder under src/ a specifier points into, for `@/x/…` and for relative paths. */
function targetRoot(file: string, specifier: string): string | undefined {
	if (specifier.startsWith("@/")) return specifier.split("/")[1];
	if (!specifier.startsWith(".")) return undefined;
	const parts = dirOf(file).split("/");
	for (const part of specifier.split("/")) {
		if (part === "..") parts.pop();
		else if (part !== ".") parts.push(part);
	}
	return parts[0] === "src" ? parts[1] : undefined;
}

const importBoundary: Rule = {
	id: "import-boundary",
	rule: "Shared code knows no feature: src/lib, src/hooks and src/components import no feature, function, route or server code, and the server imports no component or hook.",
	check: (tree) =>
		sourceFiles(tree, { stories: true }).flatMap((file) => {
			const forbidden = FORBIDDEN_IMPORTS[file.split("/")[1] ?? ""];
			if (!forbidden) return [];
			return importsOf(tree, file)
				.filter((item) => !item.typeOnly && forbidden.includes(targetRoot(file, item.from) ?? ""))
				.map((item) => ({
					key: file,
					line: item.line,
					message: `${item.from}: src/${file.split("/")[1]} may not import src/${targetRoot(file, item.from)}`,
				}));
		}),
};

const documentedExport: Rule = {
	id: "documented-export",
	rule: "Every export of src/lib, src/hooks and src/components says what it is for in a comment above it.",
	check: (tree) =>
		sourceFiles(tree)
			.filter((file) => DOCUMENTED_FOLDERS.some((folder) => file.startsWith(folder)))
			.flatMap((file) => {
				const source = parse(tree, file);
				return exportsOf(tree, file)
					.filter((item) => item.node && commentAbove(source, item.node) === "")
					.map((item) => ({
						key: file,
						line: item.line,
						message: `${item.name}: say what it is for in a comment above it`,
					}));
			}),
};

export const codeRules: Rule[] = [
	writePath,
	readPath,
	routeImport,
	routeThin,
	keyHandler,
	timer,
	bareError,
	serverRoute,
	importBoundary,
	documentedExport,
];
