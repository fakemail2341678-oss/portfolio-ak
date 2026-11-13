# Kharcha's design record: "Bahi Khata"

This is the design system of Kharcha (`/app/kharcha`) as it stands after Task 97, with every page built. It is written from the build: `src/styles/kharcha.css`, the kit in `src/features/kharcha/kit`, the shell in `src/features/kharcha/shell`, and the pages in `src/features/kharcha/**` and `src/routes/_kharcha/**`, checked against screenshots of the production build at 390 and 1280. Where the build and the direction contract ([.impeccable/surfaces/kharcha.md](../../.impeccable/surfaces/kharcha.md)) or the approved comps differ, this file says what the build does and lists the difference under "Departures". Decisions 0281 (the look) and 0282 (the section, shell and Home) explain the choices. The admin at `/admin/kharcha` stays on Graphite and is not covered here.

## Thesis

Every friend and every group is a page in a red cloth-bound shop ledger, the bahi khata. Red bookcloth holds the nav and the one primary action, edged with a line of yellow binding thread. Each page is ruled, its dates sit left of a red margin rule, a total is ruled twice under it, and a payment is struck through in red ink. The owner picked this direction on 2026-11-12 over the dice's "udharo slate" and a seamed-console challenger, then approved comps of Home, a thread with the expense panel open, and the split editor, at 390 and 1280, light and dark (`.impeccable/mocks/kharcha/board.html`, gitignored).

## Colour

