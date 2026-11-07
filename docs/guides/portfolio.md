# Portfolio (the site at /)

A portfolio for a full-stack developer from Kathmandu, in both languages, designed as "Himal": the Himalaya seen from Kathmandu, printed in altitude layers. It is the site's home: a pathless layout (`_site`) serves it at `/`, beside the admin, account and `/dev` sections (Task 35 moved it there from `/portfolio`; Task 40 gave it its design). Its content lives in the database and is edited in the admin (Task 39, decisions 0176–0178); 0107–0109 and 0161 explain the rest. `pnpm strip-demo` removes it as the `portfolio` layer (0163), admin and media library included.

- **Pages:** `/` (the story), `/work` (index, `?discipline=` filter), `/work/$slug` (case study), `/about`, `/journal`, `/journal/$slug`, `/contact` (with the contact form), plus a 404 in the section's own chrome. Nepali under `/ne/…`. `?preview=1` on a case study or an article shows a draft to someone who may read it.
- **Admin:** `/admin/portfolio/profile`, `/projects`, `/journal`, `/experience`, `/skills`, `/process`, `/testimonials`, `/messages` (the contact inbox) and `/admin/media` (the media library), in the sidebar's "Portfolio" group.
- **Code:** `src/routes/_site/` and `src/routes/_admin/admin/portfolio/` (routes), `src/features/portfolio/` (public pages and `admin/`), `src/features/media/`, `src/functions/portfolio*.ts` and `media.ts`, `src/server/portfolio/` and `src/server/media/`. The design system is `src/styles/himal.css`; its archival pictures are in `public/himal/`.

## Architecture

```
routes/_site.tsx                  layout: staticData.session = "skip", PortfolioShell (.himal: header, main, footer), font preloads
routes/_site/*.tsx                loader → ensureQuery(...QueryOptions) · component from components/pages · head → seo()
routes/_admin/admin/portfolio/    the admin sections (the CRUD standard: crud.md)

features/portfolio/
  constants.ts                    enums shared with the Drizzle schema (no imports)
  schema.ts                       the content model: inputs (strict), form values, DTOs, case-study blocks, metrics, links
  search.ts                       URL contracts: public params (discipline, preview, slug) and the admin lists
  types.ts                        what the public pages receive: one language, `lang: "en"` where untranslated
  queries.ts                      one public read per page (profile, home, work, project, about, journal, post)
  admin/                          keys, queries + mutations, columns, filters, labels, commands, components/
  lib/                            terrain/ (noise, height fields, contours, reliefs, panorama), daylight, fit, archive,
                                  format-metric, reading-time, seeded-random, structured-data, fonts, labels, cn
  components/pages/               each page's component (routes stay thin)
  components/art|primitives|chrome|sections|case-study|journal|work|content|contact/   page parts, presentational
features/media/                   the media library: list contract, schema, queries, MediaField + picker, the page
functions/portfolio-public.ts     public reads and the contact form (unguarded on purpose: guarded-functions test)
functions/portfolio*.ts, media.ts the admin's functions (requirePermission → withServices → one service call)
server/portfolio/                 repositories + services per entity, public.ts (published reads), messages (contact)
server/media/                     the library's usage, locks, alt text and deletes
server/db/schema/portfolio.ts     the tables (0176)
scripts/lib/portfolio-data/       the demo content, written by scripts/lib/portfolio-seed.ts (pnpm db:seed-portfolio)
```

**Data flow:** a route loader awaits `ensureQuery(projectQueryOptions(slug, preview))`; the query calls the public server function `getCaseStudy({ locale, slug, preview })`, which reads published rows (drafts too in a granted preview) and resolves them to the locale on the server; the component reads the same query with `useSuspenseQuery`. The HTML arrives complete and the browser hydrates the cache, so nothing is fetched on first paint; a client-side navigation calls the function, never the database. One call per page: `getHome` returns the whole story. There is no server cache, so publishing shows on `/` at once.

