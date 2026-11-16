/**
 * The standard's words (docs/guides/conventions.md, "The standard"; decision 0297): every list a
 * rule checks a name against. A new word here is a change of the standard, so it comes with a line
 * in a decision. The rules that read these lists are in ./rules/.
 */

/** A product is a folder of feature folders, with its own guards, table prefix and message prefix. */
export const PRODUCTS = ["taskline", "parda", "chaal", "kharcha"] as const;

/** The prefix of a product's tables. Messages spell the product's name instead. */
export const TABLE_PREFIXES: Record<string, string> = {
	taskline: "tl_",
	parda: "pd_",
	chaal: "ch_",
	kharcha: "kh_",
	portfolio: "portfolio_",
};

/** The first word of a migration's name, after its number: the layer whose tables it changes. */
export const MIGRATION_LAYERS = ["core", "apps", "portfolio", ...PRODUCTS] as const;
/** Migrations up to this number shipped before the rule and keep their names (records, 0163). */
export const LAST_UNNAMED_MIGRATION = 58;

// --- Feature folders -----------------------------------------------------------------------------

/** The folders a feature folder may hold besides other feature folders (a product's modules). */
export const FEATURE_SUBFOLDERS = ["components", "hooks", "lib"] as const;

/** The files a feature folder may hold beside those folders. Anything else goes into one of them. */
export const FEATURE_FILES: Record<string, string> = {
	"schema.ts": "Zod schemas and the DTO types (forms, function inputs)",
	"search.ts": "the URL contract, the only file a route imports statically",
	"keys.ts": "query keys",
	"queries.ts": "queryOptions for reads and one object of mutationOptions for writes",
	"collection.ts": "TanStack DB collections",
	"columns.tsx": "a list's columns",
	"filters.tsx": "a list's filter controls and chips",
	"labels.ts": "the localized labels of enum values",
	"constants.ts": "values with no logic",
	"types.ts": "types that no schema gives",
	"links.ts": "link builders to the feature's pages",
	"commands.ts": "the palette's actions",
	"load.ts": "the loaders of the feature's routes (a route imports it inside its loader)",
	"head.ts": "the head builders of the feature's routes",
	"store.ts": "a TanStack Store",
};

/**
 * The last word of a component's file name says what it renders: `<thing>-<role>.tsx`.
 * Grouped for the reader; the rule reads them as one list.
 */
export const COMPONENT_ROLES = {
	screens: ["page", "layout", "frame", "shell", "pending"],
	regions: ["section", "header", "footer", "sidebar", "rail", "nav", "tabs", "bar", "banner", "panel", "hero"],
	collections: ["list", "table", "grid", "board", "gallery", "calendar", "timeline", "chart", "thread"],
	items: ["detail", "card", "row", "cell", "tile", "badge", "avatar", "icon", "image", "mark"],
	controls: ["form", "field", "editor", "picker", "input", "switch", "button", "link", "menu", "palette", "composer"],
	overlays: ["dialog", "sheet", "overlay"],
} as const;
export const ROLES: ReadonlySet<string> = new Set(Object.values(COMPONENT_ROLES).flat());

/** The suffix of what each kind of file exports. */
export const EXPORT_SUFFIXES: Record<string, ReadonlyArray<string>> = {
	"keys.ts": ["Keys"],
	"queries.ts": ["QueryOptions", "Mutations"],
	"collection.ts": ["Rows"],
};

// --- Server functions ----------------------------------------------------------------------------

