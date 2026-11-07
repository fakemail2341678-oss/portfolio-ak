# Testing

Vitest for logic, server code and components; Storybook for every component in a real browser; Playwright for flows and the browser review of every page, against a production build. A task is done when `typecheck`, `check`, `knip`, `test`, `test:storybook`, `test:e2e`, `build` and `build-storybook` are green with no warnings. CI (`.github/workflows/ci.yml`) runs all of them on every pull request and push to `main`; story tests and e2e tests there use the runner's installed Chrome.

## The suites

| Command | What runs | Environment |
| --- | --- | --- |
| `pnpm test` | `tests/**/*.test.{ts,tsx}` (Vitest project `unit`) | Node; files starting with `// @vitest-environment jsdom` get a DOM |
| `pnpm test:storybook` | Every story, twice, in one run: en/light and ne/dark. Play functions run, and any a11y violation fails the story. | Headless Chrome (the installed one) |
| `pnpm test:e2e` | `e2e/`: flows and the browser review (Playwright), against a production server the harness builds and starts | Installed Chrome; in-memory PGlite (CI: Postgres) |
| `pnpm test:coverage` | The unit project with v8 coverage, then a per-area table (`scripts/coverage-report.ts`) | `coverage/index.html` |

| Folder | For |
| --- | --- |
| `tests/unit/` | Pure logic: schemas, list and search helpers, SEO and route-wide head rules, CSP, env, errors, intl |
| `tests/server/` | Code with a database or server: repositories and services on PGlite, middleware, guards, permissions, attachments, sitemap |
| `tests/components/` | jsdom tests of fields, filters, breadcrumbs, masking, preferences UI, permissions UI, the attachments editor |
| `tests/i18n/` | Message parity, translation, unused keys, locale routing |
| `tests/email/` | Every template in both languages |
| `e2e/` | Playwright: `review.spec.ts` (every page), `flows/` (auth, account, Test CRUD, edit conflicts, permissions, user management and the audit log, no-JS lists, health), `harness/` (the server it runs against), `support/` (fixtures, page list, checks) |

## Patterns

- **Database:** `createTestDb()` (`tests/utils/test-db.ts`) is an in-process Postgres (PGlite) with the committed migrations and one admin user. Repositories take a `db` and services the call's services (`{ db, actor, imageStore }`), so tests call them directly with their own (`{ db, actor: { id, isAdmin, permissions }, imageStore: null }`).
  - It loads a migrated data directory that the unit project's global setup (`tests/setup/pglite.ts`) builds once per run and caches in `node_modules/.cache/vitest-pglite/`, rebuilt when `drizzle/` changes. Don't create `new PGlite()` and migrate in a test file: that costs initdb plus the migrations again (0159).
  - `reset()` truncates every table, then adds the admin back. Fixtures a file needs in every test (another user, a role) go in the second argument, `createTestDb("admin-1", (db) => db.insert(…))`, which runs again after each reset.
- **DOM setup:** `tests/setup/dom.ts` loads Testing Library only in jsdom files, so server tests don't pay for it.
- **Server functions** run only inside Start. Test the functions they call, and the wiring with static checks: `tests/server/guarded-functions.test.ts` asserts each function's `requirePermission` and that every file in `src/functions` is declared, and `env-boundary.test.ts` asserts no client code imports `src/server`.
- **Routes:**
  - `createRouter({ routeTree, context: {} as RouterContext })` resolves real route ids (see `route-seo.test.ts`, `dev-examples.test.ts`);
  - `createMemoryHistory` plus a test route tree renders components that need a router (`breadcrumbs.test.tsx`, `route-masking.test.tsx`).
- **Cloudinary:** `tests/utils/fake-cloudinary.ts` runs the real client over a fake `fetch` that behaves like Cloudinary's API.
- **Locale:** `overwriteGetLocale(() => "ne")` and reset it in `afterEach`.
- **Env:** `tests/setup/env.ts` sets a valid baseline; override with `vi.stubEnv` (including `DEV`).
- **Radix menus** open on pointer events: use `userEvent`, not `element.click()`.
- **Timeouts:** unit tests have 15 s (jsdom interaction tests are slow on a busy machine). Import heavy modules at the top of a test file, not inside a test: module loading doesn't count against the timeout there.
- **Guards as tests:**
  - every route's head rules (`route-seo.test.ts`);
  - every `<form>`'s method (`form-method.test.ts`);
  - the example registry against the routes;
  - unused messages.

