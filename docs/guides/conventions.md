# Conventions: file structure and building blocks

How code is organised and which shared pieces a page is built from. When a pattern shows up twice, it becomes a shared component or helper here. Feature code then only supplies what is specific to the feature.

## Where code lives

```
src/
  routes/                 File routes (TanStack Router). Thin: loader, head, staticData, and a page that composes components.
    _public/ _auth/ _authed/ _admin/   Layouts by audience. A folder's route.tsx is a section layout (names its breadcrumb).
                          _public: health, verify email, reset password; _auth: sign-in, /upgrade; _authed: account; _admin: admin area
    dev/                  Demo and references, dev builds only
    _site/                The portfolio at / <!-- @portfolio -->
    _apps/ f/ l/          The showcase apps at /apps; a published form; a short link <!-- @apps -->
    _taskline/            Taskline at /app/taskline <!-- @taskline -->
    _parda/               Parda at /app/parda <!-- @parda -->
    _chaal/               Chaal at /app/chaal <!-- @chaal -->
    _kharcha/             Kharcha at /app/kharcha <!-- @kharcha -->
  components/             Generic UI, no feature knowledge.
    crud/                 CrudListPage, useCrudMutation, useCrudForm + CrudForm, NewButton, RecordLink (crud.md)
    ui/                   shadcn primitives (Button, Table, Dialog…). Generated; adjust sparingly.
    page/                 Page, PageHeader (tabs slot), PageTabs, Breadcrumbs, EmptyState, DetailLayout, SettingsLayout,
                          FormSection, FormCard, StickyFormBar, PageHeaderSkeleton, ListSkeleton
    data-table/           DataTable (TanStack Table: toolbar, row actions, CSV, saved views), DataTableSkeleton
    data-display/         StatCard, StatusBadge/StatusOf, DescriptionList, UserCell, UserAvatar, RelativeTime, CopyButton, Timeline/ActivityFeed
    charts/               AreaChart, BarChart, DonutChart (Recharts, lazy), Sparkline (SVG)
    navigation/           Pagination, SearchLink, useCloseOverlay (masked dialogs)
    filters/              FilterBar + Search/Select/MultiSelect/Boolean/NumberRange/DateRange filters, ActiveFilters chips
    dialogs/              ConfirmProvider + useConfirm, FormDialog, FormSheet, QueryDialog
    forms/                useAppForm + the field library (see the forms showcase at /dev/forms)
    admin-shell/          The admin frame: AdminShell, AppSidebar, Topbar, UserMenu, CommandMenu (design-system.md)
    auth-shell/           The sign-in pages' split screen (AuthShell)
    app-header/           The compact header of signed-in pages outside the admin (AppHeader)
    brand/                BrandMark, BrandName, ContourArt
    layout/               Site header/footer (/dev), theme, language switcher, consent banner, skip link
    errors/               Error, not-found and pending pages
  features/rbac/          Permission catalog + labels, useCan/<Can>/assertRoutePermission, users and roles UI
  features/admin/         Admin sections and groups, commands (the palette's actions), dashboard, appearance page
  features/dev/examples/  The /dev/examples pages' registry, page frame, schema and in-memory data (development only)
  features/taskline/      A product of its own, with src/server/taskline and src/functions/taskline (taskline.md) <!-- @taskline -->
  features/parda/         A product of its own, with src/server/parda and src/functions/parda (parda.md) <!-- @parda -->
  features/chaal/         A product of its own, with src/server/chaal and src/functions/chaal (chaal.md) <!-- @chaal -->
  features/kharcha/       A product of its own, with src/server/kharcha and src/functions/kharcha (kharcha.md) <!-- @kharcha -->
  features/<name>/        Everything specific to one feature, shared by client and server (the CRUD standard, crud.md):
    search.ts             The URL contract (listSchema: search, list input, defaults, filter keys). Route files import this
    schema.ts             Strict input schemas, DTO schemas (isoDateTime), form values; never imported by route options (0151)
    keys.ts queries.ts    Query keys (createCrudKeys); queryOptions for reads and mutationOptions for writes
    columns.tsx filters.tsx  DataTable columns; the filter controls and chip specs (defineFilters)
    collection.ts         The list's rows as a TanStack DB collection (crudCollection)
    constants.ts labels.ts commands.ts  Enum values, their localized labels, palette actions
    components/           <name>-list, <name>-form, <name>-detail, <name>-pending, dialogs, cards
    hooks/ lib/           use-<thing>.ts hooks; everything else, with no React ("The standard", below)
  functions/<name>.ts     Server functions: middleware + validator + a one-line call into src/server
  server/                 SERVER-ONLY (import protection + tests enforce it)
    db/                   client, schema/, types.ts (Db, Tx), list.ts (SQL list helpers)
    db/crud.ts            listPage, findOrThrow, updateVersioned, uniqueViolation, withAudit (crud.md)
    services.ts           Services: what a handler hands to its service (db, actor, imageStore)
    <name>/               repository.ts (Drizzle over an injected Db) and service.ts (rules, audit, I/O)
  middleware/             Start middleware (security headers, CSRF, auth, logging, errors)
  hooks/                  React hooks: useListPage, useListQuery, useHotkeys, useDebouncedValue, useMediaQuery, useMinuteClock
  lib/                    Isomorphic helpers, grouped by area (0158):
    list/                 params.ts (URL params), paging.ts (Paged, page maths), url.ts (search serialization)
    env/ i18n/ http/      client env schema; intl, Nepali digits, calendar days; CSP, cache-control, redirects
    observability/        Sentry (sentry-client.ts in the browser), PostHog, Web Vitals, log lines
    start/                Needs the Start runtime: routes and server code only, never components (Biome enforces it)
    crud/                 keys, schema (listSchema, idSchema, isoDateTime), filters (defineFilters), route (routes only)
    *.ts                  query (loadList, ensureQuery), seo, breadcrumbs, validation, phone, errors, tanstack-db, zod, utils
```

