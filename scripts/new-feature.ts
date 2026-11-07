/**
 * pnpm new:feature <name> [--title "Projects"] [--title-ne "परियोजनाहरू"] [--public] [--localized] [--no-build]
 *
 * Generates an admin CRUD section in the CRUD standard's shape (docs/guides/crud.md,
 * decision 0173): table + migration, the URL contract, schemas and DTOs, keys,
 * queries and mutations, columns, filters, a palette command, the list, form and
 * detail components, guarded server functions on `withServices`, repository and
 * service (audited creates, edits and deletes), thin routes, messages in both
 * languages, stories with their mocks, a PGlite test, and the entries shared lists
 * need (at their `// @new-feature:<slot>` lines). The result passes every gate as
 * generated.
 *
 * - `--public`: a slug and a "published" switch, public list and detail pages under
 *   `_public` (seo()/listSeo(), in the sitemap), read without signing in.
 * - `--localized`: the title and notes are typed in both languages (`{ en, ne }`,
 *   LocalizedField), shown in the reader's language.
 *
 * It refuses to run with uncommitted changes to tracked files, and on any failure
 * puts the tree back (`git checkout -- .`, and `git clean` on the files it created).
 * Templates live in scripts/templates/feature: paths and contents use the tokens
 * below, `{{#flag}}…{{/flag}}` / `{{^flag}}…{{/flag}}` sections keep text with or
 * without a flag, and `*.public.tpl` files exist only with --public.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templates = path.join(root, "scripts/templates/feature");

/** Files this run created and shared files it changed: what a failure puts back. */
const created: string[] = [];
let touchedTree = false;

const rollback = () => {
	if (!touchedTree) return;
	console.error("new:feature: putting the tree back");
	spawnSync("git", ["checkout", "--", "."], { cwd: root, stdio: "inherit" });
	const generated = created.filter((file) => existsSync(path.join(root, file)));
	if (generated.length > 0) spawnSync("git", ["clean", "-fdq", "--", ...generated], { cwd: root, stdio: "inherit" });
	// Migrations drizzle-kit wrote for this feature (named after it).
	spawnSync("git", ["clean", "-fdq", "--", "drizzle"], { cwd: root, stdio: "inherit" });
};

const fail = (message: string): never => {
	console.error(`new:feature: ${message}`);
	rollback();
	process.exit(1);
};

// ---------------------------------------------------------------------------
// Arguments and names
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const option = (flag: string) => {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) fail(`${flag} needs a value`);
	args.splice(index, 2);
	return value;
};
const titleOption = option("--title");
const titleNeOption = option("--title-ne");
const flags = { public: args.includes("--public"), localized: args.includes("--localized") };
const build = !args.includes("--no-build");
const name = args.find((arg) => !arg.startsWith("--"));

if (!name) {
	fail('usage: pnpm new:feature <name> [--title "Projects"] [--title-ne "…"] [--public] [--localized] [--no-build]');
}
const feature = name as string;
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(feature))
	fail(`"${feature}" must be kebab-case, e.g. "projects" or "event-logs"`);

const words = feature.split("-");
const capital = (word: string) => (word[0]?.toUpperCase() ?? "") + word.slice(1);
const names = {
	name: feature,
	snake: words.join("_"),
	camel: (words[0] ?? "") + words.slice(1).map(capital).join(""),
	Pascal: words.map(capital).join(""),
	UPPER: words.join("_").toUpperCase(),
	Title: titleOption ?? capital(words.join(" ")),
	// Without a Nepali name the English one is marked for translation (ne messages must differ from en).
	TitleNe: titleNeOption ?? `${titleOption ?? capital(words.join(" "))} (अनुवाद गर्नुहोस्)`,
};

