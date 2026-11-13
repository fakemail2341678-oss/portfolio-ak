# The showcase apps

Small, complete apps under `/apps/<slug>` that visitors try without an account (decisions 0185–0189): Notes and Links (decisions 0190, 0191), Habits (0193) and Forms (0195). Kanban, the first (0188), grew into Taskline and moved there in Part 5 Task 48 ([taskline.md](taskline.md), 0210); `/apps/kanban` redirects to it. Expenses (0192) moved into Kharcha in Part 8 Task 95 ([kharcha.md](kharcha.md), 0289); `/apps/expenses` redirects to it. The whole folder is the `apps` layer of `pnpm strip-demo`; guest sessions stay with the core.

## How a visit goes

1. `/apps` lists the apps; `/apps/notes` is Notes' landing: what it does, **Try it now** and **Sign in**. Both pages are indexable and in the sitemap.
2. **Try it now** calls `authClient.signIn.anonymous()`. Better Auth creates a guest (a user row with `is_anonymous`, the name "Guest", a `…@anonymous.placeholder.invalid` address) and a session; an after hook gives the guest every app's sample rows in the page's language and the signed `guest_claim` cookie (0186). The landing re-renders as the app.
3. A banner on every app page says the guest's data is deleted after 7 days and links to sign-up. Account pages send a guest to `/upgrade`.
4. Signing up (and verifying) or signing in moves the guest's rows to the account: the anonymous plugin's `onLinkAccount` when the browser still holds the guest's session, otherwise `claimGuestData` with the cookie (after a two-factor sign-in, or on the verify-email landing). Both are one transaction, and idempotent.
5. Guests nobody claimed are deleted by `GET /api/cron/guests` (daily), with their rows (foreign keys cascade) and uploads (through the attachments service).

## What a guest can't do (0185)

