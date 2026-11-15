# Testing

Vitest for logic, server code and components; Storybook for every component in a real browser; Playwright for flows and the browser review of every page, against a production build. A task is done when `typecheck`, `check`, `knip`, `test`, `test:storybook`, `test:e2e`, `build` and `build-storybook` are green with no warnings. `pnpm gates` runs them all in order and prints what each covered and how long it took (below). CI (`.github/workflows/ci.yml`) runs all of them on every pull request and push to `main`; story tests and e2e tests there use the runner's installed Chrome.

## The suites

| Command | What runs | Environment |
| --- | --- | --- |
| `pnpm test` | `tests/**/*.test.{ts,tsx}` in three Vitest projects: `unit` (`tests/unit`, `i18n`, `email`), `components` and `server` | Node, jsdom for `components`; a file starting with `// @vitest-environment jsdom` gets a DOM wherever it is |
| `pnpm test:storybook` | Every story, twice: en/light, then ne/dark, each pass in a Vitest process of its own (`scripts/test-storybook.ts`). Play functions run, and any a11y violation fails the story. | Headless Chrome (the installed one) |
| `pnpm test:e2e` | `e2e/`: flows and the browser review (Playwright), against a production server the harness builds and starts | Installed Chrome; in-memory PGlite (CI: Postgres) |
| `pnpm test:coverage` | The three projects of `pnpm test` with v8 coverage, then a per-area table (`scripts/coverage-report.ts`) | `coverage/index.html` |

| Folder | For |
| --- | --- |
| `tests/unit/` | Pure logic: schemas, list and search helpers, SEO and route-wide head rules, CSP, env, errors, intl; the messages (`i18n-message-parity`, `i18n-message-usage`, `i18n-locale-routing`) and every email template in both languages (`email-templates`) |
| `tests/server/` | Code with a database or server: repositories and services on PGlite, middleware, guards, permissions, attachments, sitemap |
| `tests/components/` | jsdom tests of fields, filters, breadcrumbs, masking, preferences UI, permissions UI, the attachments editor |
| `e2e/` | Playwright: `review.spec.ts` (every page), `flows/` (auth, account, Test CRUD, edit conflicts, permissions, user management and the audit log, no-JS lists, health), `harness/` (the server it runs against), `support/` (fixtures, page list, checks) |

## pnpm gates

One command for every gate, cheapest first: typecheck, check, knip, i18n, test, storybook, build, bundle, build-storybook, e2e (`scripts/gates.ts`, 0296). It stops at the first gate that fails, prints a table of what each gate covered and how long it took, and writes the same to `.data/gates/last.json`.

