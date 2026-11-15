# CLAUDE.md

Entry point for working on this repository (people and AI sessions alike). Read this first, then the guide for the area you touch. It holds only what most tasks need (0223). The rest is in the guides, in `.claude/rules/` (one area's rules, loaded when a session touches its files) and in `.claude/skills/` (the recipes for repeated jobs) (0297). Other tools start at [AGENTS.md](AGENTS.md).

## What this is

A bilingual (English + Nepali) portfolio app with a public site and an admin area. Every page renders on the server, works in both locales, and passes strict CSP, accessibility and layout-shift checks. **Test CRUD** is the reference feature to copy.

- **Plan and status:** [docs/PLAN.md](docs/PLAN.md). **Never read it whole:** search it, or read only the lines you need. Parts 5 to 8 (sections 11 to 14) are done: Taskline (0226, 0227), Parda (0244, 0245; its servers are a placeholder that plays no video until the owner connects a provider, 0228), Chaal (0275, 0276; four redesigns left for the owner, 0275) and Kharcha (0291, 0292). Part 9 (section 15, Tasks 98–127: one standard everywhere, the portfolio redesign, the reviews) is under way. Done: Task 98's baseline and audit (0295; `docs/history/part9-audit.md` has every gate's time and every count later tasks are compared with), Task 99's fast gates (0296), Task 100's standard (0297) and Task 101's move (0298: every file in its standard place with its standard name). To run a task, follow the `plan-task` skill: read 15.1–15.7 and the task's own section. Other work follows the same rules.
- **Why things are the way they are:** [docs/decisions.md](docs/decisions.md), numbered with an index. Add an entry for every non-obvious choice.
- **The standard:** one folder shape, one naming scheme and one way to do each thing, in [conventions.md](docs/guides/conventions.md) ("The standard"). `pnpm standard` checks it in two seconds; `tests/unit/standard/known-deviations.json` lists what does not follow it yet, and only gets shorter.
- **Taskline** (Part 5) is a product of its own at `/app/taskline` (0208): `src/routes/_taskline`, `src/features/taskline`, `src/server/taskline`, `src/functions/taskline`; the admin runs the team from `/admin/taskline` (`src/functions/taskline-admin`) ([taskline.md](docs/guides/taskline.md)). <!-- @taskline -->
- **Parda** (Part 6) is a streaming product of its own at `/app/parda` (0228): `src/routes/_parda`, `src/features/parda`, `src/server/parda`, `src/functions/parda` and `parda-admin`; its look is "Masking" (`docs/design/parda.md`) ([parda.md](docs/guides/parda.md)). <!-- @parda -->
- **Chaal** (Part 7) is a chess app on the Lichess API at `/app/chaal` (0254): `src/routes/_chaal`, `src/features/chaal`, `src/server/chaal`, `src/functions/chaal` and `chaal-admin`, its OAuth, stream and manifest routes in `src/server/routes/chaal-*.ts`; its look is "Diagram" (`src/styles/chaal.css`, 0258) ([chaal.md](docs/guides/chaal.md)). <!-- @chaal -->
- **Kharcha** (Part 8) is an expense tracker and bill splitter at `/app/kharcha` (0277): `src/routes/_kharcha`, `src/features/kharcha`, `src/server/kharcha` (tables `kh_*`), `src/functions/kharcha` and `kharcha-admin`; its look is "Bahi Khata" (`src/styles/kharcha.css`, 0281) ([kharcha.md](docs/guides/kharcha.md)). <!-- @kharcha -->
- **Where things are:** the portfolio is the site at `/`; the showcase apps are under `/apps` (Notes, Links, Habits and Forms; Kanban became Taskline and Expenses became Kharcha, and `/apps/kanban` and `/apps/expenses` redirect there), open to visitors through guest sessions; Taskline is at `/app/taskline`, with a sandbox for visitors; a published form is at `/f/<slug>`. The demo and the references live under `/dev` (`pnpm dev` only, 404 in production): the demo home, `/dev/stack`, the public Test CRUD pages and `/dev/examples`, one working page per module, each naming its source file and guide.

**Stack:** TanStack Start, Router, Query, DB, Form and Store; React 19, TypeScript 6 strict; Tailwind 4 + shadcn/ui; Zod 4, Paraglide; Better Auth, Drizzle + Neon Postgres (PGlite in tests); Vitest, Storybook, Biome, Knip, pnpm. Versions and services: [architecture.md](docs/guides/architecture.md).