Outside `src/`:

```
messages/              en.json, ne.json        drizzle/   SQL migrations        public/   icons, og-default.png
tests/                 unit/, server/, components/, i18n/, email/, setup/ (env, dom, PGlite snapshot), utils/ (test-db, fake-cloudinary)
e2e/                   Playwright: review.spec.ts, flows/, harness/ (build + PGlite + fake Resend + server), support/
scripts/               setup-local, diagnose, dev-local, dev-offline, check-bundle, seeds, new-feature, strip-demo (TypeScript run by Node)
docs/                  PLAN.md, decisions.md, guides/, history/ (past reviews, screenshots)
PRODUCT.md, DESIGN.md  the portfolio's product record and design system for the design tools (impeccable); .impeccable/ holds the direction contract <!-- @portfolio -->
.github/               CI workflow, Dependabot        lefthook.yml   git hooks        knip.json   dead-code config
```

**Naming:** files are kebab-case and components PascalCase. Server-only modules live under `src/server/` or are named `*.server.ts`. Stories sit next to their component as `*.stories.tsx`. Tests live in `tests/`:
- `unit/` for pure logic
- `server/` for code that touches the database or server, on PGlite
- `components/` for jsdom tests

Every other name is in the next section.

## The standard

One folder shape, one naming scheme and one way to do each thing, in every layer, so learning one feature teaches them all (decision 0297, from PLAN 15.5). Each rule below is checked by a test in `tests/unit/standard/`, and its example is Test CRUD's (`src/features/test-crud`, `src/server/test-crud`, `src/functions/test-crud.ts`). The words the rules check names against are in `scripts/standard/vocabulary.ts`.

### A feature folder