**Components are presentational:** sections take data as props (pages do the querying), which is why every one of them has a story.

## Content and languages

- **UI chrome** (labels, buttons, the site's own headings) is Paraglide messages: `portfolio_*` keys in `messages/en.json` and `messages/ne.json`.
- **Content** (projects, posts, bio…) is data. Every human-language field is `{ en, ne }` jsonb (`localizedText()`), typed in both languages in the admin (`LocalizedField`, "Nepali missing" while empty; no machine translation for content). Brand names, tech names and code are plain strings.
- **Fallback (0178):** where Nepali is empty the page shows English; `resolveLocalized` adds `lang: "en"` to a record or block with no Nepali at all, and components put it on that element (`<article lang={project.lang}>`). Alt text works the same way in `CloudImage`.
- `tests/unit/portfolio-data.test.ts` checks the demo content against the admin's input schemas and that every Nepali text is in Devanagari.

## Editing content (the admin)

- **Profile:** one form, its sections in a side navigation: identity (portrait), story (headline lines, intro, manifesto, bio), principles and numbers, links and résumé (a PDF from the library), search and sharing (SEO title, description, social image; empty means the name and intro).
- **Projects:** the CRUD standard (list, filters, form, publish, delete) plus "Reorder" (a dialog, drag or Alt + ↑/↓): published projects show in that order. The form edits the cover (a library image, or the generated art: motif, glyph, art seed), the gallery, outcome numbers, links and the case study as typed blocks (`BlocksField`): chapter, quote, code, system diagram (boxes in tiers and arrows between them), screens. "Preview" opens the public page with `?preview=1`.
- **Journal:** title, excerpt and body in both languages (the body is rich text, sanitized on the server), tags, a cover. Newest first; reading time is computed.
- **Experience, skills, process, testimonials:** short lists in display order, reordered by drag and edited in a sheet. Testimonials have a "Show on the site" switch.
- **Publishing:** needs `portfolio:publish` (from the list, or the status in the form); without it a save keeps the status and a new record is a draft. Previews need `portfolio:read`.
- **Messages:** the contact form's inbox: open (marks read), reply (your mail app), mark read/unread, archive, delete (`messages:manage`).
- **A new block type:** add it to `caseStudyBlockSchema` in `schema.ts` and to `CaseStudyBlocks` in `admin/components/case-study-blocks.tsx`; typecheck then fails in `case-study-body.tsx` until it has a renderer.
- New slugs reach the sitemap once published (`listSitemap` in `server/portfolio/public.ts`).

## Media library

Images and PDFs at `/admin/media` (decision 0177): upload (the attachments flow with the `media` scope: `attachments:upload` and `media:write`), describe in both languages, see where each is used, delete what nothing uses (the server refuses the rest, and a save that references a removed item is refused on its field). Forms pick from it with `MediaField` (`features/media/components/media-field.tsx`): "Choose from the library" opens a picker that also uploads. Library items keep their alt text; it shows wherever they're used.

## Demo content and seeding

`pnpm db:seed-portfolio` writes the demo content from `scripts/lib/portfolio-data/` when there is no profile yet (it never overwrites). `pnpm db:seed-demo`, `pnpm setup:local`, `pnpm dev:local` and the e2e harness run it too. To start your own portfolio, edit the content in the admin, or change the files in `scripts/lib/portfolio-data/` before the first seed.

## Contact form

`/contact` posts to `submitContactMessage`: a honeypot, Turnstile when `TURNSTILE_*` is set, a rate limit per sender (3 per 10 minutes, keyed by a keyed hash of the IP), then the message is saved for the inbox and emailed to the profile's address (`contact-message` template). A failed email is logged; the message is still in the inbox.

## Design system: "Himal"

The Himalaya seen from Kathmandu is the site's one picture: a range of generated mountains printed in flat altitude layers, like a multi-block woodblock print, under a sky that follows the hour in Kathmandu (decisions 0179–0184).
- **Scope:** everything lives under `.himal`, with `hm-` utilities, in `src/styles/himal.css`. The admin's Graphite system is untouched.
- **Records:**
  - `PRODUCT.md` (repository root) is the product record the design tools read.
  - `.impeccable/surfaces/` holds the direction contract.
  - `DESIGN.md` documents the built system.

### Colour: fields, not cards

- **Semantic tokens** (use these in components, as Tailwind colours):
  - `bg-hm-ground`, `bg-hm-ground-2` (the surface step);
  - `text-hm-ink`, `text-hm-muted`, `text-hm-accent`;
  - `bg-hm-action` with `text-hm-on-action` (the button);
  - `--hm-focus`.
- **Fields:** a section takes a whole ground with `hm-field-snow-2`, `hm-field-ridge`, `hm-field-pine`, `hm-field-night` or `hm-field-rhodo`. The class reassigns the tokens, so components inside keep working. Snow is the default.
  - Neighbouring sections never share a field. The home page runs snow, snow-2, ridge, snow, pine, snow-2, night, snow, rhododendron; the footer is night.
- **Accent:** rhododendron red marks what you can act on: the primary button, a link's hover underline, focus and form errors, plus the contact field (the owner's choice). Active states (the current page, the chosen filter), selection, quote marks, list markers and the reading line use ink or muted. The availability note has no coloured mark: the palette has no status colours.
- **Dark mode** is night on the ridge: every field has a dark value.
- **The art's colours:**
  - the altitude ramp `--hm-alt-0` … `8` (pine → rock blue → snow); `altitudeFill` maps a level onto it with a snow line, so the top 38% of the levels are the two snows and every summit that clears the line carries snow;
  - the sky's three bands per phase (`--hm-sky-<phase>-1…3`), alpenglow, moonlight, sun, stars;
  - the duotone inks `--hm-duo-light` and `--hm-duo-dark` (a field may set its own: the map prints red on the rhododendron field);
  - text on the art: `--hm-on-high` and `--hm-on-deep` for the strata, `--hm-on-sky` for labels on the daytime sky.
