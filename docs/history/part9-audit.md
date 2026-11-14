# Part 9: baseline and audit (Task 98)

Measured on 2026-11-14 at commit `c39ee78` (the Part 9 plan on top of `ac15bf9`), on the owner's Windows 11 laptop: Node 24.11, pnpm 10.33, an i5-12450HX with 12 threads, 11.7 GB of memory. Vitest ran with 4 workers and Playwright with 2, the caps this machine needs.

This is where the repository stood before Part 9 changed anything. Every later "faster", "smaller" or "fewer" is compared with a number here (PLAN 15.7). The decision is 0295.

**How to read it.** Each section gives the counts and what they mean for a Part 9 task. The full lists are the data files beside this page, in `docs/history/part9-audit/`, and every one of them is written by a script in `scripts/audit/` that can be run again:

| Data file | Written by | Needs |
| --- | --- | --- |
| `gates.json` | `node scripts/audit/measure.ts <label> -- <command>` | nothing else running |
| `times.json` | `node scripts/audit/times.ts` | the reporters' JSON from the measured runs |
| `coverage.json` | `node scripts/audit/coverage.ts` | `pnpm test:coverage` first |
| `bundle.txt` | `node scripts/check-bundle.ts --report --routes=/` (from PowerShell: Git Bash rewrites the `/`) | `pnpm build` first |
| `lighthouse.json` | `node scripts/audit/lighthouse.ts` | the e2e server on port 3100, `openssl` |
| `structure.json`, `functions.json`, `names.json`, `writes.json`, `reads.json`, `errors.json`, `code.json`, `docs.json`, `modules.json`, `old-plan.json` | `node scripts/audit/all.ts` (about a minute) | nothing |
| `copies.json` | `node scripts/audit/copies.ts` | the network (jscpd through `pnpm dlx`) |
| `deprecated.json` | `node --max-old-space-size=4096 scripts/audit/deprecated.ts` | as long as a cold typecheck |
| `libraries.json` | `node scripts/audit/libraries.ts` | the network (the npm registry) |
| `ux.json` | `node scripts/audit/ux.ts` | an audit run of the browser review (the command is in the file) |

The scripts read the source as text and as TypeScript syntax trees and import no app code. Where a count is a judgement (an effect's purpose, a write's class), the section says so.

## 1. The gates

All ten ran in full, once, and all were green.

| Gate | Wall time | Peak memory | Least free memory | What ran |
| --- | ---: | ---: | ---: | --- |
| `pnpm typecheck`, no cache | 1 min 45 s | 3,466 MB | 2,430 MB | 5,886 files |
| `pnpm typecheck`, nothing changed | 58 s | 1,873 MB | 4,155 MB | the same, from the incremental cache |
| `pnpm check` | 15 s | 299 MB | 6,078 MB | 2,396 files |
| `pnpm knip` | 7 s | 575 MB | 5,340 MB | |
| `pnpm i18n:check` | 6 s | 718 MB | 5,271 MB | 7,227 messages, two locales |
| `pnpm test` | 3 min 26 s | 4,460 MB | 1,996 MB | 207 files, 2,534 tests |
| `pnpm test:storybook`, en and light | 55 s | 7,319 MB | 39 MB | 77 files, 394 stories |
| `pnpm test:storybook`, ne and dark | 53 s | 7,247 MB | 537 MB | the same stories |
| `pnpm build` | 1 min 34 s | 4,722 MB | 2,113 MB | |
| the bundle budget | 2 s | 77 MB | 6,751 MB | 227 routes |
| `pnpm build-storybook` | 1 min 16 s | 2,923 MB | 3,797 MB | |
| the e2e server (build, database, start) | 1 min 8 s | not sampled | | |
| `pnpm test:e2e`, ten shards | 73 min 26 s | 4,567 MB | 505 MB | 3,832 tests, none failed, 1 flaky |

Everything but e2e takes 11 min 17 s; with e2e the full set is 86 minutes. Peak memory is the sum of the working sets of the command and every process it started, sampled every 1.5 s, so shared pages are counted more than once. "Least free" is the machine's free physical memory at its lowest sample.