const RESERVED = new Set([
	"admin",
	"api",
	"apps",
	"auth",
	"audit",
	"attachments",
	"dev",
	"new",
	"rbac",
	"roles",
	"users",
	"test-crud",
	// Paths of other pages (a --public feature lives at /<name>).
	"account",
	"forgot-password",
	"health",
	"login",
	"register",
	"reset-password",
	"sign-in-code",
	"verify-email",
	"about",
	"contact",
	"journal",
	"work",
]);
if (RESERVED.has(feature)) fail(`"${feature}" is already used by the app`);

const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const write = (file: string, content: string) => {
	mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
	writeFileSync(path.join(root, file), content);
};
const git = (...gitArgs: string[]) => spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" });

const status = git("status", "--porcelain", "--untracked-files=no");
if (status.status !== 0) fail("needs a git checkout (it restores the tree with git if anything fails)");
if (status.stdout.trim() !== "") fail("commit or stash your changes first: a failed run restores the tree with git");

if (existsSync(path.join(root, "src/features", feature))) fail(`src/features/${feature} already exists`);
if (new RegExp(`^\\s*"?${feature}"?: \\[`, "m").test(read("src/features/rbac/permissions.ts"))) {
	fail(`the permission catalog already has "${feature}"`);
}
// Files only: apps keep their tables in a subfolder (src/server/db/schema/apps/).
const schemaFiles = readdirSync(path.join(root, "src/server/db/schema"), { withFileTypes: true })
	.filter((entry) => entry.isFile())
	.map((entry) => entry.name);
for (const file of schemaFiles) {
	if (new RegExp(`export const ${names.camel}\\b`).test(read(`src/server/db/schema/${file}`))) {
		fail(`src/server/db/schema/${file} already exports "${names.camel}"`);
	}
}

