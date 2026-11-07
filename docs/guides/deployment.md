# Deployment (Vercel + Neon)

`pnpm build` produces Vercel output through Nitro (`vercel.json`: framework `tanstack-start`). The server validates its environment on boot and refuses to start if something is missing.

## First deploy

1. **Database:** create a Neon project. Use the pooled connection string as `DATABASE_URL` and the direct one as `DATABASE_URL_UNPOOLED` (used for migrations).
2. **Environment** (Vercel project settings; full table in the README):
   - Required: `VITE_APP_TITLE`, `VITE_SITE_URL` (your domain, no trailing slash), `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EMAIL_FROM`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`.
   - Optional: Cloudinary (all three), `CRON_SECRET`, Sentry, PostHog, Google sign-in, Turnstile (both keys), `AUTH_REQUIRE_ADMIN_2FA=true` once every admin has set up two-factor.
   - `VITE_` variables are baked in at build time. Changing one needs a rebuild.
3. **Migrate and seed:** from CI or locally against production, run `pnpm db:migrate` (it uses `DATABASE_URL_UNPOOLED`), then `pnpm db:seed-admin --email … --password … --name …`.
4. **Deploy.** Then open `/health` (database status; point your uptime monitor at `/api/health`, which answers 503 when the database is down), `/robots.txt`, `/sitemap.xml` (absolute URLs on your domain) and sign in at `/login`.

## Seeds

```bash
pnpm db:seed-admin | db:seed-demo   # seed-demo: roles, users with them, 30 Test CRUD items (0117)
pnpm db:seed-portfolio   # the portfolio's demo content, only when there is no profile yet (0176) <!-- @portfolio -->
pnpm db:seed-taskline --password "…"   # Taskline's demo team: 5 accounts, 3 projects, 60 tasks (dev:local seeds it fresh) <!-- @taskline -->
```

## Scheduled jobs

`vercel.json` runs two jobs daily (Hobby plans allow daily crons only). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without `CRON_SECRET` the routes answer 404.

- `/api/cron/attachments` (03:17 UTC) deletes removed images and day-old unlinked uploads from Cloudinary.
- `/api/cron/guests` (03:41 UTC) deletes guest sessions older than 7 days, with their app data and uploads (decision 0186).
- `/api/cron/parda` (02:30 UTC) refreshes Parda's title snapshot and its US certificates, rolls up the sources' plays and probe runs into the day's scores, checks followed series for new episodes (at most 1,500, under 35 TMDB requests a second: under a minute) and emails the new-episode digest through Resend (decisions 0229, 0238, 0240 and 0241). <!-- @parda -->

**Parda's watch parties** (decision 0243) need `PARDA_REALTIME_KEY`, an Ably API key (the whole `appId.keyId:secret`), in the Vercel env. Without it the party's UI is hidden and its page is a 404. The key stays on the server; browsers get a token for one party's channel.

**Parda's source probe** (decision 0238) is a GitHub Actions workflow, not a Vercel cron: `.github/workflows/parda-probe.yml` runs `pnpm parda:probe` daily at 01:40 UTC. Set `PARDA_PROBE_SECRET` (16+ random characters) in the Vercel env and, with the same value, in the repo's Actions secrets, and the deployed URL as the Actions variable `PARDA_PROBE_URL`; without the variable the job is skipped. It takes about a minute per source and title (about 12 minutes a day for 4 sources): after the first runs, check the Actions minutes against the repo's allowance, and run it every other day if they don't fit. <!-- @parda -->

## Every release

- **Gates:** CI runs `typecheck`, `check`, `knip`, `test`, `test:storybook`, `build` and `build-storybook` on every PR and on `main`. Deploy only a green commit.
- **Schema changes:** run `pnpm db:generate`, commit the SQL in `drizzle/` (CI fails if the schema and migrations disagree), and run `pnpm db:migrate` before (or with) the deploy. Keep a migration compatible with the version still running (add columns and tables first; drop them in a later release).
- **CSP reporting check (once per project, and after changing the CSP):** on a preview deploy with a Sentry DSN, open the browser console on any page and run `document.body.append(Object.assign(new Image(), { src: "https://csp-check.invalid/x.png" }))`. Within a minute or two Sentry shows a warning `CSP violation: img-src blocked https://csp-check.invalid/x.png`, and the function logs have a `csp violation` line (0139).
- **Legacy images:** migration `0009` drops `test_crud.image` and `test_crud_image` (0160). If a database may still hold Part 1 images, run `attachments:import-legacy` from the commit before 0160 first.
- **Feature flags:** set `POSTHOG_SECRET_KEY` in production so flags are evaluated on the server without a request per page (0154).

## Running a production build locally

```bash
pnpm build
EMAIL_PROVIDER=resend RESEND_API_KEY=re_placeholder BETTER_AUTH_URL=http://localhost:3000 pnpm start
```

- **Email:** production refuses the console email provider. Any `re_…` value works as long as no email is sent.
- **Checks:** run CSP, layout-shift and SEO checks here, not in dev.

## Other hosts

Nitro can target other presets (Node, Netlify, Cloudflare). Three things change:
- **Client IP:** set your proxy's trusted client-IP header in `src/server/auth/client-ip.ts` (rate limits depend on it).
- **Cron:** replace the Vercel Cron schedule.
- **Neon driver:** check that the host's runtime supports it.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Running production locally** needs `EMAIL_PROVIDER=resend` and a `RESEND_API_KEY` (any `re_…` placeholder works when emails aren't sent). Production refuses the console email provider.
- **Raw SQL inserts into Better Auth tables** (seeds, scripts) must set `updated_at` on `account` and `session`: those columns have no database default.
- **Redirects and rewrites go in Nitro's `routeRules`** (`vite.config.ts`), never in `vercel.json`: Nitro writes Vercel's routing (`.vercel/output/config.json`), and a rewrite keeps the old URL, which the client router then renders. For now a Vercel build (`VERCEL=1`) sends `/` and `/ne` to Parda with a 307; delete that block to bring the portfolio back (0252). <!-- @parda -->
- **Slow `pnpm dev`?** Run `pnpm diagnose`: a remote database costs a few hundred ms per query from far away; `pnpm dev:local` uses a local one (0155).
- **`read ECONNRESET` in the dev overlay or logs:** Neon dropped an idle pooled connection (its compute suspends after a few idle minutes). `src/server/db/client.ts` listens for the pool's `error` and logs a `warn`; the next query opens a fresh connection. Keep that listener on any new `Pool` (0251).
