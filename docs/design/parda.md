# Parda's design record: "Masking"

This is the design system of Parda (`/app/parda`) as it shipped at the end of Part 6 (Task 70). It is written from the build: `src/styles/parda.css`, `src/features/parda/kit`, `shell` and `player`. Where the build and the direction contract ([.impeccable/surfaces/parda.md](../../.impeccable/surfaces/parda.md)) differ, this file says what the build does and lists the difference under "Known gaps". Decisions 0232 (the look), 0233 (frame and kit) and 0244 (the finish review) explain the choices. The admin at `/admin/parda` stays on Graphite and is not covered here.

## Thesis

The page is a cinema screen: two masks hold all the interface, and the screen between them fits each picture's real shape. Text stays in the masks, so the picture is never faded, tinted or written on, apart from one subtitle line over its scrim.

## Colour

Every token lives in `src/styles/parda.css`, scoped to `html[data-section="parda"]` (light) and `html[data-section="parda"].dark` (dark). Tailwind names them `bg-pd-mask`, `text-pd-ink` and so on. Dark is the default: "system" resolves to dark on the server (0232).

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--pd-mask` | `oklch(0.135 0.0047 285.8)` | `oklch(0.876 0.0113 89.7)` | The masks: top mask, lower mask, footer, tab bar, missing-picture boxes, the Top 10's rank strip |
| `--pd-ground` | `oklch(0.174 0.0061 285.7)` | `oklch(0.934 0.0099 87.5)` | The page, one step lighter than the masks |
| `--pd-ground-2` | `oklch(0.22 0.0077 285.7)` | `oklch(0.885 0.0113 89.7)` | One step up: an empty picture box before its file, menus, secondary fills |
| `--pd-ink` | `oklch(0.959 0.0098 87.5)` | `oklch(0.187 0.0026 67.7)` | Text, rating stars, Top 10 numbers, avatar letters |
| `--pd-muted` | `oklch(0.726 0.0149 88.7)` | `oklch(0.413 0.0121 87.5)` | Secondary text: facts, captions' detail line, inactive links |
| `--pd-action` | `oklch(0.881 0.1613 96.9)` (yellow) | `oklch(0.187 0.0026 67.7)` (ink) | The primary fill (Play) and on-states: a checked My list, a filled heart, the current link's bar, the current slide |
| `--pd-on-action` | `oklch(0.199 0.0414 100.7)` | `oklch(0.881 0.1613 96.9)` (yellow) | Text on the action fill |
| `--pd-subtitle` | `oklch(0.881 0.1613 96.9)` | same | The tagline on a picture, always over `pd-scrim` |
| `--pd-on-picture` | `oklch(0.985 0.005 90)` | same | Any other text that must sit on a picture |
| `--pd-scrim` | `oklch(0 0 0 / 72%)` | same | The band under the subtitle |
| `--pd-progress` | `oklch(0.881 0.1613 96.9)` | same | Watched-so-far bar |
| `--pd-track` | `oklch(0 0 0 / 55%)` | same | The bar's track |

- The last five tokens sit on pictures, so they are the same in both themes.
- **Yellow has three jobs only** (0244): the subtitle, the progress bar, and the action (its fill in dark, its text in light). Stars, ranks and avatar letters are ink.
- `parda.css` also redefines Graphite's tokens (`--background`, `--primary`, `--border`, `--ring`, `--destructive` and the rest), so the shared kit (buttons, menus, dialogs, toasts) takes the look without variants. Borders are `oklch(1 0 0 / 12%)` in dark and `oklch(0 0 0 / 14%)` in light. The focus ring is yellow in dark and ink in light.
- Destructive: `oklch(0.704 0.191 22.216)` dark, `oklch(0.46 0.19 27.5)` light.
- Native checkboxes, radios and ranges take `accent-color: var(--pd-action)` (0249).
- Text selection is subtitle yellow with `oklch(0.199 0.0414 100.7)` text.
- The browser's UI takes the mask colour: `PARDA_BRAND.themeColors` is `#08080a` dark and `#d9d6ce` light (`src/features/parda/brand.ts`).
- The brand's `accent: "amber"` is never seen: `--primary` is redefined in both themes.

## Type

