# CLAUDE.md

Entry point for working on this repository (people and AI sessions alike). Read this first, then the guide for the area you touch. It holds only what most tasks need; the rest is in the guides (0223).

## What this is

A bilingual (English + Nepali) portfolio app with a public site and an admin area. Every page renders on the server, works in both locales, and passes strict CSP, accessibility and layout-shift checks. **Test CRUD** is the reference feature to copy.

- **Plan and status:** [docs/PLAN.md](docs/PLAN.md). **Never read it whole:** search it, or read only the lines you need. Part 5 (section 11, Tasks 46–58: **Taskline**) is done; its review and measurements are decisions 0226 and 0227. Part 6 (section 12, Tasks 59–70: **Parda**) is done; its review and measurements are decisions 0244 and 0245, and its servers are a placeholder that plays no video until the owner connects a provider (0228). Part 7 (section 13, Tasks 71–85: **Chaal**) is under way: Tasks 71 (the foundation, decisions 0254–0257), 72 (the look, "Diagram", decision 0258), 73 (the shell, settings and first pages, decisions 0259–0260), 74 (the game model and the board kit, decisions 0261–0262), 75 (the analysis board and the engine, decisions 0263–0264), 76 (play offline: the computer and over the board, decision 0265), 77 (play online I: streams, challenges, the Lichess AI and the live game, decision 0266), 78 (play online II: quick pairing, correspondence and notifications, decision 0267), 79 (admin I: settings, connections and blocks, API health, decision 0268), 80 (puzzles: the daily one, training, the streak, Lichess's dashboard and replays, decisions 0269 and 0270) and 81 (players and games: leaderboards, a player's page and games, following, a finished game's replay, the palette's search, decision 0271) are done; the next is Task 82. Other work follows the same rules: read the guide for the area, run every gate, and record non-obvious choices.
- **Why things are the way they are:** [docs/decisions.md](docs/decisions.md), numbered with an index. Add an entry for every non-obvious choice.
- **Taskline** (Part 5) is a product of its own at `/app/taskline` (0208): its routes in `src/routes/_taskline`, its pages and shell in `src/features/taskline`, its tables, access resolver and services in `src/server/taskline`, its functions in `src/functions/taskline`; the admin runs the team from `/admin/taskline` (`src/features/taskline/admin`, `src/server/taskline/admin`, `src/functions/taskline-admin`) ([taskline.md](docs/guides/taskline.md)). <!-- @taskline -->
- **Parda** (Part 6) is a streaming product of its own at `/app/parda` (0228): its routes in `src/routes/_parda`, its pages, shell, media kit and player in `src/features/parda`, its TMDB client and cache, catalogue, library, profiles, sources, parties and alerts in `src/server/parda`, its functions in `src/functions/parda`; the admin runs sources, takedowns, reports, settings and curation from `/admin/parda` (`src/functions/parda-admin`). Its look is "Masking" (`.impeccable/surfaces/parda.md`, the record in `docs/design/parda.md`) ([parda.md](docs/guides/parda.md)). <!-- @parda -->
- **Chaal** (Part 7) is a chess app on the Lichess API at `/app/chaal` (0254): its Lichess client, cache, connections (OAuth, the token vault) and streams in `src/server/chaal`, its isomorphic parts in `src/features/chaal` (the game model over chess.js in `chess/`, the board kit in `board/`, the engine's worker client in `engine/`, the analysis board in `analysis/`, local games and the play hub in `local/`, online play in `play/` and `game/`, the streams' reader, the event store and the tab leader in `live/`, puzzles in `puzzles/`, players and replays in `players/` and `game/`), its look in `src/styles/chaal.css` ("Diagram", 0258), its functions in `src/functions/chaal` and `src/functions/chaal-admin`, its OAuth, stream and manifest routes in `src/server/routes/chaal-*.ts` (and its daily job in `cron-chaal.ts`), its pages in `src/routes/_chaal` (the frame in `src/features/chaal/shell`); the admin runs settings, connections and blocks, and the API's health from `/admin/chaal` (`src/features/chaal/admin`, `src/server/chaal/admin`), with Task 71's lab at `/admin/chaal/lab` ([chaal.md](docs/guides/chaal.md)). <!-- @chaal -->
- **Where things are:** the portfolio is the site at `/`; the showcase apps are under `/apps` (Notes, Links, Expenses, Habits and Forms; Kanban became Taskline, and `/apps/kanban` redirects there), open to visitors through guest sessions; Taskline is at `/app/taskline`, with a sandbox for visitors; a published form is at `/f/<slug>`. The demo and the references live under `/dev` (`pnpm dev` only, 404 in production): the demo home, `/dev/stack`, the public Test CRUD pages and `/dev/examples`, one working page per module, each naming its source file and guide.

