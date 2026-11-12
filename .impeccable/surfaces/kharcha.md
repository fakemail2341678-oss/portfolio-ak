---
version: 1
slug: "kharcha"
primary_target: "src/routes/_kharcha/route.tsx"
related_targets: ["src/features/kharcha"]
---

# Surface brief: Kharcha at /app/kharcha

**Scope:** every page of the `_kharcha` layout (landing, sign-in, sign-up, Home, Spend, People, a friend's or a group's thread, the expense panel and page, the split editor, Insights, account), in English and Nepali, dark and light. The admin at `/admin/kharcha` stays on Graphite.

**Mode:** Operate. People open it to add an expense, see who owes whom and settle up. The landing is Persuade inside the same world.

**Audience and job:**
- Friends, flatmates and families in Nepal and abroad, on phones first and laptops just as much: a trip to Pokhara, a shared flat, a household's spending.
- The job: record what was spent in seconds, see in words who owes whom, and record a payment made elsewhere.

**Proof:** balances that always add up (the ledger, 0278), exact splits to the paisa, Nepali digits and rupees written as Nepalis write them.

**Constraints:**
- Expensify is a reference for flows only: never its colours, logo, illustrations or copy (PLAN 14.6). The owner, 2026-11-12: design our own, Expensify was only a reference.
- Light and dark both, following the device with a switch (owner, 2026-11-12).
- Money is never colour alone: the direction in words and an icon too (14.5).
- CLS ≤ 0.01, strict CSP, axe clean, no overflow at 390/768/1280.

**Memorable moment:** the margin. Every thread is a page of the red book: its dates sit left of a red margin rule, its lines on a faint ruling, and a total is ruled twice under it.

## UX notes

The owner (2026-11-12): design our own; New Expensify was given only as a reference, so its help pages were not studied.
- **We take its patterns** (PLAN 14.5 "UX"): a conversation per friend and per group holding expense and payment cards, comments and system lines; the expense in a side panel on a laptop and full screen on a phone; a to-do Home; one primary action per screen, the rest in a More menu; search with typed filters and saved searches; fix badges; a composer whose + adds an expense where you are.
- **We never take:** its colours, logo, illustrations, copy, its green, its chat-bubble styling, or its company features (workspaces, approvals, reports, reimbursement, cards).

## Direction contract

THESIS: Every friend and every group is a page in a red cloth-bound shop ledger, the bahi khata every Nepali shop keeps: lines dated in the margin, totals ruled twice. It refuses the category default of mint-green banners, round avatars and floating rounded cards.

OWN-WORLD: Red bookcloth (`#9e1f1a`, deeper in dark) owns the nav rail and the primary action, edged with one line of yellow binding thread. Pages are white in light and a blue-black night in dark, with faint blue ruling and a red margin rule. Owed is a ledger green, owe a burnt ochre; brand red never means debt. Laila (Latin and Devanagari) sets titles, the wordmark and hero amounts; Inter and Noto Sans Devanagari set text and tabular money. Corners are small (6px), avatars are square plates in each person's colour, totals carry a double rule.

STORY: You open a page, read the dated lines, see in words what you owe or are owed, open a line in the side panel, and settle up with the one red button.

FIRST VIEWPORT: Laptop, 1280: the 64px red rail (wordmark, Home, Spend, People, Insights, account at the foot), the 300px list of pages with each balance in words, the open page (title, people and dates, the balance double-ruled at the right, Remind and a red Settle up), its ruled feed with dates in the margin, the composer with its +; the expense panel at the right when a line is open. Phone, 390: one pane at a time, a red top bar, bottom tabs and the floating + in cloth red.

FORM: Bahi khata, first on the ordered list of seven: the bahi khata, rupee banknotes, the tea shop's udharo slate, painted shop signboards, dhaka cloth, Nepal's postage stamps, Gorkhapatra's classifieds. The roll assigned the udharo slate; the owner chose this pick over it and over the seamed console challenger (2026-11-12). Signature move: settling strikes a line through with red ink, and a settled total is ruled twice. seed:ce93f732880eb506

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Pages arrive in Task 88; until then the tokens are exercised by the kit's stories only.
- The finish review runs at Part 8's wrap-up (Task 97), as in Parts 6 and 7.