/** One word per meaning. `set` and `is` are the first words of `set<Field>` and `is<Check>`. */
export const STANDARD_VERBS: ReadonlySet<string> = new Set([
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

/** Verbs a standard verb already says, with the one to use. */
export const FOLDED_VERBS: Record<string, string> = {
	save: "create, update or set<Field>",
	find: "search or get",
	locate: "get",
	fetch: "get",
	patch: "update or set<Field>",
	toggle: "set<Field>",
	mark: "set<Field>",
	switch: "set<Field>",
	pause: "set<Field>",
	suspend: "set<Field>",
	archive: "set<Field>",
	deactivate: "set<Field>",
	reactivate: "set<Field>",
	rename: "update or set<Field>",
	bulk: "update or delete (they take ids)",
	check: "is<Check> or get",
	ensure: "is<Check> or get",
	clear: "delete",
	log: "create or record",
	note: "record",
	post: "create",
	open: "create",
	rank: "reorder",
	take: "claim",
	end: "stop",
	watch: "follow",
	repeat: "copy",
	withdraw: "leave",
	example: "a verb for what the function does",
	fail: "a verb for what the function does",
	run: "a verb for what the function does",
};

/** Domain verbs: allowed because no standard verb says them. */
export const DOMAIN_VERBS: ReadonlySet<string> = new Set([
	"accept",
	"act",
	"block",
	"cancel",
	"challenge",
	"claim",
	"complete",
	"confirm",
	"copy",
	"decline",
	"disconnect",
	"discard",
	"follow",
	"impersonate",
	"invite",
	"join",
	"leave",
	"move",
	"ping",
	"play",
	"preview",
	"pulse",
	"rate",
	"react",
	"record",
	"remind",
	"report",
	"resend",
	"reset",
	"revoke",
	"rewatch",
	"seek",
	"send",
	"share",
	"sign",
	"skip",
	"start",
	"stop",
	"submit",
	"transfer",
	"unblock",
	"unshare",
]);

/** The layers that have guards of their own: `require<Layer>User`, `with<Layer>Services`, `with<Layer>Public`. */
const GUARD_LAYERS = ["Taskline", "Parda", "Chaal", "Kharcha", "Apps"];
/** `require<Who>` refuses. */
export const REQUIRE_GUARDS: ReadonlySet<string> = new Set([
	"requirePermission",
	"requireUser",
	"requireAccountOwner",
	"requireAdminAccess",
	"requireDev",
	...GUARD_LAYERS.map((layer) => `require${layer}User`),
]);
/** `with<What>` provides. */
export const WITH_GUARDS: ReadonlySet<string> = new Set([
	"withServices",
	"withPublic",
	"withSession",
	...GUARD_LAYERS.flatMap((layer) => [`with${layer}Services`, `with${layer}Public`]),
]);

// --- Messages ------------------------------------------------------------------------------------

/**
 * A message is `<feature>_<part>_<name>`: it starts with the name of a folder in src/features
 * (snake_case), or with one of these words for text the shared kit owns.
 */
export const SHARED_MESSAGE_WORDS: ReadonlySet<string> = new Set([
	"account",
	"appearance",
	"blocks",
	"breadcrumbs",
	"calendar",
	"category",
	"color",
	"combobox",
	"command",
	"common",
	"consent",
	"copy",
	"crud",
	"csv",
	"dashboard",
	"date",
	"dialog",
	"email",
	"error",
	"examples",
	"field",
	"file",
	"filters",
	"footer",
	"form",
	"guest",
	"health",
	"home",
	"image",
	"impersonation",
	"intl",
	"key",
	"kit",
	"landing",
	"language",
	"list",
	"localized",
	"matrix",
	"messages",
	"multiselect",
	"nav",
	"not",
	"pagination",
	"password",
	"pending",
	"perm",
	"phone",
	"rail",
	"role",
	"roles",
	"rt",
	"select",
	"seo",
	"settings",
	"shortcuts",
	"showcase",
	"sidebar",
	"site",
	"skip",
	"slider",
	"slug",
	"sortable",
	"table",
	"tags",
	"theme",
	"time",
	"tool",
	"unsaved",
	"user",
	"users",
	"validation",
]);

// --- Reasons -------------------------------------------------------------------------------------

/**
 * Where the one way does not apply, the code says why in a comment right above the line:
 * `// <word>: <reason>`. The rule accepts it and the reason stays next to the exception.
 */
export const REASON_WORDS = {
	/** `useQuery` with no `enabled`: live data over a server-rendered first paint, or another reason. */
	read: "useQuery",
	/** `setTimeout` or `setInterval` that is not a debounce, a throttle, a queue or a batch. */
	timer: "timer",
	/** A key handler that is a widget's own keyboard model, not a shortcut. */
	keys: "keys",
} as const;

// --- Import boundaries ---------------------------------------------------------------------------

/**
 * What a folder under src/ may not import (by `@/<folder>`). Type-only imports are erased and do
 * not count. Routes have a rule of their own (`route-import`).
 */
export const FORBIDDEN_IMPORTS: Record<string, ReadonlyArray<string>> = {
	lib: ["components", "features", "functions", "hooks", "middleware", "routes", "server"],
	hooks: ["features", "functions", "middleware", "routes", "server"],
	components: ["features", "functions", "middleware", "routes", "server"],
	features: ["middleware", "routes"],
	functions: ["components", "hooks", "routes"],
	middleware: ["components", "functions", "hooks", "routes"],
	server: ["components", "functions", "hooks", "routes"],
};

/** The folders whose exports the Learn page lists: each export says what it is for in a comment. */
export const DOCUMENTED_FOLDERS = ["src/lib/", "src/hooks/", "src/components/"] as const;