**Code:** `src/routes` (file routes), `src/features/<name>` (one feature, client and server), `src/functions` (server functions), `src/server` (server-only), `src/components`, `src/hooks`, `src/lib` (shared), `messages/` (en, ne), `drizzle/` (migrations), `tests/`, `e2e/`, `scripts/`. The full map: [conventions.md](docs/guides/conventions.md).

## Before you write code

1. **Read the guide for the area** (the table below) and its "Pitfalls already solved". The rules for the files you will touch are in `.claude/rules/`: routes, functions, server, features, tests, messages, migrations.
2. **Find the one way.** The standard says how each thing is named and done, and Test CRUD shows it (`src/features/test-crud`, `src/server/test-crud`, `src/functions/test-crud.ts`). Where the code shows two ways, the standard's is the one.
3. **Reuse before writing.** Pages are built from `src/components/page`, `data-table`, `data-display`, `charts`, `filters`, `navigation`, `dialogs` and `forms` (the kit: design-system.md, "Components"). Feature code supplies columns, filters, fields and actions.
4. **Use the recipe when there is one** (`.claude/skills/`): `new-feature` (`pnpm new:feature`, the only "add a feature" text is [crud.md](docs/guides/crud.md), 0173), `server-function`, `migration`, `gates`, `plan-task`.
5. **Research first:** the current docs (context7) for every library API you adopt.
6. **When the code is written:** both message files, the guide for the area, a decision for a non-obvious choice, then `pnpm standard` and `pnpm gates`.

## MUST

1. **Server-render everything.** The loader MUST await `ensureQuery(queryClient, opts)` (`src/lib/query.ts`; Query 5.104 deprecated `ensureQueryData`, 0111) and the component MUST call `useSuspenseQuery(opts)`. Loaders return only what `head`/`staticData` need.
2. **Follow the standard.** Folders, file names, exports, verbs, guards and the one way for each thing are in conventions.md ("The standard"). A new file, export or function MUST fit it as written; `pnpm standard` says where it does not.
3. **Keep the URL as the state** of lists (`q`, filters, `sort`, `page`, `pageSize`), through the shared list contract: `src/lib/list/` on both sides, `src/server/db/list.ts` for SQL, `listSchema`, `listLoader` and `useListPage` + `CrudListPage` (0116, 0173). Filters go in `<FilterBar>`, which works without JS.
4. **Make the server the authority.** Every protected server function MUST run `requirePermission("<resource>:<action>")` first, then `withServices` (0173), validate its input with the feature's Zod schema (`z.strictObject`), and call into `src/server/**`. `tests/server/functions-guards.test.ts` makes every file in `src/functions` declare its guards. Routes add `assertRoutePermission` in `beforeLoad`; the UI only hides (`useCan`, `<Can>`) what the server would refuse.
5. **Write through the write hook:** `useCrudMutation` over the feature's collection, a form through `useCrudForm` (0294).
6. **Put every user-visible string in both message files** (`messages/en.json`, `messages/ne.json`) and call `m.key()` at render time. Delete keys whose UI is gone (a test checks).
7. **Import Zod as `"zod"`.** It resolves to `src/lib/zod.ts` (jitless). The CSP forbids eval (0086).
8. **Make every page indexable or private:** public content uses `seo()` (lists `listSeo()`) and goes in the sitemap; everything else is `noindex` via its layout or `privateHead()`. `tests/unit/route-seo.test.ts` checks every route (0100).
9. **Ship a migration with every schema change:** CI fails when `drizzle-kit generate` would produce one (0118).
10. **Log on the server through `log()`** (`src/server/log.ts`), so each line carries the request id (0123).
11. **Move the docs with the code:** the guide for the area and `decisions.md` in the same commit. A new pitfall goes in its area's guide; it goes here only if most tasks would hit it.
12. **Run every gate before calling work done:** `typecheck`, `check`, `knip`, `test`, `test:storybook`, `test:e2e`, `build`, `build-storybook`, `i18n:check` and the bundle budget, green with no warnings. `pnpm gates` runs them all, narrowed to what changed, and says what each covered ([testing.md](docs/guides/testing.md), "pnpm gates"). `test:e2e` is the browser review: every page on a production build, en/ne × light/dark × 390/768/1280 (axe, overflow, console, CSP, CLS ≤ 0.01), plus the flows.

## NEVER