```
src/features/<feature>/            a core feature; a product's module is src/features/<product>/<module>/
  schema.ts                        Zod schemas and the DTO types (forms, function inputs)
  search.ts                        the URL contract, the only file a route imports statically
  keys.ts                          query keys
  queries.ts                       queryOptions for reads, one object of mutationOptions for writes
  collection.ts                    TanStack DB collections (always singular)
  columns.tsx  filters.tsx         a list's columns, its filter controls and chips
  labels.ts  constants.ts  types.ts  links.ts  commands.ts
  load.ts  head.ts                 the loaders and head builders of the feature's routes
  store.ts                         a TanStack Store
  components/                      every component, its stories beside it
  hooks/                           use-<thing>.ts
  lib/                             everything else, with no React
src/server/<feature>/              repository.ts (SQL only), service.ts (rules, transactions, audit)
src/server/<product>/<module>/     the same pair, plus the product's access.ts, settings.ts, cron.ts
src/functions/<feature>.ts         or src/functions/<product>/<module>.ts and <product>-admin/<module>.ts
tests/{unit,server,components}/    <subject>[-<topic>].test.ts
```

| Rule | Example (Test CRUD) | Test |
| --- | --- | --- |
| A feature folder holds only the files above; a product is a folder of feature folders, with `shell/`, `kit/` and `admin/` | `src/features/test-crud/` holds `schema.ts`, `search.ts`, `keys.ts`, `queries.ts`, `collection.ts`, `columns.tsx`, `filters.tsx`, `labels.ts`, `constants.ts`, `commands.ts` and `components/` | `feature-file` |
| Components are in `components/`; only `columns.tsx` and `filters.tsx` sit beside the data files | `components/test-crud-list.tsx` | `feature-component` |
| `lib/` has no React, `hooks/` holds only `use-<thing>` files | | `feature-lib` |
| A server module is a folder with `repository.ts` and `service.ts`, never `<thing>-repository.ts` | `src/server/test-crud/repository.ts`, `service.ts` | `server-file` |
| Tests live in `tests/unit`, `tests/server` or `tests/components`, named after what they test | `tests/server/test-crud-service.test.ts` | `test-place`, `test-name` |

### Names

| Rule | Example (Test CRUD) | Test |
| --- | --- | --- |
| Files are kebab-case | `test-crud-list.tsx` | `file-name` |
| A feature's component file is `<thing>-<role>.tsx`; the role says what it renders | `test-crud-list.tsx`, `test-crud-form.tsx`, `edit-dialog.tsx`, `public-card.tsx`, `test-crud-pending.tsx` | `component-role` |
| An exported hook lives in a `use-<thing>` file | `src/hooks/use-list-page.ts` | `hook-file` |
| `keys.ts` exports `<feature>Keys` | `testCrudKeys` | `export-name` |
| `queries.ts` exports `<thing>QueryOptions` functions and one `<feature>Mutations` object | `testCrudListQueryOptions`, `testCrudMutations` | `export-name` |
| `collection.ts` exports `<feature>Rows` | `testCrudRows` | `export-name` |
| A schema is `<thing>Schema`, its type the same name without `Schema` | `testCrudInputSchema` and `TestCrudInput`, `testCrudListItemSchema` and `TestCrudListItem` | `export-name` |
| Guards: `require<Who>` refuses, `with<What>` provides, with the same words in every layer | `requirePermission("test-crud:read")`, `withServices`, `withPublic`; a product: `require<Product>User`, `with<Product>Services`, `with<Product>Public` | `function-guards` |
| A table carries its layer's prefix (a product's two letters, `portfolio_`, an app's name); the core's have none. Columns are snake_case | `test_crud` | `table-name` |
| A migration is `NNNN_<layer>_<what>.sql` (`core`, `apps`, `portfolio`, a product). The 59 that shipped before the rule keep their names | `pnpm db:generate --name core_projects` | `migration-name` |
| A message is `<feature>_<part>_<name>`: it starts with the feature's name spelled out, or with a word of the shared kit | `test_crud_title`, `crud_edit` | `message-name` |
| A permission is `<resource>:<action>` | `test-crud:update` | `function-guards` |

