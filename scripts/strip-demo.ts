/**
 * pnpm strip-demo [--keep-portfolio] [--keep-apps] [--keep-taskline] [--keep-parda] [--keep-chaal] [--keep-kharcha] [--no-build]
 *
 * Turns the template into a clean starting point (docs/guides/new-project.md) by
 * removing layers, each whole: its files, its marked code in shared files, its
 * package scripts, crons, knip entries and tables, and every message nothing uses
 * any more. Run it on a fresh clone. The core always stays: auth, admin, RBAC,
 * audit, attachments, i18n, SEO, Test CRUD and all of /dev (the dev-only
 * references, decision 0163).
 *
 * - `portfolio`: the portfolio at `/` (src/routes/_site, features/portfolio). A neutral
 *   landing page takes its place (scripts/templates/landing).
 * - `apps`: the showcase apps under /apps (filled by Task 41).
 * - `taskline`: Taskline, the project management app at /app/taskline (Part 5, from Task 46).
 * - `parda`: Parda, the movie and series product at /app/parda (Part 6, from Task 59).
 * - `chaal`: Chaal, the chess app on Lichess at /app/chaal (Part 7, from Task 71).
 * - `kharcha`: Kharcha, the expense tracker and bill splitter at /app/kharcha (Part 8, from Task 86).
 *
 * Markers: scripts/lib/strip-markers.ts. Paths per layer are data below, so a
 * task that adds to a layer appends to its lists. Then it removes dependencies
 * nothing imports (knip), formats what it touched, compiles the messages, turns
 * dropped tables into a migration and builds (skip with --no-build). Once no
 * layer is left, it deletes itself.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LAYERS, type Layer, RECORDS, stripLayer, TEXT, TOOL } from "./lib/strip-markers.ts";

type LayerSpec = {
	/** A path that exists while the layer is in the repo. */
	sentinel: string;
	/** Files and folders that belong to the layer only. */
	paths: string[];
	/** `package.json` scripts of the layer (e.g. a seed). */
	packageScripts: string[];
	/** `vercel.json` cron paths of the layer. */
	crons: string[];
	/** `knip.json` entries of the layer. */
	knipEntries: string[];
	/** Its table files in src/server/db/schema (their lines in index.ts carry the layer's marker). */
	schema: string[];
};