**Families.**
- Display: Anek Devanagari, as `font-pd-display` ("Anek Display", then metric-matched Arial and Nirmala UI fallbacks). Latin uses the variable file with the width axis (114 kB). Devanagari uses the static 700 cut (95 kB), because the variable Devanagari files are over the 150 kB preload budget.
- Text: Inter (Latin) and Noto Sans Devanagari (Nepali), the app's text faces.
- Preloads (`src/features/parda/lib/fonts.ts`): two per locale, production only. English loads Anek Latin and Inter. Nepali loads Anek Devanagari and Noto Sans Devanagari.
- The `@font-face` rules override Anek's vertical metrics (ascent 92%, descent 28% for Latin; 100% and 40% for Devanagari), so a large title's box matches its line.

**The `pd-display` utility.** Weight 700, `font-stretch: 125%` (wide), line height 1, tracking -0.015em. Use it for every display line. Anek is display only: never set body text in it.

**Scale.**

| Token | Value | Size at 390 to 1280 | Use |
| --- | --- | --- | --- |
| `text-pd-title` | `clamp(2.25rem, 1.48rem + 3.15vw, 4rem)` | 36 px to 64 px | A title in the lower mask (billboard, title page), a missing picture's label on the billboard |
| `text-pd-head` | `clamp(1.625rem, 1.5rem + 0.55vw, 2rem)` | 26 px to 32 px | Rail headings, page headings, the 404 |
| `text-pd-sub` | `clamp(1.125rem, 1rem + 0.5vw, 1.5rem)`, line height 1.3 | 18 px to 24 px | The subtitle on a picture |

Smaller fixed sizes: the wordmark at 1.375rem, the Top 10 rank at 2.5rem, a poster preview's title at `text-lg`. Captions are `text-sm` (title) and `text-xs` (detail). Facts lines are `text-sm` muted. Tab bar labels are 0.6875rem.

**Nepali.**
- `pd-display` under `:lang(ne)` drops the negative tracking and sets line height 1.2. Title boxes repeat this (`[&:lang(ne)]:leading-[1.2]`).
- Nepali display type is one weight (700) at one width: the static cut has no width axis.
- A Nepali title counts only when it is written in Devanagari. Otherwise the English title is shown (`nepaliName`, 0244), never TMDB's third-language original.
- The wordmark "Parda" is Latin in both languages (`lang="en"`).
- Numbers, years, clocks and dates go through `formatNumber` and `formatDate`, so Nepali pages print Devanagari digits. Years have no grouping.

Sentence case everywhere ("My list", not "My List").

## Layout

**The frame** (`src/features/parda/shell/parda-frame.tsx`) is on every page, sign-in, sign-up and the 404 included.
- **Top mask:** sticky, always solid `--pd-mask`, 60 px (`h-15`). The wordmark sits at the start, the section links beside it from `md`, and search, theme, bell and account at the end. My list and the language switcher join at `lg`, About at `xl`. The current link is ink with a 2 px inset bar in the action colour. Nothing in the top mask sits on a picture.
- **Tab bar:** phones only (hidden from `md` by CSS, so hydration moves nothing). It is fixed to the bottom, in the mask, 56 px tall (`h-14`) plus the safe area, with an icon and a label per section. The frame pads the page by the same height.
- **Footer:** in the mask. It holds Parda's wordmark, About, Schedule, the language on phones, and the analytics choice. No catalogue provider is named anywhere in Parda (decision 0249).
- **Gutters:** `px-4`, `sm:px-6`, `lg:px-8` for every mask and rail.

**Screen shapes.** A picture keeps its real shape. The masks take whatever space is left.

| Where | Shape | Rule |
| --- | --- | --- |
| Home and hub billboard, `md` | 2.39:1 | Full width, under the top mask |
| Home and hub billboard, `lg` and up | The screen's own | Picture and lower mask fill exactly the first screen under the top mask (`100svh - 3.75rem`, at least 32rem); the backdrop is cover-fit in what the lower mask leaves (0249) |
| Home and hub billboard, phones | 2:3 poster | Narrowed to `(100svh - 22.5rem - safe area) * 2/3`, so the lower mask and Play clear the tab bar; the masks close in at the sides (325 px at 390×844, 0244) |
| Title page | 16:9 | `max-w-[max(24rem, (100dvh - 20rem) * 16/9)]`, centred in the mask |
| Collection page | 16:9 | Same rule with 16rem |
| Player | 16:9 | `max-w-[max(20rem, (100dvh - 12rem) * 16/9)]`; theater mode `(100dvh - 7.5rem) * 16/9` |
| Posters and people | 2:3 | `TmdbImage aspect="poster"` |
| Backdrops, stills, trailers | 16:9 | `aspect="backdrop"` |