1. **NEVER fetch first-paint data in an effect,** and NEVER call `useQuery` without `enabled` or a `// useQuery: <reason>` comment.
2. **NEVER import server-only code into client code:** `src/server/**` and `*.server.ts` stay on the server (Start import protection and tests enforce it). Shared code (`src/lib`, `src/hooks`, `src/components`) NEVER imports a feature, a function or a route.
3. **NEVER use `any`, `@ts-ignore`, or a lint suppression without its reason** in the comment.
4. **NEVER put `m.key()` in a module-level constant:** on the server it freezes the first request's locale.
5. **NEVER import a feature's `queries.ts`, `schema.ts` or `collection.ts` statically in a route file** (0151, 0194, 0294): the route imports `search.ts`, and its loader imports `queries.ts` with `await import(…)`.
6. **NEVER throw a bare `Error` for a refusal** in server code: an `AppError` (`ruleError`, `notFound`). NEVER `console.*` there.
7. **NEVER add `useMemo` or `useCallback` for speed** (the React Compiler memoizes, 0136). Keep `useMemo` where identity matters (creating a TanStack DB collection).
8. **NEVER use `z.strictObject` for a URL search schema** (links carry utm tags), `zod/v4`, or `db:push`.
9. **NEVER add to `known-deviations.json` without a decision,** skip a gate, or weaken a test to pass one.
10. **NEVER edit a migration that has shipped,** and NEVER rewrite the records: PLAN.md's done sections, old decisions, `docs/history`.

## Guides ([docs/guides/](docs/guides/))

Most guides end with "Pitfalls already solved". Read them before you change that area.

| Guide | Covers |
| --- | --- |
| [architecture.md](docs/guides/architecture.md) | Layers, a request end to end, where to start for each task, the stack |
| [crud.md](docs/guides/crud.md) | **The one way to build a feature**, `pnpm new:feature` |
| [conventions.md](docs/guides/conventions.md) | File map, **the standard** (folders, names, verbs, the one way, how it is enforced), building blocks, breadcrumbs, command palette |
| [design-system.md](docs/guides/design-system.md) | Tokens, presets, shells, the component kit, theming |
| [routing-data.md](docs/guides/routing-data.md) | Routes, loaders, streaming, server functions, errors, server-only code |
| [search-filters-masking.md](docs/guides/search-filters-masking.md) | URL search params, the list contract, filters, route masking |
| [tables-filters.md](docs/guides/tables-filters.md) | DataTable, FilterBar and chips, Pagination, bulk and row actions |
| [forms.md](docs/guides/forms.md) | useAppForm, fields, validation, server field errors, rich text |
| [state.md](docs/guides/state.md) | Query vs DB vs Store vs Form vs URL |
| [rbac.md](docs/guides/rbac.md) | Roles, permissions, guards, escalation rules |
| [attachments.md](docs/guides/attachments.md) | Cloudinary uploads, showing images |
| [seo.md](docs/guides/seo.md) | seo()/listSeo() vs privateHead(), JSON-LD, sitemap, robots, icons |
| [i18n.md](docs/guides/i18n.md) | Messages, locale URLs, Intl formatting, fonts, adding a language |
| [testing.md](docs/guides/testing.md) | Vitest projects, PGlite, Storybook, guard tests, the standard's tests, e2e and browser review |
| [observability.md](docs/guides/observability.md) | Logs, Sentry, PostHog consent, feature flags |
| [security.md](docs/guides/security.md) | Headers, CSP, CSRF, authorization, sanitizing, secrets |
| [deployment.md](docs/guides/deployment.md) | Vercel + Neon, migrations, cron, seeds, production builds |
| [recipes.md](docs/guides/recipes.md) | Optional features: jobs, caching, rate limits, contact form, CSV, orgs, billing |
| [new-project.md](docs/guides/new-project.md) | `pnpm strip-demo`, renaming, first admin, your first feature |
| [apps.md](docs/guides/apps.md) | The showcase apps at `/apps`: guest sessions, ownership, adding an app <!-- @apps --> |
| [taskline.md](docs/guides/taskline.md) | Taskline at `/app/taskline`: where things are, its shell, views, access matrix, services, admin, adding to it <!-- @taskline --> |
| [parda.md](docs/guides/parda.md) | Parda at `/app/parda`: the shell and the media kit, the TMDB catalogue, sources and the placeholder player, the library and profiles, search, watch parties, the admin <!-- @parda --> |
| [chaal.md](docs/guides/chaal.md) | Chaal at `/app/chaal`: the layer, the game model and the board kit, online play, puzzles, players, watch, community, the Lichess client, connecting Lichess, the look, the admin <!-- @chaal --> |
| [kharcha.md](docs/guides/kharcha.md) | Kharcha at `/app/kharcha`: where things are, the shell, expenses and Spend, budgets, invites, People and threads, money, access, the look, server patterns, the admin <!-- @kharcha --> |
| [portfolio.md](docs/guides/portfolio.md) | The portfolio at `/`: content, admin, media, the "Himal" design system <!-- @portfolio --> |

