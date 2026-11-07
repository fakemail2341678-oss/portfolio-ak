# Chaal

Chaal (चाल, "a move") is a chess app on the Lichess API at `/app/chaal`, run from `/admin/chaal`, built as a removable layer (`pnpm strip-demo`; decision 0254). The plan is [PLAN.md](../PLAN.md), section 13.

**Where it stands: Tasks 71 and 72, the foundation and the look.** Chaal has no pages of its own yet (they start with Task 73). What exists: the look ("Diagram": tokens, board themes, pieces, sounds and fonts; see "The look" below), the Lichess client, its cache and fixtures, a fake Lichess for e2e, connecting a Lichess account (OAuth, the token vault), the event stream through our server, and the admin's lab at `/admin/chaal/lab`. `/admin/chaal` opens the lab until the overview arrives (Task 84).

## The layer

| Part | Path |
| --- | --- |
| Feature (isomorphic) | `src/features/chaal/`: `brand.ts` (`CHAAL_NAME`), `links.ts` (the base path, the connect routes, `safeReturnPath`), `features.ts` (switches and scopes), `schema.ts` (what functions return), `keys.ts`, `queries.ts`, `live/` (ndjson, the event shapes), `admin/` (the lab) |
| Server | `src/server/chaal/`: `lichess/` (client, lanes, cooldowns, counters, cache, schemas), `connect/` (OAuth, vault, repository, service), `controls.ts`, `context.ts`, `status.ts`, `stream.ts`, `guest-data.ts`, `store.ts` (the singletons), `admin/lab.ts` |
| Functions | `src/functions/chaal/status.ts` (public: `withChaalPublic`), `src/functions/chaal/connection.ts` (personal: `requireChaalUser` → `withChaalServices`), `src/functions/chaal-admin/lab.ts` (`chaal:configure`) |
| Middleware | `src/middleware/chaal.ts` |
| Nitro routes | `src/server/routes/chaal-oauth.ts` (`/api/chaal/oauth/{start,callback}`), `src/server/routes/chaal-stream.ts` (`/api/chaal/stream/events`), registered in `vite.config.ts` |
| Schema | `src/server/db/schema/chaal/`: `ch_settings`, `ch_block`, `ch_connection` (migration `0039_chaal_foundation`) |
| Admin | `src/routes/_admin/admin/chaal/` (`chaal:read` on the layout, `chaal:configure` on the lab) |
| Tests | `tests/unit/chaal-lichess.test.ts`, `tests/unit/chaal-connect.test.ts`, `tests/server/chaal-connect.test.ts`, `tests/server/chaal-access.test.ts`, `e2e/flows/chaal.spec.ts` |
| Fixtures | `tests/fixtures/lichess/` (`pnpm lichess:record`), `e2e/harness/lichess.ts` (the fake Lichess) |
| The look | `src/styles/chaal.css` (imported in `app.css` between `chaal:start` and `chaal:end`), `src/features/chaal/look/` (board themes, the "Chaal/Tokens" stories), `src/features/chaal/lib/fonts.ts`, `public/chaal/pieces/cburnett/`, `public/chaal/sounds/` (`pnpm chaal:sounds`), `tests/unit/chaal-tokens.test.ts`, `.storybook/mocks/chaal.tsx` (`withChaal`) |

Nothing here imports from the portfolio, the apps, Taskline or Parda (0215). The server's LRU (`src/server/cache/lru.ts`) is core and shared with Parda (0255).

## Settings, switches and blocks

`ch_settings` is one row (missing means the defaults), read at most every 5 s per process (`controls.ts`):

- `features`: `{ play: false }` turns a feature off; a feature not listed is on. The list and each feature's scopes are in `src/features/chaal/features.ts`. Each feature's server check arrives with the feature; `withToken(…, feature, …)` checks the switch for anything that uses a token.
- `guests_may_connect`, `extra_scopes`, `cache_epoch`, and the public lane's cooldown.

`ch_block` holds a site user or a Lichess account (its lowercase id). A blocked user's personal calls are refused (`chaalUserOf`), and neither can connect. Their admin pages arrive with Task 79.

## The Lichess client