| Command | Does |
| --- | --- |
| `pnpm gates` | Every gate, narrowed to the files changed since the last commit (with a clean tree: the last commit's files) |
| `pnpm gates --full` | Every suite whole: a Part's last task, and what CI runs |
| `pnpm gates --list` | Prints each gate's scope and command, and runs nothing |
| `--only=test,e2e` / `--skip=e2e` | Some gates, by the names above |
| `--base=<commit>` | "Changed" means changed since that commit |
| `--e2e="<grep>"` | The e2e gate's `--grep`, in place of the one worked out from the changes |
| `--keep-going` | Runs the remaining gates after one fails |
| `pnpm gates:clean` | Stops what a killed run left behind: Playwright and Vitest runners and workers, the e2e harness and its server, a Storybook build, Playwright's Chromes (those with its throwaway profile only, never your browser) |

**What "narrowed" means** (the changed-files rule, 0280). No gate is skipped unless nothing it tests changed:

| Gate | Narrowed to | Runs whole when |
| --- | --- | --- |
| typecheck | What changed, by the incremental cache | |
| check | The changed files | More than 150 files changed |
| knip, i18n, build, bundle | Never narrowed: they have no per-file form | |
| test | `vitest related`: the test files that import a changed file, plus the guard tests, which read the source as files (they use `node:fs` or `import.meta.glob`) so no import leads to them | The Vitest config, `tests/setup`, `tests/utils`, `drizzle/`, `package.json` or the lockfile changed |
| storybook, build-storybook | `STORIES_ONLY` set to the changed files' folders (`src/features/<name>`, `src/components/<name>`) that hold stories; skipped when there is none | `.storybook/`, `src/styles`, `src/lib`, `src/hooks`, `src/components/ui`, `messages/`, `package.json` or the lockfile changed |
| e2e | The pages and flows whose title matches a changed layer, route or flow file (`src/features/kharcha/…` gives `kharcha`); skipped when no changed file is part of a page | Never by itself. When shared code changed (`src/components`, `src/lib`, `src/styles`, the core of `src/server`, `messages/`, `e2e/support`, the configs), every page is also reviewed once, in English, light, at 1280, in place of its twelve variants |

- **Read the scope column.** A narrowed green run says what it covered; it does not say the whole suite is green. `--full` and CI do.
- **Worker counts need no flag.** `scripts/lib/workers.ts` gives each suite what the free memory allows when it starts: a worker's cost was measured (a server-test worker 520 MB, a story pass 2.7 GB plus 900 MB a page, an e2e worker with its Chrome 1,150 MB on top of 1 GB for the server and the runner), 1 GB stays free, and no suite takes more workers than stopped helping (`unit` 4, `components` and `server` 6, stories 3, e2e 4). `GATE_WORKERS=<n>` forces a count. A gate warns when the processors are busy or memory is short before it starts.
- **A stale e2e server is restarted.** The harness reports the hash of the build it serves at `/e2e/run`; when the source's hash is another, the gate stops that server so Playwright starts a fresh one.
- **The build gate empties `.output`,** so the e2e gate after it builds again (its build has the `/dev` pages, the production one doesn't). The harness's build cache saves the build when `pnpm test:e2e` runs again with the app's source unchanged.

### How long the gates take

Every suite whole, on the owner's machine (12 threads, 11.7 GB, about 5.3 GB free with an editor open), 2026-11-15, measured with `scripts/audit/measure.ts` as the baseline was (0295, 0296). "Least free" is the machine's free memory at its lowest.

| Gate | Before (Task 98) | Now | Least free | What ran |
| --- | ---: | ---: | ---: | --- |
| `pnpm typecheck`, no cache | 1 min 45 s | 1 min 13 s | 1,535 MB | Compiling the messages is 55 s of it, `tsc` 14 s |
| `pnpm typecheck`, nothing changed | 58 s | 2 s | 4,555 MB | |
| `pnpm check` | 15 s | 8 s | | Not changed |
| `pnpm knip` | 7 s | 5 s | | Not changed |
| `pnpm i18n:check` | 6 s | 6 s | | Not changed |
| `pnpm test` | 3 min 26 s | 1 min 44 s | 1,653 MB | 208 files, 2,538 tests (207 and 2,534 before, plus the workers' own) |
| `pnpm test:storybook`, both passes | 1 min 48 s, 39 MB free | 2 min 49 s at one page, 1 min 49 s at two | 1,650 MB | 2 × 77 files, 2 × 394 stories, as before |
| `pnpm build` | 1 min 34 s | 1 min 46 s | 957 MB | Not changed |
| the bundle budget | 2 s | 2 s | | 227 routes |
| `pnpm build-storybook` | 1 min 16 s | 1 min 18 s | 2,839 MB | Not changed |
| the e2e server (build, database, start) | 1 min 8 s | 1 min 19 s; 8 s when the build is cached | | |
| `pnpm test:e2e`, two workers, ten shards | 73 min 26 s | 61 min 31 s | 1,938 MB | 3,832 tests as before (3,624 review checks, 208 flows); none failed, none flaky |

Everything but e2e: 9 min 13 s (11 min 17 s before). The full set: 72 minutes (86 before).

**Where the remaining time goes:**

- **typecheck:** `tsc` 7 checks 5,886 files in 14 s with two checker threads (3.5 GB; four threads took 4.5 GB for 2 s less). The rest of a cold run is Paraglide compiling 7,227 messages, which now happens only when a message changed.
- **test:** 101 s inside Vitest: half running tests, 30% importing, 9% building jsdom. The `server` project is 60 s of it at six workers, each file opening its own PGlite from the shared data directory. `kharcha-access`, 173 s of the old run, takes 7 s.
- **test:storybook is bound by memory, not time.** A pass takes 84 s on one page, 50 s on two and 48 s on three, and holds 3.6, 4.5 and 5.4 GB: a page keeps what its story files loaded until Chrome collects it. With 5.3 GB free, the two-page run left 0.5 GB, so the rule gives one page there and two from 5.5 GB up. Before, four pages ran with 39 MB left, and runs were killed for it.
- **test:e2e is its count.** 3,624 review checks at 1.83 s each (2.2 s before) on two workers are 55 of the 61 minutes; the flows are 6. A check is two page loads back to back (0.26 s to warm the fonts, 0.4 s measured), Playwright's 0.5 s wait for the network to go idle, axe (0.4 s; 0.8 s before), and 0.17 s for a new context with its sign-in. None of these can go without weakening a check. Half an hour would need a check under 0.9 s, or four workers (6.6 GB free).

## Patterns

- **Database:** `createTestDb()` (`tests/utils/test-db.ts`) is an in-process Postgres (PGlite) with the committed migrations and one admin user. Repositories take a `db` and services the call's services (`{ db, actor, imageStore }`), so tests call them directly with their own (`{ db, actor: { id, isAdmin, permissions }, imageStore: null }`).
  - It loads a migrated data directory that the unit project's global setup (`tests/setup/pglite.ts`) builds once per run and caches in `node_modules/.cache/vitest-pglite/`, rebuilt when `drizzle/` changes. Don't create `new PGlite()` and migrate in a test file: that costs initdb plus the migrations again (0159).
  - `reset()` empties every table, then adds the admin back. Fixtures a file needs in every test (another user, a role) go in the second argument, `createTestDb("admin-1", (db) => db.insert(…))`, which runs again after each reset. It deletes as a replica (no foreign-key checks, no triggers) and restarts the sequences: `truncate … cascade` over the 123 tables took 80 to 100 ms a test, this takes 4 to 5 (0296).
  - **Fixtures that take many service calls:** build them once, call `snapshot()`, and call `restore()` between tests in place of rebuilding: the same rows come back with the same ids. Kharcha's access matrix builds its world through some thirty service calls and needs it fresh about 400 times; rebuilding it each time was 42% of `pnpm test` (173 s, now 7 s). Restore anything a test keeps outside the database too (that file puts the fake Cloudinary's assets back).
- **DOM setup:** `tests/setup/dom.ts` loads Testing Library only in jsdom files, so server tests don't pay for it.
- **The three projects** (`vitest.config.ts`, 0296) all run on worker threads. `unit` shares one module graph per worker (`isolate: false`): its tests keep nothing between files, and importing was over half their time. `components` and `server` stay isolated per file: run in a shuffled order without isolation, a file of each failed. So a `tests/unit` file must not rely on a fresh module (a `vi.mock` there needs `vi.resetModules()`), and a test that needs isolation belongs in the other two folders.
- **Workers:** each project takes what the machine's free memory allows when the run starts (`scripts/lib/workers.ts`, measured per worker), so no command needs `--maxWorkers`. `GATE_WORKERS=<n>` overrides it.
- **Messages are loaded by Node, not through Vite** (`server.deps.external` for `src/paraglide`): nearly every test file imports them, and 10 MB of compiled messages took 0.8 s a file through Vite's module runner. Don't `vi.mock` a Paraglide module; use `overwriteGetLocale`.
- **Server functions** run only inside Start. Test the functions they call, and the wiring with static checks: `tests/server/functions-guards.test.ts` asserts each function's `requirePermission` and that every file in `src/functions` is declared, and `env-boundary.test.ts` asserts no client code imports `src/server`.
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
  - every `<form>`'s method (`forms-method.test.ts`);
  - the example registry against the routes;
  - unused messages.

## Storybook

- **Where:** stories sit next to their components (`*.stories.tsx`).
- **Providers:** `.storybook/app-providers.tsx` wraps each story in the app's router (memory history), Query, DB and preferences store. Set the session, preferences and URL with `parameters.app`.
- **No server:** server functions and the auth client are mocked (`.storybook/mocks/`).
- **Fields:** wrap them in `FieldStory` (`src/components/forms/story-harness.tsx`) and add a `play` function for anything interactive.
- **What not to import:** components must not import Start runtime helpers (`createIsomorphicFn`); Storybook has no Start plugin.
- **Two passes, one project** (0296): the Nepali, dark pass is a second browser instance of the same Vitest project (`storybook-dark-ne`), so both passes share one Vite config and one dependency cache. Its setup file sets `globalThis.__STORY_VARIANT__`, and the preview's decorator reads it when a story renders (`.storybook/variant.ts`). A story that must know its pass calls `storyVariant()`.
- **Narrowing to what changed** (0280): `STORIES_ONLY` limits `.storybook/main.ts`'s `stories` to some folders or story files, comma-separated, relative to the repository root (PowerShell: `$env:STORIES_ONLY="src/features/kharcha,src/components/forms"; pnpm build-storybook`). The story tests read the same list, so it narrows `test:storybook` too; a path (`pnpm test:storybook src/features/kharcha`) does the same there, for both passes. `pnpm gates` sets it from the changed files. Unset, every story. A narrowed build doesn't prove the whole Storybook builds: a Part's last task and CI build it all.
- **No docgen** (0280): `typescript: { reactDocgen: false }`. It only inferred the Controls panel's props and took nearly all of every build (over 10 minutes); the full build takes 1 min 16 s (0295; about 20 s when 0280 was written). A story that wants controls declares them in `args` or `argTypes`.

## E2E and the browser review (`pnpm test:e2e`)

One command, locally and in CI. Playwright runs `node e2e/harness/server.ts` (its `webServer`), which:
1. **builds** the app (`vite build`) with fixed public settings, Sentry/PostHog off and `VITE_DEV_ROUTES=true` (so the `/dev` pages exist and are reviewed; a production deploy refuses the flag, 0162), whatever `.env` says. It builds only when the source changed: `.output/.e2e-build-hash` holds a hash of what the build reads (`e2e/harness/build-hash.ts`: `src`, `public`, `messages`, the Vite config, the lockfile, the public settings), and any other build empties `.output` and the hash with it (0296);
2. **starts a database:** in-memory PGlite served over TCP (`e2e/harness/pglite-server.ts`), or the Postgres in `E2E_DATABASE_URL` (CI; its name must contain `e2e` or `test`, because it's emptied first);
3. **migrates and seeds** it: an admin and the `db:seed-demo` data, every user with the password in `e2e/harness/config.ts`;
4. **starts the harness** on port 3101: a fake Resend API that keeps every email, plus test controls (read emails, reset rate limits, look up seeded rows);
5. **starts the production server** on port 3100 with `EMAIL_PROVIDER=resend` and `RESEND_BASE_URL` pointing at the harness, so emails go through the real provider code. No other env reaches it.

| Command | Use |
| --- | --- |
| `pnpm test:e2e` | Everything (62 minutes with 2 workers on the owner's machine, 0296; CI splits it into 5 shards) |
| `pnpm test:e2e e2e/flows` / `--project=review -g "/admin"` | A folder, or tests whose title matches |
| `node e2e/harness/server.ts` in another terminal | Keeps a server up: `pnpm test:e2e` reuses it locally (restart it after changing app code; `pnpm gates` does that itself, from the build hash the harness reports at `/e2e/run`) |
| `E2E_SKIP_BUILD=1` | Reuse whatever `.output` holds, without the hash check |
| `pnpm test:e2e --ui` | UI mode: pick, watch and debug tests (see below) |
| `pnpm exec playwright show-report` | The HTML report; CI uploads it when a shard fails (traces are recorded on the retry) |

Ports: the app on `E2E_PORT` (3100), the harness on `E2E_HARNESS_PORT` (3101); PGlite takes any free port (`E2E_PGLITE_PORT` to fix it). The harness stops before building when 3100 or 3101 is taken.

### UI mode (`pnpm test:e2e --ui`)

- **Start-up takes about a minute:** UI mode starts the harness, which builds first. The test list shows "Loading…" until the server is up. UI mode restarts the server when the window reconnects (a reload), so it builds again; `E2E_SKIP_BUILD=1 pnpm test:e2e --ui` reuses the last e2e build when the app code hasn't changed.
- **Projects:** only `flows` is ticked at first (UI mode selects the first project). Tick `review` under "Projects" for the browser review.
- **"Playwright browsers are missing"** can be ignored: the suite runs in the installed Chrome (`channel: "chrome"`), not Playwright's bundled browsers, so there's nothing to install.
- **Closing it** stops the harness and the server. If the UI process is killed instead, the harness notices within a few seconds and exits, so no stale server is left on port 3100.

### The browser review (`e2e/review.spec.ts`)

- **Pages:** `REVIEWED_PAGES` in `e2e/support/pages.ts`, each with who visits it (`as`), how a `$param` gets a value (from `/sitemap.xml`, a seeded row's id or slug, or a fixed `path`), and an expected status (the 403 and 404 pages). `tests/unit/pages-review.test.ts` compares the list with `src/routeTree.gen.ts`, so **a new route fails `pnpm test` until it's reviewed** or listed in `NOT_REVIEWED` with a reason. The `/dev` pages are reviewed like the others: the harness's build keeps them.
- **Matrix:** en/ne × light/dark × 390/768/1280, one test each.
- **Checks** (`e2e/support/review.ts`):
  - the HTTP status;
  - horizontal overflow, naming the elements that stick out;
  - CLS ≤ 0.01 from a `layout-shift` `PerformanceObserver`, naming what moved;
  - axe: WCAG 2.2 AA plus best practices, run in the page (`setLegacyMode`): axe's default mode opens a blank page for every run to join the frames' results, which took as long as the rules themselves (0296);
  - the first tab stop is a skip link whose target is the page's `<main>` (0137).
- **Always on** (the `guard` fixture in `e2e/support/fixtures.ts`, for flows too): any console error or warning (hydration mismatches included), uncaught error, or CSP violation (`securitypolicyviolation`) fails the test. A test that expects one calls `guard.allow(pattern)`, e.g. `RESOURCE_STATUS(403)` for the browser's own line on a refused page.
- **Retries:** each test gets one retry (locally too). A test that passes only on the retry is listed as flaky in the summary and the report, with a trace; treat a page that keeps showing up there as a real problem.
- **Warm-up load:** each page is loaded once before the measured load, so the fonts are cached. Cold, on a busy CPU, Chrome can paint the fallback faces before the preloaded fonts arrive, and CLS would depend on machine load (decision 0121). The two loads must be back to back in one page: the font has to be in that page's memory cache. A context shared by a worker's checks, with the warm-up only for a URL it hadn't loaded, was tried (0296) and failed 8 of 604 checks on CLS, all in Nepali.
- **A stuck run ends:** `globalTimeout` is two hours, and the ten slowest tests over 20 s are listed after every run (`reportSlowTests`).

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

## The standard's tests (`tests/unit/standard`)

The standard ([conventions.md](conventions.md), "The standard"; decision 0297) is checked by tests that read the source as files, so `pnpm gates` runs them on every change.

| File | Checks |
| --- | --- |
| `standard.test.ts` | Each of the 27 rules (`scripts/standard/rules/`) on the whole tree, against `known-deviations.json`. A deviation that is not listed fails; a listed one that is gone fails too |
| `rules.test.ts` | The rules themselves, on a tree in memory (`fixture.ts`): one of each deviation, and a feature in the standard's shape that nothing may flag. The ratchet's arithmetic |
| `generator.test.ts` | What `pnpm new:feature`'s templates make has no deviation; `biome.json`'s import boundaries forbid only what the standard forbids |

- **`pnpm standard`** is the same check without Vitest, in two seconds: `pnpm standard <file>` for one file, `--list <rule>` for a rule's deviations with their lines, `--summary` for the counts.
- **A test fails with "new":** the code deviates. Fix the code. The message says what to do.
- **A test fails with "fixed":** a listed deviation is gone. Run `pnpm standard --prune` and commit the shorter list with the fix.
- **After moving files** the list's keys (paths) are stale: `pnpm standard --rewrite` writes it from the tree. Read the diff: it must only rename keys.
- **A new rule** is a function from a tree to deviations in `scripts/standard/rules/`, with its deviation and its clean case in `fixture.ts`.

## Measuring the gates and auditing the source (`scripts/audit`)

Part 9's baseline (0295, `docs/history/part9-audit.md`) was taken with these, and every later "faster" or "fewer" is measured the same way.

| Command | Gives |
| --- | --- |
| `node scripts/audit/measure.ts <label> -- <command>` | The command's wall time, the peak memory of every process it started and the machine's least free memory, added to `docs/history/part9-audit/gates.json`. Its output goes to `.data/audit/logs/<label>.log` |
| `node scripts/audit/times.ts` | Where the suites spend their time: the slowest test files, stories, reviewed pages and flows, from the reporters' JSON (the commands are in the file's header) |
| `node scripts/audit/all.ts` | The ten audits that only read the source: folders and names, server functions, writes, reads, errors, effects and casts, docs, shared modules, the old plan |
| `node scripts/audit/coverage.ts` | Coverage per layer and per kind of code, after `pnpm test:coverage` |
| `node scripts/audit/ux.ts` | Every reviewed page's use of the width, its anatomy and what its first load asks the server for, after an audit run of the review (`AUDIT_DIR`, `AUDIT_WIDTHS`; the command is in the file) |
| `deprecated.ts`, `libraries.ts`, `copies.ts`, `lighthouse.ts` | Deprecated APIs in use, versions behind, copied code, Lighthouse through an HTTP/2 proxy with brotli. Each file's header says what it needs |

- **Check the machine first.** Close what else is running, keep the session unlocked and the laptop cool. `measure.ts` warns when the processors are more than 15% busy before it starts; it cannot see a processor that is throttled. On 2026-11-14 a locked, overheating laptop ran the same loop in 1.7 s, then 4.8 s, and headless Chrome drew no frames: the review's `page.evaluate` timed out and the runner printed nothing until it was killed.
- **The audits never import app code.** They read files as text and as TypeScript syntax trees (`scripts/audit/lib.ts`), so `node` runs them as they are.
- **Their data files are not formatted** (`biome.json` leaves `docs/history/part9-audit` out): each run writes them again.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Radix menus in tests:** they open on pointer events. Use real clicks (Testing Library `userEvent`, puppeteer `page.click`), not `element.click()`.
- **A developer's .env changed test results:** Vitest loads `.env`, and a PostHog key there failed the "without a key" tests locally (CI has no `.env`). `tests/setup/env.ts` sets the required values and removes the optional services' keys (PostHog, Sentry); a test that needs one uses `vi.stubEnv`.
- **Server functions run only inside the Start runtime.** Keep them as thin wrappers and test the plain functions in `src/server/**` they call.
- **Browser scripts against dev:** a devtools SSE stream stays open (wait for `load`, not network idle), clicks must wait for hydration, and layout-shift numbers aren't meaningful (no font preloads in dev). Measure CLS on a production build.
- **Component tests that load a route whose queries call server functions** (the portfolio's `_site` layout) `vi.mock` that functions module: function files import server code statically, which only Start's compiler strips from browser code (`tests/components/layout/section-headers.test.tsx`).
- **Tried for speed and rejected** (0296), so nobody tries them again without a new reason:
  - **No isolation for `server` and `components`:** in a shuffled order a file of each failed (`taskline-admin`'s invitations, `task-panel`). Only `unit` shares its modules.
  - **Chrome's headless shell** for stories and e2e: four stories failed in it, and the same review checks took 28.1 s where Chrome took 25.3 s. It saved 320 MB a worker.
  - **One browser context per e2e worker,** warming up only a URL it had not loaded: 8 of 604 review checks failed on CLS, all in Nepali, and it was no faster.
  - **Both story passes in one Vitest process:** 8.2 to 8.9 GB, with 15 MB of the machine's memory left.
  - **Collecting garbage after every story file** (`--js-flags=--expose-gc`): a pass on three pages fell from 5.4 to 4.1 GB and took 72 s in place of 48 s; two pages without it are faster in the same memory.
- **A play function that checks an overlay right after opening it** can run a frame early on a loaded machine: the element is in the document before it is shown. Wrap the visibility check in `waitFor` (`primitives.stories.tsx`'s context menu, Parda's poster preview).
- **`--grep "/admin"` in Git Bash matches nothing:** it rewrites an argument that starts with `/` into a Windows path. Write `--grep "[/]admin"`, or use PowerShell.
