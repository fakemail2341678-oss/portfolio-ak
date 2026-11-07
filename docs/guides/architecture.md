# Architecture

How the app is put together and how a request flows through it. The file-by-file map is in [conventions.md](conventions.md); why each choice was made is in [decisions.md](../decisions.md).

## The shape

- **One TanStack Start app**: React 19, file routes, server functions. Nitro builds it for Vercel.
- **Every page renders on the server**, in English (`/…`) or Nepali (`/ne/…`), and hydrates without refetching. Public pages work without JavaScript.
- **The server is the authority:** each server function checks the caller's permission and validates its input with the same Zod schema the form uses.
- **Data:** Postgres (Neon) through Drizzle. Repositories take an injected `Db`, so tests run them on PGlite with the real migrations.
- **Outside services, all optional except the database and email:** Cloudinary (images), Resend (email), Sentry (errors), PostHog (analytics after consent, feature flags).

## Stack

- **App:** TanStack Start 1.168 + Router 1.170 (file routes, server functions), Nitro 3 RC (h3 2.0.8), deployed to Vercel; React 19.3, TypeScript 6 strict.
- **TanStack libraries:** Query 5, DB 0.5, Form 1.33, Store 0.11.
- **UI:** Tailwind 4.3 + shadcn/ui (Radix), lucide icons; TanStack Table 9, Recharts 3 (lazy), dnd-kit (`@dnd-kit/react`).
- **Validation, i18n, env:** Zod 4.6 (aliased, jitless), Paraglide 2.25, T3 Env.
- **Data and auth:** Better Auth 1.7, Drizzle 0.45 + Neon Postgres (PGlite in tests).
- **Services:** Cloudinary (REST, no SDK), React Email 6 + Resend, Sentry 11, PostHog.
- **Tooling:** Vitest 5 + Storybook 10.6, Biome 2.4, Knip 6, lefthook 2, pnpm 10, Node ≥ 22 (`.nvmrc`: 24), Vite 8. CI: GitHub Actions; updates: Dependabot.

## Layers

| Layer | Where | Rule |
| --- | --- | --- |
| Routes | `src/routes/` | Thin: `validateSearch`, guards in `beforeLoad`, a loader, `head`, `staticData.breadcrumb`, and a page made of shared components. |
| Features | `src/features/<name>/` | Code shared by client and server for one feature: Zod schemas, query options, TanStack DB collections, components, labels. |
| Server functions | `src/functions/<name>.ts` | The only door from the browser to the server: middleware (permission) + `validator(zodInput(schema))` + a one-line call into `src/server`. |
| Server | `src/server/` | Server-only: env, database, auth, email, repositories and services, Nitro routes. Import protection and a test keep it out of client bundles. |
| Middleware | `src/middleware/` | Security headers + CSP nonce, CSRF, locale, logging, error normalisation, auth/permissions, dev-only guard. |
| Shared UI | `src/components/` | Generic building blocks with no feature knowledge: page, data table, filters, navigation, dialogs, forms, layout. |
| Helpers | `src/lib/` | Isomorphic: list contract, search params, SEO, breadcrumbs, intl, validation, errors, stores, analytics, Zod. |

## A request, end to end

1. **Server entry** (`src/server.ts`): Sentry starts, Paraglide resolves the locale from the URL (or from a header, for server-function calls), and AppError statuses become HTTP statuses.
2. **Request middleware** (`src/start.ts`): Sentry, security headers with a per-request CSP nonce, CSRF (server functions only).
3. **Router**: `/ne/…` is mapped onto the same routes. The root `beforeLoad` loads the session into the Query cache (unless the section skips it: the portfolio at `/`). Layout guards run next: `_authed` needs a session; `_admin` asks the server on entry; `/dev` is a 404 outside development; section routes run `assertRoutePermission`. Each layout renders its own header.
4. **Loader**: `ensureQuery(queryClient, options)`, or `loadList(...)` for search-driven lists. The query function calls a **server function**.
5. **Server function**: function middleware (locale header, the request's id and logging, error normalisation, then `requirePermission(…)` and `withServices`, which hands the handler the database, the actor and the image store), the Zod validator, then the handler. The handler calls one service, which applies the rules, audits the change and talks to Postgres through its repository (Drizzle).
6. **Response**: the page streams as HTML with the Query cache dehydrated into it, and hydrates without refetching (`staleTime` 60 s). Errors arrive as `AppError` with a code; the page shows a localized message, and SSR responses carry the matching status.

## Where to start for…

| Task | Read |
| --- | --- |
| A new feature (list, form, detail, public page) | [crud.md](crud.md) (`pnpm new:feature`), [conventions.md](conventions.md) |
| Loaders, server functions, errors | [routing-data.md](routing-data.md) |
| Lists: URL params, filters, masking | [search-filters-masking.md](search-filters-masking.md), [tables-filters.md](tables-filters.md) |
| Forms | [forms.md](forms.md) |
| Permissions | [rbac.md](rbac.md) |
| Images | [attachments.md](attachments.md) |
| Head tags, sitemap | [seo.md](seo.md) |
| Text and formatting | [i18n.md](i18n.md) |
| Query vs DB vs Store | [state.md](state.md) |
| Tests | [testing.md](testing.md) |
| Errors, logs, analytics | [observability.md](observability.md) |
| Headers, CSP, CSRF, sanitizing | [security.md](security.md) |
| Shipping | [deployment.md](deployment.md) |

Every module has a working page at `/dev/examples` (`pnpm dev`). The site's sections: the portfolio at `/` (`src/routes/_site`), the demo and references under `/dev` (dev builds only), sign-in, account and admin; see [routing-data.md](routing-data.md).