**The ten e2e shards** (`--shard=n/10`, one after another on one server, so that each fits the tool's 10-minute limit):

| Shard | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Seconds | 631 | 343 | 436 | 458 | 442 | 467 | 385 | 442 | 365 | 437 |
| Peak MB | 3,581 | 3,248 | 4,192 | 3,820 | 3,619 | 4,567 | 3,972 | 4,336 | 3,683 | 4,098 |

Shard 1 holds every flow (they run in order inside a file) and is the only one over the 10-minute limit.

### Where the time goes

**`pnpm test`** spends 416 s inside its test files, summed over four workers. Vitest's own split of the run: tests 63%, imports 26%, transform 5%, environment 5%, setup 2%.

- `tests/server` takes 376 s, `tests/components` 34 s, `tests/unit` 6 s.
- One file, `tests/server/kharcha-access.test.ts` (100 tests), takes 173 s: 42% of the suite. `taskline-access.test.ts` takes 31 s and `chaal-access.test.ts` 11 s. The slowest tenth of the files (21 of 207) take 71% of the time.
- By layer: Kharcha 205 s, Taskline 85 s, the core 46 s, Chaal 32 s, Parda 32 s, the apps 12 s.

**`pnpm test:storybook`** is short and heavy. Each pass spends 97 s inside the stories and finishes in under a minute, but its 20 processes hold 7.3 GB at the peak, and the first pass left 39 MB of the machine's 11.7 GB free. That is why earlier runs of it were killed for memory. The time is not the problem here; the memory is.

**`pnpm test:e2e`** is the browser review, almost entirely.

- The review is 302 page entries, each in 12 variants (two themes, three widths, two locales): 3,624 checks that take 129 minutes of test time, 90% of the suite. The flows are 208 tests in 18 files and take 14.7 minutes.
- A check takes 2.1 to 2.2 s whatever the variant (2.07 s at 390 wide, 2.19 s at 1280 in Nepali). Each one loads the page twice, a warm-up and the measured load (0121), then runs axe.
- The pages differ less than the count does: the median page takes 24.6 s for its 12 variants, the slowest 30 take 1,213 s of 7,750 s. The slowest are Parda's home (57 s) and hubs (52 to 54 s), `/dev/examples/streaming` (51 s), the portfolio's project editor (47 s) and Taskline's list (43 s).
- Flows by file: Chaal 266 s, Parda 249 s, Taskline 168 s, Kharcha 78 s, account 26 s, auth 19 s.
- The flaky test: Chaal's "saves the analysis board to a study, then opens the new chapter" failed once and passed on its retry (63 s in all).

**`pnpm typecheck`** takes 58 s when nothing changed, a little over half of a run with no cache: the incremental cache (0280) saves less than its name suggests. The checker reads 282,000 lines of TypeScript and 803,000 lines of declarations, builds 1.14 million types with 7.6 million instantiations, and uses 3.3 GB of its 4 GB heap (`tsc --extendedDiagnostics`).

**The two builds** take about twice what the docs say: `pnpm build` 94 s (PLAN 15.4 said 47 s) and `pnpm build-storybook` 76 s (the testing guide says about 20 s).

### What Task 99 starts from

1. **The review's cost is its count.** 3,624 checks at 2.2 s on two workers. Memory, not processors, sets the two: a shard peaks at 3.2 to 4.6 GB.
2. **One test file is 42% of `pnpm test`.**
3. **Storybook needs 7.3 GB** for 55 s of work.
4. **A no-change typecheck takes 58 s.** TypeScript 7.0.2 is out (section 12).
5. **The builds doubled** since their times were last written down.
6. **A stuck runner never ends.** `playwright.config.ts` has no `globalTimeout`. When Chrome stopped drawing frames (below), the runner printed nothing for 16 minutes and had to be killed, leaving orphan Chromes.
7. **Nothing checks the machine before a timing run.** See the next paragraph.

### The day's first numbers were thrown away

The first measurements of the day are not in this report.

- A Windows service, `WidgetService.exe`, had been using 3 to 5 of the 12 threads since the morning (83,556 processor-seconds in seven hours). The owner let it be stopped.
- Later the session was locked and the laptop was overheating. The same fixed loop took 1.7 s, then 2.7 s, then 4.8 s in three runs one after another, a typecheck with no cache took 5 min 35 s, and headless Chrome fired no animation frame for 8 s, so the review's first `page.evaluate` timed out and the runner hung.
- After a restart the loop held at 2.0 s and the numbers above were taken.

`scripts/audit/measure.ts` now records how busy the processors were in the second before each command (`busyBeforePercent` in `gates.json`: 3% to 21% for the records above) and warns above 15%.

## 2. Coverage

`coverage.json`. `pnpm test:coverage` with four workers took 5 min 28 s, two minutes more than the suite without coverage, and 5,477 MB at its peak; the machine had 4 MB free at the lowest sample.

This is the unit project only. Pages and components are also run by Storybook and e2e, which v8 coverage does not see.

**Overall:** 57.5% of lines, 46.2% of branches, 42.2% of functions, over 1,795 files.

| Kind of code | Files | Lines | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| `src/server` | 371 | 92.2% | 78.1% | 89.6% |
| `src/lib` | 51 | 87.0% | 81.3% | 81.2% |
| `src/hooks` | 6 | 72.6% | 67.8% | 55.9% |
| `src/middleware` | 17 | 68.7% | 72.4% | 53.3% |
| `src/components` | 137 | 57.7% | 42.4% | 52.9% |
| `src/functions` (wrappers that only run inside Start) | 114 | 47.9% | 1.6% | 0.5% |
| `src/features` | 833 | 37.1% | 27.4% | 19.6% |
| `src/routes` | 261 | 29.8% | 12.6% | 23.0% |

| Layer | All its code (lines) | Its `src/server` | Its `src/features` |
| --- | ---: | ---: | ---: |
| the core | 62.6% | 86.6% | 31.2% |
| Taskline | 61.7% | 92.7% | 40.0% |
| Chaal | 57.7% | 91.3% | 46.9% |
| the portfolio | 57.4% | 87.6% | 51.3% |
| Kharcha | 57.1% | 94.3% | 26.1% |
| Parda | 53.8% | 93.3% | 25.8% |
| the apps | 48.0% | 92.4% | 30.3% |
| `/dev` | 22.3% | none | 24.5% |

**By the first plan's areas** (`scripts/coverage-report.ts`, lines, branches, functions): schemas and validation 93.8%, 83.0%, 77.0%; form fields 75.4%, 65.9%, 73.2%; guards 79.5%, 79.2%, 70.4%; email 90.1%, 72.7%, 89.4%; i18n 96.4%, 78.3%, 96.4%; env 94.6%, 76.4%, 96.2%; lists and filters 51.1%, 36.2%, 43.8%; RBAC 59.3%, 52.4%, 35.7%; attachments 93.8%, 74.2%, 90.9%; SEO 89.7%, 54.3%, 94.1%.

54 files of 20 lines or more are run by no unit test: 46 in `src/features`, 5 in `src/components`, 2 in `src/server`, 1 in `src/functions`.

**For Task 123:** the server can take a floor now (86% or more in every layer). `src/features` cannot until component tests or Storybook's runs count: 37% here says where the tests are, not that the pages are untested.

## 3. Bundle

`node scripts/check-bundle.ts` on the production build: every page loads **297.1 kB** of JavaScript (gzip, 70 files) against a budget of 300 kB. A route adds on top of that:

| Section | Routes | Heaviest (kB) | Median (kB) |
| --- | ---: | --- | ---: |
| admin | 70 | 355.3, `/admin/portfolio/projects` | 171.2 |
| Taskline | 32 | 221.5, a task's page | 55.5 |
| apps | 12 | 211.3, a form's editor | 41.3 |
| `/dev` | 31 | 207.2, `/dev/examples/fields` | 33.0 |
| Parda | 19 | 196.6, profiles | 61.1 |
| Kharcha | 16 | 192.5, Home | 50.9 |
| Chaal | 24 | 108.2, the analysis board | 41.0 |
| the portfolio | 8 | 25.7, the home | 14.5 |
| the rest (auth, account, public forms) | 15 | 151.2, `/f/$slug` | 21.0 |

- Of 227 routes, 151 add under 100 kB, 50 add 100 to 200 kB, 18 add 200 to 300 kB and 8 add more than 300 kB (budget 360 kB). The eight are admin lists and editors: they carry TanStack DB (0294).
- The entry is 2.9 kB under its budget. Every route definition is in it (0151), so every route Part 9 adds or removes moves it.
- Preloaded fonts: the two largest are Noto Sans Devanagari (118.4 kB) and Anek Devanagari's Latin width axis (111.7 kB), both under the 150 kB line.

`bundle.txt` has every route.

## 4. Lighthouse

`lighthouse.json`. Lighthouse 13.6, mobile, simulated throttling, three runs a page, through a local HTTP/2 proxy with brotli in front of the e2e server's production build, as 0245 and 0292 measured.

| Page | Performance, three runs | Median | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/` (the portfolio's home) | 94, 95, 96 | 95 | 1.14 s | 1.14 s | 266 ms | 0 |
| `/app/taskline` | 100, 100, 100 | 100 | 1.13 s | 1.13 s | 77 ms | 0 |
| `/app/parda` | 73, 78, 78 | 78 | 1.23 s | 3.85 s | 427 ms | 0 |
| `/app/chaal` | 99, 99, 99 | 99 | 1.11 s | 1.11 s | 122 ms | 0 |
| `/app/kharcha` | 99, 99, 99 | 99 | 1.09 s | 1.09 s | 110 ms | 0 |

Accessibility, best practices and SEO are 100 on all five.

**For Task 124:** Parda's home is the outlier, with its largest paint at 3.85 s and 427 ms of blocking time. The portfolio's home sits at the plan's line of 95.

## 5. Structure and names against 15.5

`structure.json`, `names.json`.

- **Feature folders:** 9 of 129 have the standard's shape (the core 5 of 9, the portfolio 2 of 2, the apps 1 of 7, Kharcha 1 of 23, and none of Taskline's 31, Chaal's 31 or Parda's 24). The products have no `components/` folder: 355 of their `.tsx` files sit beside the data files (Taskline 107, Chaal 93, Kharcha 81, Parda 74). 183 `.ts` files in feature folders have a name outside the standard's list; the commonest are `load.ts` (8), `brand.ts`, `limits.ts` (4 each), `collections.ts`, `head.ts`, `uploads.ts` (3 each).
- **File names:** one file is not kebab-case, `src/lib/env/client.schema.ts`.
- **Component roles:** 176 of 467 feature components end in a role from the list (page 86, dialog 32, list 21, form 15, field 6, menu 6, panel 5, sheet 3, card 1, detail 1). The other 291 end in 160 different words: section 18, settings 12, filters 9, dialogs 8, columns 7, home 7, frame 6, layout 6, banner 5, board 5, button 5.
- **Hooks:** 84 exported hooks, 45 in a `use-<thing>` file and 39 in a file with another name.
- **Exports:** `keys.ts` exports `…Keys` in 21 of 23 cases. `queries.ts` exports 218 `…Options` functions, 19 `…Mutations` objects and 13 `…Keys`. `schema.ts` exports 258 names ending in `Input` and 65 ending in `Schema`. Collections: 11 `collection.ts` and 3 `collections.ts`, exporting 24 `…Rows` and 5 `…Collection`.
- **Server folders:** 94 folders. 31 hold `repository.ts` and `service.ts`, 26 hold `service.ts` alone, and 11 files are named `<thing>-repository.ts` or `<thing>-service.ts` (the portfolio).
- **Tables:** 123. The products' carry their prefix (`tl_` 27, `pd_` 26, `kh_` 30, `ch_` 13) and the portfolio's 8 carry `portfolio_`. The core's 12 have none or their own word, and the apps' 7 have none or `form_`, `habit_`, `link_`. Columns come from `casing: "snake_case"`; the 53 named by hand are snake_case.
- **Migrations:** 59, all `NNNN_<words>.sql`. 39 start with a product's name; the others start with `drop`, `auth`, `expenses`, `rbac`, `test` and eight more words.
- **Messages:** 7,227, all snake_case, 6,794 with three parts or more, under 87 first words. Chaal and Parda abbreviate theirs (`ch_` 1,378, `pd_` 856); Taskline and Kharcha spell theirs (`taskline_` 1,609, `kharcha_` 1,045).
- **Permissions:** 36 in the catalog over 14 resources, all `<resource>:<action>`.
- **Tests:** 207 files: `tests/server` 89, `tests/unit` 80, `tests/components` 34, `tests/i18n` 3, `tests/email` 1. 158 are named after a feature, a module or a core library and 49 are not.

**For Task 100 and 101:** the folder shape is the one large move (355 components, four products). The role list and the schema suffix are cheaper to change in the standard than in the code; PLAN 15.5 now says so.

## 6. Server functions

`functions.json` lists all 582 (in 113 files): 235 `GET` and 347 `POST`. Taskline 150, Kharcha 97, Chaal 96, Parda 88, the portfolio 50, the core 42, the apps 40, `/dev` 19.

- **The chain is uniform.** Every one is a literal `createServerFn(…)`. 559 run `require…` then `with…`; 20 use a guard with another name (`devOnlyMiddleware` 19, `sessionMiddleware` 1); 3 have no guard and need none (`getAuthFeatures`, `getHomeFlags`, `getDbHealth`).
- **Guard names** follow the pattern but not one vocabulary: `requirePardaViewer` (35) where the others say `…User`, `requireAppUser` and `withAppServices` (32), `withPardaCatalog` (19) and `withPublicServices` (15) beside `withChaalPublic` (34), and four names ending in `Middleware` (9 uses).
- **Validators:** 479 use `zodInput`. 103 have none; 86 of those are `GET`s with no input, and 17 are `POST`s (Chaal 4, `/dev` 4, Taskline 3, the apps 2, Parda 2, the core 1, Kharcha 1).
- **Handlers:** 533 are one call into a service; 49 have statements of their own.
- **Verbs:** 454 standard, 24 folded by 15.5 (`save` 13, `mark` 6, `toggle` 2, `find`, `locate`, `patch`), and 104 domain verbs in 66 words. The commonest: `confirm`, `discard`, `join`, `revoke`, `sign`, `submit` (4 each), `invite`, `leave`, `preview`, `start` (3 each).

**For Task 100:** the chain needs no work. The 24 folded verbs and the guard vocabulary are renames; the 17 `POST`s without a validator and the 49 block handlers are each a look.

## 7. Writes

`writes.json` lists 222 call sites in 122 files: 151 `useMutation` and 71 `useCrudMutation`, over 168 mutations defined with `mutationOptions`. 17 more writes go straight through a TanStack DB collection (Taskline 8, the apps 6, the core 2, `/dev` 1).

| Layer | Optimistic today | Call sites |
| --- | ---: | ---: |
| Taskline | 8 | 95 |
| Kharcha | 1 | 45 |
| Chaal | 3 | 20 |
| the apps | 4 | 17 |
| Parda | 6 | 13 |
| the core | 6 | 12 |
| the portfolio | 8 | 10 |
| `/dev` | 0 | 10 |

- By hook: 30 of 71 `useCrudMutation` calls pass `optimistic`; 6 of 151 `useMutation` calls have `onMutate`.
- **The 15.6 class of each call site**, guessed from the names in the mutation: 184 can be optimistic, 24 are irreversible or leave the app, 11 change access, 3 are credentials. (Sign-in and sign-up forms call Better Auth's client without a mutation hook, so they are not in the 222.)
- **Of the 184, 26 are optimistic today and 158 are not:** Taskline 81, Kharcha 39, the apps 13, `/dev` 9, Parda 6, Chaal 5, the core 3, the portfolio 2.

**For Task 105 and the layer tasks:** 158 call sites is the work, three quarters of it in Taskline and Kharcha. The class is a first guess; Task 105 decides each.

## 8. Reads

`reads.json`.

- **Hooks:** 197 `useQuery`, 180 `useSuspenseQuery`, 2 `useLiveQuery`.
- **`useQuery` by layer:** Chaal 107, Kharcha 27, Parda 27, Taskline 17, the core 12, the apps 4, `/dev` 2, the portfolio 1.
- **The reason the code gives:** 60 have `enabled` (asked for after an interaction), 2 have a comment, and 135 give none (Chaal 76, Kharcha 19, Parda 17, Taskline 11, the core 7). None uses `refetchInterval`; live data comes through streams.
- **Routes:** 257 page and layout files. 181 have a loader, 70 a search schema, 219 a `head`, 24 a pending, error or not-found component of their own. Loaders call `ensureQuery` (112 files), `listLoader` (16) and `loadList` (6).
- **23 routes have no loader while their page component reads data.** Eleven are Taskline's project pages (the board, backlog, calendar, timeline, milestones and four settings pages), where the project layout's loader has already loaded it; the rest are "new" forms in the admin, three `/dev` pages and two layouts. Section 15 has the browser's answer.
- **37 route files import a feature's `queries`, `schema` or `collection` statically,** which 0194 keeps for a loader's `await import`. Most import `@/features/auth/queries`.
- **Lists:** 64 `list…` functions. 16 take the list contract's input (`listSchema`), 5 page in their own way, 12 take an input with no paging, 31 take no input. 18 components call `useListPage`, 23 render `<CrudListPage>`, and 12 of the 14 that render `<DataTable>` do so without either.

**For Task 106:** 135 `useQuery` calls need a reason or a loader, more than half of them in Chaal. The cursor contract does not exist yet as a schema.

## 9. Errors

`errors.json`, for `src/server`, `src/functions` and `src/middleware`.

- **666 throws:** 528 are an `AppError` (the class, or one of the helpers that build it: `notFound`, `ruleError`, `fieldError`, `quotaError`, `forbidden`, `conflict` and others), 43 rethrow what was caught, **63 are a bare `Error`** (Taskline 32, the core 10, Kharcha 8, the apps 6, Parda 4, `/dev` 2, the portfolio 1), 17 are a class of their own (`APIError` 5, `VaultError` 5, `EmailConfigError` 3, `AttachmentLinkError` 2, two more), 5 are helpers that build something else, and 10 are other expressions.
- **174 catches:** 77 rethrow or map the error, 48 log and go on, and **49 go on in silence**, 7 of them with a comment that says why. Of the 42 without one, 30 are Chaal's: 13 in `lichess/schemas.ts`, 4 in `lichess/client.ts`, 4 in `stream.ts`.
- **20 server routes** (16 Nitro routes and 4 under `src/routes/api`, 675 lines). 16 build their own `Response`, 8 define their own `json()`, 6 their own secret check with `timingSafeEqual`, 3 their own method check, 8 call `log()`, and 1 has a `try`.

**For Task 103:** `defineApiRoute` and `defineCron` replace eight `json()` helpers and six secret checks. The 63 bare errors are each a choice between a refusal (an `AppError`) and a broken invariant.

## 10. Effects, casts, suppressions, default exports, timers and key handlers

`code.json`.

- **Effects:** 118 in 77 files (Chaal 50, the core 27, Parda 25, Kharcha 8, Taskline 4). By what the body does: a timer 24, copying props or state into state 23, keeping a ref current 11, a DOM listener 9, driving a library object 5, **fetching or writing 5** (four in Chaal, one in Taskline's `freshness.ts`), focus or scroll 4, the document 3, key presses 2, navigating 2, a subscription 2, an observer 1, and 27 the patterns don't name.
- **Casts:** 19 `as unknown as` in 9 files (Kharcha 12, the core 5, Chaal 1, Parda 1). No `as any` and no non-null assertion.
- **Suppressions:** 67 `biome-ignore`, every one with a reason but one: `noArrayIndexKey` 30, `useExhaustiveDependencies` 10, `noNoninteractiveTabindex` 7, `noDocumentCookie` 7, `useSemanticElements` 5. No `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`.
- **Default exports:** 129. 94 are asked for by a tool (stories, Nitro routes and plugins); 35 are components loaded with `React.lazy`.
- **Timers:** 31 `setTimeout` and 18 `setInterval` (Chaal 22, Parda 12, the core 9), and 8 calls of `useDebouncedValue`.
- **Keys:** 13 `useHotkeys` calls, 26 `onKeyDown` props and 2 `keydown` listeners (Taskline 11, the core 6, Kharcha 5, Chaal 3).
- **Memoization:** 4 `useMemo`, no `useCallback` (0136 holds).
- **`console`:** 1 call in `src/server` (the console email provider) and 4 elsewhere in `src`.

**For Task 102 and 107:** 49 timers and 41 key handlers are what Pacer and Hotkeys are measured against. The 23 effects that copy state are the ones to read first.

## 11. Copies

`copies.json`. jscpd read 2,261 files and 239,327 lines (no stories, generated code or shadcn files). A copy is 12 lines and 90 tokens or more that match exactly.

- **46 copies, 1,032 lines, 0.43% of the code.** Exact copies are rare.
- **26 cross two layers** (634 lines):
  - Kharcha and Taskline 11 (283 lines): the two shells four times, Spend and Taskline's list twice, the sign-in pages, the expense and task panels, `rev.ts`;
  - the core and Taskline 5 (137 lines): the command menu, the user menu, the login page;
  - Parda and Taskline 4, Chaal and Taskline 2, Chaal and Kharcha 2, Chaal and Parda 1, the apps and Kharcha 1;
  - five of the 26 are the six cron routes copying one another.
- **20 are inside one layer:** the apps 6, Chaal 4, Taskline 4, the core 3, Parda 2, Kharcha 1.

Exact matching cannot see the same pattern written again under other names, which is how the four products repeat each other. A second list in `copies.json` finds that by path: **27 files exist under the same path in three or four products.**

- In `src/features/<product>`: the sign-in and sign-up pages, the user menu, the section wrapper, `brand.ts`, `links.ts`, `queries.ts`, `search.ts` (all four); the palette, the shortcuts dialog, the mark, the home page, `schema.ts`, `lib/fonts.ts` (three).
- In its `admin/`: the overview page, the settings page, `queries.ts`, `schema.ts`, `collection.ts` (all four); `search.ts`, `labels.ts` (three).
- In `src/server/<product>`: `cron.ts`, `manifest.ts`, `admin/overview.ts`, `admin/settings.ts` (all four); `activity.ts`, `guest-data.ts` (three).

**For Task 108:** the 27 paths are the list of shared patterns, not the 46 copies.

## 12. Libraries

`libraries.json` has all 109 dependencies (64 runtime, 45 dev): 45 are at the registry's latest, 27 a patch behind, 30 a minor version behind and 7 a major version behind. None is marked deprecated by the registry.

**A major version behind:** TypeScript 6.0.3 (7.0.2), `@tanstack/react-db` 0.5.4 (1.0.0-rc.1.5), `@inlang/paraglide-js` 2.25.4 (3.2.2), `lucide-react` 0.577.0 (1.73.0), `@babel/core` 7.29.7 (8.1.2), `jsdom` 30.1.1 (31.0.1), `@types/node` 22.20.4 (26.6.6; the runtime is Node 24).

| Library | Installed | Latest | Imported by |
| --- | --- | --- | ---: |
| TanStack Start | 1.168.59 | 1.169.5 | 144 files |
| TanStack Router | 1.170.40 | 1.170.46 | 545 |
| TanStack Query | 5.104.5 | 5.107.1 | 317 |
| TanStack DB | 0.5.4 | 1.0.0-rc.1.5 | 16 |
| TanStack Form | 1.33.5 | current | 66 |
| TanStack Store | 0.11.2 | current | 2 |
| TanStack Table | 9.3.1 | current | 1 |
| Better Auth | 1.7.6 | 1.7.23 | 6 |
| Drizzle ORM, Drizzle Kit | 0.45.3, 0.31.11 | 0.45.4, current | 211 |
| Paraglide | 2.25.4 | 3.2.2 | generated code |
| Tailwind | 4.3.3 | 4.3.5 | CSS |
| Radix UI (shadcn's files are vendored in `src/components/ui`) | 1.6.7 | 1.8.1 | 29 |
| Sentry | 11.4.0 | 11.12.0 | 7 |
| PostHog (browser, Node) | 1.437.0, 5.55.0 | 1.449.2, 5.73.1 | 1, 1 |
| Ably | 2.30.0 | current | 1 |
| Cloudinary | no SDK: signed uploads through `fetch` | | |
| Resend | 6.30.0 | 6.38.1 | 1 |
| Nitro | 3.0.261029-rc | 3.0.261103-rc | 17 |
| Vite | 8.3.1 | 8.3.8 | config |
| The React Compiler | 1.0.0 | current | config |
| React | 19.3.0 | 19.3.1 | 411 |
| Zod | 4.6.5 | 4.6.7 | 166 |
| Vitest | 5.0.3 | 5.1.0 | tests |
| Storybook | 10.6.1 | 10.6.7 | 72 |
| Playwright | 1.64.0 | 1.65.1 | e2e |
| Biome | 2.4.5 | 2.6.7 | config |
| Knip | 6.42.0 | 6.45.1 | config |

**Deprecated APIs in use.** `deprecated.json`: TypeScript's language service, over 2,201 files, reports 138 uses in 61 files of something its declarations mark `@deprecated`.

- React's `FormEvent` type: 77 uses in 34 files.
- TanStack Store's `useStore`: 51 uses in 18 files.
- Zod's `.finite()`: 4 (a Zod 4 number is finite already).
- Recharts' `Cell` (2) and `verticalAlign` (1, in the vendored chart file).
- One each: posthog-node's `getFeatureFlag` signature, Vitest's `toThrowError`, the DOM's `BeforeUnloadEvent.returnValue`.

Nothing deprecated from Start, Router, Query, DB, Form, Table, Better Auth, Drizzle, Sentry or Storybook is in use.

**Read against the current docs** (context7, 2026-11-14), for the libraries Part 9 adopts or upgrades first:

- **TanStack Start:** a server function is `createServerFn({ method }).middleware([…]).validator(…).handler(…)`. `.validator()` is the stable name (the release candidates called it `.inputValidator()`). Our 582 functions match.
- **TanStack DB 1.0 RC:** `useLiveQuery` takes a config object and no dependency array, and `transaction.isPersisted.promise` becomes `transaction.when("settled")`. Five call sites use `isPersisted.promise` (Notes 3, Habits 1, a `/dev` example 1); 0.5.4 does not mark it deprecated yet, so the scan above does not list it. Task 102 upgrades before Task 105 builds on it.
- **TanStack Pacer:** the React package has hooks for debounced values and callbacks, throttling, queues with concurrency and batching. Its rate limiter is in memory and its docs say it is not a distributed quota: it does not replace `src/server/http/rate-limit.ts`.
- **TanStack Hotkeys:** `useHotkey(hotkey, handler, { meta: { name, description, group }, ignoreInputs, scope, enabled })`, `useHotkeyRegistrations()` for the list and `formatForDisplay` for the label. That is what 15.5 asks for ("registered with a name so the shortcuts dialog lists it").

**Not done here:** the other libraries were checked by version and by the deprecated-API scan, not line by line against their docs. 15.7 already makes each task read the docs of what it touches.

## 13. Package verdicts

`modules.json` lists the 89 shared hand-written modules (7,979 lines) with their size and importers. The verdicts, by the owner's rule (a maintained package replaces hand-written code where it is equal or better):

| Hand-written | Size and use | Package | Verdict |
| --- | --- | --- | --- |
| `src/hooks/use-hotkeys.ts` | 97 lines, 13 calls; 26 `onKeyDown` props and 2 listeners beside it | `@tanstack/react-hotkeys` 0.25 | **Replace.** Names, scopes, input rules and the shortcuts list come with it |
| `src/hooks/use-debounced-value.ts` and the timers in `filter-bar.tsx`, `async-combobox-field.tsx`, `slug-field.tsx`, `async-validators.ts` | 11 lines, 8 calls, plus 4 files | `@tanstack/react-pacer` 0.24 | **Replace** |
| One write at a time per row (new in Task 105) | none yet | Pacer's queue | **Use the package** from the start |
| Chaal's request lanes, `src/server/chaal/lichess/lanes.ts` | 47 lines | Pacer's async queue with a concurrency of 1 | **Replace the queue, keep the cooldown** (`cooldown.ts`, 67 lines: the shared 429 rule is Lichess's, not a queue's), if Task 102's tests show the same order |
| `src/server/http/rate-limit.ts` | 62 lines, 17 importers | Pacer's rate limiter | **Keep.** Ours counts in Postgres so every server instance shares the window; Pacer's is in memory and says it is not for enforcement |
| `src/server/cache/lru.ts` | 76 lines, 2 users (TMDB, Lichess) | `lru-cache` | **Replace**, if its `fetch` gives the same three things: a TTL, stale-while-revalidate and one call for concurrent readers. Otherwise keep |
| `src/lib/fractional-index.ts` | 177 lines, 15 importers | `fractional-indexing` (the same algorithm, by the same authors our file names) | **Replace**, with a test that the package orders the keys already stored exactly as ours does |
| `src/lib/csv.ts` | 143 lines, 16 importers | Papa Parse | **Keep the writer** (the formula-injection guard is ours). **Keep the parser** unless Task 123's property tests find a case it gets wrong: it is 50 lines and the package is 7 kB on two import pages |
| `src/lib/i18n/intl.ts`, `date-only.ts`, `currency.ts` | 533 lines, used everywhere | date and money libraries | **Keep.** They wrap `Intl` for two locales with Nepali digits; no package does both |
| `src/lib/validation.ts`, `slug.ts`, `phone.ts`, `concurrency.ts`, `safe-html.ts` | thin, over Zod and libphonenumber-js | none | **Keep** |
| `src/hooks/use-media-query.ts`, `use-minute-clock.ts` | 22 lines each | hook collections | **Keep.** Each carries a rule of ours (no layout from JavaScript after hydration) |

## 14. The old plan, deliverable by deliverable

Each deliverable of PLAN sections 4 to 10 (Parts 1 to 4), where its code is today, and what the audits count inside it. `old-plan.json` has the same table; every number is one of the other audits', counted for the deliverable's paths.

| Part | Tasks | Deliverable | Files | Lines | Unit coverage | Counted against the standard | Closed by |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | 1 | Scaffold and tooling | 56 | 6688 | 0% | nothing | 99, 100, 103 |
| 1 | 2 | Environment validation | 4 | 332 | 94.6% | bare errors 1 | 103 |
| 1 | 3 | Database | 61 | 4832 | 68.6% | files with timers 1 | 104 |
| 1 | 4 | Internationalisation | 6 | 723 | 97.4% | nothing | 100, 110 |
| 1 | 5 | Router, SSR and server functions | 28 | 1323 | 70.4% | routes reading with no loader 1, silent catches 1 | 103, 106 |
| 1 | 6 | Email | 13 | 1217 | 90.1% | bare errors 1 | 103, 110 |
| 1 | 7 | Authentication | 40 | 3014 | 22.8% | POST without a validator 1, routes reading with no loader 1, effects 1 | 103, 110 |
| 1 | 8–9 | Form system | 28 | 4042 | 75.4% | effects 8, double casts 2, files with key handlers 3 | 107 |
| 1 | 10 | State and reactive data | 15 | 1024 | 82.2% | useQuery with no reason 1, effects 2, double casts 2, files with timers 2, files with key handlers 1 | 105, 106 |
| 1 | 11–12 | Test CRUD | 26 | 1701 | 57.9% | routes reading with no loader 1 | 110 |
| 1 | 13 | Observability | 9 | 432 | 57.1% | bare errors 1, silent catches 2 | 103 |
| 1 | 14–15 | Storybook and tests | 112 | 6554 | – | nothing | 99, 123 |
| 2 | 18 | Page building blocks | 42 | 2807 | 46.7% | useQuery with no reason 1, effects 7, files with timers 2 | 107 |
| 2 | 19 | Filters, search params, tables | 11 | 1531 | 45.2% | effects 4, files with timers 1, files with key handlers 1 | 106 |
| 2 | 20 | RBAC | 23 | 2081 | 58.4% | loose components 1, useQuery with no reason 2, bare errors 2 | 110 |
| 2 | 21 | Attachments | 11 | 1144 | 92.5% | bare errors 4, silent catches 1, effects 2 | 110 |
| 2 | 22 | SEO | 8 | 370 | 87.1% | double casts 1 | 106, 110 |
| 2 | 23 | Module examples and /dev | 47 | 4100 | 21.9% | loose components 4, POST without a validator 4, writes to make optimistic 9, useQuery with no reason 2, routes reading with no loader 3, bare errors 2, effects 2, files with timers 4 | 109 |
| 3 | 28 | Server routes, health, request tracing | 26 | 1072 | 40.5% | silent catches 4 | 103 |
| 3 | 29–30 | Account, audit log, admin users | 25 | 2123 | 58.1% | routes reading with no loader 1 | 110 |
| 4 | 36–37 | Shells and the admin kit | 9 | 797 | 87.5% | useQuery with no reason 2, effects 2 | 107 |
| 4 | 38 | The CRUD standard | 6 | 650 | 1.9% | writes to make optimistic 2 | 100, 105 |
| 4 | 39–40 | Portfolio and media | 177 | 13760 | 55.4% | writes to make optimistic 3, useQuery with no reason 2, routes reading with no loader 2, bare errors 1, effects 2, files with timers 1, files with key handlers 1 | 120–122 |
| 4 | 41–44 | Apps platform, Notes, Links, Habits, Forms | 101 | 9144 | 47% | loose components 1, folded verbs 1, POST without a validator 2, writes to make optimistic 13, useQuery with no reason 2, bare errors 6, silent catches 1, files with key handlers 1 | 111 |

Read with these: the table counts what the scripts can see. Three gaps are not counts.

- **Parts 1 to 4 were built before the standard existed,** so their gap is mostly shape, not defects: the kit's pages are centred columns (section 15), the admin's lists write through one hook and everything else through another (section 7), and the server routes each do their own plumbing (section 9).
- **The portfolio (Tasks 39 and 40)** is the largest old deliverable (177 files) and is replaced, not brought up to the standard, by Tasks 120 to 122.
- **Kanban and Expenses (Tasks 41 and 43)** are gone: they became Taskline and Kharcha, and their redirect routes go in Task 111.

## 15. UX: widths, anatomy, the first load

`ux.json`. The browser review ran once more over all 302 page entries, in English and the light theme, at 1280 and at 1920 wide (1920 is not a reviewed width). All 604 checks passed: no page overflows, shifts or fails axe at 1920. For each page it saved a screenshot of the first screen and measured the layout.

The 604 screenshots are in `.data/audit/ux/screens/1280` and `/1920` on the owner's machine (34 MB, not committed). The command in `scripts/audit/ux.ts` makes them again.

**Empty side space.** At 1920, how much of the width beside the sidebar does the first screen's content span?

| Section | Pages | Median share used | Pages under 75% |
| --- | ---: | ---: | ---: |
| admin | 71 | 97% | 17 |
| Kharcha | 32 | 97% | 6 |
| Parda | 34 | 97% | 9 |
| the portfolio and public pages | 13 | 80% | 6 |
| Taskline | 46 | 67% | 41 |
| the apps | 15 | 58% | 15 |
| `/dev` | 28 | 52% | 28 |
| Chaal | 57 | 50% | 51 |
| account and auth | 6 | 20% | 6 |

- 179 of 302 pages use under three quarters of the width.
- **Chaal** (51 of 57) and **the apps** (all 15) are centred columns (`max-w-7xl` and `max-w-6xl`). **Taskline** (41 of 46) fills the width only on its board and timeline.
- **The admin** is fluid except its forms: 11 "new" and edit pages, two settings pages and one report use 46% to 67%, and three forbidden pages show a small centred message.
- Kharcha's and Parda's short lists are sign-in, sign-up, account, profiles and about pages, where a narrow column is the design.

**Anatomy.** Every page has exactly one `<main>` and one `<h1>`. Of the 140 pages with a sidebar, 113 show breadcrumbs and 27 do not: all 27 are Kharcha's, whose rail replaces them.

**The first load asks for more.** On 79 of 302 pages the browser called a server function while the page loaded:

| Function | Pages | What it is |
| --- | ---: | --- |
| `getTasklineUnread` | 43 | the shell's unread count, asked again on mount |
| `getTasklineProjectRev` | 30 | a project's freshness poll, first tick on mount |
| `getKharchaRev` | 27 | Kharcha's freshness poll, first tick on mount |
| `listTasklineSavedViews` | 6 | data the loader does not load |
| `getChaalExplorer` | 3 | the analysis board's opening explorer |
| `getUploadSettings`, `getTasklineUploadSettings`, `getNoteUploadSettings` | 4 | upload limits for a form's file field |
| `listKharchaFriends` | 1 | data the loader does not load |
| three `POST`s on Parda's watch and party pages (4 calls) | 3 | progress and presence |

So 100 of the 118 calls are polls that fire once at mount with the answer the server render already had, and 14 are data a loader should have loaded. Taskline is on 43 pages of the 79 and Kharcha on 27.

**Missing states.** No page was found without a state here: the review visits the not-found and forbidden pages, and the router's defaults (`ErrorPage`, `NotFoundPage`, `PendingPage`) cover every route, 24 of which add one of their own. Empty and loading states inside a page are not something this run can see; the UX passes (Tasks 111 to 119) look at them page by page.

**For Task 106 and 107:** the freshness polls need a first tick that waits (three functions, 100 calls). Full width is a kit change for the admin's forms and a frame change for Chaal, the apps and Taskline.

## 16. Stale docs

`docs.json`. The guides are in better shape than their size suggests: of 683 paths in backticks across CLAUDE.md, README.md and the 25 guides, none is missing, every `pnpm` command they name exists, every decision they cite has an entry, and CLAUDE.md lists every guide.

What was stale, and fixed in this task:

- **The decisions index** said "241 entries" and listed 293.
- **`docs/guides/testing.md`** said `pnpm test:e2e` takes "about 6 minutes" (73 minutes here) and that the Storybook build takes "about 20 s" (76 s).
- **PLAN 15.4** carried gate times from 0292 and earlier, and counts taken by hand. Section 17 lists the corrections.

Found and left:

- **Decision 0167 does not exist** (0166 is followed by 0168). Records keep their numbers.
- **The four product guides are long:** Chaal 535 lines, Parda 396, Taskline 313, Kharcha 289. Task 109's Learn page and the layer tasks decide what moves.

## 17. Corrections to PLAN 15.4 and 15.5

- **15.4, size:** 582 server functions in 113 files (it said 592 in 121), 7,227 messages, 302 reviewed page entries (it said 104 pages).
- **15.4, gate times:** replaced with section 1's.
- **15.4, write paths:** 71 `useCrudMutation` and 151 `useMutation` calls in 122 files (it said 73 in 45 and 152 in 80).
- **15.4, read paths:** 197 `useQuery` (it said 198).
- **15.4, hand-written code:** `use-hotkeys.ts` is 97 lines with 13 call sites (it said 98 and 11), and there are 2 raw key listeners (it said 3).
- **15.5:** a new paragraph, "Checked against the code", lists where the standard as written disagrees with the counts, for Task 100 to settle.

## 18. Left for the owner

- **The screenshots are not in the repository.** 604 pictures, 34 MB, in `.data/audit/ux/screens` on this machine. Say if the UX passes should have them committed or kept elsewhere.
- **The laptop.** A Windows service ran away for seven hours, and the machine overheated and throttled once it was locked under load. A timing run needs it unlocked, cool and idle. `measure.ts` warns about a busy processor; it cannot see a throttled one.
- **Parda's home scores 78** on Lighthouse (section 4).
- **One flaky flow:** Chaal's "saves the analysis board to a study" (section 1).
- **Library docs:** four libraries were read against their current docs, the rest by version and by the deprecated-API scan (section 12).
- **The write classes in section 7 are guesses** from names. Task 105 decides each one.
