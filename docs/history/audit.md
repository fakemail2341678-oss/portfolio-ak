# Setup audit (Task 18)

A review of every module against the official docs and the Part 2 rules (reuse first, everything SSR, no warnings, no layout shift, the server is the authority). Each finding has a verdict:

- **Keep:** already the recommended approach.
- **Fixed:** changed in Task 18.
- **Later:** scheduled for a named Part 2 task.

Decision numbers refer to [decisions.md](../decisions.md).

## Summary

| Area | Verdict | Notes |
| --- | --- | --- |
| Routing and loaders | Keep + fixed | Loader → `ensureQueryData` → `useSuspenseQuery` is the official SSR pattern. Detail loaders sent the item twice (fixed). |
| Search params and lists | Fixed | One shared list contract on both sides (0084). |
| Page structure and UI reuse | Fixed | Shared `Page`, `PageHeader`, `Breadcrumbs`, `DataTable`, `Pagination`, `ConfirmDialog`, `EmptyState`, skeletons (0085). |
| Breadcrumbs | Fixed | From route `staticData` on every admin page and every public section and detail page (0083). |
| Filters | Fixed (Task 19) | Shared `FilterBar`, filter controls and chips, used on all 3 list pages. Test CRUD filters by status, tags, price range, published dates and image (0088, 0093). |
| Path params | Fixed (Task 19) | `params.parse` + `parseParams` on the route: invalid params give the localized 404 (0092). |
| Forms | Keep | `useAppForm` and the field library: one Zod schema for the client and server, server field errors, an error summary and an unsaved-changes guard. |
| State: Query / DB / Store | Keep | Query for server state (SSR-dehydrated), TanStack DB for optimistic list edits, Store and cookies for preferences, so the server renders the user's choices. |
| i18n | Keep + fixed | Paraglide URL strategy, so every page exists in both locales. Unused keys are now a test failure (0087). |
| Auth and authorization | Fixed (Task 20) | Permissions resolved per request; `requirePermission` on every protected function (a test maps each one); route guards; Users, Roles and the permission matrix (0094–0097). |
| Server functions | Keep | Thin: middleware + `zodInput` validator + one call into a service or repository. |
| Data access | Keep + fixed | Repositories over an injected `Db`, tested on PGlite. `Db`/`Tx` moved to `src/server/db/types.ts`; list SQL is shared (0084). |
| Images and files | Fixed (Task 21) | Cloudinary attachments: signed direct uploads, server verification, galleries with alt text, responsive delivery, cleanup job (0098–0099). |
| SEO | Fixed (Task 22) | `seo()`/`listSeo()` on every public page, `noindex` on every private one (checked per route), sitemap, robots, manifest, icons, default and per-item OG images, WebSite/Organization/Product JSON-LD (0100–0102). |
| Security | Keep + fixed | Headers and a nonce-based CSP. Zod's eval probe came back after a chunk-order change; it's now fixed structurally (0086). |
| Observability | Keep | Sentry (pinned), PostHog behind consent, server-side flags. |
| Testing | Keep + fixed | Unit, PGlite and jsdom tests, plus stories as tests in 2 passes. Storybook's setup notice and jsdom noise are fixed (0087). New tests cover the list contract, breadcrumbs (pure and with a real router) and the SQL helpers. |
| Env | Keep | T3 Env, validated at startup; only `VITE_` variables reach the client. |
| File structure | Fixed | Documented in [conventions.md](../guides/conventions.md) and [architecture.md](../guides/architecture.md). |

## Findings in detail

### Fixed in Task 18

1. **Pagination existed three times** (admin Test CRUD, public Test CRUD, `/stack`), with different markup, labels and disabled styles. The admin version still used `opacity-50` on disabled steps, the contrast problem fixed on the public page in 0082. It's now one `<Pagination>`: URL-driven, disabled steps are text, it works without JS, and it has an optional rows-per-page picker.
2. **The admin table was feature-specific** (`TestCrudTable`): its sort header, selection, column visibility and row menu were all hard-coded. Now there's a generic `DataTable<Row>`; Test CRUD supplies only column definitions.
3. **The delete confirmation was feature-specific.** It's now a generic `ConfirmDialog` (focus starts on Cancel; destructive styling is optional).
4. **No breadcrumbs anywhere;** a "Back to list" link served as a stand-in. Breadcrumbs now come from routes, with BreadcrumbList JSON-LD on public pages.
5. **Page headers and containers were hand-written per page** (different paddings and heading sizes). Now there are `Page` widths and `PageHeader`.
6. **The admin dashboard was a placeholder** ("arrives with Phase 9"). It's now a section index built from the shared blocks.
7. **List schemas and SQL were written out per feature:** forgiving URL params, page clamping, LIKE escaping and sort maps. They now share one contract on both sides.
8. **Detail loaders returned the whole item.** Its body was serialized twice, once as loader data and once in the Query cache. Loaders now return only what `head` and the breadcrumb need.
9. **CSP eval violation on every page** after the refactor. The cause: Zod 4.6 probes for eval when a `z.object` is *created*, and chunk order decided whether jitless was set in time. Fixed so it no longer depends on import order (0086), with a test.
10. **Module-level message calls are a locale bug.** `const x = <span>{m.foo()}</span>` at module scope freezes the first request's language on the server. One was introduced and caught during the refactor (`NewItemButton` is now a component). Rule added to the conventions.
11. **19 unused message keys** (3 of them predated this task). They were deleted, and a test now prevents more.
12. **Noise on every test run:** Storybook's "setup file … can be removed" notice and jsdom "scrollTo not implemented" messages. Both are removed.
13. **`Db` type lived in the Test CRUD repository** although every repository needs it. It's now in `src/server/db/types.ts`.

### Scheduled

- **Task 19 (done):** filters, search helpers, list loading without pending screens (0089), the admin guard round trip (0090), route masking (0091), param validation (0092).
- **Task 20 (done):** permission catalog, roles and the matrix UI; `requirePermission` everywhere; sidebar, dashboard and actions filtered by permission.
- **Task 21 (done):** Cloudinary attachments with responsive delivery; legacy Postgres images move via `pnpm attachments:import-legacy`.
- **Task 22 (done):** `seo()` on every public route and `noindex` on private ones; sitemap, robots, JSON-LD, Open Graph images, icons and a manifest ([seo.md](../guides/seo.md)).
- **Task 23 (done):** `/dev/examples`, one working page per module, linked from the guides (0103).
- **Task 24 (done):** `CLAUDE.md` completed; guides for architecture, routing and data, tables and filters, forms, state, i18n, testing, observability, security and deployment; README trimmed to an overview that links to them.

## How this was verified

The commands and results are listed in the Task 18 report:
- typecheck, Biome, unit tests and both Storybook passes;
- a production build and server;
- the browser review (axe, overflow, CSP, console warnings and CLS on every page × 2 locales × 2 themes × 3 widths);
- a scripted run of the admin flows on the shared components, with and without JavaScript.