const SPECS: Record<Layer, LayerSpec> = {
	portfolio: {
		sentinel: "src/routes/_site.tsx",
		paths: [
			"src/routes/_site.tsx",
			"src/routes/_site",
			"src/features/portfolio",
			// The "Himal" design system, its archival pictures and its design records (Task 40, decisions 0179–0184).
			"src/styles/himal.css",
			"public/himal",
			"PRODUCT.md",
			"DESIGN.md",
			".impeccable/design.json",
			".impeccable/hook.cache.json",
			".impeccable/review",
			".impeccable/surfaces/src-routes-site-tsx.md",
			// The portfolio admin, its media library and its contact inbox (Task 39, decision 0176).
			"src/routes/_admin/admin/portfolio",
			"src/routes/_admin/admin/media.tsx",
			"src/features/media",
			"src/functions/portfolio.ts",
			"src/functions/portfolio-sections.ts",
			"src/functions/portfolio-messages.ts",
			"src/functions/portfolio-public.ts",
			"src/functions/media.ts",
			"src/server/portfolio",
			"src/server/media",
			"scripts/seed-portfolio.ts",
			"scripts/lib/portfolio-seed.ts",
			"scripts/lib/portfolio-content.ts",
			"scripts/lib/portfolio-data",
			"tests/components/portfolio",
			"tests/unit/portfolio-data.test.ts",
			"tests/unit/portfolio-lib.test.ts",
			"tests/unit/himal-tokens.test.ts",
			"tests/unit/terrain.test.ts",
			"tests/server/portfolio-admin.test.ts",
			"tests/server/portfolio-public.test.ts",
			"e2e/flows/portfolio.spec.ts",
			"docs/guides/portfolio.md",
		],
		packageScripts: ["db:seed-portfolio"],
		crons: [],
		knipEntries: [],
		schema: ["src/server/db/schema/portfolio.ts"],
	},
	apps: {
		// The showcase apps (Task 41, decisions 0187–0189). Guest sessions stay: they are core
		// (Better Auth's anonymous plugin, the claim, the daily cleanup; 0185, 0186).
		sentinel: "src/routes/_apps.tsx",
		paths: [
			"src/routes/_apps.tsx",
			"src/routes/_apps",
			"src/routes/_admin/admin/apps.tsx",
			"src/routes/_admin/admin/links.tsx",
			"src/routes/l",
			"src/routes/f",
			"src/features/apps",
			"src/functions/apps",
			"src/server/apps",
			"src/middleware/apps.ts",
			"src/middleware/short-links.ts",
			"src/middleware/robots.ts",
			"tests/unit/notes-list.test.ts",
			"tests/unit/habit-streaks.test.ts",
			"tests/unit/expenses-import.test.ts",
			"tests/unit/forms-fields.test.ts",
			"tests/unit/links-target.test.ts",
			"tests/server/apps-notes.test.ts",
			"tests/server/apps-links.test.ts",
			"tests/server/apps-expenses.test.ts",
			"tests/server/apps-habits.test.ts",
			"tests/server/apps-forms.test.ts",
			"e2e/flows/notes-links.spec.ts",
			"e2e/flows/expenses-habits.spec.ts",
			"e2e/flows/forms.spec.ts",
			"tests/components/apps",
			"e2e/flows/apps.spec.ts",
			"docs/guides/apps.md",
		],
		packageScripts: [],
		crons: [],
		knipEntries: [],
		schema: [
			"src/server/db/schema/apps/expenses.ts",
			"src/server/db/schema/apps/forms.ts",
			"src/server/db/schema/apps/habits.ts",
			"src/server/db/schema/apps/links.ts",
			"src/server/db/schema/apps/notes.ts",
		],
	},
	taskline: {
		// Taskline (Part 5, decisions 0203–0207). Guest sessions stay (core); its sandbox is one of their owners.
		sentinel: "src/server/taskline",
		paths: [
			"src/features/taskline",
			"src/server/email/templates/taskline-emails.tsx",
			"src/routes/_taskline",
			"src/server/taskline",
			"src/functions/taskline",
			"src/functions/taskline-admin",
			"src/routes/_admin/admin/taskline",
			"src/middleware/taskline.ts",
			"src/server/routes/taskline-manifest.ts",
			"src/server/routes/cron-taskline.ts",
			"public/taskline",
			".storybook/mocks/taskline.ts",
			".storybook/mocks/functions/taskline",
			".storybook/mocks/functions/taskline-admin",
			"src/features/portfolio/components/case-study/taskline-link.tsx",
			"tests/components/taskline",
			"e2e/flows/taskline.spec.ts",
			"src/server/db/schema/taskline",
			"scripts/seed-taskline.ts",
			"scripts/lib/taskline-seed.ts",
			"tests/server/taskline.test.ts",
			"tests/server/taskline-access.test.ts",
			"tests/server/taskline-seed.test.ts",
			"tests/server/taskline-views.test.ts",
			"tests/server/taskline-kanban-migration.test.ts",
			"tests/server/taskline-admin.test.ts",
			"tests/server/taskline-collab.test.ts",
			"tests/server/taskline-find.test.ts",
			"tests/server/taskline-sprints.test.ts",
			"tests/server/taskline-time.test.ts",
			"tests/server/taskline-timeline.test.ts",
			"tests/server/taskline-fields.test.ts",
			"tests/server/taskline-automations.test.ts",
			"tests/server/taskline-templates.test.ts",
			"tests/server/taskline-wrap-up.test.ts",
			"tests/unit/taskline-moves.test.ts",
			"tests/unit/taskline-calendar.test.ts",
			"tests/unit/taskline-import.test.ts",
			"tests/unit/taskline-sprints.test.ts",
			"tests/unit/taskline-time.test.ts",
			"tests/unit/taskline-timeline.test.ts",
			"tests/unit/taskline-fields.test.ts",
			"tests/unit/taskline-automations.test.ts",
			"tests/unit/taskline-reports.test.ts",
			"tests/unit/taskline-filters.test.ts",
			"src/lib/fractional-index.ts",
			"tests/unit/fractional-index.test.ts",
			"docs/guides/taskline.md",
		],
		packageScripts: ["db:seed-taskline"],
		crons: ["/api/cron/taskline"],
		knipEntries: [],
		schema: [
			"src/server/db/schema/taskline/collab.ts",
			"src/server/db/schema/taskline/project.ts",
			"src/server/db/schema/taskline/task.ts",
			"src/server/db/schema/taskline/workspace.ts",
		],
	},
	parda: {
		// Parda (Part 6, decision 0228). Its schema is a folder, removed with `paths`.
		sentinel: "src/server/parda",
		paths: [
			"src/features/parda",
			// The "Masking" design system and its direction contract (Task 60, decision 0232).
			"src/styles/parda.css",
			".impeccable/surfaces/parda.md",
			// Its design record, written from the shipped pages (Task 70).
			"docs/design/parda.md",
			"tests/unit/parda-tokens.test.ts",
			"src/server/parda",
			"src/functions/parda",
			"src/functions/parda-admin",
			"src/middleware/parda.ts",
			"src/routes/_admin/admin/parda",
			"src/server/routes/cron-parda.ts",
			"src/server/routes/parda-player.ts",
			"src/server/routes/parda-manifest.ts",
			// The daily source probe (Task 65a, decision 0238).
			"src/server/routes/parda-probe.ts",
			"scripts/probe-sources.ts",
			".github/workflows/parda-probe.yml",
			"src/routes/_parda",
			"public/parda",
			"src/server/db/schema/parda",
			".storybook/mocks/functions/parda",
			".storybook/mocks/functions/parda-admin",
			".storybook/mocks/parda.tsx",
			"scripts/record-tmdb-fixtures.ts",
			"tests/fixtures/tmdb",
			"tests/unit/parda-tmdb.test.ts",
			"tests/unit/parda-player.test.ts",
			"tests/server/parda-catalog.test.ts",
			"tests/server/parda-curation.test.ts",
			"tests/server/parda-title.test.ts",
			"tests/unit/parda-slug.test.ts",
			"tests/unit/parda-library.test.ts",
			"tests/unit/parda-ranking.test.ts",
			"tests/unit/parda-probe.test.ts",
			"tests/server/parda-library.test.ts",
			"tests/server/parda-access.test.ts",
			"tests/server/parda-admin.test.ts",
			"tests/server/parda-ranking.test.ts",
			"tests/server/parda-search.test.ts",
			"tests/unit/parda-discover.test.ts",
			"tests/unit/parda-kids.test.ts",
			"tests/server/parda-saved.test.ts",
			"tests/server/parda-profiles.test.ts",
			// Schedule and new-episode alerts (Task 68, decision 0241).
			"src/server/email/templates/parda-emails.tsx",
			"tests/unit/parda-alerts.test.ts",
			"tests/server/parda-alerts.test.ts",
			// Watch party (Task 69a, decision 0243).
			"tests/unit/parda-party.test.ts",
			"tests/server/parda-party.test.ts",
			"e2e/harness/parda-relay.ts",
			"e2e/harness/tmdb.ts",
			"e2e/flows/parda.spec.ts",
			"docs/guides/parda.md",
		],
		packageScripts: ["tmdb:record", "parda:probe"],
		crons: ["/api/cron/parda"],
		knipEntries: [],
		schema: [],
	},
	chaal: {
		// Chaal (Part 7, decision 0254). Its schema is a folder, removed with `paths`.
		sentinel: "src/server/chaal",
		paths: [
			"src/features/chaal",
			"src/server/chaal",
			"src/functions/chaal",
			"src/functions/chaal-admin",
			"src/middleware/chaal.ts",
			"src/routes/_admin/admin/chaal",
			// Its pages, in its own layout and frame (Task 73, decision 0259).
			"src/routes/_chaal",
			"src/server/routes/chaal-manifest.ts",
			// Connecting Lichess and the streams through the server (decision 0256).
			"src/server/routes/chaal-oauth.ts",
			"src/server/routes/chaal-stream.ts",
			// Its daily job (Task 77, decision 0266).
			"src/server/routes/cron-chaal.ts",
			"src/server/db/schema/chaal",
			".storybook/mocks/functions/chaal",
			".storybook/mocks/functions/chaal-admin",
			// The Lichess client's recordings and the fake Lichess (decision 0255).
			"scripts/record-lichess-fixtures.ts",
			"tests/fixtures/lichess",
			"e2e/harness/lichess.ts",
			"tests/unit/chaal-lichess.test.ts",
			"tests/unit/chaal-connect.test.ts",
			"tests/server/chaal-connect.test.ts",
			"tests/server/chaal-access.test.ts",
			"e2e/flows/chaal.spec.ts",
			"docs/guides/chaal.md",
			// The "Diagram" design system, its direction contract, pieces and sounds (Task 72, decision 0258).
			"src/styles/chaal.css",
			".impeccable/surfaces/src-routes-chaal-route-tsx.md",
			"tests/unit/chaal-tokens.test.ts",
			"tests/unit/chaal-preferences.test.ts",
			".storybook/mocks/chaal.tsx",
			"public/chaal",
			"scripts/chaal-sounds.ts",
			// The game model and the board kit (Task 74, decisions 0261 and 0262).
			"tests/unit/chaal-chess.test.ts",
			"tests/unit/chaal-pgn.test.ts",
			"tests/components/chaal",
			// The analysis board and the engine (Task 75, decisions 0263 and 0264).
			"scripts/engine-copy.ts",
			"tests/unit/chaal-engine.test.ts",
			"tests/unit/chaal-analysis.test.ts",
			"tests/server/chaal-analysis.test.ts",
			// Local games: against the computer and over the board (Task 76, decision 0265).
			"tests/unit/chaal-local.test.ts",
			"tests/server/chaal-local.test.ts",
			// Online play: streams, challenges, the Lichess AI and the live game (Task 77, decision 0266).
			"e2e/harness/lichess-play.ts",
			"tests/unit/chaal-live.test.ts",
			"tests/server/chaal-play.test.ts",
			// Quick pairing, correspondence and notifications (Task 78, decision 0267).
			"tests/unit/chaal-quick.test.ts",
			// The admin: settings, connections and blocks, the API's health (Task 79, decision 0268).
			"tests/server/chaal-admin.test.ts",
			// Puzzles: the daily one, training, the streak, Lichess's dashboard and replays (Task 80, decision 0269).
			"tests/unit/chaal-puzzles.test.ts",
			"tests/server/chaal-puzzles.test.ts",
			"e2e/harness/lichess-puzzles.ts",
			// Players and games: leaderboards, a player's page and games, following, the replay (Task 81, decision 0271).
			"tests/unit/chaal-players.test.ts",
			"tests/server/chaal-players.test.ts",
			"e2e/harness/lichess-players.ts",
			// Watch: the TV, following a game being played, broadcasts (Task 82, decision 0272).
			"tests/unit/chaal-watch.test.ts",
			"tests/server/chaal-watch.test.ts",
			"e2e/harness/lichess-watch.ts",
			// Community: tournaments, teams and studies (Task 83, decision 0273).
			"tests/unit/chaal-community.test.ts",
			"tests/server/chaal-community.test.ts",
			"e2e/harness/lichess-community.ts",
			// Admin II: the overview and curation (Task 84, decision 0274).
			"tests/server/chaal-curation.test.ts",
			// The design record (Task 85).
			"docs/design/chaal.md",
		],
		packageScripts: ["lichess:record", "chaal:sounds", "engine:copy"],
		crons: ["/api/cron/chaal"],
		knipEntries: [],
		schema: [],
	},
	kharcha: {
		// Kharcha (Part 8, decisions 0277 and 0278). Its schema is a folder, removed with `paths`.
		sentinel: "src/server/kharcha",
		paths: [
			"src/features/kharcha",
			"src/server/kharcha",
			"src/functions/kharcha",
			"src/middleware/kharcha.ts",
			"src/server/db/schema/kharcha",
			".storybook/mocks/functions/kharcha",
			".storybook/mocks/kharcha.ts",
			"scripts/seed-kharcha.ts",
			"scripts/lib/kharcha-seed.ts",
			"tests/unit/kharcha-money.test.ts",
			"tests/server/kharcha.test.ts",
			"tests/server/kharcha-helpers.ts",
			"tests/server/kharcha-access.test.ts",
			"tests/server/kharcha-people.test.ts",
			"tests/server/kharcha-seed.test.ts",
			"tests/server/kharcha-spending.test.ts",
			"docs/guides/kharcha.md",
			// The "Bahi Khata" design system, its direction contract and record (Task 87, decision 0281).
			"src/styles/kharcha.css",
			".impeccable/surfaces/kharcha.md",
			".storybook/mocks/kharcha-section.tsx",
			"tests/unit/kharcha-tokens.test.ts",
			"docs/design/kharcha.md",
			// The section, its shell, Home and its manifest (Task 88, decision 0282).
			"src/routes/_kharcha",
			"src/server/routes/kharcha-manifest.ts",
			"public/kharcha",
			"e2e/flows/kharcha.spec.ts",
			// Invites and joining (Task 90, decision 0284).
			"src/server/email/templates/kharcha-emails.tsx",
			"tests/server/kharcha-social.test.ts",
			// Settling up and reminders (Task 91, decision 0285).
			"tests/server/kharcha-settle.test.ts",
			// Conversations, notifications and email (Task 92, decision 0286).
			"src/server/routes/cron-kharcha.ts",
			"src/server/routes/kharcha-unsubscribe.ts",
			"tests/server/kharcha-talk.test.ts",
			"tests/unit/kharcha-talk.test.ts",
		],
		packageScripts: ["db:seed-kharcha"],
		crons: ["/api/cron/kharcha"],
		// Its functions arrive before their pages (Tasks 89 to 91 call the rest); the entry goes when every one has a caller.
		knipEntries: ["src/functions/kharcha/*.ts"],
		schema: [],
	},
};

