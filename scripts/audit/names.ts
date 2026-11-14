/**
 * Audit: the names of tables, migrations, messages and permissions against the standard
 * (docs/PLAN.md 15.5): a table carries its layer's prefix, a migration is `NNNN_<layer>_<what>.sql`,
 * a message is `<feature>_<part>_<name>`, a permission is `<resource>:<action>`.
 *
 *   node scripts/audit/names.ts
 *
 * Prints counts and writes docs/history/part9-audit/names.json.
 * Part 9 Task 98; Task 100 turns these checks into tests with a list of known deviations.
 */
import { readdirSync } from "node:fs";
import { layerOf, print, read, save, tally, walk } from "./lib.ts";

// --- Tables ------------------------------------------------------------------------------------

type Table = { name: string; file: string; layer: string; prefix: string };
const tables: Table[] = walk("src/server/db/schema").flatMap((file) =>
	[...read(file).matchAll(/pgTable\(\s*"([^"]+)"/g)].map((match) => {
		const name = match[1] ?? "";
		return { name, file, layer: layerOf(file), prefix: name.includes("_") ? (name.split("_")[0] ?? "") : "(none)" };
	}),
);
/** Explicit column names (`text("some_name")`); the rest come from the property through `casing: "snake_case"`. */
const explicitColumns = walk("src/server/db/schema").flatMap((file) =>
	[...read(file).matchAll(/^\s*\w+:\s*\w+\("([^"]+)"/gm)].map((match) => ({ file, name: match[1] ?? "" })),
);
const prefixesByLayer = Object.fromEntries(
	[...new Set(tables.map((table) => table.layer))].map((layer) => [
		layer,
		tally(
			tables.filter((table) => table.layer === layer),
			(table) => table.prefix,
		),
	]),
);
print(
	"Tables by layer",
	tally(tables, (table) => table.layer),
);
for (const [layer, prefixes] of Object.entries(prefixesByLayer)) print(`Table prefixes: ${layer}`, prefixes, 12);
print("Columns", {
	"named explicitly": explicitColumns.length,
	"of those not snake_case": explicitColumns.filter((column) => !/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(column.name))
		.length,
});

// --- Migrations --------------------------------------------------------------------------------

const migrations = readdirSync("drizzle").filter((name) => name.endsWith(".sql"));
const migrationWord = (name: string) => name.replace(/^\d+_/, "").split(/[_.]/)[0] ?? "";
print("Migrations", {
	files: migrations.length,
	"named NNNN_<words>.sql": migrations.filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).length,
});
print("First word after the number", tally(migrations, migrationWord), 30);

// --- Messages ----------------------------------------------------------------------------------

const messages = Object.keys(JSON.parse(read("messages/en.json")) as Record<string, unknown>).filter(
	(key) => key !== "$schema",
);
const snake = messages.filter((key) => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(key));
const firstWords = tally(messages, (key) => key.split("_")[0]);
print("Messages", {
	keys: messages.length,
	snake_case: snake.length,
	"with three parts or more": messages.filter((key) => key.split("_").length >= 3).length,
	"with one part": messages.filter((key) => !key.includes("_")).length,
	"distinct first words": Object.keys(firstWords).length,
});
print("First word of a message key", firstWords, 45);

// --- Permissions -------------------------------------------------------------------------------

// The catalog's lines: `resource: ["action", …],` (src/features/rbac/permissions.ts).
const catalog = read("src/features/rbac/permissions.ts").split("ALL_PERMISSIONS")[0] ?? "";
const permissions = [...catalog.matchAll(/^\s*"?([a-z][\w-]*)"?:\s*\[([^\]]*)\]/gm)]
	.flatMap((match) =>
		[...(match[2] ?? "").matchAll(/"([^"]+)"/g)].map((action) => `${match[1] ?? ""}:${action[1] ?? ""}`),
	)
	.sort();
print("Permissions", {
	"<resource>:<action> in the catalog": permissions.length,
	resources: new Set(permissions.map((permission) => permission.split(":")[0])).size,
});
print(
	"Actions",
	tally(permissions, (permission) => permission.split(":")[1]),
	40,
);

save("names", {
	generated: "node scripts/audit/names.ts",
	tables: { total: tables.length, byLayer: tally(tables, (table) => table.layer), prefixesByLayer, list: tables },
	columns: { explicit: explicitColumns },
	migrations: { total: migrations.length, firstWords: tally(migrations, migrationWord), list: migrations },
	messages: { total: messages.length, notSnakeCase: messages.filter((key) => !snake.includes(key)), firstWords },
	permissions: { list: permissions, actions: tally(permissions, (permission) => permission.split(":")[1]) },
});