Every token lives in `src/styles/kharcha.css`, scoped to `html[data-section="kharcha"]` (light) and `html[data-section="kharcha"].dark` (dark). Tailwind names them `bg-kh-page`, `text-kh-owed` and so on. Light and dark follow the device, with the visitor's switch (owner, 2026-11-12).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--kh-ground` | `oklch(0.9732 0.0041 271.4)` | `oklch(0.1783 0.0128 270.6)` | The sheet behind pages; icon tiles; quiet notes |
| `--kh-page` | `oklch(1 0 0)` | `oklch(0.2096 0.0166 268.9)` | A page, a header, a sheet, the phone's tabs, dialogs |
| `--kh-ink` | `oklch(0.2491 0.03 267.4)` | `oklch(0.9342 0.0084 271.3)` | Text |
| `--kh-muted` | `oklch(0.5045 0.0298 261.1)` | `oklch(0.7138 0.0268 263.3)` | Secondary text, dates, "not involved", the tabs not current |
| `--kh-hair` | `oklch(0.9365 0.0087 264.5)` | `oklch(0.2849 0.0215 265.8)` | Borders of sheets, headers and controls |
| `--kh-rule` | `oklch(0.9197 0.0197 260.2)` | `oklch(0.2846 0.0277 264)` | A page's ruling; rows inside a sheet |
| `--kh-margin` | `oklch(0.5946 0.1786 27.2)` | `oklch(0.5846 0.1479 26.6)` | The margin rule; red ink striking a payment |
| `--kh-cloth`, `--kh-cloth-deep` | `oklch(0.4562 0.1635 28.2)`, `oklch(0.4038 0.1457 28.5)` | `oklch(0.3813 0.1325 28.3)`, `oklch(0.3182 0.1091 28.2)` | The rail, the phone's top bar, the public header; the current item and hovers on the cloth |
| `--kh-on-cloth`, `--kh-cloth-muted` | white, `oklch(0.9011 0.0368 30.4)` | `oklch(0.9473 0.0204 32.5)`, `oklch(0.8247 0.0544 28.3)` | Text on the cloth: current, others |
| `--kh-thread` | `oklch(0.7851 0.1405 85)` | `oklch(0.7123 0.1312 83.7)` | The binding thread on the cloth's edge; the current item's icon; the bell's count; focus on the cloth; text selection |
| `--kh-act`, `--kh-on-act` | `oklch(0.4562 0.1635 28.2)`, white | `oklch(0.5274 0.1817 28.7)`, white | The one primary action per screen, the phone's + (Graphite's `--primary` and `--ring`) |
| `--kh-mark` | the cloth | `oklch(0.7268 0.1385 27.4)` | Red ink read as text: a selected line's date, the current phone tab, links in running text |
| `--kh-owed`, `--kh-owed-bg` | `oklch(0.4823 0.1126 153.7)`, its tint | `oklch(0.7699 0.1374 156.2)`, its tint | Money owed to you |
| `--kh-owe`, `--kh-owe-bg` | `oklch(0.5076 0.1354 47.1)`, its tint | `oklch(0.7785 0.1259 60.8)`, its tint | Money you owe; problems (fix badges, the trash notice, a split that doesn't add up) |
| `--kh-sel` | `oklch(0.961 0.0133 28.9)` | `oklch(0.2312 0.0167 358.7)` | A selected line; a chosen option (split method, a people filter) |
| `--kh-c-<name>` | the same in both | | People's and groups' colours (`KHARCHA_COLORS`: gray, red, orange, amber, green, teal, blue, indigo, violet, pink), under white initials or a white icon |

- **Red is the brand, never debt.** Owed is a ledger green and owe a burnt ochre; the test checks neither equals the cloth.
- **Money never rides on colour alone:** an amount in a direction always has its words and an arrow beside it (`BalancePill`, the cards, Home's two sides). A problem is hatched as well as coloured.
- **One red per screen.** Where a header has two actions, the one that matters takes `default` and the other `outline`: a group you owe in shows Settle up red and Add expense outline, and the other way round once you are square. Home's to-dos are all outline, so Home's red stays its New button.
- `kharcha.css` redefines Graphite's tokens (`--background`, `--card`, `--popover`, `--primary`, `--border`, `--input`, `--ring`, `--destructive` and the rest), so the shared kit takes the look. `--input` is ink at 18% (22% in dark). `--radius` is 0.375rem whatever the visitor picked. The dark block repeats `--primary`, `--ring` and `--accent-subtle`, because `.dark[data-accent]` outranks the light rule. Native controls take `accent-color: var(--kh-act)`; scrollbars are muted on the ground.
- The browser's UI: `KHARCHA_BRAND.themeColors` is `#9e1f1a` light and `#6e1813` dark, the bookcloth (`src/features/kharcha/brand.ts`). The brand's `accent: "rose"` is never seen.
- **Print:** a statement saved as a PDF is the page alone, on white in the light theme's ink; the shell hides itself (`print:hidden`).

## Type

**Families.**
- Display: Laila 700 (Indian Type Foundry, OFL, `@fontsource/laila`) as "Kharcha Display", Latin and Devanagari. Static cuts: Latin 18.9 kB, Latin extended 3.8 kB, Devanagari 92.5 kB.
- Vertical metrics are overridden to the glyphs' reach, measured in Chrome: Latin 102% / 28%, Devanagari 110% / 45%. The fallbacks are metric-matched: Georgia Bold (`size-adjust` 95.98%) and Nirmala UI Bold (95.18%).
- Text: the app's Inter and Noto Sans Devanagari.
- Preloads: `kharchaFontPreloads(locale)` (`src/features/kharcha/lib/fonts.ts`), added by the `_kharcha` layout: two files per locale, production only (Laila's script and the text face).

**`kh-display`** sets Laila 700 at line height 1.15; Nepali opens it to 1.35. It sets page titles, section heads, hero and large amounts, the wordmark, empty states' titles, the landing's headline, and the expense sheet's title. Never body text.

**`kh-figures`** sets tabular numbers. Every amount (through `Money`), every date in the margin and every count uses it.

**Scale.**

| Token | Value | Size at 390 to 1280 | Use |
| --- | --- | --- | --- |
| `text-kh-hero` | `clamp(2.25rem, 1.95rem + 1.25vw, 2.75rem)` | 36 px to 44 px | Home's owed and owe from `sm` up |
| `text-kh-title` | `clamp(1.5rem, 1.38rem + 0.5vw, 1.75rem)` | 24 px to 28 px | Page titles (Home's greeting, a thread, People, Spend), the landing's section heads |
| `text-kh-head` | `1.125rem` | 18 px | Sheet heads (To do, Updates, Recent), empty states, `Money size="lg"`, the expense sheet's title |

Smaller fixed sizes: the rail's and tabs' labels at 0.6875rem, a margin date at 0.75rem, the refund and payment tags at 0.75rem. The landing's headline is `text-4xl`, `sm:text-5xl`. Secondary lines are `text-caption` muted.

**Money** reads as `formatMoney` writes it (0278): "NPR 6,840.00" and "नेरू ६,८४०.००", Nepali with its own digits and the CLDR symbol. It is semibold, never wraps, and settled money is struck in red ink and muted.

**Nepali.** The wordmark puts the locale's script first ("खर्च Kharcha" or "Kharcha खर्च"). A system line is italic in Latin and upright in Devanagari, which has no italics. Sentence case everywhere.

## Layout

**The section** (`shell/section.tsx`) has two frames.
- **Public** (`shell/public-frame.tsx`: the landing, sign-in, sign-up, the 404): a 56 px cloth header with the thread under it (`shadow-[inset_0_-2px_0_var(--kh-thread)]`), the wordmark, the language and the account buttons; a hairline footer on the page. Sign-in and sign-up put the form on a page and, from `lg`, a decorative page of the book beside it (`KharchaArt`).
- **Signed in** (`shell/kharcha-shell.tsx`, the `_shell` routes). Each page renders its own `<main>`.

**On a laptop (from `md`):**
- **The rail:** 64 px (`w-16`), sticky, full height, `--kh-cloth` with a 2 px thread line on its inner edge. The mark, then Home, Spend, Insights, People, Updates (with the thread-yellow count) and Search, each an icon over a 0.6875rem label; the caller's plate at the foot. The current item is `--kh-cloth-deep` with on-cloth text and a thread-yellow icon.
- **The page:** a header on `--kh-page` ruled off by a hairline (`px-4 sm:px-8`, `py-4 md:py-5`), with the plate, the `kh-display` title and a muted caption, the actions at the end, and tabs underlined in red where a page has them. Below it the body on `--kh-ground`, `px-4 sm:px-8`, `py-4 sm:py-6`.

**On a phone (under `md`):**
- **The top bar:** 52 px (`h-13`), sticky, cloth with the thread under it: the wordmark, the bell, search and the caller's plate.
- **The tabs:** fixed to the bottom, 64 px on `--kh-page` under a hairline: Home, Spend, Insights, People and Account (a guest's is Sign up). The current tab is `--kh-mark` and semibold.
- **The +:** a 56 px `--kh-act` square (`rounded-xl`) at the end, above the tabs, opening the create menu upward.

**Home** (`home/kharcha-home.tsx`): the greeting and the date; from `md` the search field (with its ⌘K hint) and the red New button. Then sheets: from `lg` two columns (`1.35fr` and `1fr`), the to-dos and Updates on the left, the summary and Recent on the right; on a phone one column. The summary puts the balances or the month first, as the person chose at onboarding. The balances are two sides, owed and owe, each with its words and arrow and its first amount ruled twice: `lg` on a phone so both fit side by side, `text-kh-hero` from `sm` (Task 97).

**A thread** (`threads/group-thread.tsx`, `friend-thread.tsx`): the header (plate, title, a muted line of type, members and dates, the `BalancePill`, Settle up and Add expense; on a phone the buttons show their icons only), the tabs (Thread, Balances, Totals, Settings for a group), then the page, then the composer.

**Sheets, not floating cards.** Where a page holds several things (Home, People, a group's tabs), each is a sheet: `--kh-page`, a hairline border, `rounded-lg`, no shadow, a `kh-display text-kh-head` head over a hairline. Rows inside a sheet are divided by `--kh-rule`.

## The page

- `LedgerPage` and `LedgerLine` (`kit/ledger.tsx`) draw every dated list: a thread, Spend's list, Home's Recent. Each line is at least `--kh-line` (3rem) tall, dated left of the margin rule (`--kh-margin-x`, 3.75rem on phones, 5.5rem from `sm`), ruled under it in `--kh-rule`. A day is written once; the lines after it on the same day leave the margin empty.
- The margin rule runs the page's full height, and below the last line the page stays ruled (`kh-ruled`). A selected line takes `--kh-sel` and its date turns red ink.
- `SystemLine`: what the app wrote ("You started Pokhara trip"), muted caption, italic in Latin.
- **Utilities:** `kh-ruled`, `kh-margin`, `kh-double` (3 px double rule under a total), `kh-struck` (1.5 px red ink through settled money), `kh-hatch` (135° owe-tint stripes, 4 px, under a problem), `kh-figures`, `kh-display`, and `kh-ease`.

## The kit (`src/features/kharcha/kit`, the "Kharcha/Kit" stories)

| Component | What it draws |
| --- | --- |
| `Money` | One amount: tabular, semibold, `sm` (caption), `md` (body), `lg` (display at 18 px), `hero`; a tone; struck once settled |
| `BalancePill` | Balances per currency in words and arrows ("owed to you" ↙, "you owe" ↗, "settled up" ✓), stacked at a right edge or inline, optionally ruled twice |
| `PersonAvatar` | A square plate (`rounded-md`, 24, 32 or 40 px) in the person's colour with up to two initials, whole graphemes in any script (`personInitials`: "सीता राई" gives "सीरा") |
| `GroupPlate` | A group's square plate: its icon (`GROUP_ICONS`, 8 lucide icons) in white on its colour |
| `CategoryIcon` | A category's icon (`CATEGORY_ICONS`, 18 lucide icons) in its tile, in the category's colour; the receipt in a ground tile when there is none |
| `FixBadge` | What an expense still needs (`FIX_KINDS`: no category, a possible duplicate, a receipt without details): a small owe-coloured outline badge, hatched |
| `ExpenseCard` | An expense on a line: icon, title, fix badges, who paid; at the end what it means for the caller ("you lent", "you owe Asha", "not involved", "you're even") in its tone |
| `PaymentCard` | A payment: who paid whom, method, note, the other currency at its rate; the amount struck in red ink over "payment" |
| `KharchaEmpty` | The empty states on the shared `EmptyState`, titled in `kh-display text-kh-head`: a page, people, the to-do list, spending, a search |
| `KharchaWordmark`, `KharchaMark` | "Kharcha" and "खर्च", the locale's script first; ख in Laila on a 36 px cloth square with a 3 px thread line under it |

The cards are one keyboard stop each: when they open something, the title is a link or button whose hit area covers the card.

## Components particular to the pages

| Piece | What it is | File |
| --- | --- | --- |
| `KharchaShell` | Rail, phone bar, tabs, the +, the guest banner, the palette, shortcuts, the create, expense and settle dialogs, dropping a receipt anywhere (a dashed act-red frame over the page) | `shell/kharcha-shell.tsx` |
| `CreateMenu` | The + menu: expense, split, settle up, group, friend | `shell/create-menu.tsx` |
| Composer | Under a thread: + (an expense here), the comment field with @ mentions, send; a bordered box on the page | `threads/composer.tsx` |
| Expense sheet | An expense from a list: the shared `Sheet` from the end, `sm:max-w-lg`, on `--kh-page`, title in `kh-display text-kh-head`; the panel inside: icon, date and amount, fix badges, a definition list, receipts as 96 px tiles, the actions (Edit red), history and comments | `expenses/expense-sheet.tsx`, `expense-panel.tsx` |
| Split editor | Inside the expense dialog: a fieldset on the ground (payer, a segmented method row whose chosen item takes an ink border and `--kh-sel`, the people with their amounts, itemized lines) | `expenses/split-editor.tsx` |
| Settle-up dialog | Full screen on a phone, `sm:max-w-lg` from `sm`; who pays whom, amount, method, the pay note on the ground | `settle/settle-dialog.tsx` |
| `BudgetMeter` | A budget's bar against its limit, on Home and in Insights | `budgets/budget-meter.tsx` |

## Motion

- One ease, `--kh-ease: cubic-bezier(0.2, 0, 0, 1)`, one duration, `--kh-duration` 160 ms.
- `kh-ease` moves transform, opacity, background colour, colour and the strike's colour only, and exists only inside `@media (prefers-reduced-motion: no-preference)`. Under reduced motion nothing moves.
- Loading placeholders in the expense sheet pulse (`animate-pulse`, shared kit).

## States

- **Loading:** pages render on the server. Dialogs load lazily and show nothing until ready; the expense sheet holds its place with ground-coloured bars.
- **Empty:** `KharchaEmpty` on the page or in its sheet, with the page's action where the caller can act (Add expense on an empty group).
- **Problems:** fix badges on the line and in the sheet; an expense in the trash shows a hatched notice with an owe border.
- **Archived group:** a hairline note on the page above the thread.
- **Guests:** a hairline banner under the bar with how long the sample lives and a red-ink sign-up link.
- **Freshness:** the shell polls `rev` every 15 s while visible; a moved `rev` refetches, so lines change in place.

## Accessibility the build enforces

- **Contrast:** `tests/unit/kharcha-tokens.test.ts` checks every text pair at 4.5:1 in both themes, the thread and the margin at 3:1, white initials at 4.5:1 on every person's colour, that money never uses the brand's red, the motion rule, and the preloads (two per locale, production only). Change a token, run the test.
- **Direction in words:** every balance and every card's share says who owes in words; the arrows are `aria-hidden`.
- **Plates and icons are decorative** (`aria-hidden`); the name is always written beside them.
- **Focus:** a 3 px ring, act red on the page (`ring-ring/50`), thread yellow on the cloth.
- **Keys:** ⌘K (palette), `n` (new expense), `?` (the shortcuts dialog).
- **Targets:** the phone bar's buttons and the composer's are 44 px; the tabs at least 48 px tall.
- **Layout shift (CLS ≤ 0.01):** the shell is in the server's HTML; amounts and dates are tabular; the fonts are metric-matched.
- The browser review (`pnpm test:e2e`) runs axe, overflow, console, CSP and CLS checks on every page in en/ne, light/dark, 390/768/1280.

## Don'ts

- Don't use red for money or debt. Red is the cloth, the one primary action and red ink (the margin, a strike, a mark).
- Don't put two red buttons on a screen. The second action is `outline`.
- Don't show an amount in a direction without its words and arrow, or a problem without its hatching.
- Don't round avatars. People and groups are square plates. Round shapes are small controls and marks only: chips (filters, people in a split, reactions), counts and unread dots, colour swatches, and the bars of budgets and charts.
- Don't float cards with shadows. Content sits on ruled pages and bordered sheets; the only shadows are the phone's + and menus that pop over the page.
- No eyebrows or kickers above headings (the landing lost its own in Task 97).
- Don't set body text in Laila, and don't draw money without `Money` (so `formatMoney` and `kh-figures`).
- Don't strike a payment's words; only its amount.
- Never take Expensify's colours, green, logo, illustrations, copy or chat bubbles (PLAN 14.6).
- Keep Nepal quiet: the ledger, the name खर्च and first-class Devanagari type, no motifs.
- Don't animate anything but transform, opacity and colour, and nothing outside `no-preference`.

## Departures

The finish review (Task 97) found these differences from the contract and the comps and left them for the owner as redesigns.

- **The desktop thread stands alone.** The contract's first viewport has a 300 px list of pages, each with its balance in words, beside the open page; the build makes People its own page and the thread fills the width beside the rail. The ruled page ends after its last line and the composer sits below it as a separate box, instead of the page running down to the composer.
- **The expense opens as a modal sheet,** from the end over a dimmed page, not as a third column beside the thread. It lacks the comp's hero amount, the PAID BY block, the SPLIT rows and the Total ruled twice; the amount is `Money size="lg"` beside the date and the details are a definition list.
- **The split editor is part of the Add expense form** (kind, currency, a segmented method row, a table of people), not the comp's focused step with avatar rows, a % column, the hatched remainder bar, "Assigned X of Y" and key hints.
- **The phone thread keeps the wordmark bar,** not back and the thread's title in the red bar, so a long title truncates in the page's header below.
- **A thread's header balance is a small `BalancePill`,** not the amount in Laila ruled twice.
- **The demo seed's expenses have no category,** so every line in the demo carries a "No category" fix badge.
- **Home's sheets are bordered, rounded (`rounded-lg`) boxes** on the ground. They carry no shadow, but the contract refuses rounded cards; they are recorded here as the build, not as a pattern to grow.
- **No accent preset:** the red lives in `kharcha.css`, like Chaal's and Parda's looks, not as a sixth `ACCENTS` entry.
- **A payment's words stay unstruck;** only its amount is struck, so Nepali's longer lines stay readable on a phone.
- **Money reads "NPR 6,840.00" / "नेरू ६,८४०.००",** as `formatMoney` writes it (0278), not the comps' "रु 6,840".

**What Task 97 changed:** Home's owed and owe amounts are hero size from `sm` up (`lg` on a phone, so both sides fit); the to-dos' buttons are `outline`, so the red stays the one primary; the landing has no eyebrow above its headline.
