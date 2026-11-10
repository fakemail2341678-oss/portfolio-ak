# Chaal's design record: "Diagram"

This is the design system of Chaal (`/app/chaal`) as it stands after Task 85. It is written from the build: `src/styles/chaal.css`, `src/features/chaal/look`, `shell` and `board`, and the play pages' layout. Where the build and the direction contract ([.impeccable/surfaces/src-routes-chaal-route-tsx.md](../../.impeccable/surfaces/src-routes-chaal-route-tsx.md)) or the approved comps differ, this file says what the build does and lists the difference under "Departures". Decisions 0258 (the look), 0259 (the shell), 0261 (the game model), 0262 (the board) and 0267 (the play layout) explain the choices. The admin at `/admin/chaal` stays on Graphite and is not covered here.

## Thesis

The board is a printed chess diagram: white squares, dark squares hatched in ink, a heavy double frame, and the coordinates set outside it. Around it the page is paper and ink with one spot colour, vermilion, the annotator's pencil. Dark mode reverses the chrome, never the diagram.

## Colour

Every token lives in `src/styles/chaal.css`, scoped to `html[data-section="chaal"]` (light) and `html[data-section="chaal"].dark` (dark). Tailwind names them `bg-ch-ground`, `text-ch-ink` and so on. There is no default scheme: "system" follows the device (0259).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ch-ground` | `oklch(0.9608 0.0054 95.1)` (warm paper) | `oklch(0.1818 0.002 106.6)` (ink-black) | The page, the top bar, the tab bar |
| `--ch-plate` | `oklch(1 0 0)` | `oklch(0.2174 0.0019 106.6)` | Raised surfaces: menus, dialogs, inputs, notices, a row's hover |
| `--ch-ink` | `oklch(0.1957 0 0)` | `oklch(0.9397 0.0096 93.6)` | Text, rules, the primary fill, the running clock, the current link's bar |
| `--ch-on-ink` | `oklch(0.9608 0.0054 95.1)` | `oklch(0.1818 0.002 106.6)` | Text on an ink fill |
| `--ch-muted` | `oklch(0.4669 0.008 97.5)` | `oklch(0.7118 0.0103 93.6)` | Secondary text: ratings, captions, coordinates, move numbers, the waiting clock |
| `--ch-hair` | `oklch(0.8788 0.0097 93.6)` | `oklch(0.3081 0.0053 106.7)` | Hairlines between rows, borders, a move's hover |
| `--ch-mark` | `oklch(0.5443 0.1796 33.6)` | `oklch(0.7092 0.1856 34.8)` | Vermilion as text: annotation symbols, the current move's underline, the eval graph's mark |
| `--ch-danger` | `oklch(0.4723 0.1624 30.1)` | `oklch(0.7594 0.1435 26.1)` | Destructive, a typed move's error |
| `--ch-paper` | `oklch(1 0 0)` | `oklch(0.9276 0.0096 93.6)` | The board's paper, dimmed a step in dark; halos round marks |

The board's tokens are the same in both themes, apart from the paper:

| Token | Value | Use |
| --- | --- | --- |
| `--ch-sq-light`, `--ch-sq-dark` | `var(--ch-paper)` both, in "diagram" | Squares |
| `--ch-sq-hatch`, `--ch-sq-pattern` | `oklch(0.1957 0 0)`; `repeating-linear-gradient(135deg, hatch 0 1px, transparent 1px 5.5px)` | The dark square's hatching |
| `--ch-sq-mark` | `oklch(0.5443 0.1796 33.6)` | The last move's ring, selection, premove, check, engine arrows |
| `--ch-sq-dot` | `oklch(0.1957 0 0)` | Legal-move dots and capture rings |
| `--ch-frame` | `oklch(0.1957 0 0)` | The plate's frame, the eval bar's ink half, the player's own arrows |

- **Vermilion has five jobs only** (0258): the last move's ring, annotation symbols, the current move's underline, check, and engine arrows. It is never a button, a link or a badge.
- **The primary action is ink:** an ink fill with paper text in light, a paper fill with ink text in dark.
- **The board stays paper in both themes.** Its frame, hatching and dots stay ink-black in dark too, and so does the mark (`ChaalMark`).
- `chaal.css` redefines Graphite's tokens (`--background`, `--card`, `--popover`, `--primary`, `--border`, `--input`, `--ring`, `--destructive` and the rest), so the shared kit takes the look without variants. `--input` is ink at 40%. The ring is ink. The dark block repeats `--primary`, `--ring` and `--accent-subtle`, because `.dark[data-accent]` outranks the light rule.
- Native checkboxes, radios and ranges take `accent-color: var(--ch-ink)`. Selection is ink with on-ink text. Scrollbars are muted on the ground.
- The browser's UI: `CHAAL_BRAND.themeColors` is `#f3f2ee` light and `#121211` dark (`src/features/chaal/brand.ts`). The brand's `accent: "indigo"` is never seen.