- **Contrast:** `tests/unit/himal-tokens.test.ts` checks every text pair at 4.5:1 on every field, in both themes, plus the text set on the art. Add a pair there when you set text on a new colour.
- **Never:** gradients (the sky is flat bands), shadows at rest, hairline rules, cards, eyebrows, index numbers, uppercase labels.

### Type

- **Display:** Eczar (`font-hm-display`, `hm-display` for headings at weight 650, `hm-statement` for quotes and statements at 500). One face for Latin and Devanagari.
- **Text:** the app's Inter and Noto Sans Devanagari (`hm-canvas` sets them). **Code:** JetBrains Mono (`font-hm-mono`), in code blocks only.
- **Sizes:** five: `text-hm-small`, `text-hm-body`, `text-hm-lead`, `text-hm-head`, `text-hm-title`. Metadata uses `hm-meta` (small, muted, sentence case). Figures (`FigureLines`) take their sentence's size: a figure is a fact, not a headline.
- **Nepali:** `:lang(ne)` display type drops the negative tracking (it breaks conjuncts) and opens the leading, and `text-hm-head` starts at 30px on phones (Devanagari runs about a quarter longer; at 36px a two-line heading took three). An email address is Latin, so `FittedEmail` sets `lang="en"` on it.
- **The name as a monument:**
  - `FittedName` (and `FittedEmail`) size a line to its container's width from its own length: `lib/fit.ts`, no measuring script: Eczar 700's measured advance widths for Latin, a unit count by Unicode category for Devanagari. A name in another script counts as average letters and fills less of the width.
  - Put it inside an `@container`. On phones each word (or each side of the @) takes its own line.