/** Files more than one layer uses: removed only when every one of those layers goes. */
const SHARED: ReadonlyArray<{ paths: string[]; layers: Layer[] }> = [
	{ paths: ["src/components/forms/csv-source.tsx"], layers: ["apps", "taskline"] },
	{ paths: ["src/server/db/quota.ts"], layers: ["apps", "taskline", "kharcha"] },
	{ paths: [".impeccable/config.json"], layers: ["portfolio", "parda"] },
	{ paths: ["src/components/data-display/scroll-region.tsx"], layers: ["taskline", "parda", "chaal"] },
	// The horizontal rail (Task 61) is core, but only Parda uses it so far.
	{ paths: ["src/components/data-display/rail.tsx"], layers: ["parda"] },
	// The server's LRU cache (decision 0255) is core; Parda's TMDB answers and Chaal's Lichess answers use it.
	{ paths: ["src/server/cache/lru.ts", "tests/unit/lru-cache.test.ts"], layers: ["parda", "chaal"] },
	// The segmented nav (Task 79) is core; only Parda's, Chaal's and Kharcha's pages use it so far (Task 85's matrix).
	{ paths: ["src/components/navigation/segment-nav.tsx"], layers: ["parda", "chaal", "kharcha"] },
];

/** Written when the portfolio goes: the home page becomes a neutral landing page. */
const LANDING = {
	template: "scripts/templates/landing/index.tsx.tpl",
	target: "src/routes/_public/index.tsx",
	messages: {
		landing_title: ["Welcome", "स्वागत छ"],
		landing_intro: [
			"A fast, server-rendered app, fully available in English and Nepali.",
			"अङ्ग्रेजी र नेपाली दुवैमा पूर्ण रूपमा उपलब्ध, छिटो र सर्भरमा रेन्डर हुने एप।",
		],
		landing_description: [
			"A fast, server-rendered app in English and Nepali.",
			"अङ्ग्रेजी र नेपालीमा छिटो, सर्भरमा रेन्डर हुने एप।",
		],
		landing_cta: ["Open your account", "आफ्नो खाता खोल्नुहोस्"],
	},
	/** Neutral copy for messages the core keeps (en, ne). */
	neutral: {
		site_description: [
			"A fast, server-rendered app in English and Nepali.",
			"अङ्ग्रेजी र नेपालीमा छिटो, सर्भरमा रेन्डर हुने एप।",
		],
		home_intro: [
			"A fast, server-rendered app, fully available in English and Nepali.",
			"अङ्ग्रेजी र नेपाली दुवैमा पूर्ण रूपमा उपलब्ध, छिटो र सर्भरमा रेन्डर हुने एप।",
		],
	},
	/** Lines added at `// @strip-demo:<slot>` markers (the marker line is replaced). */
	inserts: [
		{
			file: "tests/unit/route-seo.test.ts",
			slot: "indexable",
			text: '\t{ to: "/", label: "home", context: {}, path: "/" },',
		},
	],
} as const;