**Component roles** (`COMPONENT_ROLES`): screens `page`, `layout`, `frame`, `shell`, `pending`; regions `section`, `header`, `footer`, `sidebar`, `rail`, `nav`, `tabs`, `bar`, `banner`, `panel`, `hero`; collections `list`, `table`, `grid`, `board`, `gallery`, `calendar`, `timeline`, `chart`, `thread`; items `detail`, `card`, `row`, `cell`, `tile`, `badge`, `avatar`, `icon`, `image`, `mark`; controls `form`, `field`, `editor`, `picker`, `input`, `switch`, `button`, `link`, `menu`, `palette`, `composer`; overlays `dialog`, `sheet`, `overlay`.

### Server function verbs

One word per meaning (`function-verb`):

| Verb | Means |
| --- | --- |
| `list` | many rows under the list or cursor contract |
| `get` | one row, or one computed read |
| `search` | free text across kinds |
| `create`, `update`, `delete` | a row made from a form, its fields changed (versioned), rows gone (ids, bulk) |
| `set<Field>` | one field or switch: `setTestCrudStatus` |
| `add`, `remove` | a link between two rows that exist (a member, a tag) |
| `trash`, `restore`, `purge` | soft delete, its undo, and the final delete |
| `reorder`, `is<Check>`, `import`, `export` | as named |
| a domain verb | when none of the above says it (`join`, `invite`, `accept`, `submit`); the list is `DOMAIN_VERBS` |

`save`, `find`, `fetch`, `patch`, `toggle`, `mark` and the other words in `FOLDED_VERBS` are said by a verb above.

### One way for each thing

| Need | The one way | Test |
| --- | --- | --- |
| Data on a page | the loader awaits `ensureQuery`, the component calls `useSuspenseQuery`. `useQuery` only with `enabled` (asked for after an interaction) or a reason | `read-path` |
| A list | the list contract (`listSchema`, `listLoader`, `useListPage`, `CrudListPage`) | |
| A write | `useCrudMutation` over the feature's collection; a form uses `useCrudForm`. Never a raw `useMutation` | `write-path` |
| A server function | a literal `createServerFn(…)` chain: `.middleware([require…, with…])`, `.validator(zodInput(schema))` when it takes data, a handler that is one call into a service | `function-literal`, `function-guards`, `function-validator`, `function-handler` |
| A route | its search, loader, head and a component that renders one feature component; `queries.ts` imported inside the loader | `route-thin`, `route-import` |
| A refusal | an `AppError` (`new AppError`, `ruleError`, `notFound`), never a bare `Error` | `bare-error` |
| A shortcut | the hotkeys hook (`useHotkeys`; TanStack Hotkeys from Task 102) | `key-handler` |
| Debounce, throttle, queue, batch | the shared helpers (TanStack Pacer from Task 102) | `timer` |
| A log line | `log()`, never `console.*` on the server | Biome `noConsole` |
| Dates, numbers, money | `src/lib/i18n` | Biome plugin |
| Shared code | `src/lib`, `src/hooks` and `src/components` import no feature, function, route or server code; every export there says what it is for in a comment | `import-boundary`, `documented-export` |

**Where the one way does not apply, the code says why,** in a comment right above the line, and the rule accepts it:

```tsx
// useQuery: live scores over the server-rendered first paint
const live = useQuery(scoresQueryOptions(id));
// timer: the toast leaves after four seconds, which is no debounce
const timer = setTimeout(close, 4000);
<input
	// keys: Enter adds the tag, the field's own key
	onKeyDown={addTag}
/>
```

The `/dev` examples are one file each on purpose (the page names that file as its source), so `route-thin` and `route-import` leave them out, and the root route renders the document.

### How it is enforced