## Storybook

- **Where:** stories sit next to their components (`*.stories.tsx`).
- **Providers:** `.storybook/app-providers.tsx` wraps each story in the app's router (memory history), Query, DB and preferences store. Set the session, preferences and URL with `parameters.app`.
- **No server:** server functions and the auth client are mocked (`.storybook/mocks/`).
- **Fields:** wrap them in `FieldStory` (`src/components/forms/story-harness.tsx`) and add a `play` function for anything interactive.
- **What not to import:** components must not import Start runtime helpers (`createIsomorphicFn`); Storybook has no Start plugin.

## E2E and the browser review (`pnpm test:e2e`)

One command, locally and in CI. Playwright runs `node e2e/harness/server.ts` (its `webServer`), which:
1. **builds** the app (`vite build`) with fixed public settings, Sentry/PostHog off and `VITE_DEV_ROUTES=true` (so the `/dev` pages exist and are reviewed; a production deploy refuses the flag, 0162), whatever `.env` says;
2. **starts a database:** in-memory PGlite served over TCP (`e2e/harness/pglite-server.ts`), or the Postgres in `E2E_DATABASE_URL` (CI; its name must contain `e2e` or `test`, because it's emptied first);
3. **migrates and seeds** it: an admin and the `db:seed-demo` data, every user with the password in `e2e/harness/config.ts`;
4. **starts the harness** on port 3101: a fake Resend API that keeps every email, plus test controls (read emails, reset rate limits, look up seeded rows);
5. **starts the production server** on port 3100 with `EMAIL_PROVIDER=resend` and `RESEND_BASE_URL` pointing at the harness, so emails go through the real provider code. No other env reaches it.

| Command | Use |
| --- | --- |
| `pnpm test:e2e` | Everything (about 6 minutes; CI splits it into 3 shards) |
| `pnpm test:e2e e2e/flows` / `--project=review -g "/admin"` | A folder, or tests whose title matches |
| `node e2e/harness/server.ts` in another terminal | Keeps a server up: `pnpm test:e2e` reuses it locally (restart it after changing app code) |
| `E2E_SKIP_BUILD=1` | Reuse the last e2e build in `.output` |
| `pnpm test:e2e --ui` | UI mode: pick, watch and debug tests (see below) |
| `pnpm exec playwright show-report` | The HTML report; CI uploads it when a shard fails (traces are recorded on the retry) |

Ports: the app on `E2E_PORT` (3100), the harness on `E2E_HARNESS_PORT` (3101); PGlite takes any free port (`E2E_PGLITE_PORT` to fix it). The harness stops before building when 3100 or 3101 is taken.

### UI mode (`pnpm test:e2e --ui`)

- **Start-up takes about a minute:** UI mode starts the harness, which builds first. The test list shows "Loading…" until the server is up. UI mode restarts the server when the window reconnects (a reload), so it builds again; `E2E_SKIP_BUILD=1 pnpm test:e2e --ui` reuses the last e2e build when the app code hasn't changed.
- **Projects:** only `flows` is ticked at first (UI mode selects the first project). Tick `review` under "Projects" for the browser review.
- **"Playwright browsers are missing"** can be ignored: the suite runs in the installed Chrome (`channel: "chrome"`), not Playwright's bundled browsers, so there's nothing to install.
- **Closing it** stops the harness and the server. If the UI process is killed instead, the harness notices within a few seconds and exits, so no stale server is left on port 3100.

### The browser review (`e2e/review.spec.ts`)

- **Pages:** `REVIEWED_PAGES` in `e2e/support/pages.ts`, each with who visits it (`as`), how a `$param` gets a value (from `/sitemap.xml`, a seeded row's id or slug, or a fixed `path`), and an expected status (the 403 and 404 pages). `tests/unit/e2e-pages.test.ts` compares the list with `src/routeTree.gen.ts`, so **a new route fails `pnpm test` until it's reviewed** or listed in `NOT_REVIEWED` with a reason. The `/dev` pages are reviewed like the others: the harness's build keeps them.
- **Matrix:** en/ne × light/dark × 390/768/1280, one test each.
- **Checks** (`e2e/support/review.ts`):
  - the HTTP status;
  - horizontal overflow, naming the elements that stick out;
  - CLS ≤ 0.01 from a `layout-shift` `PerformanceObserver`, naming what moved;
  - axe: WCAG 2.2 AA plus best practices;
  - the first tab stop is a skip link whose target is the page's `<main>` (0137).
- **Always on** (the `guard` fixture in `e2e/support/fixtures.ts`, for flows too): any console error or warning (hydration mismatches included), uncaught error, or CSP violation (`securitypolicyviolation`) fails the test. A test that expects one calls `guard.allow(pattern)`, e.g. `RESOURCE_STATUS(403)` for the browser's own line on a refused page.
- **Retries:** each test gets one retry (locally too). A test that passes only on the retry is listed as flaky in the summary and the report, with a trace; treat a page that keeps showing up there as a real problem.
- **Warm-up load:** each page is loaded once before the measured load, so the fonts are cached. Cold, on a busy CPU, Chrome can paint the fallback faces before the preloaded fonts arrive, and CLS would depend on machine load (decision 0121).

### Flows (`e2e/flows/`)

- **Auth:** sign up → verify → log in; refused log-in while unverified; log-in code; password reset. Links and codes come from the captured emails (`harness.nextEmail(to, template)`).
- **Account:** turn on two-factor (the code comes from `support/totp.ts`, a tiny authenticator), then log in with an app code and with a backup code, and an emailed sign-in code is refused; download the data export; delete the account through the emailed link, after which logging in fails. The harness turns off the breached-password check (no outside calls); `tests/server/auth-hardening.test.ts` covers it against a real Better Auth instance with a stubbed range API.
- **Test CRUD:** create, edit, publish (its `/dev/test-crud` page appears) and delete (it 404s), as admin.
- **Conflicts:** two tabs edit the same item; the second save is refused with the "changed by someone else" notice, its response carries an `x-request-id` that matches the error, and reloading then saving keeps both changes.
- **Permissions:** a 403 page for a missing permission; actions a role lacks aren't offered; granting and revoking in the matrix takes effect on the next request.
- **User management and the audit log:** an invitation from the email to the first sign-in; sign out everywhere (the user's session stops working); view as a user with the banner and back. Each is found in `/admin/audit` by its request id. An editor gets a 403 on the audit page, and the admin's captured call replayed with the editor's session answers FORBIDDEN.
- **No JavaScript:** search and pagination on the public and admin lists.
- **Health:** `GET`/`HEAD /api/health` answer 200 JSON, never cached; every response has its own `x-request-id`.
- **Frontend:** the skip link moves focus to `<main>` (past the admin sidebar too); under reduced motion an animation and a transition, inline ones included, finish at once; pages name `/api/csp-report` in their CSP and `Reporting-Endpoints`, and the endpoint takes both report formats.

### Writing a test

- Import `test`/`expect` from `e2e/support/fixtures.ts`, not `@playwright/test`, so the guard runs.
- Sign in with `test.use(signedIn("admin"))`. The first test that needs a user signs in through the API and saves the state under `e2e/.auth/`, keyed by the harness run (each run has a new database); `signInState(user)` gives the file for a context you create yourself. Flows that change a user create one (`createVerifiedUser`), so seeded users stay as they are.
- Wait for hydration before using a form handled in JavaScript: `page.goto(path, { waitUntil: "networkidle" })`.
- Auth endpoints are rate limited per IP and every test is 127.0.0.1: call `harness.resetRateLimits()` before tests that sign in.
- Use roles and labels from `messages/en.json`; give an exact name when one label contains another ("Edit" vs "Quick edit").
- A new page needs nothing beyond its `REVIEWED_PAGES` entry.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Radix menus in tests:** they open on pointer events. Use real clicks (Testing Library `userEvent`, puppeteer `page.click`), not `element.click()`.
- **A developer's .env changed test results:** Vitest loads `.env`, and a PostHog key there failed the "without a key" tests locally (CI has no `.env`). `tests/setup/env.ts` sets the required values and removes the optional services' keys (PostHog, Sentry); a test that needs one uses `vi.stubEnv`.
- **Server functions run only inside the Start runtime.** Keep them as thin wrappers and test the plain functions in `src/server/**` they call.
- **Browser scripts against dev:** a devtools SSE stream stays open (wait for `load`, not network idle), clicks must wait for hydration, and layout-shift numbers aren't meaningful (no font preloads in dev). Measure CLS on a production build.
- **Component tests that load a route whose queries call server functions** (the portfolio's `_site` layout) `vi.mock` that functions module: function files import server code statically, which only Start's compiler strips from browser code (`tests/components/layout/section-headers.test.tsx`).