/** Removed with the script once no layer is left. */
const SELF = [
	"scripts/strip-demo.ts",
	"scripts/lib/strip-markers.ts",
	"scripts/templates/landing",
	"tests/unit/strip-markers.test.ts",
];

const root = path.resolve(import.meta.dirname, "..");
const at = (file: string) => path.join(root, file);
const args = process.argv.slice(2);
const build = !args.includes("--no-build");
const kept = new Set(LAYERS.filter((layer) => args.includes(`--keep-${layer}`)));
const unknown = args.filter((arg) => !["--no-build", ...LAYERS.map((layer) => `--keep-${layer}`)].includes(arg));

const fail = (message: string): never => {
	console.error(`strip-demo: ${message}`);
	process.exit(1);
};
if (unknown.length > 0) {
	fail(`unknown option ${unknown.join(" ")} (use ${LAYERS.map((layer) => `--keep-${layer}`).join(", ")}, --no-build)`);
}

const stripped = LAYERS.filter((layer) => !kept.has(layer));
/** Nothing kept: the script goes too, with what exists only for it (its `strip-demo` markers). */
const allGone = kept.size === 0;
const markerSets: string[] = allGone ? [...stripped, TOOL] : [...stripped];
const present = stripped.filter((layer) => existsSync(at(SPECS[layer].sentinel)));
const changed = new Set<string>();
const readJson = <T>(file: string): T => JSON.parse(readFileSync(at(file), "utf8")) as T;
const writeJson = (file: string, data: unknown) => {
	writeFileSync(at(file), `${JSON.stringify(data, null, "\t")}\n`);
	changed.add(file);
};

