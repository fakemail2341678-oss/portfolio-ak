# Starting a new project from the template

From a fresh clone to your own app with its first feature, every gate green. Decisions 0175 and 0163.

## 1. Clone and install

- [ ] Clone to a short path (Windows: about 90 characters at most, 0029), then `pnpm install` (Node ≥ 22.18; `.nvmrc` says 24).
- [ ] `pnpm setup:local` (0156): creates `.env` from `.env.example` with a generated `BETTER_AUTH_SECRET`, compiles the messages and creates a local database in `.data/pglite` with an admin and demo data. Then `pnpm dev:local` runs the app on it, with no Neon project needed yet.
- [ ] In `.env`, set `VITE_APP_TITLE` and `VITE_SITE_URL`, and `DATABASE_URL` once you have a Neon branch (or any Postgres) for `pnpm dev` and deploys (README, "Environment variables"). Leave Sentry, PostHog, Cloudinary, Turnstile and Google empty until you need them.
- [ ] `pnpm diagnose` whenever something doesn't start: it checks Node, `.env`, the database and its migrations, and ports, and prints the fix.

## 2. Remove what you don't need

- [ ] `pnpm strip-demo` removes the template's removable **layers**, each whole:
  - **portfolio:** the portfolio at `/` (routes, data, styles, fonts, messages, sitemap entries, tests and its guide). A neutral landing page takes its place (`src/routes/_public/index.tsx`, from `scripts/templates/landing`).
  - **apps:** the showcase apps under `/apps` (from Task 41 on).
  - **taskline:** Taskline, the project management app at `/app/taskline` (Part 5, from Task 46; [taskline.md](taskline.md)). <!-- @taskline -->
  - **parda:** Parda, the movie and series product at `/app/parda` (Part 6, from Task 59; [parda.md](parda.md)). <!-- @parda -->
  - **chaal:** Chaal, the chess app on Lichess at `/app/chaal` (Part 7, from Task 71; [chaal.md](chaal.md)). <!-- @chaal -->
  - **kharcha:** Kharcha, the expense tracker and bill splitter at `/app/kharcha` (Part 8, from Task 86; [kharcha.md](kharcha.md)). <!-- @kharcha -->

  Keep one with `--keep-portfolio`, `--keep-apps`, `--keep-taskline`, `--keep-parda`, `--keep-chaal` or `--keep-kharcha`. The **core** always stays: auth, admin, RBAC, audit, attachments, i18n, SEO, **Test CRUD** and everything under **`/dev`** (the demo home, `/dev/stack`, the public Test CRUD pages and `/dev/examples`: references to copy, which exist only in development). It removes dependencies nothing imports any more (knip), turns dropped tables into a migration, ends with a build (which regenerates `src/routeTree.gen.ts`; `--no-build` skips it), and deletes itself, with CI's template job, once no layer is left.
- [ ] Commit the result on its own, so the removal is one reviewable change.

How it works: each layer's files, package scripts, crons, knip entries and tables are lists at the top of `scripts/strip-demo.ts`. Its code in shared files sits between `portfolio:start` / `portfolio:end` (or `apps:…`) comment lines, or on lines ending in `// @portfolio` (an HTML comment in Markdown); `scripts/lib/strip-markers.ts` has the rules and `tests/unit/strip-markers.test.ts` checks they balance. Messages nothing uses any more are dropped by the same rule as `tests/i18n/message-usage.test.ts`. A layer's piece you add to a shared file needs a marker, or strip-demo leaves it behind.

**Shared helpers stay out of a layer's markers:** code two layers use (Taskline and the apps both use `todayInZone`, `addDays`, the CSV picker) is core, unmarked, or `strip-demo --keep-<layer>` removes what the kept layer imports (0215).

## 3. Make it yours

- [ ] **Name:** `name` in `package.json`, the README title and intro, `VITE_APP_TITLE`, `site_description` and the landing page's `landing_*` messages in `messages/en.json` and `messages/ne.json`, and the landing page itself.
- [ ] **Icons and social image:** replace the files in `public/` (same names and sizes: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `og-default.png`). The manifest reads the app title from env.
- [ ] **Theme:** follow [design-system.md](design-system.md), "Theming a new project": pick the default accent, radius and density, or change the Graphite tokens in `src/styles/app.css`, run `tests/unit/design-tokens.test.ts`, and match `THEME_COLORS` in `src/routes/__root.tsx` to `--background`.
- [ ] **Uploads folder:** `CLOUDINARY_FOLDER` (it defaults to `portfolio`).
- [ ] **CLAUDE.md:** the first paragraph ("What this is") and the plan status line describe the template; rewrite them for your app. Keep the golden rules and pitfalls.
- [ ] **License:** `LICENSE` and the README's license section.

## 4. Database and first admin

- [ ] `pnpm db:migrate`, then `pnpm db:seed-admin --email you@example.com --password "…" --name "You"`.
- [ ] Optional: `pnpm db:seed-demo` for roles, users and 30 Test CRUD items to click through.

## 5. Your first feature

- [ ] `pnpm new:feature <name>` (kebab-case, e.g. `projects`), with `--title "Projects"` and `--title-ne "परियोजनाहरू"` for the section's names. Without `--title-ne` the Nepali name is the English one plus "(अनुवाद गर्नुहोस्)" ("translate"), so it can't ship unnoticed.
- [ ] Add `--public` for public list and detail pages (a slug and a "published" switch, `seo()`/`listSeo()`, the sitemap) and `--localized` for a title and notes typed in both languages. Commit first: it refuses uncommitted changes, and puts the tree back if it fails.
- [ ] It generates a feature in the CRUD standard's shape ([crud.md](crud.md)): table and migration, URL contract, schemas and DTOs, keys, queries and mutations, columns, filters, a palette command, list, form, detail and pending components, guarded server functions on `withServices` and their guarded-functions entry, repository and service with audited creates, edits and deletes and a PGlite test, permissions (`<name>:read|create|update|delete`, with labels), thin routes, messages in both languages, an `ADMIN_SECTIONS` entry (sidebar, command palette), stories with their server-function mocks, and the browser-review entries. It runs the migration generator, Biome and a build.
- [ ] `pnpm db:migrate`, then grant the new permissions to roles in `/admin/roles/permissions` (admins hold them already).
- [ ] Add your columns: the table (`src/server/db/schema/<name>.ts`, then `pnpm db:generate`), the input schema and DTOs, the repository's mapping, the form fields, the columns and their messages. The edit page (`/admin/<name>/$id`) is listed in `NOT_REVIEWED` until a seeded row exists; seed one and review it like `/admin/test-crud/$id`.
- [ ] Filters beyond search (a param in `listSchema`, a control, a chip spec), optimistic edits (`useCrudMutation`'s `optimistic`), attachments: copy them from Test CRUD ([crud.md](crud.md)).

## 6. Gates

- [ ] `pnpm typecheck && pnpm check && pnpm knip && pnpm test && pnpm test:storybook && pnpm test:e2e && pnpm build && pnpm build-storybook`. CI runs the same on every PR.
- [ ] Deploy: [deployment.md](deployment.md).
