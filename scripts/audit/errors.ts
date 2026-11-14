/**
 * Audit: refusals and failures on the server (docs/PLAN.md 15.5: a refusal throws an `AppError`,
 * never a bare `Error`; a server route goes through one helper).
 *
 *   node scripts/audit/errors.ts
 *
 * - **Every `throw`** in `src/server`, `src/functions` and `src/middleware`: an `AppError` (the
 *   class or a helper that builds one), a bare `Error`, a class of its own, or a rethrow.
 * - **Every `catch`** there: does it rethrow, log, or go on in silence. `.catch(…)` on a promise too.
 * - **Every server route** (`src/server/routes`, `src/routes/api`): its own helpers for the
 *   response, the secret, the method and failures.
 *
 * Prints counts and writes docs/history/part9-audit/errors.json.
 * Part 9 Task 98.
 */
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

const SCOPE = /^src\/(server|functions|middleware)\//;
const BARE = new Set(["Error", "TypeError", "RangeError", "SyntaxError"]);

const all = sourceFiles();
const files = all.filter((file) => SCOPE.test(file));

/** Every top-level function and constant in the app by name: a helper thrown by name is looked up here. */
const definitions = new Map<string, string[]>();
for (const file of all) {
	const source = parse(file);
	for (const statement of source.statements) {
		const add = (name: string, node: ts.Node) =>
			definitions.set(name, [...(definitions.get(name) ?? []), node.getText(source)]);
		if (ts.isFunctionDeclaration(statement) && statement.name) add(statement.name.text, statement);
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && declaration.initializer)
					add(declaration.name.text, declaration.initializer);
			}
		}
		if (ts.isClassDeclaration(statement) && statement.name) add(statement.name.text, statement);
	}
}

/** The names the code throws: `throw name(…)` and `throw new Name(…)`. Only these are looked up. */
const thrownNames = new Set<string>();
for (const file of files) {
	const source = parse(file);
	visit(source, (node) => {
		if (!ts.isThrowStatement(node)) return;
		const thrown = node.expression;
		if (ts.isNewExpression(thrown)) thrownNames.add(thrown.expression.getText(source));
		else if (ts.isCallExpression(thrown)) thrownNames.add(calleeName(thrown));
	});
}

/**
 * Thrown names that build an `AppError`: the definition constructs one, extends it, or returns
 * another such helper. Followed until nothing new turns up.
 */
const appHelpers = new Set(["AppError"]);
for (let grew = true; grew; ) {
	grew = false;
	const known = [...appHelpers].join("|");
	const builds = new RegExp(`(new|extends|=>|return)\\s+\\(?\\s*(${known})\\b`);
	for (const name of thrownNames) {
		if (appHelpers.has(name)) continue;
		if ((definitions.get(name) ?? []).some((text) => builds.test(text))) {
			appHelpers.add(name);
			grew = true;
		}
	}
}

// --- Throws ------------------------------------------------------------------------------------

type Throw = { file: string; line: number; layer: Layer; kind: string; what: string };
const throws: Throw[] = [];
for (const file of files) {
	const source = parse(file);
	visit(source, (node) => {
		if (!ts.isThrowStatement(node)) return;
		const thrown = node.expression;
		let kind = "something else";
		let what = thrown.getText(source).slice(0, 60);
		if (ts.isNewExpression(thrown)) {
			what = thrown.expression.getText(source);
			kind =
				what === "AppError"
					? "an AppError"
					: BARE.has(what)
						? "a bare Error"
						: appHelpers.has(what)
							? "an AppError"
							: "a class of its own";
		} else if (ts.isCallExpression(thrown)) {
			what = calleeName(thrown);
			kind = appHelpers.has(what) ? "an AppError" : "a helper that is not an AppError";
		} else if (ts.isIdentifier(thrown)) {
			kind = "a rethrow";
		}
		throws.push({ file, line: lineOf(source, node), layer: layerOf(file), kind, what });
	});
}
const bare = throws.filter((item) => item.kind === "a bare Error");