// 1. The layers' own files and folders
for (const layer of stripped) {
	for (const file of SPECS[layer].paths) rmSync(at(file), { recursive: true, force: true });
	for (const file of SPECS[layer].schema) rmSync(at(file), { force: true });
}
for (const shared of SHARED) {
	if (shared.layers.every((layer) => stripped.includes(layer))) {
		for (const file of shared.paths) rmSync(at(file), { recursive: true, force: true });
	}
}

// 2. Their marked code in every tracked text file
const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
if (tracked.status !== 0) fail("git ls-files failed (run it in a git checkout)");
let markedFiles = 0;
for (const file of tracked.stdout.split("\0")) {
	if (!file || !TEXT.test(file) || RECORDS.test(file) || !existsSync(at(file)) || statSync(at(file)).isDirectory()) {
		continue;
	}
	let content = readFileSync(at(file), "utf8");
	let touched = false;
	for (const layer of markerSets) {
		const next = stripLayer(content, layer);
		if (next === null) continue;
		content = next;
		touched = true;
	}
	if (!touched) continue;
	writeFileSync(at(file), content);
	changed.add(file);
	markedFiles += 1;
}

if (present.length === 0 && markedFiles === 0) {
	console.log(`strip-demo: nothing to strip (${stripped.join(", ") || "every layer kept"}).`);
	process.exit(0);
}

