/**
 * The standard's rules for server functions: the verb, the guards and their order, the validator,
 * and a handler that is one call into a service (docs/guides/conventions.md, "The standard").
 */
import ts from "typescript";
import { type Deviation, lineOf, parse, type Rule, type Tree } from "../tree.ts";
import { DOMAIN_VERBS, FOLDED_VERBS, REQUIRE_GUARDS, STANDARD_VERBS, WITH_GUARDS } from "../vocabulary.ts";

type ServerFunction = {
	name: string;
	file: string;
	line: number;
	/** Each guard as written: `requirePermission("a:b")`, `withServices`. */
	guards: string[];
	/** The validator's callee (`zodInput`), "other" for any other expression, "none" without one. */
	validator: string;
	/** `call`: the handler is one expression. `block`: it has statements of its own. */
	handler: "call" | "block" | "none";
	/** Whether the handler reads `data`. */
	readsData: boolean;
};

function readChain(initializer: ts.Expression, source: ts.SourceFile) {
	const found = {
		guards: [] as string[],
		validator: "none",
		handler: "none" as ServerFunction["handler"],
		readsData: false,
	};
	let node: ts.Expression = initializer;
	while (ts.isCallExpression(node)) {
		const callee = node.expression;
		const first = node.arguments[0];
		if (ts.isIdentifier(callee) && callee.text === "createServerFn") return found;
		if (!ts.isPropertyAccessExpression(callee)) return undefined;
		const step = callee.name.text;
		if (step === "middleware" && first && ts.isArrayLiteralExpression(first)) {
			found.guards = first.elements.map((element) => element.getText(source));
		} else if (step === "validator" || step === "inputValidator") {
			found.validator = first && ts.isCallExpression(first) ? first.expression.getText(source) : "other";
		} else if (step === "handler" && first) {
			const isFunction = ts.isArrowFunction(first) || ts.isFunctionExpression(first);
			const body = isFunction ? first.body : undefined;
			found.handler = body && ts.isBlock(body) && body.statements.length > 1 ? "block" : "call";
			const parameter = isFunction ? first.parameters[0]?.name : undefined;
			found.readsData =
				parameter !== undefined &&
				ts.isObjectBindingPattern(parameter) &&
				parameter.elements.some((element) => (element.propertyName ?? element.name).getText(source) === "data");
		}
		node = callee.expression;
	}
	return undefined;
}

const functionFiles = (tree: Tree) =>
	tree.files.filter(
		(file) => file.startsWith("src/functions/") && file.endsWith(".ts") && !file.startsWith("src/functions/_lib/"),
	);

const functions = new WeakMap<Tree, ServerFunction[]>();

/** Every server function declared as `const name = createServerFn(…)…` at the top of a functions file. */
function serverFunctions(tree: Tree): ServerFunction[] {
	let found = functions.get(tree);
	if (found) return found;
	found = [];
	for (const file of functionFiles(tree)) {
		const source = parse(tree, file);
		for (const statement of source.statements) {
			if (!ts.isVariableStatement(statement)) continue;
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
				const chain = readChain(declaration.initializer, source);
				if (chain) found.push({ name: declaration.name.text, file, line: lineOf(source, declaration), ...chain });
			}
		}
	}
	functions.set(tree, found);
	return found;
}

const each = (tree: Tree, problem: (fn: ServerFunction) => string | undefined): Deviation[] =>
	serverFunctions(tree).flatMap((fn) => {
		const message = problem(fn);
		return message ? [{ key: `${fn.file}#${fn.name}`, line: fn.line, message }] : [];
	});

const functionLiteral: Rule = {
	id: "function-literal",
	rule: "A server function is a literal createServerFn(…) chain assigned to a const (Start extracts them statically).",
	check: (tree) =>
		functionFiles(tree).flatMap((file) => {
			const written = tree.read(file).match(/\bcreateServerFn\(/g)?.length ?? 0;
			const declared = serverFunctions(tree).filter((fn) => fn.file === file).length;
			return written === declared
				? []
				: [
						{
							key: file,
							message: `${written} createServerFn( calls but ${declared} declared as "const name = createServerFn(…)…"`,
						},
					];
		}),
};

const functionVerb: Rule = {
	id: "function-verb",
	rule: "A server function's name starts with a verb of the standard, or with a listed domain verb.",
	check: (tree) =>
		each(tree, (fn) => {
			const verb = fn.name.match(/^[a-z]+/)?.[0] ?? fn.name;
			if (STANDARD_VERBS.has(verb) || DOMAIN_VERBS.has(verb)) return undefined;
			const use = FOLDED_VERBS[verb];
			return use
				? `"${verb}" is said by a standard verb: use ${use}`
				: `"${verb}" is not a verb of the standard: use one, or add it to DOMAIN_VERBS (scripts/standard/vocabulary.ts) with a decision`;
		}),
};

const guardName = (guard: string) => guard.replace(/\(.*$/s, "");

const functionGuards: Rule = {
	id: "function-guards",
	rule: "A server function's middleware is require<Who> guards, then with<What> providers, from the guard vocabulary.",
	check: (tree) =>
		each(tree, (fn) => {
			const names = fn.guards.map(guardName);
			if (names.length === 0) return "no guard: a public function says so with a with…Public provider";
			const unknown = names.filter((name) => !REQUIRE_GUARDS.has(name) && !WITH_GUARDS.has(name));
			if (unknown.length > 0) return `${unknown.join(", ")}: not in the guard vocabulary (require<Who>, with<What>)`;
			const firstWith = names.findIndex((name) => WITH_GUARDS.has(name));
			const lastRequire = names.map((name) => REQUIRE_GUARDS.has(name)).lastIndexOf(true);
			if (firstWith !== -1 && lastRequire > firstWith)
				return "a require… guard comes after a with… provider: refuse first";
			const permission = fn.guards.find((guard) => guard.startsWith("requirePermission("));
			if (permission && !/^requirePermission\("[a-z][a-z-]*:[a-z][a-z-]*"\)$/.test(permission)) {
				return `${permission}: a permission is "<resource>:<action>"`;
			}
			return undefined;
		}),
};

const functionValidator: Rule = {
	id: "function-validator",
	rule: "A server function that takes data validates it with .validator(zodInput(schema)).",
	check: (tree) =>
		each(tree, (fn) => {
			if (fn.validator === "none") return fn.readsData ? "the handler reads data with no validator" : undefined;
			return fn.validator === "zodInput" ? undefined : "the validator is not zodInput(schema)";
		}),
};

const functionHandler: Rule = {
	id: "function-handler",
	rule: "A server function's handler is one call into a service.",
	check: (tree) =>
		each(tree, (fn) =>
			fn.handler === "block" ? "the handler has statements of its own: move them into the service" : undefined,
		),
};

export const functionRules: Rule[] = [
	functionLiteral,
	functionVerb,
	functionGuards,
	functionValidator,
	functionHandler,
];