- **`cn` in portfolio components** comes from `features/portfolio/lib/cn.ts`, which teaches tailwind-merge the `text-hm-*` sizes.

### Layout

- `hm-container`: one pair of outer margins (16–32px).
- `hm-grid`: 4 columns on phones, 12 from 48rem.
- `hm-section`: 96–192px between sections.
- `hm-measure`: 66ch.
- Buttons are square fills (`hm-button`; `ButtonLink` for routes). Links in text are underlined (`hm-link`; `TextLink` for routes).
- Every section opens with a heading that names it (`SectionHeading`).

### The art (`components/art`, `lib/terrain`)

- **Pipeline:**
  1. `heightField`: seeded peaks shaped by simplex noise (`noise.ts`); each cover motif is a landform.
  2. `contourLevels`: marching squares, closed rings, smoothed.
  3. `relief`/`reliefOf`: each level lifted one step and filled flat in its altitude colour, like one block of a print. `bleed` draws the plan wider than the frame, so the low land runs off both edges (it closes out of view), and long straight sides are split before smoothing, so no corner rounds across the drawing. Rings under `minArea` are dropped at every level (a smaller summit cap would float above its peak).
- **Components:**
  - `Relief` draws it (presets `hero`, `cover`, `wide`).
  - `HeroRange` adds the sky (`Sky`) and the drift.
  - `ProjectMountain` shows a project's uploaded cover or its own mountain with its glyph, inside a `MountainFrame` (fixed ratio, view-transition name).
  - `PanoramaBoard` draws the work index's board with the same engine: a crest with one summit per project (`lib/terrain/panorama.ts`), stretched to its own shape (`fit="none"`) under the names, each leader line ending on the highest sheet drawn at its summit.
- **The same markup on the server and in the browser:** only exact arithmetic (no sin, cos, exp or fractional powers) in the terrain, and every coordinate rounded. A new landform must keep to that, or hydration mismatches.
- **Budgets:** the hero stays under 35 kB of markup, a cover under 8 kB (`tests/unit/terrain.test.ts`).

### Kathmandu at this hour (`lib/daylight.ts`)

- **Sky:** the sky, the low sun and the alpenglow come from the sun's real position over `HOME` (Asia/Kathmandu; a design setting, change it there).
- **Hydration:** the public profile read carries `generatedAt`. Pass it to `useMinuteClock` so the server and the first browser render draw the same moment, then the clock follows the minute.
- **Time line:** `HomeTime` prints Kathmandu's time; the gap to the visitor's clock appears only in the browser, in a reserved line.

### Archival pictures (`lib/archive.ts`)