## Type

**Families.**
- Display: Mukta 800 (Ek Type, OFL), as `font-ch-display` ("Chaal Display"). One static cut per script: Latin 21 kB, Devanagari 101 kB. Fallbacks are metric-matched in Chrome: "Chaal Fallback" (Arial Bold, `size-adjust` 91.09%) and "Chaal Devanagari Fallback" (Nirmala UI Bold, 86.06%).
- Text: Inter (Latin) and Noto Sans Devanagari (Nepali), the app's text faces.
- Preloads (`src/features/chaal/lib/fonts.ts`): two per locale, production only. English loads Mukta Latin and Inter. Nepali loads Mukta Devanagari and Noto Sans Devanagari.
- The `@font-face` rules override Mukta's vertical metrics (ascent 92%, descent 28% for Latin; 100% and 40% for Devanagari). Mukta ships 1.13 / 0.53 em, which would spill a clock's box far past its line.

**The `ch-display` utility.** Weight 800, line height 1, tracking -0.01em. Use it for clocks, headings, the wordmark, the result's score and the eval bar's figure. Mukta is display only: never set body text in it.

**`ch-figures`** sets tabular numbers. Every clock, rating, rank and coordinate that can change in place uses it.

**Scale.**

| Token | Value | Size at 390 to 1280 | Use |
| --- | --- | --- | --- |
| `text-ch-clock` | `clamp(2.5rem, 2.17rem + 1.35vw, 3.25rem)` | 40 px to 52 px | Clocks |
| `text-ch-title` | `clamp(2.125rem, 1.85rem + 1.12vw, 2.75rem)` | 34 px to 44 px | Page titles, the 404 |
| `text-ch-head` | `1.5rem` | 24 px | Section heads, the result banner, the "More" sheet's title |

Smaller fixed sizes: the wordmark at 1.375rem, tab bar labels at 0.6875rem, the eval bar's figure at 0.6875rem. Coordinates are `text-xs` muted. Ratings and a strip's note are `text-xs` muted. Move lists and openings are `text-sm`.

**Nepali.**
- `ch-display` under `:lang(ne)` drops the negative tracking and sets line height 1.2.
- The wordmark is "Chaal" (`lang="en"`) and "चाल" (`lang="ne"`, muted) side by side in both languages.
- Notation on screen is figurine SAN by default (♘f3), which reads the same in both languages. Letters are a preference. PGN is always letters.
- Clocks are `dir="ltr"`. Square names (e4) and opening names (`lang="en"`) stay Latin.

Sentence case everywhere.

## Layout