// 3. Config that can't hold markers: package scripts, crons, knip entries
const pkg = readJson<{ scripts: Record<string, string> }>("package.json");
const vercel = readJson<{ crons?: Array<{ path: string }> }>("vercel.json");
const knip = readJson<{ entry: string[] }>("knip.json");
for (const layer of stripped) {
	for (const script of SPECS[layer].packageScripts) delete pkg.scripts[script];
	vercel.crons = vercel.crons?.filter((cron) => !SPECS[layer].crons.includes(cron.path));
	knip.entry = knip.entry.filter((entry) => !SPECS[layer].knipEntries.includes(entry));
}
if (allGone) delete pkg.scripts["strip-demo"];
writeJson("package.json", pkg);
writeJson("vercel.json", vercel);
writeJson("knip.json", knip);

// 4. The portfolio's place: a neutral landing page, its messages and its test entries
const messages = {
	en: readJson<Record<string, string>>("messages/en.json"),
	ne: readJson<Record<string, string>>("messages/ne.json"),
};
if (present.includes("portfolio")) {
	mkdirSync(path.dirname(at(LANDING.target)), { recursive: true });
	writeFileSync(at(LANDING.target), readFileSync(at(LANDING.template), "utf8"));
	changed.add(LANDING.target);
	for (const [key, [en, ne]] of Object.entries({ ...LANDING.messages, ...LANDING.neutral })) {
		messages.en[key] = en;
		messages.ne[key] = ne;
	}
	for (const insert of LANDING.inserts) {
		const content = readFileSync(at(insert.file), "utf8");
		const marker = new RegExp(`^.*// @strip-demo:${insert.slot}\\b.*$`, "m");
		if (!marker.test(content)) fail(`${insert.file}: no // @strip-demo:${insert.slot} marker`);
		writeFileSync(
			at(insert.file),
			content.replace(marker, () => insert.text),
		);
		changed.add(insert.file);
	}
}