## Commands

```bash
pnpm setup:local         # fresh clone -> runnable: .env, secret, messages, local database (0156)
pnpm diagnose            # checks Node, .env, database latency and migrations, ports; prints fixes
pnpm dev                 # http://localhost:3000, on DATABASE_URL from .env
pnpm dev:local           # same, on a local PGlite database in .data/pglite (fast; kept between runs, 0155)
pnpm dev:offline         # same, on in-memory PGlite with every outside service off (0149)
pnpm gates               # every gate below in order, narrowed to what changed, with a table of times; --full runs every suite whole; pnpm gates:clean stops what a killed run left (0296)
pnpm standard            # the standard's rules against the list of known deviations, in two seconds; <file> checks one file, --list <rule> prints a rule's deviations, --prune takes fixed ones off the list (0297)
pnpm typecheck           # compiles messages if they changed, then TypeScript 7's native tsc, incremental (0280, 0296); the tools still read TypeScript 6
pnpm check               # Biome lint + format check (warnings fail). pnpm check:fix to fix
pnpm knip                # unused files, exports, types and dependencies (knip.json)
pnpm test                # three Vitest projects: unit, components (jsdom), server (PGlite); worker counts come from free memory (0296)
pnpm test:storybook      # every story in real Chrome, twice: en/light and ne/dark (a11y violations fail); a path narrows both passes
pnpm test:e2e            # builds (only when the source changed) + starts a production server (PGlite, fake Resend), then flows + the browser review of every page
pnpm build               # production build (.output/); pnpm start runs it
pnpm build-storybook
pnpm db:generate | db:migrate | db:check   # db:generate --name <layer>_<what> (core, apps, portfolio, a product)
pnpm i18n:translate      # machine-translates Nepali for messages that have none (review the diff, 0157)
pnpm i18n:check          # missing or empty translations, variables, plural forms
pnpm new:feature <name> [--public] [--localized]   # a feature in the standard's shape (crud.md, 0175, 0297); needs a committed tree
node scripts/check-bundle.ts   # after a build: every page's JavaScript (with what it imports) and preloaded fonts against the budget (0151, 0217); --routes=<text> lists matching routes
pnpm tmdb:record         # Parda: re-records tests/fixtures/tmdb/ from the real API (TMDB_READ_TOKEN); pnpm parda:probe runs the source probe <!-- @parda -->
pnpm lichess:record      # Chaal: re-records tests/fixtures/lichess/ from the real API (the explorer needs LICHESS_APP_TOKEN; `puzzles`, `players` or `watch` records only those); pnpm engine:copy copies Stockfish into public/chaal/engine/ (Vite runs it before dev and build) <!-- @chaal -->
node scripts/audit/all.ts      # Part 9's audits of the source against the standard (15.5); scripts/audit/measure.ts <label> -- <command> times a gate (0295)
pnpm db:seed-kharcha --password "…"   # Kharcha: three demo accounts who share a group (dev:local and the e2e harness have them) <!-- @kharcha -->
```

Seed commands are in [deployment.md](docs/guides/deployment.md), coverage in [testing.md](docs/guides/testing.md).

## Pitfalls most tasks can hit

