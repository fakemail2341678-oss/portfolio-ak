# Kharcha's design record: "Bahi Khata"

This is the design system of Kharcha (`/app/kharcha`) as it stands after Task 87, before any page exists. It is written from the build: `src/styles/kharcha.css` and the kit in `src/features/kharcha/kit`. The direction contract is [.impeccable/surfaces/kharcha.md](../../.impeccable/surfaces/kharcha.md), and decision 0281 explains the choices. Task 97 rewrites this record from the finished pages. The admin at `/admin/kharcha` stays on Graphite.

## Thesis

Every friend and every group is a page in a red cloth-bound shop ledger, the bahi khata. Red bookcloth holds the nav and the one primary action, edged with a line of yellow binding thread. Each page is ruled, its dates sit left of a red margin rule, a total is ruled twice under it, and a payment is struck through in red ink. The owner picked this direction on 2026-11-12 over the dice's "udharo slate" and a seamed-console challenger, then approved comps of Home, a thread with the expense panel open, and the split editor, at 390 and 1280, light and dark (`.impeccable/mocks/kharcha/board.html`, gitignored).

## Colour

Every token lives in `src/styles/kharcha.css`, scoped to `html[data-section="kharcha"]` (light) and `html[data-section="kharcha"].dark` (dark). Tailwind names them `bg-kh-page`, `text-kh-owed` and so on. Light and dark follow the device, with the visitor's switch (owner, 2026-11-12).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--kh-ground` | `oklch(0.9732 0.0041 271.4)` | `oklch(0.1783 0.0128 270.6)` | The sheet behind pages; tiles |
| `--kh-page` | `oklch(1 0 0)` | `oklch(0.2096 0.0166 268.9)` | A page, the list, the panel |
| `--kh-ink` | `oklch(0.2491 0.03 267.4)` | `oklch(0.9342 0.0084 271.3)` | Text |
| `--kh-muted` | `oklch(0.5045 0.0298 261.1)` | `oklch(0.7138 0.0268 263.3)` | Secondary text, dates, "not involved" |
| `--kh-hair` | `oklch(0.9365 0.0087 264.5)` | `oklch(0.2849 0.0215 265.8)` | Borders |
| `--kh-rule` | `oklch(0.9197 0.0197 260.2)` | `oklch(0.2846 0.0277 264)` | A page's ruling |
| `--kh-margin` | `oklch(0.5946 0.1786 27.2)` | `oklch(0.5846 0.1479 26.6)` | The margin rule; red ink striking a payment |
| `--kh-cloth`, `--kh-cloth-deep` | `oklch(0.4562 0.1635 28.2)`, `oklch(0.4038 0.1457 28.5)` | `oklch(0.3813 0.1325 28.3)`, `oklch(0.3182 0.1091 28.2)` | The rail and the phone's top bar; the current item |
| `--kh-on-cloth`, `--kh-cloth-muted` | white, `oklch(0.9011 0.0368 30.4)` | `oklch(0.9473 0.0204 32.5)`, `oklch(0.8247 0.0544 28.3)` | Text on the cloth: current, others |
| `--kh-thread` | `oklch(0.7851 0.1405 85)` | `oklch(0.7123 0.1312 83.7)` | The binding thread on the cloth's edge; the current item's icon; text selection |
| `--kh-act`, `--kh-on-act` | `oklch(0.4562 0.1635 28.2)`, white | `oklch(0.5274 0.1817 28.7)`, white | The one primary action per screen (Graphite's `--primary`) |
| `--kh-mark` | the cloth | `oklch(0.7268 0.1385 27.4)` | Red ink read as text: a selected line's date |
| `--kh-owed`, `--kh-owed-bg` | `oklch(0.4823 0.1126 153.7)`, its tint | `oklch(0.7699 0.1374 156.2)`, its tint | Money owed to you |
| `--kh-owe`, `--kh-owe-bg` | `oklch(0.5076 0.1354 47.1)`, its tint | `oklch(0.7785 0.1259 60.8)`, its tint | Money you owe; problems (fix badges, a split that doesn't add up) |
| `--kh-sel` | `oklch(0.961 0.0133 28.9)` | `oklch(0.2312 0.0167 358.7)` | A selected line |
| `--kh-c-<name>` | the same in both | | People's and groups' colours (`KHARCHA_COLORS`), under white initials |

- **Red is the brand, never debt.** Owed is a ledger green and owe a burnt ochre; the test checks they never equal the cloth.
- **Money never rides on colour alone:** an amount in a direction always has its words and an arrow beside it (`BalancePill`, the cards). A problem is hatched as well as coloured.
- `kharcha.css` redefines Graphite's tokens, so the shared kit takes the look: `--primary` is the act red, `--ring` too, `--radius` is 0.375rem whatever the visitor picked, and the dark block repeats `--primary` and `--ring` because `.dark[data-accent]` outranks the light rule. Native controls take `accent-color: var(--kh-act)`.
- `tests/unit/kharcha-tokens.test.ts` checks 27 text pairs at 4.5:1 in both themes, the thread and the margin at 3:1, and white initials at 4.5:1 on every person's colour.

## Type

- **Display:** Laila 700 (Indian Type Foundry, OFL, `@fontsource/laila`) as "Kharcha Display", Latin and Devanagari: titles (`text-kh-title`, 24 to 28px), hero amounts (`text-kh-hero`, 36 to 44px), section heads (`text-kh-head`, 18px), the wordmark. `kh-display` sets it; Nepali opens the leading to 1.35.
- **Vertical metrics** are overridden to the glyphs' reach, measured in Chrome: Latin 102% / 28%, Devanagari 110% / 45%. The fallbacks are Georgia Bold (size-adjust 95.98%) and Nirmala UI Bold (95.18%).
- **Text:** the app's Inter and Noto Sans Devanagari. Money is tabular (`kh-figures`) and drawn by `Money` through `formatMoney`, so Nepali gets its own digits and the CLDR symbol (नेरू).
- **Preloads:** `kharchaFontPreloads(locale)` gives two files per locale in production (Laila's script and the text face); the `_kharcha` layout adds them in Task 88.

## The page

- `LedgerPage` and `LedgerLine` (`kit/ledger.tsx`): each line is at least `--kh-line` (3rem) tall, dated left of the margin rule (`--kh-margin-x`, 3.75rem on phones, 5.5rem from `sm`), ruled under it. The margin rule runs the page's height; below the last line the page stays ruled (`kh-ruled`). A selected line takes `--kh-sel` and its date turns red ink.
- **Utilities:** `kh-ruled`, `kh-margin`, `kh-double` (a total ruled twice), `kh-struck` (red ink through settled money), `kh-hatch` (a problem), `kh-figures`, `kh-display`, and `kh-ease` (colour, opacity and transform only, 160ms, nothing under reduced motion).

## The kit (`src/features/kharcha/kit`, the "Kharcha/Kit" stories)

| Component | What it draws |
| --- | --- |
| `Money` | One amount: tabular, `sm` to `hero`, a tone, struck once settled |
| `BalancePill` | Balances per currency in words and arrows ("owed to you", "you owe", "settled up"), stacked or inline, optionally ruled twice |
| `PersonAvatar` | A square plate in the person's colour with up to two initials, whole graphemes in any script (`personInitials`: "सीता राई" gives "सीरा") |
| `CategoryIcon` | A category's icon (`CATEGORY_ICONS`, 18 lucide icons) in its tile, in the category's colour; the receipt when there is none |
| `FixBadge` | What an expense still needs (`FIX_KINDS`: no category, a possible duplicate, a receipt without details), hatched |
| `ExpenseCard` | An expense on a page: its icon, title, fix badges and who paid; on the right what it means for the caller ("you lent", "you owe Asha", "not involved", "you're even") |
| `PaymentCard` | A payment: who paid whom (the caller as "you"), method, note, the other currency at its rate, the amount struck in red ink |
| `KharchaEmpty` | The empty states on the shared `EmptyState`: a page, people, the to-do list, spending, a search |
| `KharchaWordmark`, `KharchaMark` | "Kharcha" and "खर्च", the locale's script first; ख on the cloth with the thread under it |

The cards are one keyboard stop each: when they open something, the title is a button whose hit area covers the card.

## Departures from the comps

- **No accent preset:** the comps' red lives in `kharcha.css`, like Chaal's and Parda's looks, not as a sixth `ACCENTS` entry; the section outranks the visitor's accent.
- **A payment's words stay unstruck;** only its amount is struck, so Nepali's longer lines stay readable on a phone.
- **Money reads "NPR 6,840.00" / "नेरू ६,८४०.००"**, as `formatMoney` writes it (0278), not the comps' "रु 6,840".
- **The icon files** (favicon, manifest) are drawn from `KharchaMark` in Task 88, with the section.