// 5. The script itself, once nothing is left to strip
if (allGone) for (const file of SELF) rmSync(at(file), { recursive: true, force: true });

// 6. Messages nothing uses any more (the rule of tests/i18n/message-usage.test.ts)
const sourceText = () => {
	let text = "";
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "paraglide") walk(full);
			} else if (/\.(ts|tsx)$/.test(entry.name)) text += readFileSync(full, "utf8");
		}
	};
	walk(at("src"));
	walk(at(".storybook"));
	return text;
};
const code = sourceText();
let removedMessages = 0;
for (const [locale, values] of Object.entries(messages)) {
	for (const key of Object.keys(values)) {
		if (key === "$schema" || new RegExp(`\\bm\\.${key}\\b`).test(code)) continue;
		delete values[key];
		if (locale === "en") removedMessages += 1;
	}
	writeJson(`messages/${locale}.json`, values);
}

// 7. Commands: messages, unused dependencies, formatting, migrations, route tree
const node = process.execPath;
/** vite.config.ts and drizzle.config.ts validate env when loaded (by knip, drizzle-kit, the build). */
const configEnv = {
	VITE_APP_TITLE: process.env.VITE_APP_TITLE || "App",
	VITE_SITE_URL: process.env.VITE_SITE_URL || "http://localhost:3000",
	DATABASE_URL: process.env.DATABASE_URL || "postgresql://strip:strip@localhost:5432/strip",
};
const run = (label: string, command: string, commandArgs: string[], env: Record<string, string> = {}) => {
	console.log(`strip-demo: ${label}`);
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		stdio: "inherit",
		// pnpm is a .cmd shim on Windows; node itself must not go through the shell (spaces in its path).
		shell: process.platform === "win32" && command === "pnpm",
		env: { ...process.env, ...env },
	});
	if (result.status !== 0) fail(`${label} failed`);
};

run("compiling messages", node, [
	"node_modules/@inlang/paraglide-js/bin/run.js",
	"compile",
	"--project",
	"./project.inlang",
	"--output-structure",
	"locale-modules",
	"--silent",
]);
run(
	"removing dependencies nothing imports any more",
	node,
	["node_modules/knip/bin/knip.js", "--fix", "--fix-type", "dependencies", "--no-exit-code", "--no-progress"],
	configEnv,
);
run("updating the lockfile", "pnpm", ["install", "--no-frozen-lockfile"]);
run("formatting", node, [
	"node_modules/@biomejs/biome/bin/biome",
	"check",
	"--write",
	"--no-errors-on-unmatched",
	...[...changed].filter((file) => existsSync(at(file))),
]);
// Always: a layer can also own columns of a kept table (the apps layer, a project's app_slug); drizzle-kit
// writes nothing when the schema didn't change.
if (stripped.length > 0) {
	run(
		"writing the migration that drops the layers' tables and columns",
		node,
		["node_modules/drizzle-kit/bin.cjs", "generate", "--name", `strip_${stripped.join("_")}`],
		configEnv,
	);
	run("formatting the migration's metadata", node, [
		"node_modules/@biomejs/biome/bin/biome",
		"format",
		"--write",
		"drizzle/meta",
	]);
}
if (build) {
	run("building (regenerates the route tree)", node, ["node_modules/vite/bin/vite.js", "build"], configEnv);
}

console.log(`
strip-demo: removed ${stripped.join(" and ")} (${changed.size} files edited, ${removedMessages} messages dropped).
  ${allGone ? "The script removed itself." : `Kept: ${[...kept].join(", ")}; run it again without --keep-… to remove those too.`}
  ${build ? "" : "Run pnpm dev or pnpm build once to regenerate src/routeTree.gen.ts.\n  "}Next: docs/guides/new-project.md (rename, env, first admin), then pnpm new:feature <name>.
`);