**Stack:** TanStack Start, Router, Query, DB, Form and Store; React 19, TypeScript 6 strict; Tailwind 4 + shadcn/ui; Zod 4, Paraglide; Better Auth, Drizzle + Neon Postgres (PGlite in tests); Vitest, Storybook, Biome, Knip, pnpm. Versions and services: [architecture.md](docs/guides/architecture.md).

**Code:** `src/routes` (file routes), `src/features/<name>` (one feature, client and server), `src/functions` (server functions), `src/server` (server-only), `src/components`, `src/hooks`, `src/lib` (shared), `messages/` (en, ne), `drizzle/` (migrations), `tests/`, `e2e/`, `scripts/`. The full map: [conventions.md](docs/guides/conventions.md).

## Guides ([docs/guides/](docs/guides/))

Most guides end with "Pitfalls already solved". Read them before you change that area.

| Guide | Covers |
| --- | --- |
| [architecture.md](docs/guides/architecture.md) | Layers, a request end to end, where to start for each task, the stack |
| [crud.md](docs/guides/crud.md) | **The one way to build a feature**, `pnpm new:feature` |
| [conventions.md](docs/guides/conventions.md) | File map, building blocks, breadcrumbs, command palette, rules |
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
| [testing.md](docs/guides/testing.md) | Vitest projects, PGlite, Storybook, guard tests, e2e and browser review |
| [observability.md](docs/guides/observability.md) | Logs, Sentry, PostHog consent, feature flags |
| [security.md](docs/guides/security.md) | Headers, CSP, CSRF, authorization, sanitizing, secrets |
| [deployment.md](docs/guides/deployment.md) | Vercel + Neon, migrations, cron, seeds, production builds |
| [recipes.md](docs/guides/recipes.md) | Optional features: jobs, caching, rate limits, contact form, CSV, orgs, billing |
| [new-project.md](docs/guides/new-project.md) | `pnpm strip-demo`, renaming, first admin, your first feature |
| [apps.md](docs/guides/apps.md) | The showcase apps at `/apps`: guest sessions, ownership, adding an app <!-- @apps --> |
| [taskline.md](docs/guides/taskline.md) | Taskline at `/app/taskline`: its shell, views, access matrix, services, admin, adding to it <!-- @taskline --> |
| [parda.md](docs/guides/parda.md) | Parda at `/app/parda`: the shell and the media kit, the TMDB catalogue, sources and adapters, the placeholder player, the watch page and progress, the library and profiles, the kids' cap, the schedule and new-episode alerts, source ranking and the daily probe, search and Discover, watch parties, the player lab, the admin's controls (sources, takedowns, reports, settings), curation and the overview <!-- @parda --> |
| [chaal.md](docs/guides/chaal.md) | Chaal at `/app/chaal`: the layer, the shell and pages (the frame, connecting from any page, preferences, `MiniBoard`), the game model and the board kit (rules over chess.js, the tree, PGN, the board's pointer, keyboard and speech, the kit), online play (Board-legal paces, challenges kept open, the Lichess AI, a game on Lichess, the tab leader, activity), puzzles (the trainer, themes, batches and the queue, the streak, attempts and posting them, progress and Lichess's dashboard), players and games (leaderboards, a player's page and games, following, the replay, the palette's search), the Lichess client (lanes, cooldowns, cache, counters), the admin (settings, maintenance, connections and blocks, health and the call stats), connecting Lichess (OAuth, the token vault, scopes by feature, guests), the look ("Diagram": tokens, board themes, pieces, sounds, fonts), streams through the server, the lab, fixtures and the fake Lichess, the spikes, the en/ne glossary <!-- @chaal --> |
| [portfolio.md](docs/guides/portfolio.md) | The portfolio at `/`: content, admin, media, the "Himal" design system <!-- @portfolio --> |

## Commands