print(
	"Every throw in src/server, src/functions and src/middleware",
	tally(throws, (item) => item.kind),
);
print(
	"Bare errors by layer",
	tally(bare, (item) => item.layer),
);
print(
	"Classes of their own and helpers that are not AppErrors",
	tally(
		throws.filter((item) => /class of its own|not an AppError/.test(item.kind)),
		(item) => item.what,
	),
	25,
);

// --- Catches -----------------------------------------------------------------------------------

type Catch = { file: string; line: number; layer: Layer; form: "try" | "promise"; kind: string; comment: boolean };
const catches: Catch[] = [];
const kindOf = (body: ts.Node, source: ts.SourceFile) => {
	const text = body.getText(source);
	if (ts.isBlock(body) && body.statements.length === 0) return "empty";
	if (/\bthrow\b/.test(text)) return "rethrows or maps";
	if (/\blog\(|captureException|console\./.test(text)) return "logs and goes on";
	return "goes on in silence";
};
for (const file of files) {
	const source = parse(file);
	visit(source, (node) => {
		if (ts.isCatchClause(node)) {
			const comment = /\/\/|\/\*/.test(node.block.getFullText(source)) || commentAbove(source, node.parent) !== "";
			catches.push({
				file,
				line: lineOf(source, node),
				layer: layerOf(file),
				form: "try",
				kind: kindOf(node.block, source),
				comment,
			});
		} else if (ts.isCallExpression(node) && calleeName(node) === "catch" && node.arguments[0]) {
			const handler = node.arguments[0];
			const body = ts.isArrowFunction(handler) || ts.isFunctionExpression(handler) ? handler.body : handler;
			const comment = /\/\/|\/\*/.test(node.getFullText(source));
			catches.push({
				file,
				line: lineOf(source, node),
				layer: layerOf(file),
				form: "promise",
				kind: kindOf(body, source),
				comment,
			});
		}
	});
}
const silent = catches.filter((item) => item.kind === "empty" || item.kind === "goes on in silence");
print(
	"Every catch (try and promise)",
	tally(catches, (item) => `${item.form}: ${item.kind}`),
);
print("Silent catches", {
	total: silent.length,
	"with a comment saying why": silent.filter((item) => item.comment).length,
	"with none": silent.filter((item) => !item.comment).length,
});
print(
	"Silent catches by layer",
	tally(silent, (item) => item.layer),
);

// --- Server routes -----------------------------------------------------------------------------

type ServerRoute = { file: string; layer: Layer; lines: number; own: string[] };
const routeFiles = [...walk("src/server/routes"), ...walk("src/routes/api")];
const routes: ServerRoute[] = routeFiles.map((file) => {
	const text = parse(file).text;
	const own = [
		[/const json = /, "its own json()"],
		[/timingSafeEqual/, "its own secret check"],
		[/\.method\b/, "its own method check"],
		[/\btry\s*\{/, "its own try/catch"],
		[/\blog\(/, "log()"],
		[/new Response\(/, "new Response()"],
		[/isAppError|AppError/, "AppError"],
	]
		.filter(([pattern]) => (pattern as RegExp).test(text))
		.map(([, name]) => name as string);
	return { file, layer: layerOf(file), lines: text.split("\n").length, own };
});
print("Server routes", { files: routes.length, lines: routes.reduce((sum, route) => sum + route.lines, 0) });
print(
	"What each writes for itself",
	tally(
		routes.flatMap((route) => route.own),
		(name) => name,
	),
);

save("errors", {
	generated: "node scripts/audit/errors.ts",
	appErrorHelpers: [...appHelpers].sort(),
	throws: {
		byKind: tally(throws, (item) => item.kind),
		bare,
		other: throws.filter((item) => /class of its own|not an AppError|something else/.test(item.kind)),
	},
	catches: { byKind: tally(catches, (item) => `${item.form}: ${item.kind}`), silent },
	routes,
});
