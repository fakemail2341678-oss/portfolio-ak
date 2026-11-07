# Recipes for optional features

Things many projects need but the base doesn't ship in every app (Part 3 rule: when in doubt, it's a recipe). Each section says what to use, where the working example or script is, and how to adopt it. Decisions 0145–0150.

| Recipe | Example or script |
| --- | --- |
| [Background jobs](#background-jobs) | `/dev/examples/background-jobs`, `src/server/examples/jobs.ts` |
| [Cursor pagination](#cursor-pagination) | `cursorPaginate()` in `src/server/db/list.ts`, `tests/server/recipes.test.ts` |
| [Caching public pages](#caching-public-pages) | `/dev/examples/caching`, `publicCache()` in `src/lib/http/cache-control.ts` |
| [Rate limiting server functions](#rate-limiting-server-functions) | `src/server/http/rate-limit.ts`, `tests/server/recipes.test.ts` |
| [Contact form](#contact-form) | `/dev/examples/contact` |
| [Avatar upload](#avatar-upload) | `/dev/examples/attachments` (the same flow) |
| [CSV export, undo, saved views](#csv-export-delete-with-undo-saved-views) | `/dev/examples/list-extras`, `src/lib/csv.ts` |
| [Resizable columns and expandable rows](#resizable-columns-and-expandable-rows) | `components/data-table/data-table.tsx` |
| [Offline development](#offline-development) | `pnpm dev:offline` (`scripts/dev-offline.ts`) |
| [Preview deploys with a Neon branch](#preview-deploys-with-a-neon-branch-per-pr) | `docs/recipes/preview-neon.yml` |
| [Changelog](#changelog) | `scripts/check-commit-msg.ts` |
| [Organizations and billing](#organizations-and-billing) | Guide only (0150) |

Also recipes, documented with their area: idempotency keys ([routing-data.md](routing-data.md), 0125), last login method and passkeys ([security.md](security.md), 0131), impersonation ([rbac.md](rbac.md), 0134), the admin command palette and view transitions ([conventions.md](conventions.md), 0140).

## Background jobs

Vercel functions end with the response, so anything slow or retryable (bulk email, imports, webhooks out, image work) goes to a durable job service; the request only enqueues and returns.

- **Pick (0145):** [Workflow DevKit](https://vercel.com/docs/workflow) when you deploy only to Vercel (`"use workflow"` functions orchestrate `"use step"` functions; each step is retried, 3 times by default, and finished steps are replayed, not re-run, after a crash). [Inngest](https://www.inngest.com/) or [Trigger.dev](https://trigger.dev/) when you want the same model on any host, with a hosted dashboard. All three are "named steps with retries", so the code below moves between them.
- **The shape:** `/dev/examples/background-jobs` runs `runSteps()` (`src/server/examples/jobs.ts`) in the request to show it: three steps, the middle one failing, retried with exponential backoff, the job giving up after the last retry. It is in memory and dies with the request, so it is only a demonstration.
- **Rules for steps:** each step is idempotent (it may run twice: use the row id or an idempotency key, 0125), returns small serializable data, and does one side effect. Read inputs by id inside the job rather than passing big payloads.
- **Bulk email off the request:** the server function writes what to send (or just the audience) and enqueues `send-batch` with its id; the job loads recipients, sends in chunks through `sendEmail` (one step per chunk, so a retry resends one chunk, not everyone), and records progress. The page polls the job's status or reads it from a table.
- **Adopting it:** add the SDK, a server route for its webhook endpoint (`src/routes/api/…`, like `/api/health`), the signing secret to `src/server/env.ts`, and its host to `connect-src` only if the browser talks to it (it usually doesn't).

## Cursor pagination

`paginate()` (offset, totals, page numbers) stays the default for admin lists. For feeds and very large tables, `cursorPaginate()` in `src/server/db/list.ts` pages by `(sort column, id)`:

- each page costs the same however deep it is (with an index on those two columns), and rows inserted meanwhile don't shift pages;
- the URL carries an opaque `?cursor=` instead of `?page=`; a broken cursor is the first page;
- there is no total or "page 7 of 12": show "Load more" (or infinite scroll with `useInfiniteQuery`).

Order with `cursorOrder(column, id, direction)` and return the sort value with `key`. For timestamps select it as text (`sql\`${table.publishedAt}::text\``): a JS `Date` drops microseconds and rows could be skipped. The search schema gets `cursor: z.string().max(200).optional().catch(undefined)`. `tests/server/recipes.test.ts` walks ten rows with shared timestamps in pages of four.

## Caching public pages

Pages that look the same to every visitor (marketing pages, the portfolio at `/`, a public item page) can be served by Vercel's CDN without running the function:

```ts
export const Route = createFileRoute("/_public/about")({
	headers: () => ({ "cache-control": publicCache({ sMaxAge: 300, staleWhileRevalidate: 86_400 }) }),
	…
});
```

- `publicCache()` (`src/lib/http/cache-control.ts`) sets `max-age=0` for browsers and `s-maxage` / `stale-while-revalidate` for the CDN. `/dev/examples/caching` sets it and reads it back.
- **Never** on a page that reads the session, a preference cookie (theme, sidebar, consent banner) or anything per request. The root layout renders the header from the session, so only pages under a layout that doesn't (or whose header is client-only) qualify; check the HTML is identical signed in and out first.
- The CSP nonce is per response, so a cached page reuses one nonce for everyone until it expires. That keeps working (the nonce matches its own HTML) but is one more reason to cache only public pages.
- Prerendering (TanStack Start's `prerender` option) fits content that changes only on deploy; it builds the HTML once, at build time.
- After changing content, purge with Vercel's cache purge, or keep `s-maxage` short.

## Rate limiting server functions

Better Auth limits its own endpoints (0128). For your public server functions (contact forms, search, anything that sends email), `src/server/http/rate-limit.ts` keeps a fixed-window count in Postgres, in Better Auth's existing `rate_limit` table (keys prefixed `fn:`), so all server instances share it:

```ts
.handler(async ({ data }) => {
	const ip = trustedClientIp(getRequest());
	await enforceRateLimit(db, `contact:${ip ?? "unknown"}`, { max: 3, windowSeconds: 600 });
	…
});
```

`enforceRateLimit` throws the localized `RATE_LIMITED` error ("Too many attempts…"); `consumeRateLimit` returns `{ allowed, remaining, retryAfterSeconds }` if you'd rather decide. Key by what you're protecting: the client IP (`trustedClientIp`, never a raw `X-Forwarded-For`), the user id for signed-in actions, or the target (an email address) for messages to someone. It is one upsert per call; for very hot paths use an edge rate limiter (Vercel Firewall rules) instead. The in-memory limiter of the CSP report endpoint (0139) only guards a quota.

## Contact form

`/dev/examples/contact`: a form with the honeypot field (`Honeypot` from `bot-check.tsx`), the Turnstile widget when `TURNSTILE_*` is set (`useTurnstile`, checked on the server by `verifyTurnstile` in `src/server/http/turnstile.ts`), and the rate limit above (3 per 10 minutes per IP). A filled honeypot gets the normal "sent" answer. The example logs the message; to send it:

1. a template in `src/server/email/templates` (both languages, like the others) and its entry in the preview list;
2. `CONTACT_TO` in `src/server/env.ts` (validated as an email);
3. `sendEmail({ to: serverEnv.CONTACT_TO, template: "contact", data: input, locale })` where the example logs (`src/server/email/send.ts`; add a `replyTo` to the provider call if replies should reach the sender), behind the idempotency-key recipe (0125) so a double submit sends once.

For the portfolio's `/contact` the page already exists; add the form below its email link.

## Avatar upload

Use the attachments flow (decision 0098, [attachments.md](attachments.md)); `/dev/examples/attachments` is the same upload, sign and confirm sequence.

1. A scope `avatar` in `src/features/attachments/constants.ts` with its limits (one image, square crop on delivery).
2. On the account page, an `ImageGalleryField`-like single picker (`max={1}`) in a new `AvatarSection` (`features/auth/components/`), saving through a new `setMyAvatar({ attachmentId })` function with `requireAccountOwnerMiddleware` that links the attachment to the user (`syncEntityAttachments` with entity `user`) and stores its delivery URL in Better Auth's `user.image`.
3. Render with `CloudImage` (`variant="thumb"`), with the initials as the fallback; delete the old asset when replaced (`purge`), and in account deletion (0129) as today.

## CSV export, delete with undo, saved views

`/dev/examples/list-extras` shows all three on one list. CSV export and saved views are DataTable toolbar features since Task 37 (`exportName`, `savedViews`, [tables-filters.md](tables-filters.md)); undo stays a recipe.

- **CSV export:** `DataTable`'s `exportName` exports the rows on screen through the columns' `csv` values, with `toCsv(rows, columns)` and `downloadCsv(name, csv)` in `src/lib/csv.ts`: RFC 4180 quoting, a BOM so Excel reads Devanagari, and formula-looking cells prefixed with `'` (CSV injection). Export the rows on screen, or add a server function that streams every row of the current filter for large exports (same list input, no `pageSize`, a hard cap). **Reading CSV back:** `parseCsv(text)` in the same file (quoted cells, doubled quotes, line breaks in cells, any line end, a BOM; `CsvParseError` names the line of an unclosed quote).

  Expenses' import (`/apps/expenses/import`, decision 0192) maps columns, previews every row through the server's schema and sends the valid ones with an idempotency key. <!-- @apps -->
- **Delete with undo:** the row hides at once and a toast offers "Undo"; the delete request goes out only when the toast closes. Nothing to restore on the server, but the delete is lost if the tab closes first. For undo after the request, soft delete: a `deletedAt` column, lists filtering `isNull(deletedAt)`, a `restore` function behind the same permission, and a cron (like `/api/cron/attachments`) that removes rows older than N days.
- **Saved views:** the URL is the list's state (golden rule 3), so a view is a name plus the search string. `SavedViewsMenu` (`components/data-table/saved-views.tsx`) keeps them in `localStorage` under `views:<tableId>`; to follow the user across devices, store them in a `saved_view` table (user id, table id, name, search) and read them in the menu instead.

## Resizable columns and expandable rows

`DataTable` runs on TanStack Table v9 (0169), so both are a feature away rather than a rewrite:

- **Resizing:** add `columnSizingFeature` to the `features` in `data-table.tsx`, keep `columnSizing` in the table's preferences (next to `hiddenColumns`, so SSR renders the saved widths), give the table `table-layout: fixed` with each `<th>` at `header.getSize()`, and render `header.getResizeHandler()` on a handle that also takes ← / → from the keyboard. Cap the number of tables kept in the cookie.
- **Expansion:** add `rowExpandingFeature` with an `expanded` state, a column with a disclosure button (`aria-expanded`, `aria-controls`), and after each expanded row a `<tr>` with one cell spanning every visible column (`colSpan={row.getVisibleCells().length}`) for the detail. Load the detail with its own query when it opens, not with the page.

## Offline development

`pnpm dev:offline` (`scripts/dev-offline.ts`) runs the dev server with no outside services and no `.env` edits: an in-memory PGlite over TCP (the e2e harness's server), migrated and seeded with an admin and the demo data on each start, the console email provider, and Sentry, PostHog, Cloudinary, Turnstile and Google switched off. It prints the admin's sign-in. Data is gone when it stops; use `pnpm dev` with a Neon branch for anything you want to keep. Uploads are unavailable (no Cloudinary), as in any setup without its keys.

## Preview deploys with a Neon branch per PR

`docs/recipes/preview-neon.yml` is a GitHub Actions workflow: on each PR it creates (or reuses) a Neon branch `preview/pr-<n>`, runs `pnpm db:migrate` on it, builds and deploys a Vercel preview with that branch's `DATABASE_URL`, and deletes the branch when the PR closes. Copy it to `.github/workflows/`, add the secrets it lists, and turn off Vercel's own preview deploys. Vercel's Neon integration can create branches by itself instead; the workflow is for running migrations before the deploy, which the integration doesn't. Check the Neon actions' current major versions when adopting.

## Changelog

Pick one (0150):

- **Conventional Commits** (`feat:`, `fix:`, …): `scripts/check-commit-msg.ts` checks a message; enable it as a `commit-msg` hook in `lefthook.yml` (the snippet is at the top of the script) and generate the changelog from history at release time (e.g. `git-cliff`). Squash-merge PRs so the PR title is the commit, and check the title in CI with the same function.
- **Changesets** (`@changesets/cli`): each PR adds a short `.changeset/*.md`; good when the release notes should be written for users rather than derived from commits.

## Organizations and billing

Multi-tenancy stays a non-goal of the base, so this is guide only (0150).

- **Organizations:** Better Auth's `organization()` plugin (`better-auth/plugins`) with its client plugin; run `pnpm auth:schema` and `pnpm db:generate` for its tables (organization, member, invitation, and the session's active organization). Then every tenant table gets an `organizationId`, every repository function filters by it, and the auth middleware puts `activeOrganizationId` in the context; the RBAC tables either stay global (platform admins) or gain an `organizationId` for per-org roles. Better Auth's organization endpoints must be rate limited (`customRules`) and its invitation emails moved to the app's templates.
- **Billing:** `@better-auth/stripe` (with the Stripe SDK): customer on sign-up, Checkout and the billing portal, subscriptions referenced to a user or an organization (seats for teams), and a webhook (`checkout.session.completed`, `customer.subscription.created|updated|deleted`, signed with `STRIPE_WEBHOOK_SECRET`). Gate features on the subscription in server middleware, never only in the UI, and add Stripe's checkout and API hosts to the CSP.
- Docs: [Better Auth organization](https://better-auth.com/docs/plugins/organization), [Better Auth Stripe](https://better-auth.com/docs/plugins/stripe).