**The lower mask** follows every screen. It holds the title in `text-pd-title`, the facts line (year, runtime or seasons, certificate, rating), and the actions. On `md` and up the title sits at the start and the actions at the end. On phones they stack, and the actions sit in a row. The billboard's title box has one height: two lines on phones, one from `md`. A title over 22 characters is set at half size in two lines from `md`.

**Max widths.** Prose (About, a person's biography) is `max-w-3xl`. Facts lists and the profiles page are `max-w-4xl`. The search field is `max-w-2xl`. A subtitle is `max-w-3xl`. Rails run the full width.

## Components (the media kit)

| Piece | What it is | File |
| --- | --- | --- |
| `PardaFrame` | Top mask, page, footer, tab bar | `shell/parda-frame.tsx` |
| `PardaMark`, `PardaWordmark` | A lit yellow screen at 2.4:1 between two masks, square; the mark plus "Parda" in wide Anek | `shell/parda-mark.tsx` |
| `PardaSection`, `PardaNotFound` | The layout component, and the 404 in the frame with its heading in `pd-display text-pd-head` | `shell/section.tsx` |
| `TmdbImage` | A picture in a fixed box (`poster` 2:3, `backdrop` 16:9, `scope` 2.39:1), cover-fit to a hard edge, lazy unless `priority` | `kit/tmdb-image.tsx` |
| `Billboard`, `BillboardSkeleton` | The home's screen, subtitle and lower mask; three pictures mounted at most; moves every 6 s (4 s on phones) | `kit/billboard.tsx` |
| `PosterCard` | Poster and caption under it; a preview on a resting mouse (never on touch); optional corner action | `kit/cards.tsx` |
| `BackdropCard`, `EpisodeCard`, `PersonCard` | A 16:9 card; an episode row with its still; a 2:3 portrait with the part or job | `kit/cards.tsx` |
| `Rail`, `RailItem`, `RailSkeleton` | Scroll-snap row, a named region, arrow buttons for fine pointers | `src/components/data-display/rail.tsx` |
| `Top10Rail` | Posters in rank order, the rank in a mask strip under each, beside the title | `kit/top10-rail.tsx` |
| `RatingBadge` | Star and score in ink; a score of 0 renders nothing | `kit/badges.tsx` |
| `CertBadge` | The certificate, ruled (1 px border), not filled, so it reads as a label | `kit/badges.tsx` |
| `ProgressBar` | 4 px, yellow on its dark track in both themes, flush under a picture | `kit/badges.tsx` |
| `ShieldControls`, `playerBox` | Play, clock, seek, fullscreen and *Player menu* under the player | `player/player-chrome.tsx` |
| `CatalogUnconfigured` | An unlit screen with one subtitle line, and the owner's next step in the mask | `home/catalog-unconfigured.tsx` |

Rules every piece follows:
- Captions sit under pictures, never on them. A caption is two lines of title and one of detail, so cards line up.
- Pass `alt=""` when the caption names the title.
- A whole card is one link. Its focus ring is 3 px, offset 2 px from the page ground.
- Cards have no border, fill or shadow. The picture is the card.

## Motion

- One ease: `--pd-ease: cubic-bezier(0.16, 1, 0.3, 1)`.
- Two durations: `--pd-duration` 420 ms (`pd-move`), `--pd-duration-quick` 160 ms (`pd-press`).
- `pd-move` transitions transform and opacity: billboard pictures cross-fade with it.
- `pd-press` scales to 0.98 while pressed: every card link has it.
- Only transform and opacity move. Both utilities exist only inside `@media (prefers-reduced-motion: no-preference)`.
- **Reduced motion:** nothing transitions. The billboard never advances on its own (JavaScript checks the media query), and its pause button is hidden by CSS (`motion-reduce:hidden`), so nothing shifts on hydration.
- **The billboard stops** for its visible pause button, a resting mouse, focus inside it, and a hidden tab (WCAG 2.2.2).

## States

- **Loading:** every piece has a skeleton of exactly its size: `BillboardSkeleton` (same screen and title box), `PosterCardSkeleton`, `BackdropCardSkeleton`, `EpisodeCardSkeleton`, `PersonCardSkeleton`, `Top10RailSkeleton` (with its mask strip), `RailSkeleton`. Streamed rails replace them with no shift. Skeletons are square (`rounded-none` where the shared one rounds).
- **No picture:** the box keeps its shape and becomes a piece of mask holding the title in `pd-display`, muted (`text-lg` in cards, `text-pd-title` on the billboard). A person without a portrait shows a user icon instead.
- **No tagline:** the subtitle and its scrim are left out. Nothing fills the line.
- **Couldn't load:** a rail TMDB couldn't answer keeps its heading and one muted line ("This row couldn't load. Try again in a moment.") in a box a poster tall. Episodes and the schedule use the same wording.
- **Empty:** the library and similar lists use the shared `EmptyState` (kept, 0244). A rail with no titles renders nothing.
- **No catalogue configured:** `CatalogUnconfigured`.
- **No title logo in light:** TMDB logos are drawn for dark grounds, so the logo shows in dark only, and the title text shows in light (kept, 0235 and 0244).

## Accessibility the build enforces

- **Contrast:** `tests/unit/parda-tokens.test.ts` checks every text pair at 4.5:1 in both themes. It checks subtitle text over the 72% scrim on a pure white picture at 4.5:1, and the progress bar on its track at 3:1. Change a token, run the test.
- **The scrim band:** `pd-scrim` is solid for 4.5rem on phones and 5.5rem from `md`, then fades to nothing 2.5rem higher. Keep a subtitle to two lines inside the solid band. A 45% gradient was tried and fails the test (0244).
- **Focus:** every link and button shows a 3 px ring (`focus-visible:ring-[3px]`), yellow in dark and ink in light.
- **Motion:** the test above also checks that only transform and opacity move, with one ease, only under `no-preference`.
- **Layout shift (CLS ≤ 0.01):** pictures have their aspect box before the file arrives. Title boxes, caption lines and facts lines have fixed heights. Skeletons match their pieces. The tab bar is in the server's HTML.
- **Text on pictures is hidden from screen readers** (`aria-hidden`) and repeated as `sr-only` text in the mask, so it is read once and in order.
- **The billboard** follows the WAI-ARIA carousel pattern: a region with a role description, a slide group with its position, and `aria-live` polite only while stopped.
- The browser review (`pnpm test:e2e`) runs axe, overflow, console and CLS checks on every page in en/ne, light/dark, 390/768/1280.

## Don'ts

- Don't fade the billboard into the page under a transparent header. The top mask is always solid, and pictures end at a hard edge.
- Don't put text on a picture, except the subtitle (or `--pd-on-picture` text) over `pd-scrim`. Titles, ranks, badges and captions go in the masks.
- Don't tint, blur or gradient a picture into the page.
- Don't put cards around content: no bordered or shadowed boxes around rails, facts or sections.
- No eyebrows or kickers above headings.
- Corners are square: `--radius` is 0 inside Parda, whatever the visitor picked for the admin. Don't add `rounded-*`.
- Don't use yellow for anything beyond its three jobs.
- Don't set body text in Anek.
- Never imitate a real streaming service (PLAN 12.6). For example, no big rank numerals beside or over posters.
- Keep Nepal quiet. It shows in the name and in first-class Nepali type, not in motifs, flags or patterns.

## Known gaps

- **The watch page's lower mask** (left for later, the owner's call in 0244). The contract puts the title at the left of the lower mask, the servers as plain buttons, one ad-blocker button and a full-width progress line. The build has the Task 64 layout (0236): a control row under the player (play, clock, seek, fullscreen, *Player menu*, Theater, My list, heart, Report, Watch together, and a server menu), the ad-blocker note under the description, and the title below the mask on the page ground.
- **The seek bar** is a native range input tinted with the action colour, with the browser's round thumb. The review kept it as shared kit (0244). It is not a Parda pattern to copy.
- **`PlayerFrame`'s default class** (`rounded-md border`) is the admin player lab's box, on Graphite. Parda's watch page passes `playerBox()` instead. Don't reuse the default inside Parda.
- **The masks don't glide between pages yet.** The contract's signature interaction (masks moving to the next picture's shape on navigation) is not built. Each page draws its masks in place, and only the billboard's pictures cross-fade with `pd-move`.
