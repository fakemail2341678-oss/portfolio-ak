# Kharcha

Kharcha (खर्च, "spending") is the personal expense tracker and bill splitter at `/app/kharcha` (Part 8 of [PLAN.md](../PLAN.md), section 14): your own spending, and bills split with friends and groups, with balances per currency and settling up recorded. Visitors try it as guests with sample data.

**Status:** Task 86 (the foundation) is done: the tables, the money core, people, access, the services and their functions, the guests' sample data and the demo accounts. Task 87 (the design direction) is done: the look, "Bahi Khata", its tokens and the kit, still with no pages. Tasks 88–97 add the pages and the rest (PLAN 14.3). Decisions 0277 (the layer, people, access, guests), 0278 (money and the ledger), 0279 (the bundle budget) and 0281 (the look).

## Where things are

Kharcha is its own strip-demo layer, `kharcha` (`pnpm strip-demo --keep-kharcha` keeps it). It imports nothing from the portfolio, the apps, Taskline, Parda or Chaal; what it shares with them is core (0215).

| Piece | Path |
| --- | --- |
| Shared shapes and inputs | `src/features/kharcha/`: `types.ts` (constants, DTOs), `settings.ts` (`kharchaSettings`: quotas, currencies, switches), `schema.ts` (the inputs) |
| The money core | `src/features/kharcha/money/`: `split.ts` (split methods, `allocate`), `ledger.ts` (an expense's and a payment's debts, balances), `simplify.ts`, `problem.ts` (a split's problem in words). Pure; `split.ts`, `ledger.ts` and `simplify.ts` import nothing at run time |
| Money in any currency (core) | `src/lib/i18n/currency.ts`: `CURRENCIES`, `minorDigits`, `toMinor`, `toMajor`, `formatMoney`, `money(code)`; `NE_CURRENCY_SYMBOLS` in `intl-ne.ts` |
| Tables | `src/server/db/schema/kharcha/{person,group,expense,payment,ledger,activity,settings}.ts`, migration `0049_kharcha_foundation` |
| People | `src/server/kharcha/people.ts`: `ensurePerson`, `insertContact`, `personByEmail`, `befriend`, `loadPeople`, `mergePerson` |
| Access | `src/server/kharcha/access.ts`: `resolveMe`, `resolveExpense`, `resolvePayment`, `resolveGroup`, `resolveFriend`, `assertGroupCan`, `assertSourceCan` |
| The ledger | `src/server/kharcha/ledger.ts`: `writeLedger` (its only writer), `pairBalances`, `groupNets`, `groupNetOf`, `netsByGroup` |
| History and freshness | `src/server/kharcha/activity.ts` (`recordActivity`, `fieldChanges`, `pairOf`), `rev.ts` (`bumpRevs`, `revOf`, `saveVersioned`) |
| Rules and limits | `src/server/kharcha/rules.ts` (offered currencies, who a change touches, former members), `settings.ts` (`getSettings`, `quotasFor`, `assertQuota`) |
| Services | `src/server/kharcha/{me,expenses,payments,groups,friends}/service.ts` (and `expenses/repository.ts`) |
| Functions | `src/functions/kharcha/{me,expenses,payments,groups,friends}.ts`, each `requireKharchaUser` → `withKharchaServices`; listed in `knip.json`'s entries until their pages exist (Task 88) |
| Middleware | `src/middleware/kharcha.ts` |
| Guests and accounts going | `src/server/kharcha/guest-data.ts` (`KHARCHA_GUEST_DATA`: the sample, the claim, `forget`), `forget.ts` (`forgetUsers`, `forgetUser`) |
| Demo accounts | `scripts/lib/kharcha-seed.ts`, `pnpm db:seed-kharcha` |
| The look | `src/styles/kharcha.css` (tokens and `kh-*` utilities, imported by `app.css` between `kharcha:start`/`end`), `src/features/kharcha/kit/` (the kit), `src/features/kharcha/lib/fonts.ts` (`kharchaFontPreloads`); the contract `.impeccable/surfaces/kharcha.md`, the record `docs/design/kharcha.md` |
| Storybook | `.storybook/mocks/kharcha.ts` (sample data), `.storybook/mocks/functions/kharcha/*` (one per functions file), `.storybook/mocks/kharcha-section.tsx` (`withKharcha`: the section on `<html>`) |
| Tests | `tests/unit/kharcha-money.test.ts`, `tests/unit/kharcha-tokens.test.ts`, `tests/unit/currency.test.ts`, `tests/server/kharcha{,-access,-people,-seed}.test.ts`, `tests/server/kharcha-helpers.ts` (`expectLedgerConsistent`) |

Shared files mark Kharcha's code with `kharcha:start`/`kharcha:end` or a trailing `// @kharcha`: the schema index, the permission catalog and its labels, the audit actions and targets, `GUEST_DATA`, the account deletion hook (`src/server/auth/auth.ts`), the guard test and the e2e harness's seed.

## People (0277)

Everything points at `kh_person`, never at a user: a payer, a share, a payment's two ends, a member, a friend, an actor.

- **A user's own person** is made on first use with their `kh_profile` (`ensurePerson`, called by `resolveMe` in every service). A verified account takes over the person someone already made for its address, so the balances waiting for it appear. An unverified account or a guest never claims an address.
- **A friend** is added by name only (a contact, private to whoever added it) or by address (one person per address, shared by everyone who adds it). The caller's own name for them becomes their nickname, so neither the account's name nor whether anyone else added the address shows; whether the person has joined Kharcha does (`hasAccount`), which decides between "invite" and nothing (Task 90). Guests add names only.
- **Friends both ways:** adding someone or the first debt between two people makes `kh_friend` rows in both directions. The nickname and `hidden` are each owner's own.
- **`mergePerson(tx, from, to)`** makes two people one (the guest claim now; adding an address to a contact and joining in Task 90). It adds up where both were on an expense (the split becomes the exact shares it gave), drops a debt or a payment between the two, keeps one membership per group, and moves every other reference. A table that points at people adds its lines there; `kharcha-people.test.ts` reads every foreign key to `kh_person` from the catalogue and fails if one is left pointing at the merged person.
- **When an account goes** (`forgetUser` in Better Auth's `beforeDelete`): what was theirs alone goes (personal expenses, groups and expenses with only them and their own contacts, those contacts, their friend list); what they shared stays, under their name, without the account (`user_id` set null). Nothing of Kharcha's cascades from `user_id` except the profile.

## Money (0278)

- **Amounts** are integer minor units of their own currency, end to end: `toMinor(amount, code)` where a form reads what was typed, `formatMoney(minor, code)` where it is shown, `money(code)` to validate. Never add major units.
- **An expense** has an amount, a currency, its payers (together the amount) and its shares (together the amount). `split` keeps how the shares were entered, for the editor. A refund is its own kind: money back, negative spending, its debts the other way.
- **Splits:** `computeShares(amount, split)` gives exact shares or a problem (`left to assign`, percentages not 100%…); `splitProblemMessage` says it in words, for the editor and for the server's refusal. Ties in rounding go to whoever was entered first, so the same input always gives the same shares.
- **The ledger:** `writeLedger(tx, { expense })` or `({ payment })` rewrites the source's rows from what is stored, in the write's transaction; a source in the trash has none. A payment from X to Y writes "Y owes X".
- **Balances** are sums over the ledger per currency: between the caller and each person (`pairBalances`), in a group (`groupNets`), the caller's per group (`netsByGroup`). "You're owed" and "you owe" on Home are sums over people, not a net: being owed by Asha doesn't pay what you owe Bikash.
- **Simplify** (a group setting, on by default) suggests the fewest payments per currency; it never changes a record.
- **Another currency:** a payment settles the debt in the debt's currency, and may note what changed hands (`paid`: currency, amount, the typed rate as text). Nothing is converted on its own.

## Access (0277)

| Caller | Personal expense | Shared, no group | A group and what is in it |
| --- | --- | --- | --- |
| Its owner or someone on it | everything | everything | — |
| A current group member | — | — | everything; removing members and archiving are the owner's |
| A former member | — | their own, as before | the history up to leaving, read only |
| Anyone else, guests and admins | NOT_FOUND | NOT_FOUND | NOT_FOUND |

- Every service resolves first: `resolveExpense`, `resolvePayment`, `resolveGroup`, `resolveFriend`. FORBIDDEN carries a reason in the caller's language (archived, left the group, in the trash, the owner's).
- **Who an expense may name:** in a group, its current members; outside one, the caller and their friends, and the caller must be on it.
- **Leaving or removing** needs a zero balance in the group (FORBIDDEN, with the amounts). A change to an old expense or payment that would leave a former member owing or owed is refused until they are added back. The owner leaving hands the group to the longest-standing member with an account.
- **The trash:** a deleted expense or payment can be restored for 30 days by anyone who could edit it.
- **Admins:** `kharcha:read` and `kharcha:configure` open `/admin/kharcha` (Task 96), counts only, never anyone's data (0186).
- **The matrix** is `tests/server/kharcha-access.test.ts`: every operation, as the owner, a friend, a member, a former member, a stranger, a guest and an admin. A new service function adds its operation there.

## The look (0281)

"Bahi Khata": every friend and group is a page in a red cloth-bound shop ledger. The record, with every token, is [docs/design/kharcha.md](../design/kharcha.md); the direction contract is `.impeccable/surfaces/kharcha.md`.

- **Scope:** everything is under `html[data-section="kharcha"]` (and `.dark`), set by the root from the brand once the section exists (Task 88). `kharcha.css` redefines Graphite's tokens, so shadcn components take the look; Tailwind names its own `bg-kh-page`, `text-kh-owed`, `font-kh-display`.
- **Colour jobs:** red bookcloth for the rail, the phone's top bar and the one primary action (`--kh-act`); the thread (yellow) edges the cloth; owed is green and owe ochre, never red. Every coloured amount has its direction in words and an arrow; a problem is hatched (`kh-hatch`).
- **Money** is drawn only by `Money` or `BalancePill` (tabular, through `formatMoney`). Balances are signed: above zero, the caller is owed.
- **A page** is `LedgerPage` with `LedgerLine`s (a day in the margin, a card or a `SystemLine` beside it). `ExpenseCard` and `PaymentCard` take the views from `types.ts`; with `onOpen` the title becomes the card's one keyboard stop.
- **People** are `PersonAvatar` plates in their `KHARCHA_COLORS` colour (`--kh-c-<name>`), initials by grapheme so Devanagari keeps its vowel signs.
- **Type:** Laila 700 for titles, hero amounts and the wordmark (`kh-display`); Inter and Noto Sans Devanagari for the rest. `kharchaFontPreloads` goes in the `_kharcha` head (Task 88).
- **Changing a colour:** edit `kharcha.css` and run `tests/unit/kharcha-tokens.test.ts` (text 4.5:1 in both themes, white initials on each person's colour, red never for money).

## Server patterns

- **Every write is one transaction:** resolve access, make the change, `writeLedger`, `recordActivity`, `bumpRevs` for everyone the change touches (the people on it and the group's members). Notifications (Task 92) will be produced in the same transaction and delivered after it.
- **Forms save with `version`** (`saveVersioned`): a save from an older version is a stale CONFLICT. Deleting and restoring are guarded by the row's own state, so two people deleting at once leave one line of history.
- **Freshness:** `kh_profile.rev` goes up for everyone a change touches; open pages will poll `getKharchaRev` (Task 88). No websockets (0209).
- **History** (`kh_activity`): a group's thread (`group_id`), the thread of two people (`person_lo` < `person_hi`), or only its expense or payment. An edit writes one row per changed field (`{ field, from, to }`; who paid and the split as a whole). Who it was done to is `subject_id`, never a key in `data`, so merging people is an indexed update.
- **Quotas** (`assertQuota`, under `lockQuota`): expenses, payments, groups, members per group and friends per person, from `kh_settings` (defaults in `settings.ts`), smaller for guests. The admin changes them in Task 96.
- **Currencies:** a new expense, payment or group must be in a currency the admin offers (`kh_settings`; empty means all of `CURRENCIES`); what exists keeps its own.

## Guests and the demo accounts

- **Guests** started in Kharcha (`guest_scope` = `kharcha`, 0236) get sample data in their language (`seedSample`): three months of personal spending, Asha, Bikash and Sita as contacts, the groups "Pokhara trip" (an itemized dinner with service charge and VAT, a split by shares) and "Flat 3B" (rent, internet, electricity by percent), and one payment. It is written in a few bulk inserts, the shares and debts from the money core; `kharcha-seed.test.ts` checks it against the ledger's invariants.
- **The claim** moves everything with `mergePerson`; the account's own preferences win.
- **An expired guest's** rows go through `KHARCHA_GUEST_DATA.forget` (`GuestData.forget`, a hook for owners whose rows don't cascade from the user), then the guest.
- **`pnpm db:seed-kharcha --password "…"`** writes three accounts (asha@, bikash@ and sita@kharcha.example.com) who share a group: four expenses in it and a payment, a coffee outside it, and each one's groceries. The e2e harness and a fresh `pnpm dev:local` database have them (the same password as every seeded user).

## Testing

- `tests/unit/kharcha-money.test.ts`: each split method, rounding, debts, balances, simplify, and properties over random expenses (a seeded generator: a failure prints its run and input).
- `tests/server/kharcha.test.ts`: the services, with `expectLedgerConsistent(db)` after each kind of change: every expense's payers and shares add up, every source's ledger rows are exactly the money core's debts (none in the trash), and the nets of every currency, overall and per group, sum to zero.
- `tests/server/kharcha-access.test.ts`: the matrix. `kharcha-people.test.ts`: `ensurePerson`, `mergePerson` reference by reference, an account going. `kharcha-seed.test.ts`: the guest's sample, the claim, expiry, the demo accounts.

## Pitfalls already solved

- **A split's people all have shares**, even of zero (0%, one paisa among three): an expense's people are its payers and shares, and `mergePerson` rewrites the ids in `split` through them.
- **Leaving is stamped with the database's clock** (`now()`), as `created_at` is: a former member sees what was made before they left, and nothing made after, even within the same millisecond.
- **Money in an error message** is formatted with a no-break space between the code and the amount ("NPR 6.00"); tests normalize it.
- **Sentry's release snippet** (a build with `SENTRY_*` in `.env`) isn't counted by `check-bundle.ts` (0279).
- **The margin rule is drawn above the lines** (`before:z-10` on `LedgerPage`): each `LedgerLine` is positioned and painted on the page colour, so a rule beneath them disappears.
- **A fix badge truncates** inside its column: a nowrap badge wider than a phone's middle column spilled under the amount beside it.
- **`.storybook/mocks/kharcha.ts` is the sample data;** the section decorator is `kharcha-section.tsx`, since `kharcha.tsx` would resolve to the same import.
