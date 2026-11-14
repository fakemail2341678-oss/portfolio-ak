/**
 * Audit: every server function against the standard (docs/PLAN.md 15.5): its verb, its guards and
 * their order, its validator, and whether the handler is one call into a service.
 *
 *   node scripts/audit/functions.ts
 *
 * Prints counts and writes docs/history/part9-audit/functions.json with every function.
 * Part 9 Task 98; Task 100 turns these checks into tests with a list of known deviations.
 */
import ts from "typescript";
import { type Layer, layerOf, lineOf, parse, print, save, tally, walk } from "./lib.ts";

/** One word per meaning (15.5). `set`, `is`: the first word of `set<Field>`, `is<Check>`. */
const STANDARD_VERBS = new Set([
	"list",
	"get",
	"search",
	"create",
	"update",
	"delete",
	"set",
	"add",
	"remove",
	"trash",
	"restore",
	"purge",
	"reorder",
	"is",
	"import",
	"export",
]);
/** Folded into the verbs above by 15.5. */
const FOLDED_VERBS = new Set(["save", "find", "locate", "fetch", "patch", "toggle", "mark"]);

type ServerFunction = {
	name: string;
	file: string;
	line: number;
	layer: Layer;
	method: string;
	verb: string;
	verbClass: "standard" | "folded" | "domain";
	guards: string[];
	validator: string;
	/** `call`: the handler is one expression. `block`: it has statements of its own. */
	handler: "call" | "block" | "none";
};

const text = (node: ts.Node, source: ts.SourceFile) => node.getText(source);

/** `requirePermission("a:b")` gives `requirePermission("a:b")`; the test for order uses the name only. */
const guardName = (guard: string) => guard.replace(/\(.*$/s, "");

function readChain(initializer: ts.Expression, source: ts.SourceFile) {
	const found = { method: "", guards: [] as string[], validator: "none", handler: "none" as ServerFunction["handler"] };
	let created = false;
	let node: ts.Expression = initializer;
	while (ts.isCallExpression(node)) {
		const callee = node.expression;
		const first = node.arguments[0];
		if (ts.isIdentifier(callee) && callee.text === "createServerFn") {
			created = true;
			found.method = first ? (text(first, source).match(/method:\s*"(\w+)"/)?.[1] ?? "GET") : "GET";
			break;
		}
		if (!ts.isPropertyAccessExpression(callee)) break;
		const step = callee.name.text;
		if (step === "middleware" && first && ts.isArrayLiteralExpression(first)) {
			found.guards = first.elements.map((element) => text(element, source));
		} else if (step === "validator" || step === "inputValidator") {
			found.validator = first && ts.isCallExpression(first) ? text(first.expression, source) : "other";
		} else if (step === "handler" && first) {
			const body = ts.isArrowFunction(first) || ts.isFunctionExpression(first) ? first.body : undefined;
			found.handler = body && ts.isBlock(body) && body.statements.length > 1 ? "block" : "call";
		}
		node = callee.expression;
	}
	return created ? found : undefined;
}

const functions: ServerFunction[] = [];
const files = walk("src/functions").filter((file) => !file.startsWith("src/functions/_lib/"));
for (const file of files) {
	const source = parse(file);
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			const chain = readChain(declaration.initializer, source);
			if (!chain) continue;
			const name = declaration.name.text;
			const verb = name.match(/^[a-z]+/)?.[0] ?? name;
			functions.push({
				name,
				file,
				line: lineOf(source, declaration),
				layer: layerOf(file),
				verb,
				verbClass: STANDARD_VERBS.has(verb) ? "standard" : FOLDED_VERBS.has(verb) ? "folded" : "domain",
				...chain,
			});
		}
	}
}

/** `require…` refuses, `with…` provides, in that order (15.5). */
const orderOf = (guards: string[]) => {
	const names = guards.map(guardName);
	if (names.length === 0) return "no guard";
	if (names.some((name) => !/^(require|with)[A-Z]/.test(name))) return "another name";
	const firstWith = names.findIndex((name) => name.startsWith("with"));
	const lastRequire = names.map((name) => name.startsWith("require")).lastIndexOf(true);
	return firstWith !== -1 && lastRequire > firstWith ? "with before require" : "require, then with";
};

const literal = files.reduce((sum, file) => sum + (parse(file).text.match(/createServerFn\(/g)?.length ?? 0), 0);

print("Server functions", {
	functions: functions.length,
	files: new Set(functions.map((item) => item.file)).size,
	"createServerFn( in the source": literal,
	GET: functions.filter((item) => item.method === "GET").length,
	POST: functions.filter((item) => item.method === "POST").length,
});
print(
	"By layer",
	tally(functions, (item) => item.layer),
);
print(
	"Verbs: standard, folded by 15.5, or a domain verb",
	tally(functions, (item) => item.verbClass),
);
print(
	"Folded verbs in use",
	tally(
		functions.filter((item) => item.verbClass === "folded"),
		(item) => item.verb,
	),
);
print(
	"Domain verbs in use",
	tally(
		functions.filter((item) => item.verbClass === "domain"),
		(item) => item.verb,
	),
	60,
);
print(
	"Guard chains",
	tally(functions, (item) => orderOf(item.guards)),
);
print(
	"Guard names",
	tally(
		functions.flatMap((item) => item.guards.map(guardName)),
		(name) => name,
	),
	40,
);
print(
	"Validators",
	tally(functions, (item) => item.validator),
);
print(
	"Handlers",
	tally(functions, (item) => item.handler),
);
print(
	"POST functions without a validator",
	tally(
		functions.filter((item) => item.method === "POST" && item.validator === "none"),
		(item) => item.layer,
	),
);

save("functions", {
	generated: "node scripts/audit/functions.ts",
	total: functions.length,
	byLayer: tally(functions, (item) => item.layer),
	byMethod: tally(functions, (item) => item.method),
	verbClasses: tally(functions, (item) => item.verbClass),
	verbs: tally(functions, (item) => item.verb),
	guardChains: tally(functions, (item) => orderOf(item.guards)),
	guardNames: tally(
		functions.flatMap((item) => item.guards.map(guardName)),
		(name) => name,
	),
	validators: tally(functions, (item) => item.validator),
	handlers: tally(functions, (item) => item.handler),
	functions,
});
