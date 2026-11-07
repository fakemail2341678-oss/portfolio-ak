# Portfolio

A bilingual (English + Nepali), server-rendered portfolio app built on TanStack Start.

Public pages render fully on the server (and without JavaScript), every string, email, validation message, meta tag and formatted value exists in both languages, and an admin area manages content. **Test CRUD** is the reference feature to copy for new ones.

The plan, phases and Definition of Done are in [docs/PLAN.md](docs/PLAN.md). Every non-obvious choice is recorded in [docs/decisions.md](docs/decisions.md). Start with [CLAUDE.md](CLAUDE.md) (stack, commands, golden rules, solved pitfalls), then the [guides](#guides). With `pnpm dev`, `/dev/examples` has one working page per module.

## Requirements

- Node.js 22 or newer (`.nvmrc` pins 24, the version CI uses)
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- On Windows, clone to a short path of about 90 characters or fewer, such as `C:\dev\portfolio`. pnpm's nested `node_modules/.pnpm` paths add about 170 characters. Past about 260 in total, Node misreads ES modules, and tests and builds fail with `ERR_REQUIRE_CYCLE_MODULE`.

## Getting started

```bash
pnpm install
cp .env.example .env    # then fill in real values (see "Environment variables")
pnpm db:migrate         # create the tables in your Neon database
pnpm db:seed-admin --email you@example.com --password "at-least-12-chars" --name "You"
pnpm db:seed-demo --password "at-least-12-chars"   # optional: demo roles, users and items
pnpm dev                # http://localhost:3000
```

Sign in at `/login` with the admin account, then open `/admin/test-crud`.

`pnpm dev` and `pnpm start` validate the whole environment before serving. `pnpm build` validates only the public `VITE_` variables, because those are baked into the bundle. Each command stops with a message naming every missing or invalid variable. See [.env.example](.env.example) for the full list. Set `VITE_SITE_URL` to the public origin (for example `https://example.com`) in every deployed environment: canonical, hreflang and Open Graph URLs are built from it. Visit `/health` to confirm the database connection; uptime monitors use `GET /api/health` (503 when the database is down).

## Environment variables

Everything is validated at startup with T3 Env (`src/server/env.ts` and `src/lib/env/client.schema.ts`). Only `VITE_` variables reach the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_APP_TITLE` | yes | Site name in the header and `<title>`. |
| `VITE_SITE_URL` | yes | Public origin, e.g. `https://example.com`, used for canonical, hreflang and Open Graph URLs. |
| `DATABASE_URL` | yes | Neon **pooled** connection string. |
| `DATABASE_URL_UNPOOLED` | no | Neon direct connection, used for migrations. Falls back to `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters (`openssl rand -base64 32`). Signs sessions. |
| `BETTER_AUTH_URL` | yes | The app's public URL, used for auth callbacks and links in emails. |
| `EMAIL_FROM` | yes | Sender, e.g. `Portfolio <hello@example.com>`. |
| `EMAIL_PROVIDER` | prod | `console` (dev) or `resend`. Production refuses to start with `console`. |
| `RESEND_API_KEY` | with Resend | Resend API key (`re_…`). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Enable "Continue with Google" (both or neither). |
| `AUTH_REQUIRE_ADMIN_2FA` | no | `true` requires two-factor for everyone with an admin permission before they can use `/admin` (default `false`). |
| `AUTH_BREACHED_PASSWORD_CHECK` | no | `false` turns off the Have I Been Pwned check on new passwords (default `true`). |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | no | Cloudflare Turnstile on register, forgot-password and sign-in-code (both or neither). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | no | Defaults for `pnpm db:seed-admin`. |
| `DEMO_PASSWORD` | no | Default password for `pnpm db:seed-demo`'s users. |
| `VITE_SENTRY_DSN` | no | Turns Sentry on (browser + server). |
| `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | no | Turn PostHog on (opt-in, behind the consent banner). |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | no | Upload source maps to Sentry during `pnpm build` (all three or none). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | Image uploads (all three or none; server-only). Without them items have no images. See [docs/guides/attachments.md](docs/guides/attachments.md). |
| `CLOUDINARY_FOLDER` | no | public_id prefix for uploads (default `portfolio`). |
| `TMDB_READ_TOKEN` | no | TMDB's API read token: Parda's catalogue. Non-commercial use only. <!-- @parda --> |
| `PARDA_PLAYER_BASE` | no | Where Parda's relative source templates live, path included, when this app doesn't serve the player. <!-- @parda --> |
| `PARDA_PROBE_SECRET` | no | Bearer token for Parda's daily source probe (`/api/parda/probe`, `.github/workflows/parda-probe.yml`); unset, the route answers 404. <!-- @parda --> |
| `PARDA_REALTIME_KEY` | no | Ably API key for Parda's watch parties; unset, the party's UI is hidden. <!-- @parda --> |
| `CRON_SECRET` | no | Bearer token for `/api/cron/*` (Vercel Cron, `vercel.json`); unset, the routes answer 404. |

## Architecture

```
src/
  routes/        file routes: _site (the portfolio at /), dev (demo and references, dev builds only), _public, _auth (sign-in), _authed (account), _admin
  features/      feature code shared by client and server: schemas, queries, collections, components
  functions/     server functions: permission middleware + Zod validator + one call into src/server
  server/        SERVER-ONLY: env, db (Drizzle), auth, email, rbac, attachments, seo, repositories/services, Nitro routes
  middleware/    security headers + CSP nonce, CSRF, logging, error normalisation, auth/permissions, dev-only
  components/    shared UI: page, data-table, filters, navigation, dialogs, forms, layout, errors, ui (shadcn)
  lib/           isomorphic helpers: list contract, search params, seo, breadcrumbs, intl, validation, errors, stores
```

A request goes through the server entry (Sentry, locale), request middleware (headers, CSP nonce, CSRF), route guards, a loader that calls a server function (permission, validation, then a repository over Drizzle), and streams back as HTML that hydrates without refetching. The full walk-through is in [docs/guides/architecture.md](docs/guides/architecture.md).

## Guides

| Guide | Covers |
| --- | --- |
| [Architecture](docs/guides/architecture.md) | Layers and a request end to end |
| [CRUD](docs/guides/crud.md) | The one way to build a feature: its files, list page, writes, forms, server helpers, the generator |
| [Conventions](docs/guides/conventions.md) | File map, building blocks, list-page recipe, live examples |
| [Routing, data, server functions](docs/guides/routing-data.md) | Loaders, SSR without refetching, streaming, server functions, errors |
| [Search params, filters, masking](docs/guides/search-filters-masking.md) | The URL list contract, filters, route masking, path params |
| [Tables and filters](docs/guides/tables-filters.md) | DataTable, FilterBar, chips, Pagination, bulk actions |
| [Forms](docs/guides/forms.md) | useAppForm, fields, validation, server field errors, rich text |
| [State](docs/guides/state.md) | Query (reads and mutations), DB (client-first apps), Store (preferences), URL |
| [RBAC](docs/guides/rbac.md) | Roles, permissions, guards, the permission matrix |
| [Attachments](docs/guides/attachments.md) | Cloudinary uploads and images |
| [SEO](docs/guides/seo.md) | Head tags, JSON-LD, sitemap, robots, manifest, icons |
| [i18n](docs/guides/i18n.md) | Messages, locale URLs, formatting |
| [Testing](docs/guides/testing.md) | Vitest, PGlite, Storybook, Playwright e2e and browser review |
| [Observability](docs/guides/observability.md) | Logs, Sentry, PostHog, feature flags |
| [Security](docs/guides/security.md) | Headers, CSP, CSRF, authorization, sanitizing |
| [Deployment](docs/guides/deployment.md) | Vercel + Neon, migrations, cron |

## Security

Security headers on every response, a nonce-based CSP on pages, CSRF checks on server functions, permission checks and input validation in every server function, server-side sanitizing of rich text, and verified image uploads. See [docs/guides/security.md](docs/guides/security.md).

## Deployment (Vercel)

Create a Neon database, set the variables above in Vercel (including `VITE_SITE_URL`, `EMAIL_PROVIDER=resend` and `RESEND_API_KEY`), run `pnpm db:migrate` and `pnpm db:seed-admin` against it, and deploy. Steps, cron and release checks: [docs/guides/deployment.md](docs/guides/deployment.md).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with SSR. |
| `pnpm dev:offline` | The dev server with no outside services: in-memory PGlite (migrated and seeded), console email, Sentry/PostHog/Cloudinary/Turnstile/Google off ([recipes](docs/guides/recipes.md#offline-development)). |
| `pnpm build` | Production build (client, SSR and Nitro server output in `.output/`). |
| `pnpm start` | Run the production build with Node, loading `.env` if present. |
| `pnpm typecheck` | TypeScript in strict mode, no emit. |
| `pnpm check` | Biome lint + format check. Warnings fail the run. |
| `pnpm check:fix` | Apply Biome fixes and formatting. |
| `pnpm knip` | Report unused files, exports, types and dependencies (`knip.json`). |
| `pnpm test` | Run the unit, component and server tests once (Vitest project `unit`). |
| `pnpm test:watch` | Run the unit project in watch mode. |
| `pnpm test:coverage` | Unit run with v8 coverage (`coverage/`, HTML included), then a per-area table. |
| `pnpm test:storybook` | Render every story in headless Chrome, twice (English/light, then Nepali/dark), run play functions and fail on any a11y violation. Uses the installed Chrome. |
| `pnpm test:e2e` | Build and start a production server (in-memory PGlite, emails captured by a fake Resend API), then run the flows (sign-up, sign-in code, password reset, Test CRUD, permissions, no-JS lists) and the browser review of every page in en/ne × light/dark × 390/768/1280. Uses the installed Chrome. |
| `pnpm db:generate` | Generate a SQL migration in `drizzle/` from schema changes. |
| `pnpm db:migrate` | Apply pending migrations (uses `DATABASE_URL_UNPOOLED` if set). |
| `pnpm db:check` | Check the migrations in `drizzle/` for consistency. |
| `pnpm db:studio` | Open Drizzle Studio. |
| `pnpm db:seed-admin` | Create the first admin user (flags or `ADMIN_*` env vars). |
| `pnpm db:seed-taskline` | Taskline's demo team: five accounts, every admin as a member, three projects and 60 tasks (`pnpm dev:local` runs it on a fresh database). Safe to rerun. <!-- @taskline --> |
| `pnpm db:seed-demo` | Development data: editor and viewer roles, three users holding them (one with no role), 30 Test CRUD items. Safe to rerun. |
| `pnpm new:feature <name> [--public] [--localized]` | Generate a feature in the CRUD standard (table, migration, permissions, functions, routes, messages, tests, stories; public pages, text in both languages); see [docs/guides/crud.md](docs/guides/crud.md). Needs a committed tree. |
| `pnpm strip-demo` | Remove the portfolio (and later the apps) for a neutral landing page; `--keep-portfolio`, `--keep-apps`, `--keep-taskline`; it deletes itself once nothing is left. <!-- @portfolio --> |
| `pnpm storybook` | Storybook dev server on http://localhost:6006. |
| `pnpm build-storybook` | Static Storybook in `storybook-static/`. |

## CI and git hooks

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, check, knip, a schema-vs-migrations check, test, test:storybook, test:e2e (3 shards, on Postgres), build and build-storybook on every pull request and push to `main`. `pnpm install` installs git hooks (`lefthook.yml`): Biome on staged files before a commit, typecheck and unused-dependency checks before a push. Dependabot opens grouped update PRs weekly. Version pinning rules: decision 0119.

## Testing

`pnpm test` runs unit, server (real SQL on PGlite) and jsdom component tests; `pnpm test:storybook` renders every story in Chrome twice (en/light, ne/dark) and fails on any accessibility violation; `pnpm test:e2e` runs the flows and the browser review against a production build; `pnpm test:coverage` prints coverage by area. What lives where and the patterns to copy: [docs/guides/testing.md](docs/guides/testing.md).

## Storybook

Stories sit next to their components (`*.stories.tsx`) and run in the app's providers with mocked server functions (`.storybook/`). The toolbar switches language and theme. `pnpm storybook` opens it; see [docs/guides/testing.md](docs/guides/testing.md#storybook).

## Internationalisation (English + Nepali)

English lives at `/`, Nepali under `/ne/`; every string is a message in `messages/en.json` and `messages/ne.json` (tests check parity and unused keys), and values are formatted with `src/lib/i18n/intl.ts`. See [docs/guides/i18n.md](docs/guides/i18n.md).

## Routing, data and server functions

Loaders call `ensureQuery(queryClient, …)` and components read with `useSuspenseQuery`, so pages render on the server and hydrate without refetching. Server functions are `createServerFn().middleware([requirePermission("…")]).validator(zodInput(schema)).handler(…)`. See [docs/guides/routing-data.md](docs/guides/routing-data.md).

## Forms

Build forms with `useAppForm` and the field library (`src/components/forms`), validated by one Zod schema from `src/lib/validation.ts` on both sides. Try every field at `/dev/forms` (`pnpm dev`). See [docs/guides/forms.md](docs/guides/forms.md).

## State: Query, DB and Store

Query for server data you read and its mutations for what you change (optimistic, rolled back on refusal), TanStack DB collections for client-first apps, the Store (cookies) for UI preferences, the URL for view state. See [docs/guides/state.md](docs/guides/state.md).

## Building a feature (the CRUD standard)

Every admin section is built one way: [docs/guides/crud.md](docs/guides/crud.md) is the only "add a feature" text, and `pnpm new:feature projects [--public] [--localized]` generates it, passing every gate as generated (an admin section with search, sort, pagination, create, edit with the version check, delete, an audit row for each change; `--public` adds public list and detail pages, `--localized` text in both languages). Starting a whole new project (strip the demo first): [docs/guides/new-project.md](docs/guides/new-project.md).

`/admin/test-crud` (admin) and `/dev/test-crud` (public, a dev reference) make up the reference feature. The Test CRUD files for each layer:

| Layer | File | What it shows |
| --- | --- | --- |
| Table | `src/server/db/schema/test-crud.ts` | Drizzle table. Then run `pnpm db:generate` and `pnpm db:migrate`. |
| URL contract and schemas | `src/features/test-crud/search.ts`, `schema.ts` | `listSchema` (search params, the list's input, defaults), one strict Zod schema for the form and the server, DTO schemas |
| Data access | `src/server/test-crud/repository.ts`, `service.ts` | `listPage`, `updateVersioned`, `uniqueViolation`, audited changes (`withAudit`), tested on PGlite (`tests/server/test-crud-*.test.ts`) |
| Server functions | `src/functions/test-crud.ts` | `requirePermission("test-crud:<action>")` then `withServices` on every function, `.validator(zodInput(schema))`, one service call; images as attachment ids |
| Keys and queries | `src/features/test-crud/keys.ts`, `queries.ts` | Loader `ensureQuery` for SSR; `mutationOptions` run by `useCrudMutation` (publish and delete show at once on every cached page and roll back) and `useCrudForm` |
| UI | `src/routes/_admin/admin/test-crud/*`, `src/features/test-crud/components/*`, `columns.tsx`, `filters.tsx` | `CrudListPage` with Test CRUD's columns, filters (status, tags, price, dates, image) and chip specs, URL sorting and paging, bulk delete, a "Quick edit" dialog via route masking (`QueryDialog`), a form split with `withForm`, toasts and the unsaved-changes guard |
| Public pages (a dev reference) | `src/routes/dev/test-crud/*`, `src/functions/test-crud-public.ts` | SSR card grid and detail page that work without JavaScript, a masked "Quick view" dialog, published items only, localized 404 for drafts and invalid slugs. They live under `/dev` (dev builds only), so their heads are private; a real public page uses `seo()`/`listSeo()` instead |

Images are Cloudinary attachments: uploaded straight from the browser with a server signature, verified, and linked when the item is saved ([docs/guides/attachments.md](docs/guides/attachments.md), decision 0098).

For a public page's head, use `seo({ title, description, path, image, jsonLd })` from `src/lib/seo.ts` (lists: `listSeo()`). It returns the title, description, robots, canonical URL, `hreflang` alternates for every locale plus `x-default`, Open Graph and Twitter tags, and JSON-LD. Private pages use `privateHead()`. The sitemap, robots.txt and the web manifest are server routes. See [docs/guides/seo.md](docs/guides/seo.md).

## Observability: Sentry and PostHog

Both optional and off without their variables. Every response carries an `x-request-id`, also in the log lines, the Sentry event and the error page; Sentry reports unexpected errors; PostHog is opt-in behind a consent banner; feature flags are evaluated on the server. See [docs/guides/observability.md](docs/guides/observability.md).

## Authentication

Better Auth (`src/server/auth/auth.ts`) provides:
- email and password sign-up with required email verification;
- email-code (OTP) sign-in;
- password reset;
- email change, with a security notice to the old address;
- password change and session management;
- two-factor authentication (authenticator app + backup codes), optionally required for admins;
- breached-password checks, an optional Turnstile captcha and a honeypot on the auth forms;
- account deletion confirmed by email, a JSON export of your data, and linking or unlinking Google;
- optional Google sign-in, which appears only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set;
- an `admin` flag for the first administrator; everything else is roles and permissions edited in the admin area ([docs/guides/rbac.md](docs/guides/rbac.md)).

```bash
pnpm db:migrate                       # creates the auth tables
pnpm db:seed-admin --email you@example.com --password "at-least-12-chars" --name "You"
```

- **Seeding an admin:** `db:seed-admin` also reads `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` from `.env`. Add `--force` if other users already exist.
- **Protecting data:** Use `.middleware([requireUserMiddleware])` or `.middleware([requirePermission("…")])` on server functions. The `_authed` and `_admin` layouts guard navigation (`_admin` asks the server when entering the area; any permission opens it), and each admin section route checks its own permission with `assertRoutePermission`.
- **Rate limits:** They are stored in the database and keyed by a trusted client IP (`src/server/auth/client-ip.ts`). Behind a reverse proxy other than Vercel, set that proxy's trusted header there.
- **Schema changes:** After changing auth plugins, regenerate the schema with `pnpm auth:schema`, then run `pnpm db:generate` and `pnpm db:migrate`.

## Email

- **Sending:** Call `sendEmail({ to, template, data, locale })` from server code (`src/server/email/send.ts`). Pass the recipient's language, not the current page's.
- **Templates:** They live in `src/server/email/templates/` and are registered in `index.ts` with a subject and sample data.
- **Preview:** In development, open `/dev/emails` to see every template in English and Nepali, as HTML and plain text. The preview only exists on the dev server.
- **Delivery in development:** Emails are printed to the terminal (console provider) unless `RESEND_API_KEY` is set.
- **Production:** Resend is required. A production server refuses to start with the console provider or without `RESEND_API_KEY`. To smoke-test a production build locally, set `RESEND_API_KEY` (and clear `EMAIL_PROVIDER`) for that run.

## Adding shadcn/ui components

```bash
pnpm dlx shadcn@latest add <component>
```

The shadcn CLI (4.21.0) currently writes `import { cn } from "cn"`. Replace it with `import { cn } from "@/lib/utils"` after adding a component. `pnpm typecheck` fails until you do. Never install the `cn` npm package to make it pass: it's an unrelated library (decision 0118).

## License

MIT. See [LICENSE](LICENSE).
#   p o r t f o l i o - a k  
 