- **The pictures:** five public-domain pictures (Sella's 1899 photographs, Kangchenjunga at first light, Kathmandu about 1920, Landon's 1928 map of the valley). They are in `public/himal/` as WebP at two widths, with alt text and captions in both languages.
- **Showing one:** `ArchivalFigure` frames it at a fixed shape, lazy, in the field's duotone.
- **Credits:** the footer lists every one, linking to its Wikimedia Commons page.
- **Adding one:** licence-check it (public domain or CC BY with the credit), crop it, save the two widths, add it to `ARCHIVE` with its messages, and record its origin beside it (`<file>.webp.json`: impeccable's `embed-prompt <file> --prompt "<creator, date, licence, page>"`).

### Motion (CSS, plus one small script)

Content is visible and at rest by default. Animations run on screens where supported, for readers who haven't asked for reduced motion. Only transform, translate, clip-path and colour move (0109, 0181), and nothing that runs on load may repaint the art: an SVG's children get no compositor layer, so animating them repaints the whole drawing every frame.

| Effect | How |
| --- | --- |
| The map rises on load: each band of altitude lifts from the flat map into relief, the low land first | `.hm-relief[data-print] .hm-relief-band`, `hm-lift` (transform only) staggered by `--hm-depth` |
| The name rises word by word | `FittedName animate` (`hm-name-in`, `--hm-i`) |
| Scrolling spreads the sheets apart | `.hm-relief-depth`, `animation-timeline: scroll(root)` |
| The cursor moves the sheets by depth | `art/drift.ts` (after hydration, fine pointers, paused offscreen) |
| Section parts rise into view | `hm-reveal` with `--hm-i` (`animation-timeline: view()`) |
| Archival pictures settle from a slight zoom | `hm-settle` |
| The work index's preview follows the pointer and focus | `SelectedWorkSection` state |
| A mountain morphs into the case study | `MountainFrame transitionSlug` + `<Link viewTransition>` |
| Reading progress on articles | `hm-progress`, `scroll(root)` |
| A page loading: a line of ink grows across the top | `NavigationProgress className="h-1 bg-hm-ink"` in the layout (0201) |
| A slow page: a panorama printed over and over, bands rising low land first and sinking snow first | `PortfolioPending` (`chrome/portfolio-pending.tsx`), `.hm-printing`, `hm-print-0…2`; the layout passes it to `SectionPending` (0201) |

**The home page's hydration:** each section below the hero is a `Slice` (`pages/home-page.tsx`), its own Suspense boundary, so React hydrates it as a separate task (0201). A new home section goes in a `Slice`.

### Fonts and layout shift

- **Preloads:** the layout preloads Eczar Latin and Inter, plus both Devanagari files on Nepali pages (`lib/fonts.ts`, production only). All are under the bundle check's 150 kB.
- **Fallbacks:** "Eczar Fallback" (Times New Roman or Liberation Serif) and "Eczar Devanagari Fallback" (Nirmala UI), one face per weight range, with `size-adjust` and ascent/descent measured in Chrome. A new weight for large type needs its own measurement.
- **Eczar's own metrics are overridden:** `himal.css` declares the Eczar faces itself (not Fontsource's stylesheet) with `ascent-override`/`descent-override` (0.88/0.24 em Latin, 1.0/0.36 em Devanagari). Eczar ships 1.14/0.63 em, and large type's text box then spilled half an em past its line, so a big link caught clicks on the text above it. The fallbacks are measured against these overrides.
- **Never inline fonts:** the CSP's `font-src 'self'` blocks `data:` fonts.

## Chrome

- **Header:** the root renders no header (each section brings its own, 0161). The portfolio's reuses the app's `LanguageSwitcher` and `ThemeToggle`, and its `<main>` is the root skip link's target (`MAIN_CONTENT`).
- **No session:** no portfolio page reads the session, so the layout sets `staticData: { session: "skip" }` and nothing looks it up, on the server or after hydration (0161).
- **Phone menu:** a native `<details>`, so it works before hydration. Escape and choosing a link close it.
- **404:** a layout's `notFoundComponent` replaces the layout itself, so it renders `PortfolioShell` around `PortfolioNotFound`. The layout's head carries `noindex` as a fallback that every page's `seo()` overrides.

## SEO

- **Indexable pages:** every page uses `seo()`, and all are in `INDEXABLE` (`tests/unit/route-seo.test.ts`).
- **JSON-LD:** `WebSite` and `Person` (home), `ProfilePage` (about), `CollectionPage` (work), `Blog` (journal), `CreativeWork` (case study), `BlogPosting` (article). All of them point to one `Person` `@id`.
- **Filtered views:** a filtered work index is `noindex`, with its canonical on the full list.
- **Social image:** a project's cover or the profile's social image when set, otherwise `public/himal/og.png` (`himalOgImage`), the range at dawn rendered once from the art. Re-render it by hand if the art or the name changes; nothing generates it per page.

## Tests and stories

