/**
 * Audit: every deprecated API the code uses, as TypeScript's language service reports it (the
 * struck-through names an editor shows: a library's `@deprecated` tags, and the platform's).
 *
 *   node --max-old-space-size=4096 scripts/audit/deprecated.ts
 *
 * It type-checks the whole project once, so it takes as long as a cold `pnpm typecheck` and
 * as much memory.
 *
 * Prints counts and writes docs/history/part9-audit/deprecated.json.
 * Part 9 Task 98.
 */
import ts from "typescript";
import { print, save, tally } from "./lib.ts";

const SCOPE = /^(src|tests|e2e|scripts|\.storybook|vite)\//;

const config = ts.getParsedCommandLineOfConfigFile(
	"tsconfig.json",
	{},
	{ ...ts.sys, onUnRecoverableConfigFileDiagnostic: (diagnostic) => console.error(diagnostic.messageText) },
);
if (!config) process.exit(1);

const root = ts.sys.getCurrentDirectory().split("\\").join("/");
const relative = (file: string) => (file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file);

const service = ts.createLanguageService({
	getScriptFileNames: () => config.fileNames,
	getScriptVersion: () => "1",
	getScriptSnapshot: (file) => {
		const text = ts.sys.readFile(file);
		return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
	},
	getCurrentDirectory: ts.sys.getCurrentDirectory,
	getCompilationSettings: () => config.options,
	getDefaultLibFileName: ts.getDefaultLibFilePath,
	fileExists: ts.sys.fileExists,
	readFile: ts.sys.readFile,
	readDirectory: ts.sys.readDirectory,
	directoryExists: ts.sys.directoryExists,
	getDirectories: ts.sys.getDirectories,
});

/** The package a definition lives in: `node_modules/.pnpm/…/node_modules/<name>/…` gives `<name>`. */
const packageOf = (file: string) => {
	const tail = file.split("/node_modules/").at(-1) ?? "";
	if (!file.includes("/node_modules/")) return "(this repo)";
	const parts = tail.split("/");
	return tail.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? "");
};

type Use = { file: string; line: number; name: string; from: string; message: string };
const uses: Use[] = [];
const files = config.fileNames.map(relative).filter((file) => SCOPE.test(file) && !file.startsWith("src/paraglide/"));
for (const file of files) {
	for (const diagnostic of service.getSuggestionDiagnostics(file)) {
		if (!diagnostic.reportsDeprecated) continue;
		const source = diagnostic.file;
		const start = diagnostic.start;
		const definition = service.getDefinitionAtPosition(file, start)?.[0];
		uses.push({
			file,
			line: source.getLineAndCharacterOfPosition(start).line + 1,
			name: source.text.slice(start, start + diagnostic.length),
			from: definition ? packageOf(definition.fileName) : "?",
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
		});
	}
}

print("Deprecated APIs in use", {
	uses: uses.length,
	files: new Set(uses.map((use) => use.file)).size,
	"files checked": files.length,
});
print(
	"By package",
	tally(uses, (use) => use.from),
);
print(
	"By name",
	tally(uses, (use) => `${use.from}: ${use.name}`),
	60,
);

save("deprecated", {
	generated: "node --max-old-space-size=4096 scripts/audit/deprecated.ts",
	filesChecked: files.length,
	byPackage: tally(uses, (use) => use.from),
	byName: tally(uses, (use) => `${use.from}: ${use.name}`),
	uses,
});