`createLichess(config, fetcher, deps)` in `src/server/chaal/lichess/client.ts` is the only way to Lichess (decision 0255). Use the singleton `chaalLichess` from `store.ts`; tests build their own with a fake fetcher.

```ts
const puzzle = await chaal.cache.read(
	{ endpoint: "puzzle-daily", path: "/api/puzzle/daily", epoch: chaal.settings.cacheEpoch },
	untilUtcMidnight(Date.now()),
	() => chaal.lichess.json({ endpoint: "puzzle-daily", path: "/api/puzzle/daily", lane: "public" }, dailyPuzzleAnswer),
);
```

- **`json(request, schema)`** for answers, **`send(request)`** when the body doesn't matter (a 204, a move), **`stream(request)`** for ndjson and PGN streams.
- **`endpoint`** names the call in the log and the counters: keep it short and stable (`account`, `puzzle-daily`, `stream:event`).
- **Lanes** (`lanes.ts`): `public` for calls without a user's token, `userLane(id)` for a user's reads and writes, `playLane(id)` for moves. One call at a time per lane per instance. Streams take no lane.
- **`host`**: `api` (default), `explorer` or `tablebase`.
- **Errors:** `UPSTREAM_UNAVAILABLE` (a timeout, a 5xx after the retry, an answer whose shape changed), `NOT_FOUND`, `RATE_LIMITED` with reason `lichess-wait` (a cooldown), `LichessAuthError` (a 401 with a user's token: FORBIDDEN, reason `lichess-reconnect`), a plain FORBIDDEN for a 401 without a token, BAD_REQUEST for other 4xx.
- **Schemas** (`schemas.ts`) read only what Chaal uses and map it to Chaal's own shape: the page's dehydrated state is in its HTML. Add a schema next to the others; never pass Lichess's JSON through.

**Cooldowns:** a 429 starts one for the lane's key: 60 s, doubled when another 429 comes within ten minutes of the last one ending, at most an hour. Public calls share one key (stored in `ch_settings`); a connection's two lanes share theirs (in `ch_connection`). Every instance reads them with a 5 s TTL (`cooldown.ts`). Until a cooldown ends, calls on its key fail at once with `lichess-wait`; the UI says "Lichess asks us to wait a minute" (`m.ch_error_lichess_wait`).

**The cache** (`cache.ts`, on the shared LRU): a TTL per read, stale-while-revalidate, one call for concurrent readers, and keys with the endpoint, path, parameters, `cache_epoch` and, for a personal read, `owner` (the user's id: one user's answers never reach another). During a cooldown or an outage, a read serves what the cache still holds, however old, before failing. Each TTL arrives with its feature (PLAN 13.5, "Cache TTLs"); the daily puzzle's is `untilUtcMidnight`.

**Logging and counters:** every call logs `lichess call` with the endpoint, status, milliseconds and lane kind, never a token. `chaalLichess.counters.snapshot()` holds this instance's calls, errors, 429s and time per endpoint; the lab shows them, and Task 79 flushes them to `ch_api_stat`.

## Connecting Lichess

Decision 0256. A visitor needs a session first (a guest's is fine; a Chaal page starts a scoped guest, `setGuestScope("chaal")`), then follows a link:

```ts
<a href={connectHref(localizeHref("/app/chaal/settings"))}>…</a>   // /api/chaal/oauth/start?return=…
```

1. **Start** checks the session, the key (`CHAAL_TOKEN_KEY`), the guest rule and blocks, picks the scopes from the enabled features, seals `{ state, verifier, userId, returnTo, scopes, at }` into the `ch_oauth` cookie (HttpOnly, SameSite=Lax, `Path=/api/chaal/oauth`, 10 minutes) and redirects to Lichess's `/oauth` with an `S256` challenge.
2. **Callback** opens the cookie (and clears it), checks the state and the user, exchanges the code (`POST /api/token` with the verifier), reads `/api/account`, and saves `ch_connection` with the token sealed.
3. Both redirect to the return path with `?lichess=<result>`: `connected`, `denied`, `taken` (that Lichess account belongs to another user here), `blocked`, `off`, `expired`, `failed`, `no-session`. The messages are `m.ch_connect_result_*`.

**Return paths** go through `safeReturnPath`: a path under `/app/chaal` or `/admin/chaal`, optionally `/ne`, never another site.

**Using a token:** only inside a service, through `withToken(deps, userId, feature, (token) => …)`. It refuses (FORBIDDEN, reason `lichess-reconnect`) when the feature is off (no reason then), there's no connection, it was revoked or ran out, or it lacks the feature's scopes. A 401 inside marks the connection revoked. Never return, log or render a token; `tests/server/chaal-connect.test.ts` and the e2e flow check outputs and the page.

**Scopes by feature** (`FEATURE_SCOPES`): play → `board:play challenge:read challenge:write`; puzzles → `puzzle:read puzzle:write`; social → `follow:read follow:write`; studies → `study:read study:write`; teams → `team:read team:write`; tournaments → `tournament:write`; preferences → `preference:read`. A connection made before a feature was enabled lacks its scopes: its view lists the feature in `needsScopesFor` ("Reconnect to allow …").

**Disconnect** (`disconnectChaal`) revokes the token at Lichess, best effort, and deletes the row.

**Guests:** the claim moves a guest's connection to the account it signs up or in as. If the account has its own, that one stays, and the guest's token is revoked outside the claim's transaction.

### The vault

`CHAAL_TOKEN_KEY` is 32 random bytes in base64 (`openssl rand -base64 32`). Without it, connecting is off and the public features work. A sealed value is `v1.<key id>.<iv>.<ciphertext>` (AES-256-GCM, bound to its purpose).

**Rotating the key:** put the new key first, comma-separated: `CHAAL_TOKEN_KEY="<new>,<old>"`. New tokens are sealed with the new key and old ones still open. Once everyone has reconnected (tokens last about a year, or check that no `ch_connection.token` starts with `v1.<old key id>.`), remove the old key. A token no configured key opens marks its connection revoked, and the user reconnects.

## Streams

**Through our server** (tokens): `GET /api/chaal/stream/events` opens the user's Lichess event stream with their token and passes each line on as Chaal's event (`src/features/chaal/live/events.ts`): unknown types are dropped, keepalives (empty lines) pass through, and the first line is a keepalive so the client knows it's open. After `STREAM_WINDOW_MS` (270 s: Vercel's limit is 300 s on Hobby) the server sends `{"type":"reconnect","afterMs":0}` and closes; when Lichess ends it, `afterMs` is 1000. The client opens it again at once: Lichess restates every current challenge and game, so nothing is lost. Refusals are JSON: `{ error, reason? }` with 401, 403 (blocked, or `lichess-reconnect`), 429 or 503.

Read it with `ndjsonLines` (`src/features/chaal/live/ndjson.ts`), which the server uses too. Lichess allows **one event stream per token**: opening another closes the first. Task 77 adds the tab leader (a Web Lock and a `BroadcastChannel`) so only one tab holds it.

**Public live data** (TV, spectating, broadcasts) answers `access-control-allow-origin: *`, so the browser reads it from lichess.org directly (decision 0257); Chaal's pages add `connect-src https://lichess.org` when they first need it.

## The lab (`/admin/chaal/lab`)

`chaal:configure`. Four sections:
- **Your Lichess account:** connect, see the account, scopes and state, reconnect, disconnect. The result of a connect shows as a banner.
- **Event stream:** opens `/api/chaal/stream/events` and times it: time to the first byte, keepalives, the events, and how long until the server asks for a reconnect. Use it on a deployment to check streaming there (spike 1).
- **Setup on this server:** whether the key and the app token are set (never their values), the key id new tokens use, the client id, the API, the redirect URI to give Lichess if asked, the scopes connecting asks for, the stream window and the public cooldown.
- **Lichess calls on this server:** the counters, and "Check the public lane" (the daily puzzle through the client and the cache).

## Fixtures and the fake Lichess

- **`pnpm lichess:record`** (`scripts/record-lichess-fixtures.ts`) writes `tests/fixtures/lichess/` from the real API, one request a second: the daily puzzle, the TV channels, a cloud eval, a tablebase position and the first lines of the TV feed. With `LICHESS_APP_TOKEN` in `.env` it records the explorer too. Files are named by `lichessFixtureName(host, path, params)` (a hash of the parameters), one line each, and Biome skips them.
- **`events.ndjson`** is written by hand from the API's examples (recording needs a connected account and live games). It includes one unknown event type, which must be dropped.
- **`e2e/harness/lichess.ts`** stands in for Lichess in e2e: the approval page (pick `E2E_Player` or `E2E_Rival`, Approve or Deny), a token exchange that checks the PKCE verifier, revocation, `/api/account`, the event stream (the recorded opening lines, then a keepalive a second), and recorded reads; the explorer refuses calls without a token, as the real one. Test controls: `POST /e2e/lichess/revoke`, `POST /e2e/lichess/event`, `DELETE /e2e/lichess`, and `DELETE /e2e/chaal-connections` in the harness. **CI never calls Lichess.** A task that reads a new endpoint records it and, if e2e needs it, teaches the fake.

## Spikes (Task 71, decision 0257)

1. **Streams through Nitro:** unbuffered in the production build (the e2e flow sees a pushed event at once). On Vercel, 300 s per function on Hobby (800 s possible on Pro); the route closes at 270 s. Time it on the deployment with the lab.
2. **The engine:** `stockfish` 19.0.1, GPL-3.0. Use `stockfish-19-lite-single.js` (28 KB) and `.wasm` (1.85 MB); the package unpacks to 205 MB, so `engine:copy` copies only those two and `Copying.txt`. A dedicated worker follows its own response's CSP: serve the engine files with `script-src 'self' 'wasm-unsafe-eval'` and the page needs only `worker-src 'self'`, never `'wasm-unsafe-eval'`. Depth 18 took about 1 s on a desktop; measure a real mid-range phone in Task 75 (CDP throttling doesn't slow workers).
3. **The explorer needs a token** (any, no scope): `LICHESS_APP_TOKEN` for visitors, the user's own when connected.
4. **Board API seeks, chat and endings:** not run (they need a live account); Task 77 checks them with the lab on the owner's account.
5. **Payloads:** the TV feed is `{"t":"featured","d":{…}}` then `{"t":"fen","d":{fen, lm, wc, bc}}`; a spectated game sends its info, then every position so far, then live ones; a broadcast round streams plain PGN with `[%eval]` and `[%clk]`.
6. **CORS:** every public stream answers `access-control-allow-origin: *`; preflights allow `Authorization`.