**The frame** (`src/features/chaal/shell/chaal-frame.tsx`) is on every page, sign-in, sign-up and the 404 included. Each page renders its own `<main>`.
- **Top bar:** sticky, `--ch-ground`, 58 px (`h-[3.625rem]`), ruled off with a 2 px ink line (`border-b-2`). The wordmark at the start; the sections (Home, Play, Puzzles, Analysis, Watch) from `md`; at the end search (with its ⌘K hint from `lg`), the language from `lg`, theme from `sm`, the bell, and the account. The current section is ink with a 2 px inset ink bar under it; the others are muted.
- **The account button** is an outline button with a connection dot: ink when connected, an open ring when not, a danger ring when Lichess needs a reconnect (0259).
- **Tab bar:** phones only (hidden from `md` by CSS, so hydration moves nothing). Fixed to the bottom, 56 px (`h-14`) plus the safe area, ruled off with a 2 px ink line. Home, Play, Puzzles, Analysis, Watch and More, each an icon and a label; the current one is ink and semibold. The frame pads the page by the same height. "More" opens a bottom sheet with players, tournaments, teams, studies, settings, about, search and the language, in hairline rows.
- **A phone on its side** (`land:`, landscape under 32rem tall; 0267): the tab bar hides, the top bar carries the sections, and the notices wait on game pages.
- **Footer:** a hairline above, muted `text-sm`. "Powered by Lichess, not affiliated" on every page, about, credits, the engine's source, the language below `lg`, the analytics choice.
- **Zen** (a game's page, `z` or the preference): no top bar, notices, footer or tab bar. A ghost "Exit zen" button sits above the board for touch screens.
- **Gutters:** `px-4`, `sm:px-6`, `lg:px-8`. The frame's content is `max-w-7xl`.

**Board first** (0267, `shell/play-layout.tsx`).
- The board is as wide as its container and square. From `lg` it is capped by the height left under the chrome: `100dvh − 15rem` on play pages (a live game, a local game, a replay), `100dvh − 10.5rem` on analysis and puzzles.
- From `lg` the play grid is two columns: the board's column and a side column of `minmax(18rem, 24rem)`, `gap-x-8`. Zen makes it one column.
- On a phone held upright the board runs edge to edge (no side gutter below `sm`). The opponent's strip is above it, yours below, then the controls in thumb reach and the move strip.
- On a phone on its side the board's column becomes two: the board at `100dvh − 5.5rem`, and the strips and controls beside it.

**Rules, not boxes.** A section head is `ch-display` with `ch-rule` (2 px ink line above, `pt-4`). Rows are separated by `ch-hairline`. Lists are rows that tint to `ch-plate` on hover. Corners are square: `--radius` is 0 inside Chaal, whatever the visitor picked for the admin.

## The board and its plate

**The plate** (`board/plate.tsx`, shared by `Board` and `MiniBoard`):
- `ch-frame`: a 5 px `--ch-frame` border, then a 1 px ink outline 4 px outside it.
- Coordinates sit outside the frame: ranks in a 0.875rem column at the start, files in a 0.875rem row below, `text-xs` muted, `aria-hidden`. The `coordinates` preference turns them off.
- The inner box is `aspect-square` and takes its width from the container, so a board never shifts the layout.
- Squares are HTML, not SVG, so a board theme's CSS pattern applies (0259, 0262): `ch-sq-light` and `ch-sq-dark`.

**Board themes** (`CHAAL_BOARD_THEMES` in `look/board-themes.ts`), chosen by `data-ch-board` on the plate:

| Theme | Light square | Dark square | Marks |
| --- | --- | --- | --- |
| `diagram` (default, no attribute) | paper | paper, hatched in ink at 135° | vermilion |
| `print` | `oklch(0.9635 0.0067 97.4)` | `oklch(0.829 0.0112 95.2)`, flat | vermilion |
| `stone` | `oklch(0.9192 0.0141 88.7)` | `oklch(0.7397 0.0268 86.9)`, flat | ink (vermilion falls under 3:1 on taupe) |

**Marks are rings and outlines, never fills** (0262), so they read on hatching:
- Last move: a 3 px `--ch-sq-mark` square outline on both squares.
- Selected: the same outline with a 3 px inset paper halo.
- Premove: the outline dashed.
- Check: a 4 px round ring inside the king's square.
- Legal targets: an ink dot (28% of the square) with a 3 px paper halo; a capture is a 3 px ink ring with paper halos.
- Keyboard cursor (grid focused): an inset 3 px frame-ink square with a 3 px paper halo inside it.
- Shapes (SVG over the squares, 90% opacity): arrows and circles in vermilion for the engine and the annotator, in ink for the player's own (right-drag, right-click).
- Promotion: a column of four paper squares with 2 px frame borders over a 70% paper veil; focus is an inset vermilion ring.

**Pieces:** cburnett, the twelve original SVGs in `public/chaal/pieces/cburnett/`, used under the 3-clause BSD licence (`LICENSE.txt` beside them, credited on the about page; 0258). `CHAAL_PIECE_SETS` is `["cburnett"]`; a new set is a folder.

**`MiniBoard`** (`board/mini-board.tsx`): a static diagram from a FEN, drawn on the server, in the player's board theme, with marked squares as vermilion outlines. It draws the home's hero, the settings' theme swatches and the board in lists.

## Components particular to Chaal

| Piece | What it is | File |
| --- | --- | --- |
| `ChaalFrame` | Top bar, notices, page, footer, tab bar, palette, shortcuts | `shell/chaal-frame.tsx` |
| `ChaalMark`, `ChaalWordmark` | Four squares of a diagram in a heavy frame, two hatched; the mark, "Chaal" and "चाल" in display type | `shell/chaal-mark.tsx` |
| `ChaalSection`, `ChaalNotFound` | The layout component, and the 404 in the frame with its title in `ch-display text-ch-title` | `shell/section.tsx` |
| `Board` | The controlled interactive board on the plate | `board/board.tsx` |
| `MoveList` | `table` (play: number, White, Black in hairline rows), `strip` (a phone: one row scrolling sideways, centred on the current move), `tree` (analysis and studies: variations and comments breaking into the main line). The current move is underlined 2 px in vermilion; annotation symbols are bold vermilion | `board/move-list.tsx` |
| `Clock` | `ch-display ch-figures text-ch-clock`. The side to move is ink, the other muted; under `low` (10 s) the running clock becomes an ink block with on-ink figures. Tenths under 10 s | `board/clock.tsx` |
| `PlayerStrip` | Name (semibold), title, rating (muted, `?` when provisional), a note ("To move"), material, and the clock at the end. The side to move has a 4 px ink bar at its start edge | `board/player-strip.tsx` |
| `EvalBar` | Paper for White, frame-ink for Black, in a 1.5 px frame border. Upright (20 px) beside the board on a laptop, a 14 px band above it on a phone. The ink half scales with a transform | `board/eval-bar.tsx` |
| `EvalGraph` | One SVG line under a hairline, with a vermilion mark at the current move; a slider | `board/eval-graph.tsx` |
| `GameControls` | A toolbar of ghost icon buttons (first, back, forward, last, then the game's actions, flip at the end); arrows mirror in RTL | `board/game-controls.tsx` |
| `MoveInput` | A labelled text field for typed moves (`/` focuses it), suggestions as ghost buttons, an error in danger | `board/move-input.tsx` |
| `ResultBanner` | Under a heavy rule: the score in `ch-display text-ch-head`, the result in semibold, the reason muted | `board/result-banner.tsx` |
| `Material`, `OpeningName` | Captured pieces as small cburnett images with the lead in figures; the ECO code in semibold figures and the name | `board/material.tsx`, `board/opening-name.tsx` |

The home's entries are plates (`bg-ch-plate`, hairline border, ink border on hover) with an icon, a semibold name and a muted line; see "Departures". The settings' theme swatches are `MiniBoard`s in hairline boxes; the chosen one takes an ink border.

## Motion and sound

- One ease: `--ch-ease: cubic-bezier(0.2, 0, 0, 1)`.
- Two durations: `--ch-duration-move` 150 ms (`ch-move`, transform: a piece's slide, the eval bar), `--ch-duration-quick` 120 ms (`ch-fade`, opacity; `ch-press`, transform).
- `ch-press` scales to 0.98 while pressed: game controls and the home's entries have it.
- A moved piece keeps its React key, so it slides; both halves of castling slide; flipping remounts the pieces, so nothing slides across the board (0262).
- Only transform and opacity move, and the utilities exist only inside `@media (prefers-reduced-motion: no-preference)`. Under reduced motion nothing moves. The nav links' `transition-colors` is shared kit, not a Chaal utility.
- **Sounds:** our own, synthesized by `pnpm chaal:sounds` (`scripts/chaal-sounds.ts`): move, capture, check, start, end, low time, notify, correct, wrong. 22.05 kHz mono WAV, 3 to 22 kB, in `public/chaal/sounds/`. They play only after the visitor's first interaction (`navigator.userActivation`), at the preference's volume (70 by default), and the preference turns them off.

## States

- **Loading:** a board renders on the server at its final size, so it needs no skeleton. Clocks render the server's time and count down after hydration.
- **No board yet:** a local game's setup and a game that cannot show a board (`game/game-page.tsx`) fill the board's square with a framed plate (`ch-frame aspect-square bg-ch-plate`) holding the choices, so the layout doesn't move when the board arrives. The puzzle solver holds its place with the same square under a 2 px ink border while a puzzle loads.
- **No opening:** `OpeningName` shows a muted "Not a named opening" line in a box of fixed height.
- **No moves:** `MoveList` shows one muted line.
- **Notices:** the admin's banner and the fair-play banner are hairline rows on `ch-plate` under the top bar.

## Accessibility the build enforces

- **Contrast:** `tests/unit/chaal-tokens.test.ts` checks every text pair at 4.5:1 in both themes, and every square mark at 3:1 against both squares of every board theme. It also checks the motion rules, the preloads (two per locale, production only), the twelve pieces with their licence, and the sounds' size. Change a token, run the test.
- **The board is a keyboard grid** (0262): one tab stop, an ARIA grid of rows and cells with `aria-activedescendant` on the cursor. Arrows move the cursor as the board is drawn, Enter or Space picks up and puts down, Escape puts back. Each cell names itself ("e2, White Pawn, picked up", "f3, can move here").
- **Typed moves on every board a player moves on:** `MoveInput` beside the board on the live game, local games, analysis and puzzles. It reads exact SAN first, then any case, then SAN with less in it, and says "ambiguous" when the text fits two moves (0261).
- **Spoken moves:** one polite live region per board says each move as it arrives ("Black: Knight to f6"; "घोडा f3 मा, चेक" in Nepali), pick-ups, put-backs and "Not a legal move". Words come from SAN alone (`speech.ts`), at render time, in the page's language.
- **Move buttons are named by what they show** (♘f3!), for WCAG 2.5.3; the board speaks the move in words.
- **Clocks** are `role="timer"` with a spoken name ("8 min 15 s"); the figures are `aria-hidden`. The eval bar is a `meter` with the score as its text. Coordinates, marks, pieces' layer and shapes are `aria-hidden`; the squares carry the meaning.
- **Game keys:** ←/→, Home, End, `f` (flip), `z` (zen), `/` (move input), ⌘K (palette), `?` (the shortcuts dialog, which lists them).
- **Focus:** frame links and buttons show a 3 px ring (`focus-visible:ring-[3px] ring-ring/50`), ink. Move buttons and the eval graph show a 2 px ink ring.
- **Layout shift (CLS ≤ 0.01):** the board's box is square before anything loads; clocks, ratings and coordinates use tabular figures; the tab bar is in the server's HTML; preferences stored in the browser are read after hydration, and only colours change.
- The browser review (`pnpm test:e2e`) runs axe, overflow, console, CSP and CLS checks on every page in en/ne, light/dark, 390/768/1280. Chaal's stories run in `withChaal`, which sets a rose accent and a round radius that the tokens must outrank.

## Don'ts

- Don't fill a square to mark it. Marks are rings, outlines and dots with paper halos.
- Don't use vermilion beyond its five jobs: no vermilion buttons, links, badges or headings.
- Don't darken the board in dark mode. The paper dims a step; the frame and hatching stay ink.
- Don't add cards, shadows or gradients around content. Sections are a heavy rule and a heading; rows are hairlines.
- Corners are square. Don't add `rounded-*` (round marks are the only circles: check, dots, capture rings).
- No eyebrows or kickers above headings.
- Don't set body text in Mukta, and don't set a clock or rating without `ch-figures`.
- Don't put the board anywhere but first: on play, puzzle and analysis pages it is the largest thing, and a phone never scrolls to reach it, the clocks or the move buttons.
- Never imitate Lichess or chess.com (PLAN 13.6): no two-tone wood, green or blue boards on slate, no green action.
- Keep Nepal quiet: the name चाल and first-class Devanagari type, no motifs.
- Don't animate anything but transform and opacity, and nothing outside `no-preference`.

## Departures

- **The tab bar has six tabs.** The contract names Play, Puzzles, Analysis, Watch and More; the build adds Home at the start (`SECTIONS`), and the top bar lists Home too.
- **The board is smaller than the contract's laptop view.** The contract has the plate "filling the height" (about 744 px at a 900 px tall laptop). The build caps it at `100dvh − 15rem` on play pages (about 660 px), leaving room for the strips above and below and the controls. Analysis and puzzles use `100dvh − 10.5rem`.
- **Clocks top out at 52 px,** not the contract's 54 px.
- **The home's entries are bordered plates** (`chaal-home.tsx`, `home-sections.tsx`): cards, against "no cards" in the contract and 0258. They are not a pattern to copy.
- **`local-game-page.tsx` keeps its own copy of `PLACE`** rather than importing it from `shell/play-layout.tsx`. The values match today.
- **Annotation symbols appear only where a source gives them:** the engine's judgements in analysis and Lichess's on archived games. A live game shows none, as the contract's "Unresolved" foresaw.
- **Hatching on a 390 px phone** (squares about 44 px) was left on as the default; "print" and "stone" are one setting away. The finish review (Task 85) kept it.
- **The comps** (`.impeccable/mocks/chaal/board.html`) are gitignored and exist on the owner's machine only, so this record was written from the build and its screenshots, not checked against them.