- **`tests/unit/standard/standard.test.ts`** runs every rule (`scripts/standard/rules/`) on the tree, in two seconds, against `tests/unit/standard/known-deviations.json`: what the code did not follow when the rules were written (Task 98's counts). **A new deviation fails. A listed one that is gone fails too,** so the list only gets shorter; Task 127 deletes it when it is empty.
- **`pnpm standard`** is the same check from the command line. `pnpm standard <file>` checks one file, `--list <rule>` prints a rule's deviations with their lines, `--summary` counts them, `--prune` takes fixed ones off the list. `--rewrite` writes the list from the tree: only after files moved (the keys are paths), or with a decision that accepts a deviation.
- **Fixing one:** change the code, run `pnpm standard --prune`, commit both. Nothing is added to the list without a decision.
- **The rules have tests** (`rules.test.ts`): a tree in memory with one of each deviation and a feature in the standard's shape. **The generator is checked the same way** (`generator.test.ts`): what `pnpm new:feature` writes has no deviation.
- **Biome** shows what a linter sees better, on the line, in the editor: the import boundaries that hold today (`noRestrictedImports` per folder), `console.*` in server code, and two GritQL plugins in `scripts/standard/lint/` (`ensureQueryData`, own date and number formatting). A rule moves from the ratchet to Biome when its list is empty.
- **AI sessions:** `CLAUDE.md` has the MUST and NEVER lines, `.claude/rules/` the rules of each area (loaded when a session touches a matching file), `.claude/skills/` the recipes, and a hook (`.claude/settings.json`) runs Biome and `pnpm standard` on each file a session edits. `AGENTS.md` points other tools at the same files.
- **Adding a word** (a role, a domain verb, a guard, a shared message word): `scripts/standard/vocabulary.ts`, with a line in a decision.

## Building a list page

Admin lists follow the CRUD standard: [crud.md](crud.md) has the whole recipe (URL contract, loader, `CrudListPage`, filters, writes, forms) and `pnpm new:feature` generates it. On the server, a list is `listPage(db, table, { input, where, sort, map })` with `where` built from `src/server/db/list.ts`:

```ts
const SORT_COLUMNS = { title: projects.title, updated: projects.updatedAt };
export const listProjects = (db: Db, input: ProjectListInput): Promise<ProjectPage> =>
	listPage(db, projects, {
		input,
		where: allOf(input.status === "all" ? undefined : eq(projects.status, input.status), textSearch(input.q, [projects.title])),
		sort: { columns: SORT_COLUMNS, fallback: "updated" },
		map: (rows) => rows.map((row) => projectListItemSchema.parse(row)),
	});
```

Filters, the loader (`loadList` + `useListQuery`) and record dialogs (route masking) are covered step by step in [search-filters-masking.md](search-filters-masking.md).

Public lists use `<Page width="wide">`, `<Breadcrumbs jsonLd />` above `<PageHeader size="display">`, a card grid, `<EmptyState>` and `<Pagination layout="center" hideWhenSingle />`. Pending states use `PageHeaderSkeleton` with `ListSkeleton` or `DataTableSkeleton`, matching the page's footprint.

## Breadcrumbs

Declare them on routes, never in pages:

```ts
// routes/_admin/admin/projects/route.tsx: a section layout (no component; renders its child)
export const Route = createFileRoute("/_admin/admin/projects")({
	staticData: { breadcrumb: staticCrumb(m.projects_title) },
});
// a detail route: the loader returns { title }, and the crumb reads it
staticData: { breadcrumb: loaderTitleCrumb },
loader: async (…) => { const item = await ensureQuery(queryClient, …); return { title: item.title }; },
```

In the admin area the topbar renders the trail (`components/admin-shell/topbar.tsx`). Elsewhere a page renders `<Breadcrumbs />` above its `<PageHeader>` (`jsonLd` on indexable public pages). `PageHeader` itself has no breadcrumbs (Task 36).

## Rules

- **Everything renders on the server.** Loaders `await ensureQuery(queryClient, …)` (`src/lib/query.ts`) and components read the data with `useSuspenseQuery`. Never fetch first-paint data in an effect.
- **Lists keep their results while a new search loads:** `loadList` in the loader, `useListQuery` in the page (never a pending screen for a filter change).
- **The URL is the state** for search, filters, sort and page. Change it with `<SearchLink patch>`, `<Link search>` or `navigate({ search })`, never with local state. Defaults are stripped with `stripSearchParams`.
- **Read messages at render time.** Never put `m.foo()` (or JSX containing it) in a module-level constant. On the server it would freeze the first request's locale. Use a component or a function, or pass the message function itself (`header: m.foo`).
- **Return little from loaders.** Data already travels in the Query cache; return only what `head` or `staticData` need.
- **Server functions are thin.** `requirePermission(…)` then `withServices`, `.validator(zodInput(schema))`, one call into the service with `context` (crud.md; the chain, the verbs and the guards' words are in "The standard"). Logic goes in `src/server/<name>/` over the call's services, so it can be tested on PGlite.
- **Edits carry their version.** An update sends the record's `updatedAt` (`versionSchema()`), the repository saves with `updateVersioned` (the check is in the UPDATE's WHERE; a stale save is a CONFLICT), and `useCrudForm` shows `StaleVersionAlert` ([forms.md](forms.md), 0122). Whole-record edits only: single-field toggles and deletes don't need it.
- **Import Zod as `zod`.** It resolves to `src/lib/zod.ts` (jitless, CSP-safe). Never import `zod/v4` directly in app code.
- **Every string goes through Paraglide** in en and ne. Delete keys when their UI goes away; `tests/unit/i18n-message-usage.test.ts` enforces it.
- **No layout shift:** fixed image aspect boxes, skeletons with the page's footprint, and preferences read from cookies on the server.
- **Every page has one `<main>` that is the skip link's target.** Use `Page` (it spreads `MAIN_CONTENT`), or spread `MAIN_CONTENT` from `components/layout/skip-link.tsx` on a hand-written `<main>`. The browser review fails a page whose first tab stop isn't a skip link to a `<main>` (0137).
- **Motion respects the user.** `app.css` finishes every animation and transition at once under `prefers-reduced-motion: reduce`; don't add motion that only works with `!important` of its own (0137).
- **Let the React Compiler memoize** (0136). Don't add `useMemo`/`useCallback`/`memo` for performance; keep `useMemo` only where identity is the point (creating a collection, a resource). A component the compiler skips (see the decision for how to list them) is still correct, just not memoized.

## Live examples

Run `pnpm dev` and open `/dev/examples` (or `/ne/dev/examples`): one small, real page per module, each naming its source and guide. They answer 404 in production builds. The patterns from this guide:

| Pattern | Page | Source |
| --- | --- | --- |
| Loader + Query (SSR, no refetch while hydrating) | `/dev/examples/loader-query` | `src/routes/dev/examples/loader-query.tsx` |
| Streaming a slow part with `Await` | `/dev/examples/streaming` | `src/routes/dev/examples/streaming.tsx` |
| Forms: client validation; server field errors | `/dev/examples/forms` | `src/routes/dev/examples/forms.tsx` |
| DataTable with columns, sorting, bulk and row actions | `/dev/examples/data-table` | `src/routes/dev/examples/data-table.tsx` |
| TanStack DB optimistic update and rollback | `/dev/examples/optimistic` | `src/routes/dev/examples/optimistic.tsx` |
| Store preferences (cookies, SSR) | `/dev/examples/preferences` | `src/routes/dev/examples/preferences.tsx` |
| i18n messages and Intl formatting | `/dev/examples/i18n` | `src/routes/dev/examples/i18n.tsx` |
| Errors, not found and HTTP status | `/dev/examples/errors` | `src/routes/dev/examples/errors.tsx` |

The others are linked from their guides: filters and masking ([search-filters-masking.md](search-filters-masking.md)), permissions ([rbac.md](rbac.md)), attachments ([attachments.md](attachments.md)), SEO ([seo.md](seo.md)), analytics and flags ([observability.md](observability.md)). Tables and filters in depth: [tables-filters.md](tables-filters.md); forms: [forms.md](forms.md); state: [state.md](state.md); i18n: [i18n.md](i18n.md).

## Generating a feature

`pnpm new:feature <name> [--public] [--localized]` (decision 0175) writes a feature in the CRUD standard's shape ([crud.md](crud.md)) from `scripts/templates/feature/` and adds the entries shared lists need at their `// @new-feature:<slot>` lines. It refuses a tree with uncommitted changes and puts it back if anything fails. Change the templates when a convention changes, so new features follow it. Full checklist: [new-project.md](new-project.md).

## Import boundaries

The standard's `import-boundary` rule holds the whole list (`FORBIDDEN_IMPORTS` in `scripts/standard/vocabulary.ts`): shared code (`src/lib`, `src/hooks`, `src/components`) imports no feature, function, route or server code; the server imports no component, hook, route or function; nothing imports a route. Type-only imports don't count. Biome fails `pnpm check`, on the line, for the boundaries that hold today (0297) and for imports that would break at runtime (0158):

- `zod/v4` or `zod/mini` anywhere: import `"zod"`, which resolves to `src/lib/zod.ts` (0086).
- `@/server/**` or `@/lib/start/**` from `src/components/**`, `src/features/**/components/**` or `src/hooks/**`: components run in the browser and in Storybook. Call a server function, or move the Start-runtime code into a route.

When moving files, update imports with your editor's "move file" refactor (TypeScript follows the `@/` alias), keep `src/lib/zod.ts` where it is (the Zod alias in `vite/zod-alias.ts` points at it) and update `knip.json` entries that name a moved file and path mentions in the docs.

## The command palette and view transitions

The admin shell's palette (`components/admin-shell/command-menu.tsx`, decision 0165, which replaced the 0140 recipe) opens with Ctrl/⌘ K or the topbar's search button:

- **Permission-filtered:** it lists the sections (`permittedSections`) and the feature actions (`permittedCommands`) the user may open, like the sidebar. It only hides; routes and server functions check on their own.
- **A feature's actions** go in `features/<name>/commands.ts` (an `AdminCommand[]`: label, icon, permission, target, keywords), listed in `ADMIN_COMMANDS` (`features/admin/commands.ts`). They show in the palette and in the dashboard's quick actions. A section's `keywords` widen what the palette matches.
- **Recent pages** are kept in `localStorage` (a per-browser convenience; every access is in try/catch).
- **View transitions:** the palette navigates with `viewTransition: true`; `navigate({ to, viewTransition: true })` (or `<Link viewTransition>`) cross-fades the old and new page where the browser supports it. For every navigation, set `defaultViewTransition: true` in `src/router.tsx`. Name elements with `view-transition-name` to animate them between pages (the portfolio does, 0109). Reduced motion removes the animation (`app.css`).

**Adding an example:** a route under `src/routes/dev/examples/` built with `ExamplePage` and `Demo`, an entry in `features/dev/examples/lib/registry.ts` (a test checks the two match), `privateHead()` and a breadcrumb, server functions with `requireDev`, and a link from the guide.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **shadcn's `from "cn"` import:** the CLI writes it; fix it to `@/lib/utils`. Never install the `cn` package (an unrelated library) to silence typecheck (0118).
- **One header per section:** the root renders no header; each layout renders its own frame (`AdminShell`, `AuthShell`, `AppHeader`, `<SiteHeader links={…} />` for `/dev`, or the portfolio's), so a new layout must too (0161, which replaced 0105's `chrome: "bare"` opt-out; 0164). Don't hide headers with CSS or path checks. A section that never reads the session sets `staticData: { session: "skip" }` (`src/lib/session-scope.ts`); root-mounted session readers pass `enabled: !useSessionSkipped()`.