- **Windows:** keep the checkout path short, about 90 characters at most (0029). In Git Bash, avoid apostrophes inside heredocs and `node -e`, and backslashes inside `node -e` strings and heredocs (a heredoc turned a script's `\\w` into `w`); write the script file with the editor instead. In edit scripts, pass replacements to `String.replace` as functions: `$`` in a replacement string is a special pattern.
- **Server functions: `requirePermission` first, then `withServices`** (0173): the guard test's regex allows exactly that order, and a refused call builds nothing. Keep `createServerFn(…)` literal in each functions file (Start extracts them statically). Inputs are `z.strictObject`; URL search schemas never are (links carry utm tags).
- **Taskline's services resolve access first** (0204): every app function runs `requireTasklineUser` → `withTasklineServices`, and its service calls `resolveWorkspace`/`resolveProject` before reading or writing anything; a new function adds its operation to the access matrix (`tests/server/taskline-access.test.ts`). Notifications are written in the same transaction (`produce`) and their instant emails handed to `services.deliver` only after it commits (0214). A write that may fire automations hands its events to `runAutomations` at the end of its transaction (0221); the engine writes through repositories, never services, so nothing chains. <!-- @taskline -->
- **Parda's reads go through its catalogue service** (`src/server/parda/catalog/service.ts`): takedowns, the kids' cap and the cache epoch apply there and nowhere else, so a new page or function never calls TMDB directly. Catalogue functions start with `withPardaPublic`, library functions with `requirePardaUser` → `withPardaServices` and a row in `tests/server/parda-access.test.ts`. TMDB's Nepali answer gives an untranslated title in its original language, so Nepali text is filled in from English (`fillIn`, `nepaliName`, 0244). <!-- @parda -->
- **Chaal calls Lichess only through its client** (`src/server/chaal/lichess/client.ts`, the singletons in `store.ts`): one call at a time per lane, a shared 429 cooldown, Zod-mapped answers, never a token in a log. A user's token is opened only inside `withToken(deps, userId, feature, …)`, which checks maintenance, the feature's switch and scopes (0268), and marks the connection revoked on a 401; public functions start with `withChaalPublic`, personal ones with `requireChaalUser` → `withChaalServices` and a row in `tests/server/chaal-access.test.ts` (0254–0256). Lichess's streams with a token go through our stream routes (a seek too), and only the tab leader opens the event stream (one per token, 0266); it also reads the games in progress, since the event stream never says a move was made (0267). Public live data (the TV's feeds, a game being played, a broadcast round's PGN) the browser reads from Lichess itself, after a first paint the server reads through the cache (0272). <!-- @chaal -->
- **Kharcha's money is integer minor units of its own currency** (0278): convert typed amounts with `toMinor(amount, code)` and show them with `formatMoney` (`src/lib/i18n/currency.ts`), never add floats. Its services resolve first (`resolveExpense`, `resolveGroup`, … in `src/server/kharcha/access.ts`), and every write of an expense or payment calls `writeLedger` in its transaction and `bumpRevs` for everyone it touches; a new function adds its row to `tests/server/kharcha-access.test.ts`, and a new table that points at `kh_person` adds its lines to `mergePerson` (0277). A write that tells someone calls `produce` in its transaction and hands the instant ids to `deliverAfter(services.deliver, …)` after it commits (0286). <!-- @kharcha -->
- **Routes stay thin:** loader, search, head and a component that renders one from `src/features/<name>/components` (0143).
- **Route options are in every page's JavaScript** (0151): only `component`, `pendingComponent`, `errorComponent` and `notFoundComponent` are split out, and only when written inline in `createFileRoute("…")({ … })` (not spread or returned by a helper). One static import of a feature's `queries.ts` puts every server-function stub of that feature in every page (0194, 0197), and a `collection.ts` brings TanStack DB (0294). `node scripts/check-bundle.ts` after a build shows the cost.
- **Uptime monitors use `GET /api/health`,** not the `/health` page (0124).
- **There is no `db:push`** (0118): a schema change is a migration.
- **Shared lists carry `// @new-feature:<slot>` markers** (permissions, labels, audit actions, admin sections, commands, schema index, guard test, e2e pages, sitemap, route-SEO test): keep them when editing those lists, or `pnpm new:feature` can't insert there. Code of a removable layer in shared files sits between `portfolio:start`/`portfolio:end` (or `apps:…`) comment lines or on a line ending in `// @portfolio` (`<!-- @portfolio -->` in Markdown), for `pnpm strip-demo` (0163, 0175); `tests/unit/strip-markers.test.ts` checks they balance.
- **Knip entries:** files reached only by a string path (Nitro routes and plugins in `vite.config.ts`, Vite-plugin modules, alias targets) must be listed in `knip.json`'s `entry`, or knip reports them unused. Don't delete them on knip's word alone.
- **E2E against a stale build:** locally, `pnpm test:e2e` reuses a server already on port 3100 (`node e2e/harness/server.ts`). Restart it after changing app code, or the suite tests the old build; `pnpm gates` checks the server's build hash and restarts a stale one itself (0296). Auth endpoints are rate limited per IP: tests that sign in call `harness.resetRateLimits()` first.
- **An editor hook runs after each edit** (`.claude/settings.json`, 0297): Biome formats the file, then Biome and `pnpm standard` report what is left. Fix what it reports before going on; do not work around it.