Nothing in the admin area (no permissions, not even the baseline role's), no account change (Better Auth `GUEST_REFUSED_PATHS`, `requireUserMiddleware`), no email (`sendEmail` refuses `.invalid` addresses), no analytics identity, and nothing public: an app checks `context.user.isGuest` before publishing a short link, a form or a shared note. Guests are left out of `/admin/users`, the role counts and the dashboard.

## The shape of an app

| Piece | Where | Notes |
| --- | --- | --- |
| Client registry entry | `src/features/apps/registry.ts` (`APP_SLUGS`, `APPS`) | name, tagline, description, icon, usage labels |
| Server registry entry | `src/server/apps/registry.ts` (`APP_SERVERS`) | `seedGuestData`, `claim`, `usage` |
| Tables | `src/server/db/schema/apps/<app>.ts`, exported from the schema index with `// @apps` | `note`, with its images as attachments |
| Feature code | `src/features/apps/<app>/` | `types.ts`, `schema.ts`, `search.ts`, `queries.ts`, `collections.ts`, `uploads.ts`, `components/` |
| Repository and service | `src/server/apps/<app>/` | every query takes the owner (`ownedBy`); quotas in the service, counted under `lockQuota` (0199) |
| Server functions | `src/functions/apps/<app>.ts` | `.middleware([requireAppUser, withAppServices])`, then one service call |
| Routes | `src/routes/_apps/apps/<app>/` | `index.tsx` (landing or notes), `$noteId.tsx` (private), `s/$token.tsx` (shared); loaders import `queries.ts` on demand (0194) |
| Admin usage | `usage(db)` on the server entry | accounts and guests with notes, notes, shared notes and images |

**Ownership (0187):** every table has `owner_id text not null references user(id) on delete cascade`. A repository function takes the owner and adds `ownedBy(table, ownerId)` to every query, so someone else's row is simply not found. There is no permission on app functions; the guard test checks that every function in `src/functions/apps/` runs `requireAppUser` then `withAppServices`.

**Not audited:** app rows are their users' own data, not admin actions (0186).

## Adding an app

1. Add the slug to `APP_SLUGS` and an entry to `APPS` (messages in both languages), and an entry to `APP_SERVERS` with its `seedGuestData`, `claim` (one `update … set owner_id = to where owner_id = from` per table, children first) and `usage`.
2. Tables in `src/server/db/schema/apps/<app>.ts` with `owner_id` as above; export them from the schema index with a `// @apps` line; `pnpm db:generate`.
3. Repository and service in `src/server/apps/<app>/`, tested on PGlite: ownership isolation first (user A can't read or change user B's rows), then quotas (a create takes `lockQuota(tx, "<app>:<user id>")` in its transaction before it counts), the seed and the claim.
4. Functions in `src/functions/apps/<app>.ts` and their names in the guard test's `APP_FUNCTIONS`.
5. Routes under `src/routes/_apps/apps/<app>/`: the landing at `index.tsx` with `seo()` (add it to `INDEXABLE` in `tests/unit/route-seo.test.ts`), inner pages private; every route in `e2e/support/pages.ts`. The sitemap and the gallery pick the app up from the registry. A loader imports the app's `queries.ts` with `await import(…)`, never statically (0194).
6. Add the new paths to the `apps` layer in `scripts/strip-demo.ts`.
7. A flow in `e2e/flows/` that a guest can use it and keeps it on sign-up.

## TanStack DB in the apps (0189)

The `_apps` layout mounts `<DbScope>`, so DB is available to every app page and to no other page. A loader fills the Query cache (`ensureQuery`); the collections read that query (`select`); the page uses `useLiveSuspenseQuery`, which renders on the server and hydrates from the same cache. Handlers save, then `await collection.utils.refetch()` and return `{ refetch: false }`. See [state.md](state.md).

## Notes (0190)

- **Search:** a generated `search tsvector` (title A, body text B, the `simple` configuration: no stemming, so Nepali works as written) with a GIN index; `websearch_to_tsquery` takes quoted phrases and `-word`. The server returns ranked ids; the list shows those rows of its TanStack DB collection.
- **Images:** an app user holds no `attachments:upload`, so the editor gives `ImageGalleryField` Notes' own `UploadTransport` (`features/apps/notes/uploads.ts`, the `notes` scope, 30 uploads an hour). Any app that uploads does the same.
- **Sharing:** accounts only; a random token, revoked by clearing it. The shared page `/apps/notes/s/$token` is public and `noindex` (in the head and in `X-Robots-Tag`, `src/middleware/robots.ts`).
- **Quotas:** 500 notes per user, 8 images per note.

## Links (0191)

- **Redirect:** `/l/$slug`. Request middleware (`src/middleware/short-links.ts`) finds the link; the handler returns its 302 or falls through to the localized 404. Only an account's active, unblocked, unexpired link redirects; a guest's never does. The click is recorded with `waitUntil` and keeps no IP: the referrer's host, a country, a device class.
- **Statistics and QR:** 30 days in Nepal time, top referrers, countries and devices; the QR code as SVG or PNG.
- **Moderation:** `/admin/links` (`links:moderate`): block or delete, audited. A blocked link stays off whatever its owner does.
- **Quotas:** 200 links per user, 30 creates an hour; slugs unique across everyone, never changed after creation.

## Habits (0193)

- **Streaks on calendar days:** `features/apps/habits/streaks.ts` takes "today" from `todayInZone(APP_TIME_ZONE)` and works on "YYYY-MM-DD" strings. Unscheduled weekdays neither count nor break a streak; today stays open until it ends. The server computes each habit's streak, best and 30-day rate from every check-in.
- **Check-ins** are a TanStack DB collection over the overview query: a tap adds one (back to none after the target), rolled back with a toast if refused; the refetch after the save brings the new streak. Today and the 366 days before only.
- **Heatmap:** server-rendered SVG, 53 weeks by 7 days (`heatmap.ts` places the cells).
- **Quotas:** 20 habits.

## Forms (0195)

- **Definitions are data:** `features/apps/forms/fields.ts` is a Zod union of nine field types; `toZodSchema(fields)` makes the schema a response must pass, used by the public form's validators and again by the server. Answers are keyed by field id and choices stored as option ids (both made in the browser), so renaming keeps the answers.
- **Builder** (`/apps/forms/$formId`): a draft in the page; Save validates it with `saveFormInput` and sends it against the loaded version (stale: Reload). Problems are keyed like the input (`fields.2.label`). The palette and the questions share one dnd-kit provider (a type dropped on a question goes in there); every palette entry also has an add button, and questions move with Alt + ↑/↓. Publishing keeps the version and needs an account.
- **Public page** `/f/$slug`: outside every section (its own frame, no session lookup), an account's published form only, `noindex` in the head and `X-Robots-Tag`. Submissions: honeypot, Turnstile, 5 an hour per sender and form (`clientIpHash`), the form's schema, 1,000 per form.
- **Results:** `summarize` (`results.ts`) per question, the responses in a `DataTable` (`?page=`), every response as CSV.
- **Quotas:** 20 forms per user. A submission whose answers don't match the form's question ids (the questions changed since the page loaded) is a CONFLICT asking to reload (0199).

## Turning guest sessions off

Remove `anonymous(…)` from `src/server/auth/auth.ts` and `anonymousClient()` from `src/lib/auth-client.ts`, and the "Try it" buttons. The guards can stay: they never match without guests.

## Pitfalls already solved

- **A scroll region needs `relative`:** an `sr-only` label inside a sideways-scrolling board is absolutely positioned and escapes the region, widening the page on phones (the review's overflow check). The board's region is `relative`.
- **Route files never import a collection module:** a loader's import is in every page's JavaScript (0151), and a collection brings TanStack DB with it. Constants a loader needs live in `queries.ts`.
- **Handlers refetch explicitly:** a query collection's automatic refetch after a handler logs a deprecation warning, which fails the browser review.
- **A server handler falls through only to a page:** `next()` in a route's `server.handlers` throws unless the route has a component, and a route with a component may not import server code. `/l/$slug` has an empty component behind a `beforeLoad` that throws `notFound()`, and does its lookup in request middleware, which hands the answer to the handler in `context`.
- **Grouping by a parameterized expression:** `group by to_char(at at time zone $4)` doesn't match `select to_char(at at time zone $1)`, because every value in a `sql` template is its own parameter. Group by position: `` .groupBy(sql`1`) ``.
- **A loader's imports are in every page:** a route that imports its `queries.ts` statically puts the queries and every server-function stub of the app in the entry chunk (`check-bundle.ts` fails). Import it inside the loader (0194).
- **A button's name holds its visible text:** an `aria-label` that leaves out what the button shows ("Tue 27") fails axe's label-content-name-mismatch. Keep the visible text and add the rest in an `sr-only` span (`checkin-button.tsx`; the button is `relative` so the span stays inside).
- **Deleting what the page shows:** invalidating a detail query while its page is still mounted refetches a 404. Habits' delete invalidates the overview only, navigates, then removes the habit's query.
- **A page outside every section renders its own frame:** `/f/$slug` has no layout, so its component draws the header, preloads the fonts in its `head` and sets `staticData.session: "skip"` (a respondent has no session to look up).
- **A two-factor sign-in loses the guest's session:** the password step clears the session cookie before the anonymous plugin's hook runs; the `guest_claim` cookie and `claimGuestData` after sign-in are what keep the data.
- **"Too many attempts" when trying an app:** guest sign-ins are limited per address and per hour (30, `GUEST_SIGN_INS_PER_HOUR`), counted in the database. Mobile carriers share one address among many visitors, and in dev every attempt is 127.0.0.1 (dev builds don't limit it). The try button names the limit instead of "wait a moment" (0201).
- **A count then an insert isn't a limit:** under READ COMMITTED two requests both count `quota − 1` and both insert. Take `lockQuota` (`src/server/db/quota.ts`, core since 0206: a transaction-scoped advisory lock per owner, or per form for responses) before the count, inside the same transaction (0199).
- **A session can be a guest's** (`session.isAnonymous`, 0185): visitors trying the apps. They hold no permissions; `requireUserMiddleware` refuses them, so account functions must use it (or a `requirePermission`), and the apps use `requireAppUser` + `withAppServices`. App tables have `owner_id` and every query goes through `ownedBy`.