/** Keeps `{{#flag}}…{{/flag}}` when the flag is set and `{{^flag}}…{{/flag}}` when it isn't; a tag alone on a line takes the line with it. */
const sections = (text: string) => {
	let out = text.replace(/^[ \t]*(\{\{[#^/]\w+\}\})[ \t]*\r?\n/gm, "$1");
	for (;;) {
		const next = out.replace(
			/\{\{([#^])(\w+)\}\}((?:(?!\{\{[#^]\2\}\})[\s\S])*?)\{\{\/\2\}\}/g,
			(_, kind: string, flag: string, inner: string) =>
				(kind === "#") === Boolean(flags[flag as keyof typeof flags]) ? inner : "",
		);
		if (next === out) return out;
		out = next;
	}
};

const fill = (text: string) =>
	text
		.replaceAll("__name__", names.name)
		.replaceAll("__snake__", names.snake)
		.replaceAll("__camel__", names.camel)
		.replaceAll("__Pascal__", names.Pascal)
		.replaceAll("__UPPER__", names.UPPER)
		.replaceAll("__TitleNe__", names.TitleNe)
		.replaceAll("__Title__", names.Title);

// ---------------------------------------------------------------------------
// 1. Files from the templates
// ---------------------------------------------------------------------------

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
const files = walk(templates)
	.map((template) => ({
		template,
		target: fill(path.relative(templates, template).replaceAll("\\", "/")).replace(/(\.public)?\.tpl$/, ""),
		publicOnly: template.endsWith(".public.tpl"),
	}))
	.filter((file) => flags.public || !file.publicOnly);
for (const { target } of files) if (existsSync(path.join(root, target))) fail(`${target} already exists`);

touchedTree = true;
for (const { template, target } of files) {
	created.push(target);
	write(target, fill(sections(readFileSync(template, "utf8"))));
}

// ---------------------------------------------------------------------------
// 2. Entries in shared lists, above each `// @new-feature:<slot>` line
// ---------------------------------------------------------------------------

const changed = new Set<string>();
const insert = (file: string, slot: string, lines: ReadonlyArray<string>) => {
	const content = read(file);
	const match = new RegExp(`^([\\t ]*)// @new-feature:${slot}$`, "m").exec(content);
	if (!match) fail(`${file} has no "// @new-feature:${slot}" line`);
	const indent = match?.[1] ?? "";
	const block = lines.map((line) => (line ? `${indent}${line}` : line)).join("\n");
	const at = match?.index ?? 0;
	write(file, `${content.slice(0, at)}${block}\n${content.slice(at)}`);
	changed.add(file);
};
/** An import at the top of the file; Biome sorts it into place. */
const addImport = (file: string, line: string) => {
	write(file, `${line}\n${read(file)}`);
	changed.add(file);
};

const { name: n, snake: s, camel: c, Pascal: P } = names;
const ACTIONS = ["read", "create", "update", "delete"];
insert("src/server/db/schema/index.ts", "schema", [`export * from "./${n}";`]);
insert("src/features/rbac/permissions.ts", "permissions", [
	`"${n}": ${JSON.stringify(ACTIONS).replaceAll(",", ", ")},`,
]);
insert("src/features/rbac/labels.ts", "resource-labels", [`"${n}": m.perm_resource_${s},`]);
insert(
	"src/features/rbac/labels.ts",
	"permission-labels",
	ACTIONS.map((action) => `"${n}:${action}": m.perm_${s}_${action},`),
);
insert(
	"src/features/audit/schema.ts",
	"audit-actions",
	["create", "update", "delete"].map((a) => `"${n}.${a}",`),
);
insert("src/features/audit/schema.ts", "audit-targets", [`"${n}",`]);
insert(
	"src/features/audit/labels.ts",
	"audit-action-labels",
	["create", "update", "delete"].map((action) => `"${n}.${action}": m.audit_action_${s}_${action},`),
);
insert("src/features/audit/labels.ts", "audit-target-labels", [`"${n}": m.audit_target_${s},`]);
insert("src/features/admin/sections.ts", "admin-sections", [
	"{",
	`\t...linkOptions({ to: "/admin/${n}" }),`,
	`\tlabel: m.admin_nav_${s},`,
	`\tdescription: m.${s}_description,`,
	"\ticon: FolderIcon,",
	`\tpermission: "${n}:read",`,
	'\tgroup: "overview",',
	"},",
]);
// The icon goes into the icons' import (unless an earlier feature added it), first: the last name may
// carry a trailing `// @layer` comment. Biome sorts the names.
const iconImport = /import \{([^}]*)\} from "lucide-react";/;
const sectionsFile = read("src/features/admin/sections.ts");
if (!/\bFolderIcon\b/.test(iconImport.exec(sectionsFile)?.[1] ?? "")) {
	write(
		"src/features/admin/sections.ts",
		sectionsFile.replace(iconImport, (_, list: string) => `import { FolderIcon,${list}} from "lucide-react";`),
	);
}
addImport("src/features/admin/commands.ts", `import { ${c}Commands } from "@/features/${n}/commands";`);
insert("src/features/admin/commands.ts", "commands", [`...${c}Commands,`]);
insert("tests/server/guarded-functions.test.ts", "guarded-functions", [
	`"${n}.ts": [`,
	`\t["list${P}", "${n}:read"],`,
	`\t["get${P}", "${n}:read"],`,
	...(flags.public ? [`\t["is${P}SlugFree", "${n}:read"],`] : []),
	`\t["create${P}", "${n}:create"],`,
	`\t["update${P}", "${n}:update"],`,
	`\t["delete${P}", "${n}:delete"],`,
	"],",
]);
insert("e2e/support/pages.ts", "reviewed-pages", [
	`{ route: "/admin/${n}", as: "admin" },`,
	`{ route: "/admin/${n}/new", as: "admin" },`,
	...(flags.public ? [`{ route: "/${n}" },`] : []),
]);
insert("e2e/support/pages.ts", "not-reviewed", [
	`"/admin/${n}/$id": "generated by new:feature: no seeded row to open yet (seed one, then review it)",`,
	...(flags.public
		? [`"/${n}/$slug": "generated by new:feature: nothing is published yet (publish one, then review it)",`]
		: []),
]);
if (flags.public) {
	insert("tests/server/guarded-functions.test.ts", "unguarded-functions", [
		`"${n}-public.ts": {`,
		'\twhy: "public pages: published rows only, read without signing in",',
		`\tfunctions: ["listPublic${P}", "getPublic${P}"],`,
		"},",
	]);
	addImport("src/server/seo/sitemap.ts", `import * as ${c} from "@/server/${n}/service";`);
	insert("src/server/seo/sitemap.ts", "sitemap", [`${c}.sitemapEntries,`]);
	insert("tests/unit/route-seo.test.ts", "indexable", [
		`{ to: "/${n}", label: "${n} list", context: { match: { search: { q: "", page: 1 } } }, path: "/${n}" },`,
		"{",
		`\tto: "/${n}/$slug",`,
		`\tlabel: "${n} page",`,
		'\tcontext: { params: { slug: "sample" }, loaderData: { title: "Sample", description: "The sample page of the generated feature." } },',
		`\tpath: "/${n}/sample",`,
		"},",
	]);
	insert("tests/unit/route-seo.test.ts", "content-titled", [`"${n} page",`]);
}

// ---------------------------------------------------------------------------
// 3. Messages (appended to both files, same keys)
// ---------------------------------------------------------------------------

const { Title, TitleNe } = names;
const messages: Record<string, [string, string]> = {
	[`admin_nav_${s}`]: [Title, TitleNe],
	[`${s}_title`]: [Title, TitleNe],
	[`${s}_description`]: ["Create, edit and delete rows.", "पङ्क्तिहरू बनाउनुहोस्, सम्पादन गर्नुहोस् र मेटाउनुहोस्।"],
	[`${s}_new`]: ["New row", "नयाँ पङ्क्ति"],
	[`${s}_edit_title`]: ["Edit row", "पङ्क्ति सम्पादन"],
	[`${s}_empty`]: ["Nothing here yet.", "यहाँ अहिलेसम्म केही छैन।"],
	[`${s}_empty_filtered`]: ["No rows match the search.", "खोजसँग मिल्ने पङ्क्ति छैन।"],
	[`${s}_search_placeholder`]: ["Title or notes", "शीर्षक वा टिप्पणी"],
	[`${s}_col_title`]: ["Title", "शीर्षक"],
	[`${s}_col_updated`]: ["Updated", "अद्यावधिक"],
	[`${s}_field_title`]: ["Title", "शीर्षक"],
	[`${s}_field_notes`]: ["Notes", "टिप्पणी"],
	[`perm_resource_${s}`]: [Title, TitleNe],
	[`perm_${s}_read`]: ["View rows", "पङ्क्तिहरू हेर्ने"],
	[`perm_${s}_create`]: ["Create rows", "पङ्क्तिहरू बनाउने"],
	[`perm_${s}_update`]: ["Edit rows", "पङ्क्तिहरू सम्पादन गर्ने"],
	[`perm_${s}_delete`]: ["Delete rows", "पङ्क्तिहरू मेटाउने"],
	[`audit_action_${s}_create`]: [`${Title}: row created`, `${TitleNe}: पङ्क्ति बनाइयो`],
	[`audit_action_${s}_update`]: [`${Title}: row edited`, `${TitleNe}: पङ्क्ति सम्पादन गरियो`],
	[`audit_action_${s}_delete`]: [`${Title}: row deleted`, `${TitleNe}: पङ्क्ति मेटाइयो`],
	[`audit_target_${s}`]: [`${Title} row`, `${TitleNe} पङ्क्ति`],
	[`command_${s}_new`]: [`New row in ${Title}`, `${TitleNe} मा नयाँ पङ्क्ति`],
	[`command_${s}_new_keywords`]: ["add create", "थप्नुहोस् बनाउनुहोस्"],
	...(flags.public
		? ({
				[`${s}_field_slug`]: ["Slug", "स्लग"],
				[`${s}_field_slug_description`]: [
					"Used in the page address. Filled in from an English title.",
					"पृष्ठको ठेगानामा प्रयोग हुन्छ। अङ्ग्रेजी शीर्षकबाट आफैँ भरिन्छ।",
				],
				[`${s}_field_published`]: ["Published", "प्रकाशित"],
				[`${s}_field_published_description`]: ["Shown on the public pages.", "सार्वजनिक पृष्ठहरूमा देखिन्छ।"],
				[`${s}_col_status`]: ["Status", "अवस्था"],
				[`${s}_status_published`]: ["Published", "प्रकाशित"],
				[`${s}_status_draft`]: ["Draft", "मस्यौदा"],
				[`${s}_public_title`]: [Title, TitleNe],
				[`${s}_public_description`]: [
					`Everything published in ${Title}, in English and Nepali.`,
					`${TitleNe} मा प्रकाशित सबै कुरा, अङ्ग्रेजी र नेपालीमा।`,
				],
				[`${s}_public_empty`]: ["Nothing has been published yet.", "अहिलेसम्म केही प्रकाशित भएको छैन।"],
				[`${s}_public_no_results`]: ["Nothing matches “{q}”.", "“{q}” सँग केही मिल्दैन।"],
				[`${s}_public_back`]: [`All of ${Title}`, `सबै ${TitleNe}`],
			} satisfies Record<string, [string, string]>)
		: {}),
};
for (const [index, locale] of ["en", "ne"].entries()) {
	const file = `messages/${locale}.json`;
	const content = read(file);
	const existing = JSON.parse(content) as Record<string, string>;
	const clash = Object.keys(messages).find((key) => key in existing);
	if (clash) fail(`${file} already has "${clash}"`);
	const end = content.lastIndexOf("\n}");
	const entries = Object.entries(messages).map(
		([key, values]) => `\t${JSON.stringify(key)}: ${JSON.stringify(values[index])}`,
	);
	write(file, `${content.slice(0, end)},\n${entries.join(",\n")}${content.slice(end)}`);
	changed.add(file);
}

// ---------------------------------------------------------------------------
// 4. Migration, formatting, route tree
// ---------------------------------------------------------------------------

const run = (label: string, command: string, commandArgs: string[], env: Record<string, string> = {}) => {
	console.log(`new:feature: ${label}`);
	const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
	if (result.status !== 0) fail(`${label} failed`);
};
const node = process.execPath;

// drizzle-kit only diffs the schema against drizzle/ here; it never connects, so any URL will do.
run("generating the migration", node, ["node_modules/drizzle-kit/bin.cjs", "generate", "--name", s], {
	DATABASE_URL: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/new_feature",
});
// drizzle/ too: drizzle-kit writes its JSON snapshots in its own style.
run("formatting", node, [
	"node_modules/@biomejs/biome/bin/biome",
	"check",
	"--write",
	...created,
	...changed,
	"drizzle",
]);
run("compiling messages", node, [
	"node_modules/@inlang/paraglide-js/bin/run.js",
	"compile",
	"--project",
	"./project.inlang",
	"--output-structure",
	"locale-modules",
	"--silent",
]);
if (build) {
	run("building (regenerates the route tree)", node, ["node_modules/vite/bin/vite.js", "build"], {
		VITE_APP_TITLE: process.env.VITE_APP_TITLE || "App",
		VITE_SITE_URL: process.env.VITE_SITE_URL || "http://localhost:3000",
	});
}

const publicPages = flags.public ? `\n  Public pages  /${n}, /${n}/<slug> (published rows; in the sitemap)` : "";
console.log(`
new:feature: created "${n}" (${created.length} files, ${changed.size} shared files updated).

  Admin pages   /admin/${n}, /admin/${n}/new, /admin/${n}/<id>${publicPages}
  Permissions   ${n}:read, :create, :update, :delete (grant them in /admin/roles/permissions)
  Next          pnpm db:migrate, then add your columns (schema, form, columns, messages)
${titleNeOption ? "" : `  Translate     the Nepali name in messages/ne.json (search for "अनुवाद गर्नुहोस्")\n`}`);