```bash
pnpm setup:local         # fresh clone -> runnable: .env, secret, messages, local database (0156)
pnpm diagnose            # checks Node, .env, database latency and migrations, ports; prints fixes
pnpm dev                 # http://localhost:3000, on DATABASE_URL from .env
pnpm dev:local           # same, on a local PGlite database in .data/pglite (fast; kept between runs, 0155)
pnpm dev:offline         # same, on in-memory PGlite with every outside service off (0149)
pnpm typecheck           # compiles messages, then tsc with a 4 GB heap (0222: the default 2 GB no longer fits)
pnpm check               # Biome lint + format check (warnings fail). pnpm check:fix to fix
pnpm knip                # unused files, exports, types and dependencies (knip.json)
pnpm test                # unit + server (PGlite) + jsdom component tests
pnpm test:storybook      # every story in real Chrome, twice: en/light and ne/dark (a11y violations fail)
pnpm test:e2e            # builds + starts a production server (PGlite, fake Resend), then flows + the browser review of every page
pnpm build               # production build (.output/); pnpm start runs it
pnpm build-storybook
pnpm db:generate | db:migrate | db:check
pnpm i18n:translate      # machine-translates Nepali for messages that have none (review the diff, 0157)
pnpm i18n:check          # missing or empty translations, variables, plural forms
pnpm new:feature <name> [--public] [--localized]   # a feature in the CRUD standard (crud.md, 0175); needs a committed tree
node scripts/check-bundle.ts   # after a build: every page's JavaScript (with what it imports) and preloaded fonts against the budget (0151, 0217)
pnpm tmdb:record         # Parda: re-records tests/fixtures/tmdb/ from the real API (TMDB_READ_TOKEN); pnpm parda:probe runs the source probe <!-- @parda -->
pnpm lichess:record      # Chaal: re-records tests/fixtures/lichess/ from the real API (the explorer needs LICHESS_APP_TOKEN; `puzzles` records only the puzzle batch); pnpm engine:copy copies Stockfish into public/chaal/engine/ (Vite runs it before dev and build) <!-- @chaal -->
```

Seed commands are in [deployment.md](docs/guides/deployment.md), coverage in [testing.md](docs/guides/testing.md).

A task is done when `typecheck`, `check`, `knip`, `test`, `test:storybook`, `test:e2e`, `build`, `build-storybook`, `i18n:check` and the bundle budget are all green (CI runs them on every PR) with no warnings. `test:e2e` is the browser review: every page on a production build, en/ne × light/dark × 390/768/1280 (axe, overflow, console, CSP, CLS ≤ 0.01), plus the flows.

## Golden rules

1. **Server-render everything.** The loader awaits `ensureQuery(queryClient, opts)` (`src/lib/query.ts`; Query 5.104 deprecated `ensureQueryData`, 0111) and the component calls `useSuspenseQuery(opts)`. No first-paint fetching in effects. Loaders return only what `head`/`staticData` need.
2. **Reuse before writing.** Pages are built from `src/components/page`, `data-table`, `data-display`, `charts`, `filters`, `navigation`, `dialogs` and `forms` (the kit: design-system.md, "Components"). Feature code supplies columns, filters, fields and actions. A pattern used twice becomes shared.
3. **The URL is the state** for lists (`q`, filters, `sort`, `page`, `pageSize`). These come from the shared list contract: `src/lib/list/` (params, paging, URL serialization) on both sides, plus `src/server/db/list.ts` for SQL. Filters go in `<FilterBar>`, which works without JS. List pages use `listSchema` for the contract, `listLoader` (`tableListInput` + `loadList`) in the loader and `useListPage` + `CrudListPage` in the component (0116, 0173).
4. **The server is the authority.** Every protected server function runs `requirePermission("<resource>:<action>")` (`tests/server/guarded-functions.test.ts` makes every file in `src/functions` declare its guards), validates input with the feature's Zod schema, and calls into `src/server/**`. Routes add `assertRoutePermission` in `beforeLoad`; the UI only hides (`useCan`, `<Can>`) what the server would refuse.
5. **Server-only code stays server-only:** `src/server/**` and `*.server.ts`, enforced by Start import protection and tests.
6. **i18n:** every user-visible string is a Paraglide message in `messages/en.json` and `messages/ne.json`. Call `m.key()` at render time, never in module-level constants. Delete keys whose UI is gone (a test checks).
7. **Import Zod as `"zod"`.** It resolves to `src/lib/zod.ts` (jitless). The CSP forbids eval (decision 0086). Biome refuses `zod/v4`.
8. **No `any`, no `@ts-ignore`,** and no lint suppression without a reason in the comment.
9. **Every page is indexable or private:** public content uses `seo()` (lists `listSeo()`) and goes in the sitemap; everything else is `noindex` via its layout or `privateHead()`. `tests/unit/route-seo.test.ts` checks every route (0100).
10. **Docs move with code:** update the guide for the area and `decisions.md` for non-obvious choices in the same commit. A new pitfall goes in its area's guide; it goes here only if most tasks would hit it.

**Adding a feature:** read [crud.md](docs/guides/crud.md), the only "add a feature" text (0173), and start with `pnpm new:feature <name> [--public] [--localized]` (0175).

## Pitfalls most tasks can hit