## The look: "Diagram" (Task 72, decision 0258)

The board is a printed chess diagram: hatched dark squares in a heavy double frame, coordinates outside it, and the annotator's symbols beside the moves. Paper and ink, one vermilion. The contract is `.impeccable/surfaces/src-routes-chaal-route-tsx.md`; read it before any Chaal UI work. The approved comps are `.impeccable/mocks/chaal/board.html`, which is gitignored, so it exists on the owner's machine only.

**Tokens** (`src/styles/chaal.css`, under `html[data-section="chaal"]`, `.dark` for the dark values; Tailwind names them `bg-ch-ground`, `text-ch-ink` and so on):

| Token | Use |
| --- | --- |
| `--ch-ground` | The page: warm paper in light, ink-black in dark |
| `--ch-plate` | Raised surfaces: menus, dialogs, inputs (Graphite's `--card`, `--popover`, `--muted`) |
| `--ch-ink`, `--ch-on-ink` | Text and rules; the primary action is an ink fill with on-ink text |
| `--ch-muted` | Secondary text: ratings, captions, the clock of the side not to move |
| `--ch-hair` | Hairlines between rows; borders |
| `--ch-mark` | Vermilion as text: annotation symbols, the current move's underline |
| `--ch-danger` | Destructive (Graphite's `--destructive`) |
| `--ch-paper` | The board's paper: white, dimmed a step in dark |
| `--ch-sq-light`, `--ch-sq-dark`, `--ch-sq-pattern`, `--ch-sq-hatch` | Squares; the pattern is the hatching in "diagram" and `none` in the others |
| `--ch-sq-mark` | Marks on squares: the last move's ring, selection, check, arrows (vermilion; ink on "stone") |
| `--ch-sq-dot` | Legal-move dots: ink, drawn with a `--ch-paper` halo so they read on hatching |
| `--ch-frame` | The plate's heavy frame |

- **Vermilion has five jobs only:** the last move's ring, annotation symbols, the current move's underline, check, and engine arrows. It is never a button, a link or a badge.
- **The board stays paper in both themes.** Dark mode reverses the chrome, not the diagram.
- **Board themes:** `CHAAL_BOARD_THEMES` (`diagram`, `print`, `stone`) in `src/features/chaal/look/board-themes.ts`. Put `data-ch-board="print"` (or `"stone"`) on the board's container; "diagram" needs no attribute. A new theme is a rule in `chaal.css` plus an entry in the list, and the token test checks its marks at 3:1.
- **Utilities:**
  - `ch-display`: Mukta 800, tight; Nepali opens the leading.
  - `ch-figures`: tabular numbers, for clocks.
  - `ch-rule`: the heavy 2px section rule. `ch-hairline`: the hairline between rows.
  - `ch-sq-light` and `ch-sq-dark`: a square in the current board theme.
  - `ch-frame`: the plate's double frame.
  - Sizes: `text-ch-clock` (40 to 52px), `text-ch-title` (34 to 44px), `text-ch-head` (24px).
- **Type:** Mukta 800, as "Chaal Display", sets clocks, headings and the wordmark only; text stays Inter and Noto Sans Devanagari. `chaalFontPreloads(locale)` (two files per locale, production only) goes in the `_chaal` layout's head (Task 73). Notation on screen is figurine SAN.
- **Motion:** `ch-move` (a piece's slide: transform, 150 ms), `ch-fade` (opacity, 120 ms) and `ch-press`, all on one ease, `--ch-ease`. Nothing else may animate, and nothing moves under reduced motion (the token test checks both).
- **Pieces:** `/chaal/pieces/cburnett/{w,b}{K,Q,R,B,N,P}.svg`, under the 3-clause BSD licence (`LICENSE.txt` beside them). The about page credits Colin M.L. Burnett (Task 73).
- **Sounds:** `/chaal/sounds/{move,capture,check,start,end,low-time,notify,correct,wrong}.wav`, our own, made by `pnpm chaal:sounds`. Play them only after the player's first interaction.
- **Stories:** wrap Chaal stories in `withChaal` (`.storybook/mocks/chaal.tsx`). It sets the section with a rose accent and a round radius, which the tokens must outrank.

## Glossary (en/ne)

Chess words are Chaal's own messages, in both languages, and must read the same everywhere. Task 71's words; the board's (pieces, moves, check, mate and the rest) join with Task 74, checked by a Nepali speaker.

| English | नेपाली | Note |
| --- | --- | --- |
| Lichess | Lichess | A name: never translated |
| Chaal | Chaal (चाल in the permission matrix) | The brand stays Latin in the UI, as Parda's |
| connect, disconnect, reconnect | जोड्नु, छुटाउनु, फेरि जोड्नु | |
| account | खाता | |
| scope | स्कोप | Lichess's OAuth word |
| token | टोकन | |
| event stream | इभेन्ट स्ट्रिम | |
| daily puzzle | दैनिक पजल | |
| cooldown (Lichess asks us to wait) | पर्खाइ | |

## Pitfalls already solved

- **Lichess's 401 isn't always "revoked":** only a call with a user's token becomes `LichessAuthError`. The explorer's 401 without a token means it needs one.
- **A stream's timeout covers its headers only:** `AbortSignal.timeout` on the whole fetch would kill the stream after 8 s.
- **Nitro routes don't run TanStack Start's middleware:** the OAuth and stream routes read the session with `auth.api.getSession({ headers })` themselves, and import with relative paths like the other Nitro routes.
- **The vault's key ids:** the first 8 characters of the key's SHA-256, so the same key always has the same id, and the key itself never appears.
- **Fixture names:** a FEN in a file name would break Windows' path limit; `lichessFixtureName` hashes the parameters.
