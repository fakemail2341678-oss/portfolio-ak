# Parda

Parda (पर्दा, "the screen") is a movie and series product at `/app/parda`, run from `/admin/parda`, built as a removable layer (`pnpm strip-demo`; decision 0228). The plan is [PLAN.md](../PLAN.md), section 12.

**Part 6 is complete (Tasks 59 to 70)**: it has a home and three hubs (movies, series, anime) of rails from TMDB, title, credits, person and collection pages, "Surprise me", search (an overlay and a page) and Discover, the watch page with progress and Continue watching, the library (My List, ♥, History) and profiles (kids' profiles under a cap, PIN locks), the schedule and new-episode alerts (the bell, New episodes, the email digest), watch parties, the notice page, sign-in, sign-up and the 404, the admin's pages (the overview, billboard slots, collections, the home layout, sources, takedowns, reports, settings, the player lab), curated collections at `/app/parda/c/{slug}`, and **no real video plays**. The servers are a placeholder until a licensed provider is connected (see "Connecting the real provider").

## Design: "Masking"

The page is a cinema screen: two masks hold the interface and fit each picture's shape. The direction contract is [.impeccable/surfaces/parda.md](../../.impeccable/surfaces/parda.md); read it before any UI work. The comps are in `.impeccable/mocks/parda/` (gitignored; `board.html` shows every frame). Decision 0232.

**Tokens** (`src/styles/parda.css`, under `html[data-section="parda"]`, `.dark` for the dark values):

| Token | Use |
| --- | --- |
| `--pd-mask` | The two masks: header, lower bar, footer, tab bar |
| `--pd-ground`, `--pd-ground-2` | The page, and one step up |
| `--pd-ink`, `--pd-muted` | Text |
| `--pd-action`, `--pd-on-action` | Yellow fill in dark; ink fill with yellow text in light |
| `--pd-subtitle`, `--pd-on-picture`, `--pd-scrim` | Text on a picture, the same in both themes. Always over `pd-scrim` |
| `--pd-progress`, `--pd-track` | The progress bar, always on its track |

They redefine Graphite's `--background`, `--primary`, `--border` and the rest, so the shared kit needs no variants. Tailwind has `bg-pd-mask`, `text-pd-ink` and so on.

**Type:** `pd-display` with `text-pd-title` or `text-pd-head`; a subtitle is `text-pd-sub text-pd-subtitle` (size, then colour), at most two lines, inside `pd-scrim`'s solid band (4.5rem on phones, 5.5rem from `md`, then gone 2.5rem higher, 0244). Anek Devanagari is display only; text stays Inter and Noto Sans Devanagari.

**Motion:** one ease (`--pd-ease`), transform and opacity only, inside the `no-preference` block at the end of the file: `pd-move` and `pd-press`. A test enforces it.

**How the theme resolves:** a route's `staticData.brand` with `defaultScheme: "dark"` makes `sectionTheme()` turn "system" into "dark" in the root, on the server, so there's no flash. An explicit Light or Dark wins. `<html data-section>` scopes the stylesheet, so portalled menus and toasts match.

## Shell and brand

| File | Holds |
| --- | --- |
| `src/routes/_parda/route.tsx` | The layout: `PARDA_BRAND` in `staticData`, the `· Parda` title, `noindex` unless a page uses `seo()`, `pardaFontPreloads`, the 404 |
| `src/features/parda/brand.ts` | `PARDA_NAME`, `pardaTitle`, `pardaHead` (a private page's head), `PARDA_BRAND` (`id: "parda"`, `defaultScheme: "dark"`, `themeColors` from the masks, icons, manifest) |
| `src/features/parda/links.ts` | `pardaLinks`, `PARDA_PATHS` and `PARDA_SITEMAP`: every link into Parda. A link arrives with its route |
| `src/features/parda/search.ts` | The URL contract: `PARDA_HUBS`, `isPardaHub`, `PARDA_TYPES` (`series` in the URL is TMDB's `tv`), `titleParamsSchema` |
| `src/features/parda/shell/` | `PardaFrame` (top mask, footer with the wordmark, tab bar), `PardaSection` and `PardaNotFound`, the wordmark, the account menu |
| `src/features/parda/account/` | `/app/parda/account` (0249): the shared account sections (`AccountSections`) in Parda's look, through `AccountSectionFrameProvider`; the account menu links here, not to `/account` |
| `src/server/parda/manifest.ts`, `src/server/routes/parda-manifest.ts` | The manifest in each language, a Nitro route (`vite.config.ts`) |
| `public/parda/` | The icons, rendered from `icon.svg` |

- **One frame on every page** (decision 0233): the layout renders it, and the page renders its `<main>`. The top mask is always solid, so nothing in it sits on a picture.
- **Sections:** Home, Movies, Series, Anime, Discover, My List and About: the top mask's links from `md` up (My List and the language from `lg`, About from `xl`, decisions 0239 and 0240; the account menu has My List below), the tab bar below (without About: the footer links it). Search sits in the top mask at every width. Add a section to `SECTIONS` in `parda-frame.tsx` when its route exists, and check the top mask at 768 px. The frame keeps the tab bar's height clear on phones.
- **The 404:** `/app/parda/$` throws `notFound()`, so the layout's `notFoundComponent` answers in the frame. One segment (`/app/parda/whatever`) reaches `$hub`, whose loader does the same for anything but a hub.
- **SEO:** pages are `noindex` through the layout. An indexable page uses `seo({ siteName: PARDA_NAME })`, goes in `INDEXABLE` (`tests/unit/route-seo.test.ts`) and the sitemap. Today that's the home, the hubs and `/app/parda/about` (`PARDA_SITEMAP`), and the title pages (`catalog/sitemap.ts`, from `pd_title`). A page titled by TMDB also goes in `CONTENT_TITLED`.
- **The notice page** (`/app/parda/about`) says the catalogue is Parda's own (no provider is named anywhere in Parda, decision 0249), JustWatch's attribution, playback, players' ads, the uBlock Origin Lite stores (`BLOCKER_STORES`, the section `#ad-blocker` Task 64's button falls back to) and takedowns.
- **Sign-in and sign-up** are copies of Taskline's (layers don't import each other).

## The media kit

`src/features/parda/kit/`, every piece in the "Parda/Kit" stories (drawn stand-in pictures from `.storybook/mocks/parda.tsx`, never TMDB's):

| Piece | Notes |
| --- | --- |
| `TmdbImage` | A `PardaImage` (`{ src, srcSet, width, height }`, built by `tmdbImage(imageBase, path, kind)` in `kit/image.ts`) in a fixed box: `poster` 2:3, `backdrop` 16:9, `scope` 2.39:1. Lazy unless `priority`. No picture: the title (`label`) on a piece of mask |
| `PosterCard` | Poster and caption. A preview (backdrop, year, genres, score, overview) opens on a resting mouse; touch never opens it |
| `BackdropCard`, `EpisodeCard`, `PersonCard` | Wide cards with a detail line; an episode row; a portrait with the part or the job |
| `Rail`, `RailItem`, `RailSkeleton` | Core, in `src/components/data-display/rail.tsx`: scroll-snap, a named region, buttons for fine pointers. Give each item a width |
| `Top10Rail` | The rank in the mask under each poster |
| `RatingBadge`, `CertBadge`, `ProgressBar` | A score of 0 renders nothing; the bar is yellow on its dark track in both themes |
| `Billboard` | See below |
| Skeletons | One per piece, the same size, for streamed rails (CLS 0) |

Cards take links as `LinkOptions` (what `pardaLinks` returns). Captions sit under pictures, never on them; pass `alt=""` where the caption names the title.

**The billboard:** a poster between the masks on phones (narrowed to the height left by the masks and the tab bar, so Play is on the first screen, 0244), a 2.39:1 backdrop at `md`, and from `lg` exactly the first screen under the top mask (`100svh - 3.75rem`, at least 32rem), the backdrop cover-fit in what the lower mask leaves (0249), the tagline as a subtitle over the scrim (none when TMDB has none), and the title, facts and `actions` in the lower mask. It moves every 6 s (4 s on phones, 0249) and stops for its visible pause button, a resting mouse, focus inside it and a hidden tab; under reduced motion it never moves and the button is hidden by CSS. Only the current, previous and next pictures are mounted. The title box has one height (two lines on phones, one from `md`, a long title at half size in two lines), so moving on shifts nothing. The billboard preloads its first picture itself (`preloadHero` in `kit/hero-preload.ts`: `ReactDOM.preload` with `fetchPriority: "high"`, which React puts first in `<head>`; a route `head()` link lands after every modulepreload, 0245), and the title hero does the same. The home gives it Play (to the watch page, when `isPlayable` finds a source; *Details* otherwise), My list and *Surprise me*.

**Captions** have one height: two lines for the title, one for the detail, so cards line up and a skeleton is exactly its card's size. **Numbers and dates** go through `formatNumber` and `formatDate` (`src/lib/i18n/intl.ts`), never `Intl.*(getLocale())`: Chrome has no Nepali ICU data, so it would print Latin digits where the server printed Devanagari and break hydration.

## Home and hubs

`/app/parda` and `/app/parda/$hub` (movies, series, anime), decision 0234. One component (`home/parda-page.tsx`) renders either from `getPardaHub`.

| File | Holds |
| --- | --- |
| `src/server/parda/catalog/rails.ts` | The layout of each page: its rails in order (id, `top10` or `poster`, label, the TMDB request), and the rail that fills the billboard. No runtime imports, so `pnpm tmdb:record` records exactly these requests. The admin orders and hides them (`pd_rail`, see "Curation and the overview") |
| `src/server/parda/catalog/hubs.ts` | `hubPage` (the billboard with each title's details, and the first `AWAITED_RAILS` rails) and `hubRail` (one later rail) |
| `src/features/parda/home/` | `load.ts` (the loader: awaits the page, starts every later rail, returns nothing), `head.ts` (`seo()`, JSON-LD), `title-rails.tsx` (`TitleRail`, `StreamedRail`), `rail-labels.ts`, `types.ts` (the DTOs) |

- **Streaming:** the first two rails come with the page; each later one is its own `getPardaRail` query, started by the loader and rendered under `<Suspense>` with a skeleton of its size, so it streams into the same response.
- **Failure:** a rail TMDB can't answer is `null` and says "couldn't load" in a box of a rail's height; in the browser a `CatchBoundary` does the same. An empty rail isn't shown. Only `UPSTREAM_UNAVAILABLE` degrades.
- **Lean answers:** pictures are TMDB paths plus one `imageBase`, overviews are cut to 280 characters, genres are ids, rail labels are structured and named on the client.
- **"See all":** a rail whose request Discover can repeat (genre, language and keyword rails) carries `more`, Discover's filters, and its heading links there (Task 66).
- **Adding a rail:** add it to the page's list in `rails.ts` (and its label to `RailLabelKey` and `rail-labels.ts` if it's new), then `pnpm tmdb:record`. `tests/server/parda-catalog.test.ts` fails for a rail without a recording. A page whose layout was saved shows the new rail last until the admin moves it.

## A title's pages

`/app/parda/{movie|series}/{id}-{slug}`, `…/credits`, `/app/parda/person/{id}` and `/app/parda/collection/{id}`, decision 0235. All indexable.

| File | Holds |
| --- | --- |
| `src/features/parda/slug.ts` | `titleSlug` (from the English title), `titleParam`, `parseTitleParam` |
| `src/server/parda/catalog/title-page.ts` | `titlePage` (every section, names of countries and languages in the page's language, the player for Play), `seasonPage` (30 episodes a page), `creditsPage` |
| `src/server/parda/catalog/people.ts` | `personPage`, `collectionPage`, `surprise` |
| `src/features/parda/title/load.ts` | The loaders: data, the 301 to the canonical slug, the head (`ContentHead`: title, description, path, preview image, JSON-LD, a preload for collection pages; the title page's hero preloads itself). Imported lazily |
| `src/features/parda/title/head.ts` | `pardaContentHead`: renders the loader's head (route options, so small) |
| `src/features/parda/title/` | `title-hero.tsx`, `episodes.tsx`, `title-sections.tsx`, `gallery.tsx`, `video-dialog.tsx`, the four pages, `labels.ts` (TMDB's English statuses, departments, jobs and video kinds named) |

- **The title page, in order:** the hero (backdrop, tagline, poster, logo or title, facts, status and next episode; Play, Trailer, Share), the overview, a series' "New episode" banner and episodes, the cast rail and key crew, details, where to watch legally (with JustWatch's credit), videos, the gallery, the franchise banner, More like this, Similar, reviews and links.
- **The URL holds the episodes' state:** `?season`, `?page` (30 a page; some seasons have over a thousand) and `?episode` (its sheet). Season and page links don't scroll.
- **Play** is a link to the watch page, saying what the profile's progress says (*Resume · 23 min left*, *Next: S2 E6*, *Rewatch*); none when the kill switch is off or no source can play the title (`playable`). Trailers play in YouTube's privacy-enhanced embed inside a dialog, created only when it opens.
- **A blocked or unknown title, person or collection** is Parda's 404, TMDB failing a 503; a season TMDB can't answer says so inside its block.
- **"Surprise me"** (`/app/parda/surprise?from=`) redirects to a random title from the page's popular and top rated lists. Its link is never preloaded.
- **Progress on the page** (Task 64): a movie's bar under the picture; each episode's bar, Play and watched mark; each season's bar and mark; *Mark series watched* in the hero.
- **Keywords** link to Discover (`?keyword=`, Task 66).
- **My List, ♥, Like and Not for me** sit in the hero's actions (Task 67); a person's page has ♥.

## Watching and progress

`/app/parda/watch/{movie|series}/{id}-{slug}` (`?s=&e=`), noindex, decision 0236.

| File | Holds |
| --- | --- |
| `src/server/parda/player/watch.ts` | `watchPage`: the title, the episode and its neighbours, every enabled source filled except `{start}`, the `ok` and `slow` orders (see "Ranking"), the deadlines, the resume |
| `src/features/parda/player/machine.ts` | The pure choices: the order, the next source (another CDN group first), the start position, stuttering, Up next |
| `src/features/parda/player/use-watch-player.ts` | The player's life: picks on mount, loads, falls back, saves progress and `pd_play`, offers a smoother server, the redirect guard |
| `src/features/parda/player/watch-page.tsx`, `watch-panels.tsx` | The page: the box, the click shield and Parda's controls, the bar (server, episodes, theater, report), Up next, the episodes sheet, *Report a problem*, the ad-blocker hint |
| `src/features/parda/player/blocker.ts` | `BLOCKER_STORES` and `blockerStore(userAgent)` |
| `src/features/parda/library/progress.ts` | Continue watching's rules, pure and isomorphic |
| `src/features/parda/library/local.ts` | The browser's own progress (`pd_progress`), the pick (`pd_server`), the hint (`pd_blocker_hint`), the `pd_local` cookie |
| `src/server/parda/library/`, `profiles/` | The upsert and its throttle, marks, *Remove*, *Rewatch*, the rail; the default profile and the `pd_profile` cookie |
| `src/functions/parda/watch.ts`, `library.ts` | The watch page, plays and reports (`withPardaCatalog`, rate limited); the library (`requirePardaViewer` → `withPardaServices`) |

- **Nothing loads before mount:** the server renders the picture in the player's box; the page reads the connection and the pick, then sets the iframe's `src`, so a slow connection never loads the wrong player and nothing shifts.
- **Failing** is only the adapter's `failed` (0247). In Auto, on a row with `autoFallback`, the next source is in another CDN group if there is one ("Trying Server 3…"), then the rest, then "Not available right now" with the trailer and *Report*. A server the viewer picked stays picked: a toast offers the next one, and the pick is not cleared.
- **Slow to start:** no moving position by the source's deadline (its p90 start + 5 s, 12–30 s, once it has 20 plays; 15 s before; a needs-click source's starts at the first click in the player) only shows a toast that offers another server. Buffering and stutter never switch either. Parda doesn't switch away from a stream that is only slow.
- **Switching** (the server menu, or the stuttering toast's offer) starts the new player 30 s earlier; Auto clears the pick.
- **Progress** goes to the profile with a session and to the browser without one. Watching never starts a guest; a mark, *Remove* or *Rewatch* does (`guest_scope=parda`), and the browser's progress is imported once a session exists.
- **Shortcuts** (outside the iframe): `N` next, `P` previous, `E` episodes, `T` theater, `Esc` leaves theater, `K` play or pause.
- **Guests** see a banner under the top mask with the day their progress is deleted.

## The library and profiles

Decision 0240. `/app/parda/library/{list,favourites,continue,history}` and `/app/parda/profiles`, both noindex.

| File | Holds |
| --- | --- |
| `src/server/db/schema/parda/saved.ts` | `pd_list_item` (My List is `watchlist`, ♥ is `favourite`), `pd_favourite_person`, `pd_rating` (`like`, `dislike`), `pd_account` (the email digest) |
| `src/server/parda/library/saved.ts`, `saved-repository.ts` | Saving (a title is read through the catalogue, then its snapshot written to `pd_title`), the lists a page at a time, History, the personal rails, the guest claim's merge |
| `src/server/parda/profiles/` | Profiles: the rules between fields, PIN locks (scrypt, five tries per 15 minutes), the cookie's proof, the fallback profile, the digest |
| `src/functions/parda/library.ts`, `profiles.ts` | `requirePardaViewer` → `withPardaServices`, each with its row in `tests/server/parda-access.test.ts` |
| `src/features/parda/library/save-buttons.tsx` | + My List, ♥ and Like: on cards (`PosterCard`'s `action`), the hero, a person's page and the player's bar |
| `src/features/parda/library/library-page.tsx`, `for-you-rails.tsx` | The library's tabs; "Because you liked …" and "New from people you love" on the home |
| `src/features/parda/profiles/` | The picker and managing (`profiles-page.tsx`), the form and PIN (`profile-form.tsx`), pictures (`profile-avatar.tsx`), `options.ts` (pictures, TMDB's regions, the limit) |
| `src/features/parda/kids.ts`, `src/server/parda/catalog/kids-requests.ts` | The cap's ladder and the capped TMDB requests, pure |

- **What the buttons read:** the layout loads the profile's saved keys for a session (`getPardaSaved`, the latest 2,000 of each); a press changes them at once, then writes. Without a session the first press starts a Parda guest, as a mark does.
- **Lists are named from `pd_title`:** saving reads the title (takedowns and the cap apply) and writes its snapshot, so My List sorts by title or year without TMDB. History names its titles through the catalogue, like Continue watching.
- **History** is the progress rows by day in Parda's time zone (`APP_TIME_ZONE`), each title once a day with its episodes. Taking a day out deletes those rows; *Clear history* deletes every row and what Continue watching kept.
- **Personal rails:** recommendations of the latest liked title (♥ when nothing is liked), minus Not for me and My List; the latest titles (two years back, and those to come) of the eight newest favourite people. Awaited by the home's loader for a session.
- **Profiles:** at most five; the default is the account's own and never a kids' one. A kids' profile can only switch. A PIN locks a profile: choosing it from another asks for the PIN, and the `pd_profile` cookie then carries an HMAC of the profile and its PIN hash, so a guessed id opens nothing and a new PIN ends old cookies. Without a usable cookie a browser is on the default profile, or the oldest unlocked one when the default is locked. An account always keeps one profile without a PIN (`setPin` and `deleteProfile` refuse to take the last one, 0244), so that fallback never lands on a locked profile. A locked profile is changed only from inside it: `PardaViewer.opened` says the PIN was entered (or there is none), and landing on a profile by the fallback isn't that.
- **Switching** reloads Parda at its home: every cached list may differ for another profile.
- **The kids' cap** (TMDB's US ladder, the profile's or the admin's): lists TMDB can filter (discover, a type's popular, trending and top rated) are asked as discover queries with the exact certificates (`certification=G|PG`; never `certification.lte`, which lets NR in). Everything else (both types' trending, upcoming, on the air, search, recommendations, filmographies, collections) passes only titles whose US certificate `pd_title` knows to be within the cap; the daily job fills those in (400 a day, the unasked first). A title over the cap, or with no US certificate, is a 404, with its season and credits.
- **Region:** the profile's, else the visitor's country (`x-vercel-ip-country`) when TMDB has watch data for it (`TMDB_REGIONS`), else the admin's. **Players' language:** the profile's when the admin lists it, else the page's rule.
- **Fixtures:** `pnpm tmdb:record` records a kids' home too; `pnpm tmdb:record --kids` adds only those files.

## Schedule and alerts

Decision 0241. `/app/parda/schedule` (noindex), the bell, the home's New episodes rail and the email digest.

| File | Holds |
| --- | --- |
| `src/server/db/schema/parda/alerts.ts` | `pd_follow_state` (per series: the latest aired episode the check saw, the next air date, `ended`, `checked_at`), `pd_notification` (per profile: a season's range `episode`–`last_episode`, names and pictures as data, `read_at`, `emailed_at`) |
| `src/server/parda/notify/rules.ts` | Pure: what's new (`newEpisodes`), when a series is due (`isDue`), the pacing under TMDB's limit (`paced`) |
| `src/server/parda/notify/check.ts` | The daily check: followed series, one `tv/{id}` each, the state and the alerts in one transaction, and pruning |
| `src/server/parda/notify/digest.ts`, `src/server/email/templates/parda-emails.tsx` | The digest, after the check: one email per account that chose it |
| `src/server/parda/notify/service.ts`, `repository.ts` | The bell, marking read, New episodes, the followed half of the schedule |
| `src/server/parda/catalog/schedule.ts` | Anime airing this week (the half for everyone) |
| `src/functions/parda/alerts.ts`, `schedule.ts` | `getPardaInbox`, `markPardaInboxRead`, `getPardaFollowing` (`requirePardaViewer` → `withPardaServices`); `getPardaAnimeWeek` (`withPardaCatalog`) |
| `src/features/parda/schedule/` | `bell.tsx`, `schedule-page.tsx`, `days.ts` (the days, pure), `labels.ts` ("S2 · E1–8"), `queries.ts`, `load.ts` |

- **Following:** My List, ♥, or a play or mark in the last six months. There's no Follow button.
- **The check** runs in `GET /api/cron/parda` after the ranking: each followed series once a day (an ended one weekly), at most 1,500 a run, under 35 requests a second; ten failures in a row stop it. The first check of a series only records where it is. A new range goes to every profile following it then, except one that already finished it and a kids' profile its cap doesn't allow. Specials and episodes over 14 days old aren't news. States nobody kept checked for 60 days, and alerts over 90 days old, are deleted.
- **The digest** follows the check in the same job: per account with `pd_account.digest`, the unread alerts of its profiles from the last week, in `pd_account.locale`. Claimed before sending, handed back on failure. Guests never.
- **The bell** is in the top mask for a session; the `_parda` layout loads it. Opening it marks everything read.
- **The schedule:** followed series for 14 days (their next episode, and that season's dates), anime for 7 (TMDB's discover list by air date, placed by each title's latest or next episode), by day from today in the viewer's zone (`x-vercel-ip-timezone`, else `APP_TIME_ZONE`). Air dates are the airing country's.
- **Testing:** the check, the digest and both halves of the schedule run on PGlite with the airing data each test sets (`tests/server/parda-alerts.test.ts`); e2e writes an alert through the harness (`POST /e2e/parda-alert`).

## Search and Discover

Decision 0239. Both read TMDB through `catalog/service.ts` (`searchCatalog`, `listTitles`), so takedowns apply.

| File | Holds |
| --- | --- |
| `src/features/parda/search.ts` | The URL contracts: `searchPageSchema` (`q`, `tab`, `page` up to 500), `discoverSearchSchema` and `DISCOVER_DEFAULTS` |
| `src/features/parda/discover/options.ts` | Genres per type, languages, networks and studios (TMDB ids), the score choices. Imports nothing |
| `src/server/parda/catalog/discover-requests.ts` | Pure: `applicableFilters`, `discoverRequest`, `discoverOfRail` (a rail's "See all"), the recorder's samples |
| `src/server/parda/catalog/search.ts`, `discover.ts` | The pages' data, the overlay's hits, `noteSearch` (`pd_search_stat`) |
| `src/server/parda/tmdb/search.ts` | TMDB's search answers mapped, people included, with the Nepali fill-in |
| `src/functions/parda/search.ts` | `getPardaSearch`, `getPardaSuggest`, `notePardaSearch`, `getPardaDiscover` (`withPardaCatalog`) |
| `src/features/parda/search/` | `search-button.tsx` (the top mask's Search and the shortcuts), `search-overlay.tsx` (lazy), `search-page.tsx`, `hit-grid.tsx`, `recent.ts`, `load.ts`, `queries.ts` |
| `src/features/parda/discover/discover-page.tsx` | Discover: `FilterBar`, chips, the grid |

- **The overlay:** Search, Ctrl/⌘ K or `/`. Empty: recent searches, recently viewed (both this browser's only) and trending. Typed (two letters, a 250 ms pause): "See all results" first, so Enter opens the page, then titles and people.
- **The search page** searches on submit (a GET form), in four tabs. Nothing found: tips, Discover and trending. Noindex.
- **Statistics:** only the page counts a search, and only one really shown: page 1, all kinds, not a preload. Per UTC day and normalized query; no user or IP.
- **Discover** is indexable, canonical without filters. The server drops filters that don't apply to the type. Sorting by score or date has a vote floor; newest stops at today.
- **Limits:** a search without a session has its own per-IP limit (150 per 5 minutes, page loads included). Over it the page and the overlay say so; nothing fails.
- **Adding a Discover filter:** the param in `discoverSearchSchema`, its TMDB parameter in `discoverRequest`, its control and chip in `discover-page.tsx`, a case in `tests/unit/parda-discover.test.ts`.

## Catalogue

TMDB, read through `src/server/parda/catalog/service.ts` only: that module applies takedowns and the cache epoch, so no entry point can skip them.

| File (`src/server/parda/`) | Holds |
| --- | --- |
| `tmdb/client.ts` | `createTmdb(config, fetcher)`: 8 s timeout, one retry on 5xx, one `Retry-After` wait on 429 (at most 10 s), `include_adult=false`. Failures are `UPSTREAM_UNAVAILABLE` (503); a 404 is `NOT_FOUND` |
| `tmdb/cache.ts` | LRU, a TTL per class (configuration 7 d, details 24 h, lists 1 h, search 10 min), stale for one more TTL while refreshing, concurrent reads coalesced |
| `tmdb/mappers.ts` | Zod to lean DTOs, only the fields pages use, plus the Nepali fill-in from English (`nepaliName`: a Nepali title counts only in Devanagari, 0244) |
| `tmdb/store.ts` | The singletons: `pardaTmdb` (null without `TMDB_READ_TOKEN`), `pardaControls` and `pardaCache` |
| `catalog/context.ts`, `src/middleware/parda.ts` | `withPardaCatalog`: the services, the region and the cap (a kids' profile's, decision 0240), null when not configured; anonymous calls over HTTP limited to 300 per 5 minutes per IP (SSR isn't counted) |
| `controls.ts` | Takedowns, settings and sources from Postgres, at most every 30 s per process |
| `catalog/requests.ts` | The title pages' TMDB requests (the details `append_to_response`, credits, season and person paths, the key jobs), shared with the recorder; no runtime imports |
| `tmdb/pages.ts` | A season, the full credits, a person and a collection, each with its Nepali fill-in |
| `catalog/refresh.ts`, `cron.ts` | The daily job: the `pd_title` refresh (the top 500 of each media type), their US certificates (400 a run), the sources' ranking, the new-episode check and the digest |

Genre names are our own messages (`src/features/parda/genres.ts`), because TMDB's Nepali genre names are null.

**Fixtures:** `pnpm tmdb:record` writes `tests/fixtures/tmdb/` from the real API (`TMDB_READ_TOKEN` in `.env`): every rail of every page, each billboard's details with its full credits and first season, the popular lists, a few actors and every recorded movie's collection. `pardaFixturePath` (`e2e/harness/tmdb.ts`) gives the review a page of each kind from them. Tests inject them as the fetcher, and `e2e/harness/tmdb.ts` serves them. CI never calls TMDB. A file's name (`fixtureName`) is the path plus the parameters that pick the answer, without date values. Details are trimmed (long lists cut) and every file is one line. Tests take their ids from the recorded lists, so recording again changes no test.

## Sources and the player

A source is a row in `pd_source`, not code, so the admin can change one without a deploy.

- **Templates** (`src/features/parda/player/templates.ts`): tokens `{id}`, `{imdb}`, `{season}`, `{episode}`, `{color}`, `{lang}`, `{start}`. A template is a path such as `/1/movie/{id}`, or an absolute https URL whose origin the row lists. A path goes after `PARDA_PLAYER_BASE`, which holds the whole prefix (`https://player.example.com/parda/api`). Without that variable it goes after this app's `/parda/api` (0246).
- **Adapters** (`src/features/parda/player/adapters/`) are the only code per provider. Each turns messages into one event stream (`ready`, `position`, `play`, `pause`, `seeked`, `ended`, `failed`) and says what the player can do (`command`, `startPosition`, `infersStalls`). `parda` is our own protocol. `viduki` is the Viduki embed contract that Servers 1 to 4 follow (0248): `MEDIA_DATA` progress, picked out for the title on screen (`PlayerFrame`'s `target`), and `viduki:all-servers-failed`. It has no commands, resumes from its own memory and records no stalls. `none` reports nothing.
- **A message counts** only when it comes from the source's own frame and origin and passes the adapter's parser.
- **`stall.ts`** infers buffering: the position hasn't moved for 1.5 s while playing, ignoring the 3 s after a seek or a command. It runs only for an adapter with `infersStalls`, one that reports several times a second.
- **The bar** has Parda's controls (play, seek, the click shield, *Player menu*) only for a player that obeys commands. Every player gets full screen, theater mode and picture-in-picture (`picture-in-picture.ts`). Picture-in-picture uses Document Picture-in-Picture: Chromium on a computer, elsewhere a disabled button. It moves the frame to a small window, which reloads the frame.
- **`PlayerFrame`** is the iframe plus its messages. It has a `sandbox` attribute only when its row asks for one, never with `allow-top-navigation`.
- **CSP:** `embedOrigins` reaches `frame-src` only, never `script-src` or `connect-src`. `src/server/parda/player/csp.ts` builds it from the enabled sources for Parda's pages, and from all rows for the lab. Other pages keep the strict policy.

### The placeholder player

`GET /parda/api/{1-4}/movie/:id` and `/parda/api/{1-4}/tv/:id/:season/:episode` (`src/server/routes/parda-player.ts`), seeded as Server 1 to 4. It plays no video: a clock counts seconds. By default it speaks the Viduki contract the seeded rows use: `MEDIA_DATA` each second, `viduki:all-servers-failed` on a failure, and it obeys no command. `?protocol=parda` speaks our protocol instead:

```
to the parent:  { type: "parda.player", event: { name, position?, duration?, reason? } }
from the parent: { type: "parda.command", action: "play" | "pause" | "seek", position? }
```

`?start=` sets the start position, `?lang=` the language, and `?cue=fail|stall|silent` rehearses trouble in either protocol. The e2e harness switches its Servers 1 to 4 to `?protocol=parda`, so the flows still reach the code a commandable player uses. It adds a disabled "Viduki" row for the lab flow.

### Connecting the real provider

Use a provider licensed for the catalogue you show. Either:

1. **It serves these routes:** set `PARDA_PLAYER_BASE` (or replace the handler in `src/server/routes/parda-player.ts`). If its player follows the Viduki contract, as the owner's does, nothing else changes. If it speaks the `parda` protocol, set the rows' adapter to `parda` and their templates back to `?start={start}&lang={lang}`.
2. **It has its own embed:** add a row with its templates and origins, add an adapter beside `parda` (and its value to the `pd_source_adapter_valid` check, in a migration), and disable Server 1 to 4.

Then try it in the player lab.

## Ranking

Decision 0238. Each play starts on the source most likely to play well for that viewer and title.

| File | Holds |
| --- | --- |
| `src/server/parda/player/ranking.ts` | Pure: the factors, the score, `okOrder`, `slowOrder`, the per-title skip, exploration (`watchOrders`) |
| `src/server/parda/player/stats.ts` | The daily rollup into `pd_source_stat`, `latestStandings`, `noteTitleFailure` and `skippedSources` |
| `src/server/parda/player/probe.ts`, `src/server/routes/parda-probe.ts` | `/api/parda/probe`: `GET` what to probe, `POST` what it saw (`Bearer PARDA_PROBE_SECRET`, a 404 without it) |
| `scripts/probe-sources.ts`, `.github/workflows/parda-probe.yml` | `pnpm parda:probe`: real Chrome on each enabled source, daily at 01:40 UTC |

```
score = availability × (0.4 × quality + 0.4 × smoothness + 0.2 × speed) − 0.1 × popups per click
```

- **Viewers first:** with 20 plays or more in the last 7 days (party plays never count), availability, smoothness and speed are the viewers'. Under 20, the probe's alive rate and neutral values. With neither, no score, and the source keeps its seed slot. A `none` source is never scored.
- **Quality** is the admin's (the form's "Top quality"), else the probe's tallest picture; unknown is 0.5. The adaptive flag is the admin's, else the probe's ladder.
- **The scores change once a day** (`GET /api/cron/parda`); the orders are made at each play from them and the rows as they are, so a pin, an enable or the mode applies at once (this server at once, others within 30 s).
- **Pinned** rows lead in both modes. **Manual** is the admin's order (Reorder). **`slow`** puts adaptive sources first. **5%** of plays start on a source short of data, in automatic order, with no pin, once some source has data.
- **Per title:** a failure from a second client within 24 h sends the source last for that title for 24 h. One client can't, and these failures have their own rate limit.
- **The probe** needs `PARDA_PROBE_SECRET` in the app's env and the repo's Actions secrets, and `PARDA_PROBE_URL` as an Actions variable (deployment.md). By hand: `PARDA_PROBE_URL=http://localhost:3000 PARDA_PROBE_SECRET=… pnpm parda:probe --dry-run` (`--headed` to watch, `--seconds=N` per title).

## Player lab

`/admin/parda/player-lab` (`parda:configure`) loads any row, enabled or not, for any title, logs each message, shows stalls, and sends commands where the adapter has them. It's what you use to judge a new provider. Run it by hand in normal Chrome: automation changes how players behave.

**Findings so far:** Servers 1 to 4 report `ready`, `position`, `play`, `pause`, `seeked` and `failed`, and obey commands, under the production CSP. The questions in PLAN Task 59 about third-party players are for the real provider, once it exists.

## Controls and the admin

`/admin/parda` (decision 0237). Reading any page is `parda:read`; sources and settings change with `parda:configure`, takedowns and reports with `parda:moderate`. Every write is audited (`parda.*`) and clears the controls' 30 s cache in that process (`controls.invalidate()`), so the admin sees it at once and other servers within 30 s.

| Page | Holds | Code |
| --- | --- | --- |
| `/admin/parda/sources` (`/new`, `/$id`) | Every `pd_source` row in order with its open and ads reports, rank today, score and measurements; enable, disable, pin, reorder (dnd-kit), delete; the kill switch and the order's mode above them | `features/parda/admin/sources/`, `server/parda/admin/sources.ts` |
| `/admin/parda/titles` (`/new`) | Takedowns (`pd_blocked_title`): block by type, TMDB id and reason; "Delete" unblocks | `admin/titles/`, `server/parda/admin/takedowns.ts` |
| `/admin/parda/reports` | Viewers' reports, open first; filter by status, kind, source and text; resolve, dismiss, reopen, in bulk too | `admin/reports/`, `server/parda/admin/reports.ts` |
| `/admin/parda/settings` | The kill switch, region, kids' cap, players' languages, banner and the cache purge | `admin/settings/`, `server/parda/admin/settings.ts` |
| `/admin/parda/player-lab` | Any row, enabled or not (`?source=` picks one) | `admin/player-lab/` |

- **`pd_settings`** (one row): `region` (TMDB has no NP data), `languages` (the `{lang}` players get: the page's when listed, else the first, `playerLanguage`), `kids_cap`, `banner` (under the top mask on every page, read by the `_parda` layout's loader; empty English hides it), `playback_enabled` (the kill switch: no player loads anywhere), `cache_epoch` (bumping it purges the catalogue cache), `source_order` (`auto` or `manual`, the switch on the sources page; see "Ranking").
- **A source's templates** are checked on save (`sourceFieldProblems`) and refused on their own field. A new source starts disabled: try it in the lab, then enable it. A sandbox warns that most players refuse one.
- **Versions:** the forms save from the row's integer `version` (`saveVersioned` in `server/parda/admin/context.ts`); enable, pin, the kill switch and the purge leave it alone.
- **`pd_blocked_title`:** one per title (`pd_blocked_title_unique`). The title is a 404 and leaves every list from every entry point (`catalog/service.ts`) and the sitemap. Deleting a source keeps its plays and reports, with no source.

## Curation and the overview

Decision 0242. `/admin/parda`, `/billboard`, `/collections`, `/layout`. Reading is `parda:read`; billboard slots, collections and layouts change with `parda:curate`. Every write is audited and clears the controls' cache.

| File | Holds |
| --- | --- |
| `src/server/db/schema/parda/curation.ts` | `pd_billboard`, `pd_collection` and `pd_collection_item`, `pd_rail`, `pd_daily_stat` |
| `src/server/parda/curation.ts` | `loadCuration` (what the controls hold for 30 s), `mergedRails`, `visibleRails`, `slotState`, `liveBillboards`: the pure rules |
| `src/server/parda/admin/curation.ts`, `overview.ts` | The admin's services, the title picker's search, the overview's numbers |
| `src/server/parda/player/daily.ts` | The daily rollup and the 90-day prune |
| `src/server/parda/catalog/hubs.ts`, `people.ts` | Slots on the billboard, collections as rails, `curatedPage` |
| `src/features/parda/admin/overview/`, `curation/` | The pages; `title-fields.tsx` is the picker and the ordered list of titles |

- **Billboard slots** lead their page: those live today (Kathmandu's dates, both days included, either open), in the admin's order, then the page's rail fills up to five, each title once. An empty tagline keeps TMDB's. A slot's title that's blocked, over a kids' cap or without a backdrop is left out, and the rail takes its place.
- **Collections** have a name and description in both languages, a slug, up to 50 ordered titles, and a published switch. Published (it needs a title), the page `/app/parda/c/{slug}` is indexable and in the sitemap, and it can be placed as a rail. Takedowns and caps apply through `titleDetails`, so a blocked title drops out by itself; a collection with nothing left to show is a 404.
- **Titles are read once when chosen:** saving reads each title `pd_title` doesn't know through the catalogue, so a blocked or unknown one is refused on its field, and keeps its snapshot, so admin lists name it without TMDB.
- **The layout:** `pd_rail` holds a page's rails by id (`c-{collection}` for a collection). A page with no rows is the config's order, and a rail added in code later joins at the end, so nothing is seeded. A collection is off until placed. Continue watching and the personal rails aren't in it. The first two visible rails come with the page; a collection placed first reads its titles' details before the page is sent.
- **The overview:** finished days from `pd_daily_stat`, today live from `pd_play`, and top titles, searches and failures by server read from the range's rows. Days are UTC, as `pd_search_stat`'s. Nothing here reads TMDB.
- **Unique viewers:** `pd_play.viewer_key` is a keyed hash of the user (or the hashed IP) and the UTC day, so a day's viewers can be counted and nobody can be followed across days. The overview says "a day": the period's figure is an average, because different days' keys can't be compared.
- **The rollup** runs in `GET /api/cron/parda`: every day since the last one stored, so a missed run fills in. `pd_play` and `pd_search_stat` are deleted after 90 days; `pd_daily_stat` is kept.

## Watch party

Decision 0243. `/app/parda/party/{code}`, noindex and never listed; the code is the invitation. Everything is hidden, and the page and functions answer 404, without `PARDA_REALTIME_KEY`.

| File | Holds |
| --- | --- |
| `src/server/db/schema/parda/party.ts` | `pd_party` (the state saved for late joiners and reloads) and `pd_party_member` (who's in; the channel knows a member by this row's id, never a user id) |
| `src/server/parda/party/service.ts`, `repository.ts` | What only the server can keep: creating (rate limited, refused with playback off), seats (10), the host, ending, the pulse |
| `src/server/parda/party/token.ts` | `partyRealtime()` and the channel's token, an Ably JWT signed here, for this channel and member, 30 minutes |
| `src/functions/parda/party.ts`, `getPardaParty` in `watch.ts` | `requirePardaViewer` → `withPardaServices`, each with its row in `tests/server/parda-access.test.ts`; the page itself is `withPardaCatalog`, so the link shows what's playing before a session exists |
| `src/features/parda/party/sync.ts` | **The pure reducer.** Events in; commands, messages and reloads out. Every rule below is here, and unit-tested |
| `src/features/parda/party/channel.ts` | `PartyChannel`, the only provider code: Ably, or the e2e relay when `relayUrl` is set. Imported on the party's page only, so the SDK reaches no other page |
| `src/features/parda/party/use-party-room.ts` | Takes a seat, keeps the channel, carries out what the reducer returns, records progress and `pd_play` |
| `src/features/parda/party/clock.ts` | The offset from server time, from the quickest recent round trip |
| `e2e/harness/parda-relay.ts` | The stand-in: one channel per party with presence, checking the same tokens. CI never calls Ably |

**The room:**
- **One source for everyone,** because timecodes differ between sources: the highest-ranked with commands, else the top one. Only the host changes it; everyone reloads, 30 s earlier. A source that's gone hands the party to the best one left.
- **The lobby:** *Ready* is the gesture autoplay needs. A viewer with a session takes a seat on arrival, so the room shows who's here; a visitor's *Ready* starts a Parda guest first. It starts once all are ready (two or more) or when the host presses *Start now*, after a 3 s countdown.
- **Full sync** (the source obeys commands): anyone's play, pause and seek reach everyone, the later press winning. Drift over 2 s gets a hard seek, at most every 3 s. The click shield is on.
- **Buffering, in full sync:** `stall.ts` fires, the others pause and see "Waiting for Sam". Once Sam has moved for a second, everyone seeks to Sam and plays. After 30 s the host can *Continue without Sam*, and Sam holds nobody again.
- **Start together** (any other source): a shared countdown, then each player runs on its own, with no shared pause and no pause on buffering. A chip shows how far behind, where the player reports. *Resync* reloads at the group's position where the source takes `{start}`. The host is offered a source that can sync.
- **Late joiners and reloads:** the page reads `pd_party` (saved every 15 s by the host, and at once on a change), and the longest-present of the others tells the newcomer the live state.
- **The host:** gone for 15 s, the longest-present member asks to take over. The server agrees only if the host left or hasn't pulsed for 90 s, and only for that member.
- **The pulse** (every member at most every 30 s, the host every 15 s) keeps a seat and the party alive, and says who's host and the server's time. A 404 means the party ended: the host, the kill switch, a takedown, or 12 h idle (the daily job ends those, and deletes them a week later).
- **Trust:** anyone in the channel can publish anything, so `parsePartyMessage` checks every message, the host's messages count only from the host, and a `source` message can only name a source the page already has: no URL ever travels. The sender's id comes from the service, not the message.
- **Progress** is each member's own, as usual. `pd_play.in_party` keeps party plays out of ranking.

**Testing:** a message to the placeholder rehearses a stall (`{ type: "parda.command", action: "rehearse-stall", on }`), which a `?cue=` can't let go of. A source without commands is a row with the adapter `none` and `{start}` in its template, and `?cue=silent`.

**Connecting Ably:** create an app, copy its API key (the whole `appId.keyId:secret`) to `PARDA_REALTIME_KEY`. `connect-src` gains Ably's hosts on Parda's pages only then. Another service means another implementation in `channel.ts`, its hosts in `player/csp.ts`, and its token format in `token.ts` and the relay.

## Pitfalls already solved

- **The billboard from `lg` is one screen tall:** its picture is `flex-1` in a frame of `100svh - 3.75rem`, so a change to the top mask's height must change `FRAME` in `kit/billboard.tsx` too (0249).
- **The shared account page is drawn as cards:** a product with its own look provides `AccountSectionFrameProvider` with its section component instead of copying the forms (0249).

- **A timer in an effect without deps restarts on every render:** position reports render four times a second, so a 250 ms tick would never fire. The party's clock has `[]` and reads refs.
- **A real player can start by itself as it loads,** and the room mustn't read that as someone pressing play: what a player says within 5 s of `ready`, or 1.5 s of a command, is an echo.

- **Seven links overflowed the top mask at 768 px:** About and the language show there only from `lg` (the footer has both).
- **A takedown in the billboard test needed a title nobody recorded:** the sixth title fills in, and a Nepali answer can lack a backdrop the English one has, so the recorder keeps two spare billboard titles.
- **The review loads each page twice:** with the statistics' note also counted, the search limit tripped during the review; the note no longer counts against it.

- **Exploration on a fresh install** would start every play on a random server, because no source has data: it waits until one source has 20 plays.
- **`adaptive` defaulted to `false`,** which read as the admin's "no" once the probe could say otherwise; migration `0031` made those null.

- **A unique violation inside a transaction crashed the e2e harness's PGlite socket server** ("Received unexpected commandComplete message from backend"). Parda's writes avoid the failed statement: a takedown inserts `on conflict do nothing` and treats no row back as the field error.
- **A template's server error outlived the fix:** it's checked against the origins, so adding the origin didn't clear it and the form wouldn't submit; the origins field clears the templates' server errors when it changes.

- **The player bar grew on mount** (Parda's controls appear once the player is ready, a picked server's name is longer than Auto), shifting the page: the controls row renders from the server, disabled until ready, and the server menu is last in the bar.
- **Two `<main>` landmarks:** a player's own document can have one, and axe counts it; the watch page's `<main>` is named.
- **Paused before it moved:** progress is saved from the first moving position, so a test (or a viewer) pausing at once saves nothing; the e2e flows wait for `data-status="playing"`.

- **Nothing under `/app/parda` matched an unknown address,** so the site's 404 answered outside Parda's frame. The splat route `/app/parda/$` fixes it.
- **sr-only text inside a scrolling list widens the page:** it's absolutely positioned, so the list must be `relative` (`Rail` is, as `ScrollRegion`).
- **A billboard title box of two lines everywhere left a void under short titles on laptops;** one line from `md`, with long titles at half size, keeps one height without it.

- **Parda's tokens must outrank the visitor's presets:** `html[data-radius]` comes later in `app.css` with the same specificity, and `.dark[data-accent]` outranks the light rule, so `--radius` has its own `:root` rule and the dark rule repeats `--primary`. The "Parda/Tokens" stories check this with a rose accent and a round radius.
- **Anek's Devanagari is too big as a variable font** (258 and 726 kB), so Devanagari uses the static 700 cut, mapped to every weight and width. Only Latin takes the width axis.
- **A route `select` can't return `links`:** `useMatches` refuses functions in a selection, so `useSectionBrand` picks the plain fields with `structuralSharing`, and the head still reads the whole brand through `sectionBrandOf`.
- **`x-frame-options`:** `/**` sends `DENY` to every response, so `/parda/api/**` needs its own Nitro route rule (`SAMEORIGIN`), and the document sets `frame-ancestors 'self'`.
- **Nitro routes own their CSP:** the request middleware that adds the app's nonce doesn't run for them, so the placeholder sets its own policy with its own nonce.
- **Layer independence:** `ScrollRegion` and `.impeccable/config.json` are shared with other layers, so they're in `SHARED` in `scripts/strip-demo.ts`.
- **Two discover queries on one path** shared a fixture file named by the path alone; names now carry the parameters (`fixtureName`).
- **Trending mixes people in, and ignores `include_adult`:** the mapper keeps movies and series and drops `adult` and `softcore` items.
- **Hydration in Nepali:** the kit used `Intl.NumberFormat(getLocale())`, which prints Latin digits in Chrome and Devanagari in Node; it uses `formatNumber` now.
- **A rail heading without its buttons** (coarse pointers) was shorter than the skeleton's; the heading row is `min-h-8` everywhere.
- **A cut fixture lost what the page needs:** trimming lists to their first entries dropped the director and every trailer; the recorder keeps key crew and trailers first.
- **TanStack's `Link` sets `aria-current="page"`** on the active season link, overriding ours; the season picker uses `"page"` too.
- **Country names from the browser's `Intl`** would differ from the server's in Nepali (0234); the page builder names them on the server.
- **An index route beside a child:** `$type/$id.tsx` would make the credits page its child; the title page is `$type/$id/index.tsx` (route id `/_parda/app/parda/$type/$id/`).
- **TMDB's Nepali answer isn't blank without a translation:** it gives the title in its original language (モブサイコ100), so `trim() ||` never fell back to English. `nepaliName` keeps a Nepali title only in Devanagari (0244).
- **Full-page screenshots hide what the tab bar covers:** a fixed bar is drawn once at the viewport's bottom, so the billboard's Play row sat under it at 390×844 while every full-page shot looked fine. Check the first screen with a viewport-only capture (0244).
- **A fallback that lands on a locked profile isn't the PIN:** with every profile locked, "the profile you're in" was the fallback's, and counted as proof. `PardaViewer.opened` separates the two, and one profile always stays open (0244).
- **A route `head()` preload lands after every modulepreload** (78th on the home), so the hero picture waited behind the scripts. `preloadHero` (React's `preload`) puts it first. Measure Lighthouse behind an HTTP/2 + brotli proxy: over HTTP/1.1, Lantern queues Parda's 150 early requests six at a time, and for an image LCP it counts every request started before the paint (0245).
