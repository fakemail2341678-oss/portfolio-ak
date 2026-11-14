/**
 * Audit: effects by purpose, casts, lint suppressions, default exports, and the hand-written
 * timers and key handlers that docs/PLAN.md 15.5 gives to TanStack Pacer and TanStack Hotkeys.
 *
 *   node scripts/audit/code.ts
 *
 * An effect's purpose is read from what its body does: the first match in PURPOSES wins.
 * Prints counts and writes docs/history/part9-audit/code.json.
 * Part 9 Task 98.
 */
import ts from "typescript";
import {
	calleeName,
	exportsOf,
	type Layer,
	layerOf,
	lineOf,
	parse,
	print,
	read,
	save,
	sourceFiles,
	tally,
	visit,
	walk,
} from "./lib.ts";

const files = sourceFiles();
type Hit = { file: string; line: number; layer: Layer };
const hit = (file: string, line: number): Hit => ({ file, line, layer: layerOf(file) });

// --- Effects -----------------------------------------------------------------------------------

/** What an effect is for, by what its body does. The order decides when a body does several things. */
const PURPOSES: ReadonlyArray<[purpose: string, pattern: RegExp]> = [
	[
		"subscribes to a stream, a channel or a store",
		/EventSource|WebSocket|\.subscribe\(|BroadcastChannel|ably|\.on\(|navigator\.locks/i,
	],
	["listens to key presses", /addEventListener\(\s*"key(down|up|press)"/],
	["listens to another DOM event", /addEventListener\(/],
	["runs a timer", /setTimeout\(|setInterval\(|requestAnimationFrame\(|requestIdleCallback\(/],
	["observes size, visibility or mutations", /ResizeObserver|IntersectionObserver|MutationObserver|matchMedia/],
	[
		"fetches or writes (a query's or a mutation's job)",
		/\bfetch\(|\.mutate(Async)?\(|refetch\(|invalidateQueries|ensureQuery|prefetchQuery|Fn\(\{/,
	],
	["reads or writes storage", /localStorage|sessionStorage|indexedDB|document\.cookie/],
	["moves focus or scroll", /\.focus\(|scrollIntoView|scrollTo\(|\.select\(\)/],
	[
		"drives a library object (editor, board, engine, chart, player)",
		/editor\.|engine\.|worker\.|\.postMessage\(|chart\.|player\.|\.destroy\(|audio|Audio\(/i,
	],
	["navigates", /navigate\(|router\.|history\./],
	["touches the document (title, class, attribute)", /document\.|window\./],
	["copies props or state into state", /\bset[A-Z]\w*\(/],
	["keeps a ref current", /\.current\s*=/],
];

type Effect = Hit & { hook: string; purpose: string; lines: number };
const effects: Effect[] = [];
for (const file of files) {
	const source = parse(file);
	if (!/use(Layout|Insertion)?Effect/.test(source.text)) continue;
	visit(source, (node) => {
		if (!ts.isCallExpression(node)) return;
		const hook = calleeName(node);
		if (hook !== "useEffect" && hook !== "useLayoutEffect" && hook !== "useInsertionEffect") return;
		const body = node.arguments[0]?.getText(source) ?? "";
		const purpose = PURPOSES.find(([, pattern]) => pattern.test(body))?.[0] ?? "something else";
		effects.push({ ...hit(file, lineOf(source, node)), hook, purpose, lines: body.split("\n").length });
	});
}
print("Effects", { total: effects.length, files: new Set(effects.map((effect) => effect.file)).size });
print(
	"Effects by purpose",
	tally(effects, (effect) => effect.purpose),
);
print(
	"Effects by layer",
	tally(effects, (effect) => effect.layer),
);

// --- Casts and suppressions --------------------------------------------------------------------

const doubleCasts: Hit[] = [];
const anyCasts: Hit[] = [];
const nonNull: Hit[] = [];
for (const file of files) {
	const source = parse(file);
	visit(source, (node) => {
		if (ts.isAsExpression(node)) {
			const inner = node.expression;
			if (ts.isAsExpression(inner) && inner.type.kind === ts.SyntaxKind.UnknownKeyword)
				doubleCasts.push(hit(file, lineOf(source, node)));
			if (node.type.kind === ts.SyntaxKind.AnyKeyword) anyCasts.push(hit(file, lineOf(source, node)));
		} else if (ts.isNonNullExpression(node)) {
			nonNull.push(hit(file, lineOf(source, node)));
		}
	});
}

type Suppression = Hit & { kind: string; rule: string; reason: string };
const suppressions: Suppression[] = [];
for (const file of [...sourceFiles({ stories: true }), ...walk("tests"), ...walk("e2e"), ...walk("scripts")]) {
	const lines = read(file).split("\n");
	lines.forEach((line, index) => {
		const biome = line.match(/biome-ignore(?:-all|-start)?\s+([\w/]+)(?:\([^)]*\))?:?\s*(.*)$/);
		if (biome)
			suppressions.push({
				...hit(file, index + 1),
				kind: "biome-ignore",
				rule: biome[1] ?? "",
				reason: (biome[2] ?? "").trim(),
			});
		const tsDirective = line.match(/@ts-(expect-error|ignore|nocheck)\b:?\s*(.*)$/);
		if (tsDirective) {
			suppressions.push({
				...hit(file, index + 1),
				kind: `@ts-${tsDirective[1]}`,
				rule: "",
				reason: (tsDirective[2] ?? "").replace(/\*\/\s*$/, "").trim(),
			});
		}
	});
}
print("Casts in src", {
	"`as unknown as`": doubleCasts.length,
	"`as any`": anyCasts.length,
	"non-null assertions (`!`)": nonNull.length,
});
print(
	"`as unknown as` by layer",
	tally(doubleCasts, (item) => item.layer),
);
print(
	"Suppressions (src, tests, e2e, scripts)",
	tally(suppressions, (item) => item.kind),
);
print(
	"biome-ignore by rule",
	tally(
		suppressions.filter((item) => item.kind === "biome-ignore"),
		(item) => item.rule,
	),
	25,
);
print("Suppressions with no reason", { total: suppressions.filter((item) => item.reason.length < 8).length });

// --- Default exports ---------------------------------------------------------------------------

/** A default export the tool that loads the file asks for: stories, Nitro routes and plugins. */
const NEEDS_DEFAULT = /\.stories\.tsx$|^src\/server\/(routes|plugins)\/|^src\/(server|start|router|client)\.tsx?$/;
const defaults = sourceFiles({ stories: true }).filter((file) =>
	exportsOf(file).some((item) => item.kind === "default"),
);
print("Default exports", {
	"asked for by a tool (stories, Nitro routes and plugins)": defaults.filter((file) => NEEDS_DEFAULT.test(file)).length,
	"the rest": defaults.filter((file) => !NEEDS_DEFAULT.test(file)).length,
});

// --- Hand-written timers, key handlers and memoization -----------------------------------------

const count = (pattern: RegExp) => {
	const found: Hit[] = [];
	for (const file of files) {
		const lines = parse(file).text.split("\n");
		lines.forEach((line, index) => {
			if (pattern.test(line)) found.push(hit(file, index + 1));
		});
	}
	return found;
};
const patterns = {
	"setTimeout(": count(/\bsetTimeout\(/),
	"setInterval(": count(/\bsetInterval\(/),
	"useDebouncedValue(": count(/\buseDebouncedValue\(/),
	"debounce or throttle by name": count(/\b(debounce|throttle)[A-Z(]/i),
	"useHotkeys(": count(/\buseHotkeys\(/),
	"onKeyDown=": count(/\bonKeyDown=/),
	'addEventListener("keydown"': count(/addEventListener\(\s*"keydown"/),
	"useMemo(": count(/\buseMemo\(/),
	"useCallback(": count(/\buseCallback\(/),
	"console.* in src/server": count(/\bconsole\.(log|warn|error|info|debug)\(/).filter((item) =>
		item.file.startsWith("src/server/"),
	),
	"console.* elsewhere in src": count(/\bconsole\.(log|warn|error|info|debug)\(/).filter(
		(item) => !item.file.startsWith("src/server/"),
	),
};
print(
	"Hand-written timers, key handlers, memoization, console",
	Object.fromEntries(Object.entries(patterns).map(([name, hits]) => [name, hits.length])),
);
print(
	"setTimeout and setInterval by layer",
	tally([...patterns["setTimeout("], ...patterns["setInterval("]], (item) => item.layer),
);
print(
	"onKeyDown and keydown listeners by layer",
	tally([...patterns["onKeyDown="], ...patterns['addEventListener("keydown"']], (item) => item.layer),
);

save("code", {
	generated: "node scripts/audit/code.ts",
	effects: {
		total: effects.length,
		byPurpose: tally(effects, (effect) => effect.purpose),
		byLayer: tally(effects, (effect) => effect.layer),
		list: effects,
	},
	casts: { doubleCasts, anyCasts, nonNull: { total: nonNull.length, byLayer: tally(nonNull, (item) => item.layer) } },
	suppressions: { byKind: tally(suppressions, (item) => item.kind), list: suppressions },
	defaultExports: {
		needed: defaults.filter((file) => NEEDS_DEFAULT.test(file)).length,
		rest: defaults.filter((file) => !NEEDS_DEFAULT.test(file)),
	},
	patterns: Object.fromEntries(
		Object.entries(patterns).map(([name, hits]) => [
			name,
			{
				total: hits.length,
				byLayer: tally(hits, (item) => item.layer),
				files: [...new Set(hits.map((item) => item.file))],
			},
		]),
	),
});
