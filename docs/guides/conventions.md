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
    data-display/         StatCard, StatusBadge
    layout/               Site header/footer (/dev), theme, language switcher, consent banner, skip link
    errors/               Error, not-found and pending pages
  features/rbac/          Permission catalog + labels, useCan/<Can>/assertRoutePermission, users and roles UI
  features/admin/         Admin sections and groups, commands (the palette's actions), dashboard, appearance page
  features/dev/examples/  The /dev/examples pages' registry, page frame, schema and in-memory data (development only)
  features/<name>/        Everything specific to one feature, shared by client and server (the CRUD standard, crud.md):
    search.ts             The URL contract (listSchema: search, list input, defaults, filter keys). Route files import this
    schema.ts             Strict input schemas, DTO schemas (isoDateTime), form values; never imported by route options (0151)
    keys.ts queries.ts    Query keys (createCrudKeys); queryOptions for reads and mutationOptions for writes
    columns.tsx filters.tsx  DataTable columns; the filter controls and chip specs (defineFilters)
    constants.ts labels.ts commands.ts  Enum values, their localized labels, palette actions
    components/           <name>-list, <name>-form, <name>-detail, <name>-pending, dialogs, cards
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
- `i18n/` for the message checks

## Building a list page

Admin lists follow the CRUD standard: [crud.md](crud.md) has the whole recipe (URL contract, loader, `CrudListPage`, filters, writes, forms) and `pnpm new:feature` generates it. On the server, a list is `listPage(db, table, { input, where, sort, map })` with `where` built from `src/server/db/list.ts`:

```ts
const SORT_COLUMNS = { title: projects.title, updated: projects.updatedAt };
export const listProjects = (db: Db, input: ProjectListInput): Promise<ProjectPage> =>
	listPage(db, projects, {
		input,
		where: allOf(input.status === "all" ? undefined : eq(projects.status, input.status), textSearch(input.q, [projects.title])),
		sort: { columns: SORT_COLUMNS, fallback: "updated" },
		map: (rows) => rows.map((row) => projectListItem.parse(row)),
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
- **Server functions are thin.** `requirePermission(…)` then `withServices`, `.validator(zodInput(schema))`, one call into the service with `context` (crud.md). Logic goes in `src/server/<name>/` over the call's services, so it can be tested on PGlite.
- **Edits carry their version.** An update sends the record's `updatedAt` (`versionSchema()`), the repository saves with `updateVersioned` (the check is in the UPDATE's WHERE; a stale save is a CONFLICT), and `useCrudForm` shows `StaleVersionAlert` ([forms.md](forms.md), 0122). Whole-record edits only: single-field toggles and deletes don't need it.
- **Import Zod as `zod`.** It resolves to `src/lib/zod.ts` (jitless, CSP-safe). Never import `zod/v4` directly in app code.
- **Every string goes through Paraglide** in en and ne. Delete keys when their UI goes away; `tests/i18n/message-usage.test.ts` enforces it.
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

Biome fails `pnpm check` on imports that would break at runtime (0158):

- `zod/v4` or `zod/mini` anywhere: import `"zod"`, which resolves to `src/lib/zod.ts` (0086).
- `@/server/**` or `@/lib/start/**` from `src/components/**`, `src/features/**/components/**` or `src/hooks/**`: components run in the browser and in Storybook. Call a server function, or move the Start-runtime code into a route.

When moving files, update imports with your editor's "move file" refactor (TypeScript follows the `@/` alias), keep `src/lib/zod.ts` where it is (the Zod alias in `vite/zod-alias.ts` points at it) and update `knip.json` entries that name a moved file and path mentions in the docs.

## The command palette and view transitions

The admin shell's palette (`components/admin-shell/command-menu.tsx`, decision 0165, which replaced the 0140 recipe) opens with Ctrl/⌘ K or the topbar's search button:

- **Permission-filtered:** it lists the sections (`permittedSections`) and the feature actions (`permittedCommands`) the user may open, like the sidebar. It only hides; routes and server functions check on their own.
- **A feature's actions** go in `features/<name>/commands.ts` (an `AdminCommand[]`: label, icon, permission, target, keywords), listed in `ADMIN_COMMANDS` (`features/admin/commands.ts`). They show in the palette and in the dashboard's quick actions. A section's `keywords` widen what the palette matches.
- **Recent pages** are kept in `localStorage` (a per-browser convenience; every access is in try/catch).
- **View transitions:** the palette navigates with `viewTransition: true`; `navigate({ to, viewTransition: true })` (or `<Link viewTransition>`) cross-fades the old and new page where the browser supports it. For every navigation, set `defaultViewTransition: true` in `src/router.tsx`. Name elements with `view-transition-name` to animate them between pages (the portfolio does, 0109). Reduced motion removes the animation (`app.css`).

**Adding an example:** a route under `src/routes/dev/examples/` built with `ExamplePage` and `Demo`, an entry in `features/dev/examples/registry.ts` (a test checks the two match), `privateHead()` and a breadcrumb, server functions with `devOnlyMiddleware`, and a link from the guide.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **shadcn's `from "cn"` import:** the CLI writes it; fix it to `@/lib/utils`. Never install the `cn` package (an unrelated library) to silence typecheck (0118).
- **One header per section:** the root renders no header; each layout renders its own frame (`AdminShell`, `AuthShell`, `AppHeader`, `<SiteHeader links={…} />` for `/dev`, or the portfolio's), so a new layout must too (0161, which replaced 0105's `chrome: "bare"` opt-out; 0164). Don't hide headers with CSS or path checks. A section that never reads the session sets `staticData: { session: "skip" }` (`src/lib/session-scope.ts`); root-mounted session readers pass `enabled: !useSessionSkipped()`.