- **Windows:** keep the checkout path short, about 90 characters at most (0029). In Git Bash, avoid apostrophes inside heredocs and `node -e`, and backslashes inside `node -e` strings and heredocs (a heredoc turned a script's `\\w` into `w`); write the script file with the editor instead. In edit scripts, pass replacements to `String.replace` as functions: `$`` in a replacement string is a special pattern.
- **Server functions: `requirePermission` first, then `withServices`** (0173): the guard test's regex allows exactly that order, and a refused call builds nothing. Keep `createServerFn(…)` literal in each functions file (Start extracts them statically). Inputs are `z.strictObject`; URL search schemas never are (links carry utm tags).
- **Taskline's services resolve access first** (0204): every app function runs `requireTasklineUser` → `withTasklineServices`, and its service calls `resolveWorkspace`/`resolveProject` before reading or writing anything; a new function adds its operation to the access matrix (`tests/server/taskline-access.test.ts`). Notifications are written in the same transaction (`produce`) and their instant emails handed to `services.deliver` only after it commits (0214). A write that may fire automations hands its events to `runAutomations` at the end of its transaction (0221); the engine writes through repositories, never services, so nothing chains. <!-- @taskline -->
- **Parda's reads go through its catalogue service** (`src/server/parda/catalog/service.ts`): takedowns, the kids' cap and the cache epoch apply there and nowhere else, so a new page or function never calls TMDB directly. Catalogue functions start with `withPardaCatalog`, library functions with `requirePardaViewer` → `withPardaServices` and a row in `tests/server/parda-access.test.ts`. TMDB's Nepali answer gives an untranslated title in its original language, so Nepali text is filled in from English (`fillIn`, `nepaliName`, 0244). <!-- @parda -->
- **Chaal calls Lichess only through its client** (`src/server/chaal/lichess/client.ts`, the singletons in `store.ts`): one call at a time per lane, a shared 429 cooldown, Zod-mapped answers, never a token in a log. A user's token is opened only inside `withToken(deps, userId, feature, …)`, which checks maintenance, the feature's switch and scopes (0268), and marks the connection revoked on a 401; public functions start with `withChaalPublic`, personal ones with `requireChaalUser` → `withChaalServices` and a row in `tests/server/chaal-access.test.ts` (0254–0256). Lichess's streams with a token go through our stream routes (a seek too), and only the tab leader opens the event stream (one per token, 0266); it also reads the games in progress, since the event stream never says a move was made (0267). <!-- @chaal -->
- **Routes stay thin:** loader, search, head and a component that renders one from `src/features/<name>/components` (0143).
- **Route options are in every page's JavaScript** (0151): only `component`, `pendingComponent`, `errorComponent` and `notFoundComponent` are split out, and only when written inline in `createFileRoute("…")({ … })` (not spread or returned by a helper). Route files import a feature's `search.ts` (URL contract), never `schema.ts` (form schemas), and a loader imports its feature's `queries.ts` (or a functions module) with `await import(…)` inside the loader: one static import puts every server-function stub of that feature in every page (0194, 0197). `node scripts/check-bundle.ts` after a build shows the cost.
- **The React Compiler memoizes client code** (0136): don't add `useMemo`/`useCallback` for speed. Keep `useMemo` where identity matters (creating a TanStack DB collection). It runs in Storybook too, not in SSR.
- **Server logs go through `log()`** (`src/server/log.ts`), not `console.*`, so each line carries the request id; the id comes from AsyncLocalStorage set by `src/server.ts` (0123). Uptime monitors use `GET /api/health`, not the `/health` page (0124).
- **Schema changes need a migration:** CI fails when `drizzle-kit generate` would produce one. There is no `db:push` (0118).
- **Shared lists carry `// @new-feature:<slot>` markers** (permissions, labels, audit actions, admin sections, commands, schema index, guard test, e2e pages, sitemap, route-SEO test): keep them when editing those lists, or `pnpm new:feature` can't insert there. Code of a removable layer in shared files sits between `portfolio:start`/`portfolio:end` (or `apps:…`) comment lines or on a line ending in `// @portfolio` (`<!-- @portfolio -->` in Markdown), for `pnpm strip-demo` (0163, 0175); `tests/unit/strip-markers.test.ts` checks they balance.
- **Knip entries:** files reached only by a string path (Nitro routes and plugins in `vite.config.ts`, Vite-plugin modules, alias targets) must be listed in `knip.json`'s `entry`, or knip reports them unused. Don't delete them on knip's word alone.
- **E2E against a stale build:** locally, `pnpm test:e2e` reuses a server already on port 3100 (`node e2e/harness/server.ts`). Restart it after changing app code, or the suite tests the old build. Auth endpoints are rate limited per IP: tests that sign in call `harness.resetRateLimits()` first.
