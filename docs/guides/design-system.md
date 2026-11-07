# Design system: Graphite

Graphite is the look of everything except the portfolio: the admin area, the sign-in pages, the account page, `/dev` and, later, the apps. It is Linear-style: dense, neutral, one accent colour, keyboard first.

The portfolio at `/` has its own scoped system, "Himal" (`src/styles/himal.css`, [portfolio.md](portfolio.md)). <!-- @portfolio -->

Decisions: 0164 (tokens and presets), 0165 (the command palette), 0166 (the dashboard), 0168–0172 (the component kit).

## Tokens

All in `src/styles/app.css`: custom properties on `:root` (light) and `.dark`, mapped to Tailwind utilities in `@theme inline`.

| Token | Use | Utility |
| --- | --- | --- |
| `--background` | The page | `bg-background` |
| `--surface-1` | Sidebar, muted panels, the sign-in brand panel | `bg-surface-1` |
| `--surface-2` | Cards, popovers, menus (`--card` and `--popover` point here) | `bg-surface-2`, `bg-card` |
| `--foreground`, `--muted-foreground` | Text, secondary text | `text-foreground`, `text-muted-foreground` |
| `--border`, `--input` | Hairlines, control borders | `border`, `border-input` |
| `--accent` | Hover and selected backgrounds (shadcn's name) | `bg-accent` |
| `--primary`, `--primary-foreground` | The brand accent and text on it | `bg-primary`, `text-primary` |
| `--accent-subtle` | A tint of the accent (selected tiles, avatars) | `bg-accent-subtle` |
| `--ring` | Focus rings (the accent) | `ring-ring` |
| `--success`, `--warning`, `--info`, `--danger` | Status: text, icons or a solid fill | `text-success`, `bg-danger` |
| `--<status>-foreground`, `--<status>-subtle` | Text on the solid fill; a tinted background | `bg-success-subtle` |
| `--chart-1…5` | Chart series (chart 1 is the accent) | `fill-chart-1` |
| `--elevation-xs…lg` | Shadows (stronger in dark mode, with a faint top highlight) | `shadow-xs` … `shadow-lg` |

Neutrals are a cool graphite (hue 265, almost no chroma). Dark mode is near-black (`oklch(0.165 …)`, `#0d0e11`), never `#000`. `--danger` is `--destructive`; `--destructive-foreground` is now text *on* destructive (it used to be red text and was unused).

**Type scale** (`@theme`): `text-display` (30 px, page titles on dashboards), `text-title` (22 px, `PageHeader`'s h1), `text-heading` (15 px, section headings), `text-body` (14 px), `text-caption` (12 px). Each sets its line height, and the headings their weight and tracking. The app's `cn` (`src/lib/utils.ts`) knows them, so `cn("text-title", "text-muted-foreground")` keeps both.

**Inter** gets `cv11` (single-storey a) and `ss01` (open digits) on `body`. Tables and anything with `data-figures` (stat cards) use tabular numerals.

## Presets

Three preferences, each an attribute on `<html>`, rendered by the server from a cookie (`preferenceHtmlProps` in `components/layout/theme.tsx`), so there is no flash:

| Preset | Attribute | Values | Sets |
| --- | --- | --- | --- |
| Accent | `data-accent` | `indigo` (default), `violet`, `emerald`, `amber`, `rose` | `--primary`, `--primary-foreground`, `--accent-subtle`, `--chart-2…5` (light and dark) |
| Radius | `data-radius` | `sharp` (4 px), `default` (8 px), `round` (14 px) | `--radius`; `rounded-sm…xl` scale from it |
| Density | `data-density` | `comfortable` (default), `compact` | `--control-height` (36 / 32 px), `--row-padding` (8 / 5 px) |

- **Where they're set:** `/admin/settings/appearance`, per browser, like the theme. The store (`useAppearance()` in `src/lib/stores/hooks.ts`) re-renders `<html>`'s attributes at once, and the cookie makes the next request render them.
- **Controls follow density:** `Button` (default, `sm`, `icon`, `icon-sm`), `Input`, `InputGroup`, `NativeSelect`, `Select` and the filter bar use `h-(--control-height)`; table cells use `py-(--row-padding)`. Use the same variables in a new control.
- **A section's own accent:** a route's `staticData.brand` (`src/lib/section-brand.ts`) puts its accent on `<html>` for every page below it, whatever the visitor picked, and swaps the icons and manifest (Taskline, 0208). On `<html>`, menus and dialogs that portal to `<body>` and the tokens derived from `--primary` follow too.
- **A section's own default theme:** a brand's `defaultScheme: "dark"` makes "system" resolve to dark in that section, on the server, while an explicit Light or Dark still wins; `id` becomes `<html data-section>` for a stylesheet scoped to the whole document, and `themeColors` sets the browser UI's colour (Parda, 0232).
- **Scoped accents:** accent selectors match any element, so `<span data-accent="rose" class="bg-primary">` draws a rose swatch inside an indigo page. Only the tokens a preset sets change in such a scope.

## Contrast is tested

`tests/unit/design-tokens.test.ts` reads `app.css`, applies the rules the way `<html class="dark" data-accent="…">` matches them, resolves `var()`, converts oklch to sRGB and checks every text pair at 4.5:1 in every accent × theme: foreground on every surface, muted text, primary text and fills, sidebar pairs, and each status (foreground on fill, colour on subtle and on surfaces). The browser review sees only the default preset; this test covers the other nine.

## Shells

Each layout renders its own frame (one header per section, 0161):

| Layout | Frame | Where |
| --- | --- | --- |
| `_admin` | `AdminShell`: sidebar, topbar, command palette | `components/admin-shell/` |
| `_auth`, `_public` | `AuthShell`: the page on the left, contour art on the right (one column on phones) | `components/auth-shell/` |
| `_authed` (account; the apps later) | `AppHeader`: brand, admin link when permitted, language, theme, user menu | `components/app-header/` |
| `dev` | `SiteHeader` with the demo's links, and the footer | `components/layout/site-header.tsx` |
| `_taskline` <!-- @taskline --> | A product of its own (0208): `TasklinePublicFrame` and `TasklineAuthFrame` for visitors, `TasklineShell` (built like the admin shell) for the app; its accent, icons and manifest through `staticData.brand` | `features/taskline/shell/` |

**Admin shell:**
- **Sidebar:** shadcn's `Sidebar` (`components/ui/sidebar.tsx`), collapsing to icons on desktop (labels move into tooltips) and a sheet on phones, chosen by CSS, not by JavaScript (see the pitfalls). Its open state is the `sidebar` preference cookie, not shadcn's own cookie, and its container is sticky rather than fixed, so a banner above it (impersonation) pushes it down. `SidebarInset` is a `<div>`: each page renders its own `<main>`.
- **Sections** come from `ADMIN_SECTIONS` (`features/admin/sections.ts`): `group` (`overview`, `portfolio`, `apps`, `access`, `system`), `keywords` for the palette, and `permission` (`null` for personal pages any admin-area user may open, like Appearance). Ctrl/⌘ B toggles the sidebar.
- **Topbar:** the trigger, the breadcrumbs (taken out of `PageHeader`), the palette button with its `Kbd` hint, language, theme, and the user menu on phones (the sidebar's footer has it on desktop).
- **Command palette:** see [conventions.md](conventions.md), "The command palette and view transitions".

**Brand:** `BrandMark` (three contour rings in the accent) and `BrandName` (`components/brand/brand.tsx`). `ContourArt` (`components/brand/contour-art.tsx`) draws a seeded topographic ridge as a server-rendered SVG (`aria-hidden`, same output for a seed everywhere); the portfolio redesign can reuse it.

**Building blocks:** see Components below.

## Loading

- **The navigation line** (`components/layout/navigation-progress.tsx`): a thin line across the top while a client-side navigation loads (loaders, lazy chunks), shown after 150 ms, growing toward the end and filling when the page is ready. Decorative (`aria-hidden`), transform only. Each section's frame mounts it: `AdminShell`, `AuthShell`, `AppHeader`, `SiteHeader`, `AppsLayout` in the accent, the portfolio in ink (0201).
- **The pending page** (`components/errors/pending-page.tsx`, the router's `defaultPendingComponent`, after the router's 1 s pending delay): a spinner and "Loading…" in an `<output>`. A layout says how it fits with `<SectionPending>`: `insideMain` when it renders `<main>` around its outlet (`_auth`), or `component` for its own view (the portfolio's printed range). A list route's own `pendingComponent` (a table skeleton, `CrudListPage`) still wins.
- **Buttons that start something slow** show the `Spinner` in place of their icon with a label that says what's happening ("Starting…", the apps' "Try it now").

## Components

The admin kit (Task 37, decision 0168): everything an admin page needs, so a feature supplies data, columns, fields and actions. Every component has a story (both Storybook passes, axe on), and `/dev/examples/components` and `/dev/examples/fields` show them all on real pages.

**Page** (`components/page/`):

| Component | Use |
| --- | --- |
| `Page`, `PageHeader` | The `<main>` and the page's h1, description, actions; `tabs` takes `PageTabs` |
| `PageTabs` + `PageTab` | Route tabs: links (`createLink`), `aria-current` on the matching route; spread `linkOptions` into `PageTab` (the roles section) |
| `DetailLayout` | A record: main column plus an `aside` (sticky from `lg`) |
| `SettingsLayout` + `SettingsNavLink` | Settings pages: side navigation (a row on phones) and the section (Appearance) |
| `FormSection`, `FormCard`, `StickyFormBar` | Long forms: named sections, cards with a footer, Save/Cancel stuck to the bottom |
| `EmptyState` | `variant="empty"` (nothing yet: `primaryAction` creates the first) or `"no-matches"` (filters hide everything: clear them), plus `secondaryAction` |

**Data display** (`components/data-display/`): `StatCard` (with `trend` for a sparkline), `StatusBadge` and `StatusOf` with a feature's `defineStatuses({ draft: { tone, label } })` map (`TEST_CRUD_STATUS`), `DescriptionList`, `UserAvatar` and `UserCell`, `RelativeTime` (see below), `CopyButton`, `Timeline` and `ActivityFeed` (audit events with avatars; the dashboard), `ScrollRegion` (a hand-written wide table's horizontal scroll as a focusable, named region, as DataTable's own: axe's scrollable-region-focusable fails a scroll with nothing focusable in it), `Rail`, `RailItem` and `RailSkeleton` (a horizontal rail of links with scroll-snap and previous and next buttons for fine pointers; Parda's, decision 0233).

**Charts** (`components/charts/`, decision 0171): `AreaChart`, `BarChart`, `DonutChart` take `label`, `data`, `index` (the category field) and `series` (`{ key, label, color? }`; colours default to `--chart-1…5`). Recharts loads with `React.lazy` in the browser only; the server renders a skeleton in a box of fixed aspect ratio, so nothing shifts, and a visually hidden table with the same numbers for screen readers (the drawing is `aria-hidden`). `Sparkline` is plain SVG, server-rendered.

**Dialogs** (`components/dialogs/`): `useConfirm()` returns `confirm(options) => Promise<boolean>`; the shells mount its `ConfirmProvider` (`AdminShell`, the `/dev` layout; Storybook's providers too), so pages keep no confirm state. `FormDialog` and `FormSheet` hold a form ([forms.md](forms.md)). `QueryDialog` loads one record (a masked `?edit=`/`?view=`): placeholders, then the record or the error.

**CRUD** (`components/crud/`, [crud.md](crud.md)): `CrudListPage` and `CrudListPending` (an admin list assembled), `useCrudMutation` (writes, optimistic on every cached page), `useCrudForm` + `CrudForm` (create and edit forms), `NewButton`, `RecordLink`.

**Table** (`components/data-table/`, decision 0169): `DataTable` on TanStack Table v9 with its toolbar (saved views, CSV export, Columns), `RowAction`s with permissions and a context menu, a sticky header on long pages and a pinned first column on phones ([tables-filters.md](tables-filters.md)).

**Hooks** (`src/hooks/`): `useHotkeys({ "mod+k": … })` (Ctrl or ⌘; plain keys don't fire while typing) with `useHotkeyLabel("mod+k")` for the `Kbd` hint ("Ctrl K" on the server, "⌘ K" on a Mac after hydration, in a fixed-width `Kbd`); `useDebouncedValue`; `useMediaQuery` (the server value first: for things that open on interaction, not for first-paint layout).

**Primitives added in Task 37** (`components/ui/`, story `UI/Primitives`): tabs, scroll-area (`label` makes the viewport a focusable region), hover-card, accordion, collapsible, toggle, toggle-group, chart, progress, alert (`info`, `success`, `warning`, `destructive` in the status tones), spinner, button-group, context-menu. Tabs, toggles and the like use `--control-height`.

**RelativeTime is hydration-safe:** pass `now`, the time the data was read (a loader's `generatedAt`, or the newest row's time). The server and the first browser render both use it; after hydration a shared one-minute clock takes over.

## Theming a new project

1. **Presets first:** change the defaults in `DEFAULT_PREFERENCES` (`src/lib/stores/preferences.ts`) and the matching `:root` values (the default accent, `--radius`, `--control-height`, `--row-padding`). Remove presets you don't offer from `ACCENTS` and their blocks in `app.css`.
2. **A new accent:** add it to `ACCENTS`, add a light block and a `.dark` block like the others (keep dark accents light, with dark text on them), a label message, and run the contrast test.
3. **Your own neutrals:** change `:root` and `.dark`, then run `pnpm exec vitest run tests/unit/design-tokens.test.ts` and update `THEME_COLORS` in `src/routes/__root.tsx` to the new `--background` values (hex).
4. **Fonts:** Inter and Noto Sans Devanagari have metric-matched fallbacks in `app.css`. A new face needs its own fallback ([i18n.md](i18n.md), "Fonts are never inlined").

## Pitfalls already solved

- **shadcn's sidebar writes its own cookie and renders a `<main>`:** our copy doesn't (the preference store persists `sidebar`; pages own `<main>`). Keep that when updating `ui/sidebar.tsx`.
- **No `isMobile` state after hydration:** shadcn's `useIsMobile` sets state in an effect and swaps the sidebar for the sheet. That update made React hydrate the rest of the page at once, and a route rendering its error (the editor's 403 on `/admin/audit` at 390 px) threw again: "recovered" React error #520 in the browser review. Our sidebar renders both forms (CSS shows one), the trigger is two buttons (`md:hidden` opens the sheet, `max-md:hidden` collapses), the keyboard shortcut checks the screen when pressed, and content inside the sheet knows it from a context. Don't bring `use-mobile.ts` back.
- **`CommandDialog`'s hidden title sat outside the dialog** (shadcn renders it before `DialogContent`), so it was page content outside every landmark (axe `region` on every admin page). It is inside the content now.
- **Hard-coded English in shadcn primitives:** `sidebar.tsx`, `sheet.tsx` and `breadcrumb.tsx` use messages for their screen-reader text; a newly added primitive needs the same pass. `BreadcrumbPage` drops shadcn's `role="link" aria-disabled` (a link that can't be focused).
- **An `aria-label` that hides visible text** fails axe's `label-content-name-mismatch`: the user menu's avatar initials are `aria-hidden`, and its name is in an `sr-only` span.
- **shadcn's chart injected a `<style>` per chart** (`ChartStyle`, `dangerouslySetInnerHTML`): our `ui/chart.tsx` sets each series' `--color-<key>` as an inline style on the container instead, and the per-theme `theme` option is gone (`var(--chart-n)` already follows the theme and accent).
- **shadcn's `Progress` dropped its `value`** from the Radix root (only the indicator used it), so the bar had no `aria-valuenow`. Ours passes it on.
- **Recharts makes a pie a tab stop** (`rootTabIndex` 0) inside our `aria-hidden` drawing (axe `aria-hidden-focus`): `DonutChart` sets `rootTabIndex={-1}`; cartesian charts set `accessibilityLayer={false}`.
- **A chart's hidden table widened the page:** `sr-only` text doesn't wrap and a table is never narrower than its content, so a long category name in `ChartFrame`'s screen-reader table made phones scroll sideways. The table sits in an `sr-only` div, which clips it.
- **Radix menus and popovers in the kit are non-modal or named:** a modal `ContextMenu` aria-hides the page while it closes (axe), so table rows use `modal={false}`; a `PopoverContent` is a `dialog` and needs an `aria-label` (saved views, the async combobox).
- **Inactive tab text** was `text-foreground/60` (4.49:1 on `--muted`): tabs use `text-muted-foreground`.
- **A scroll frame is `relative`:** `sr-only` text is absolutely positioned, so inside an `overflow-x-auto` frame that isn't positioned it lays out against an outer ancestor and widens the whole page on phones (the DataTable's frame; shadcn's `table-container` had it). For the same reason the kit doesn't bleed past its container with negative margins (`StickyFormBar` spans its form).
- **Platform-specific text after hydration** (`⌘` vs `Ctrl`) renders the server's value first (`useSyncExternalStore` with a server snapshot) in a fixed-width `Kbd`, so the swap never shifts layout.
- **Confirms are `await useConfirm()(…)`** (0168): the shells mount `ConfirmProvider` (`AdminShell`, the `/dev` layout). A new shell that asks for confirmation mounts one too; there is no `ConfirmDialog` any more.