- **Unit:** `portfolio-data` (the demo content against the admin schemas, the seed conversions), `portfolio-lib` (localized fallback, metrics, seeds, reading time, `cn`), `terrain` (determinism, closed rings, markup budgets, the panorama, sunrise and sunset, the phases, the fitting), `himal-tokens` (contrast on every field).
- **Server (PGlite):** `portfolio-admin` (projects, posts, sections, profile, the contact form and inbox, the media library: versions, publish rule, reorder, usage, audit) and `portfolio-public` (published only, previews, fallback marking).
- **e2e:** `e2e/flows/portfolio.spec.ts`: create, publish and reorder a project (it appears on `/`), a draft only in a preview, the contact form reaching the inbox and the owner's email.
- **Components:** `tests/components/portfolio` (menu, copy email, the work index's active project, the time line on the server and in the browser) and `tests/components/layout/section-headers.test.tsx` (each section's header; the layout skips the session).
- **Stories:** `Portfolio/*`: the art (every sky phase, every motif, the panorama), primitives, every home section, chrome, case study and lists. They render the demo content (scripts/lib/portfolio-data) shaped like the public reads, through `components/story-helpers.tsx`.
- **Browser review:** the standard one (testing guide) on a production build: all seven pages plus a filtered index and the 404, and every admin page of the section, en/ne × light/dark × 390/768/1280.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **A layout's `notFoundComponent` replaces the layout:** a `notFound()` thrown inside the section renders without the layout's wrapper, so it must render the shell itself (`PortfolioShell` in `routes/_site.tsx`).
- **Custom `text-*` sizes and tailwind-merge:** `cn("text-hm-head", "text-hm-accent")` drops the size with the app's `cn` (both look like colours). Portfolio components import `cn` from `features/portfolio/lib/cn.ts`, which registers the scale.
- **Reordering keeps the version:** moving a project or a section entry sets `updatedAt` to itself, so `$onUpdate` doesn't bump it and an open edit of that record isn't stale (0176).
- **Seeds read rows, not row counts:** PGlite reports `affectedRows` 0 for a `select`, so an "is it seeded?" check looks at `rows.length` (`scripts/lib/portfolio-seed.ts`).
- **A fallback face per weight:** Eczar widens as it gets bolder, so each weight range used for large type has its own measured fallback face (0184). A new weight for large type needs its own `size-adjust`.
- **Exact arithmetic in the art:** the terrain runs on the server and again in the browser during hydration. `Math.sin`, `Math.exp`, `Math.hypot` or `**` can differ in the last bit between engines and print a different path, which is a hydration mismatch. Use the polynomial helpers (`smoothstep`, `triangle`), `Math.sqrt` and plain multiplication, and round what reaches the markup (0180).
- **The clock hydrates from the read time:** anything that depends on "now" (the sky, the time line) takes `generatedAt` through `useMinuteClock`; reading `Date.now()` during render mismatches on hydration (0182).
- **Text on a field takes the field's tokens:** an art label inside a field (a cover's glyph on the ridge field) inherits that field's ink. Text on the art's own sky uses `--hm-on-sky`.
- **Animating the art repaints it:** a clip-path or transform on the `<path>`s or `<g>`s inside an SVG is painted on the main thread, the whole drawing every frame. The first print-on-load cost the home page 720 ms of blocking under Lighthouse's mobile throttling. Move whole SVGs (or their wrappers) with transform, which the compositor does alone (0181).
- **Lighthouse on the harness server:** `node e2e/harness/server.ts` serves files uncompressed, which Vercel never does, so a run against it measures slow-4G downloads of raw JavaScript. Put a compressing proxy in front, and read its simulated score against a template page such as `/login` (0181).
- **Lazy pictures in dev:** `pnpm dev` keeps devtools streams open, and the browser's six connections to localhost can queue lazy images forever. Review pictures on a production build (`node e2e/harness/server.ts`).
- **`content-visibility: auto` on sections hides their field from checkers:** hit testing doesn't reach a skipped section's contents, so axe measured the pine and ridge fields' light text against the page's snow and the browser review failed `/` in light. It's off (0201).
