# Chaal

Chaal (चाल, "a move") is a chess app on the Lichess API at `/app/chaal`, run from `/admin/chaal`, built as a removable layer (`pnpm strip-demo`; decision 0254). The plan is [PLAN.md](../PLAN.md), section 13.

**Where it stands: Tasks 71–82, the foundation, the look, the shell, the board kit, the analysis board, local games, online play (with quick pairing, correspondence and notifications), the admin's first pages, puzzles, players and games, and watch.** Chaal has its own layout and frame at `/app/chaal` with a first home, the play hub with online play on Lichess (the Lichess AI, a challenge to a player, an open link, the challenges to answer and the games in progress) and local games (Stockfish at eight levels and over the board, with clocks), a game on Lichess at `/app/chaal/game/$id`, the analysis board (Stockfish in the browser, Lichess's cloud eval, explorer and tablebase, "My analyses"), settings (preferences and the Lichess connection), about, sign-in and sign-up, and its own 404 (see "The shell and pages" and "The analysis board" below). Underneath: the look ("Diagram": tokens, board themes, pieces, sounds and fonts), the Lichess client, its cache and fixtures, a fake Lichess for e2e, connecting a Lichess account (OAuth, the token vault), the event stream through our server, and the admin's lab at `/admin/chaal/lab`. `/admin/chaal` opens the lab until the overview arrives (Task 84). The game model and the board kit (Task 74) are in Storybook, on the analysis board (Task 75), the local games' board (Task 76) and a game on Lichess (Task 77); quick pairing, "My games", the bell and toasts, berserk, zen and the phone's play layouts arrived with Task 78, the admin's settings, connections, blocks and health with Task 79, puzzles (the daily one, training, the streak, Lichess's dashboard and replays) with Task 80, players and games (leaderboards, a player's page and games, following, a finished game's replay, the palette's search) with Task 81, and watch (the TV, a channel on the big board, following a game being played, broadcasts, the streamers live) with Task 82. Community (Task 83) is next.

## The layer

| Part | Path |
| --- | --- |
| Feature (isomorphic) | `src/features/chaal/`: `brand.ts` (`CHAAL_NAME`, `CHAAL_BRAND`, `chaalTitle`, `chaalHead`), `links.ts` (the base path, `chaalLinks`, `CHAAL_PATHS`, `CHAAL_SITEMAP`, the connect routes, `safeReturnPath`), `search.ts` (URL contracts), `features.ts` (switches and scopes), `schema.ts` (what functions return), `keys.ts`, `queries.ts`, `shell/` (the frame, the account menu, the palette, the shortcuts, the notice, the bell and the count on Play, zen, the play pages' layout), `connect/` (connecting and disconnecting from any page), `settings/` (preferences: schema, browser copy, hook, page), `chess/` (the game model: rules over chess.js, the tree and its editing, PGN, notation, spoken moves, clocks, evals), `board/` (the kit: `Board`, `MiniBoard`, the plate, `MoveList`, `MoveInput`, `Clock`, `PlayerStrip`, `Material`, `EvalBar`, `EvalGraph`, `GameControls`, `ResultBanner`, `OpeningName`, sounds, the FEN reader), `engine/` (the files, the worker client, UCI, the page hook, the limits), `analysis/` (the page, its panels and dialogs, the URL, import, queries, "My analyses"' schema), `local/` (local games: the model, its types and schema, the browser's store, the play hook, the hub, the history, the game page), `play/` (online play: Board-legal controls, inputs and answers, queries and calls, the hub's online part, the kept-open challenge, quick pairing and its seek, the shared labels), `game/` (a game on Lichess: the page that picks live or replay and its loader, the live model, hook, board and chat, the replay's model and board, the lichess.org links), `home/`, `about/`, `auth/`, `live/` (ndjson, the streams' shapes, the reader and its reconnects, the event store, the tab leader, fair play's lock, the notices), `puzzles/` (theme keys and names, the trainer and its hook, the queue, attempts in the browser and their import, the progress panel's figures, the page), `players/` (Task 81: the schema, labels, queries and loaders, the leaderboards, a player's page and games, the game rows, the history's rows), `watch/` (Task 82: the admin's controls (`limits.ts`), the schema, the live models (the TV's feed, following a game, a round's PGN stream), the hooks that keep Lichess's public streams open, the TV, a channel, the broadcasts' pages, the spectator's board), `head.ts` (an indexable page's head, shared), `admin/` (the lab and the admin's pages) |
| Routes | `src/routes/_chaal/route.tsx` (the layout: brand, head, loader, 404) and `src/routes/_chaal/app/chaal/`: `index`, `play`, `local/$id`, `game/$id`, `analysis`, `puzzles/index`, `puzzles/$id`, `players/index`, `players/$username`, `watch/index`, `watch/$channel`, `broadcasts/index`, `broadcasts/$id`, `about`, `settings`, `sign-in`, `sign-up`, `$` |
| Server | `src/server/chaal/`: `lichess/` (client, lanes, cooldowns, counters, cache, schemas), `connect/` (OAuth, vault, repository, service), `analysis/` (Lichess's data for the board, "My analyses"), `local/` (local games), `play/` (online play through the Board API), `puzzles/` (Lichess's puzzles, attempts and posting them), `players/` (Lichess's players and games, following), `watch/` (Lichess's TV, streamers and broadcasts for the first paint), `activity.ts` (`ch_activity`), `cron.ts` (the daily job), `controls.ts`, `context.ts`, `status.ts`, `stream.ts` (the streams' relay), `guest-data.ts`, `store.ts` (the singletons), `admin/lab.ts` |
| Functions | `src/functions/chaal/status.ts` and `analysis.ts` (public: `withChaalPublic`), `src/functions/chaal/connection.ts`, `preferences.ts`, `analyses.ts`, `local-games.ts`, `challenges.ts`, `live-game.ts` and `puzzle-attempts.ts` (personal: `requireChaalUser` → `withChaalServices`); `puzzles.ts`, `players.ts` and `watch.ts` are public too, `follows.ts` personal, `src/functions/chaal-admin/lab.ts` (`chaal:configure`) |
| Middleware | `src/middleware/chaal.ts` |
| Nitro routes | `src/server/routes/chaal-oauth.ts` (`/api/chaal/oauth/{start,callback}`), `src/server/routes/chaal-stream.ts` (`/api/chaal/stream/events`, `/game/{id}`, `/challenge` and `/seek`), `src/server/routes/cron-chaal.ts` (`/api/cron/chaal`), `src/server/routes/chaal-manifest.ts` (`/app/chaal/manifest.webmanifest` and the `/ne` one), registered in `vite.config.ts` |
| Schema | `src/server/db/schema/chaal/`: `ch_settings`, `ch_block`, `ch_connection` (migration `0039_chaal_foundation`), `ch_preference` and `ch_settings.banner` (`0040_chaal_shell`), `ch_analysis` and `ch_settings.engine` (`0041_chaal_analysis`), `ch_local_game` (`0042_chaal_local_game`), `ch_activity` and `ch_settings.play` (`0043_chaal_play`), `ch_api_stat`, `ch_api_error` and the admin's columns (`0044_chaal_admin`), `ch_puzzle_attempt` and `ch_settings.puzzles` (`0045_chaal_puzzles`), `ch_settings.watch` (`0046_chaal_watch`) |
| Admin | `src/routes/_admin/admin/chaal/` (`chaal:read` on the layout, `chaal:configure` on the lab) |
| Tests | `tests/unit/chaal-chess.test.ts` and `chaal-pgn.test.ts` (the model), `tests/components/chaal/` (the kit, the analysis panels and the engine hook), `tests/unit/chaal-engine.test.ts` (the engine client against a fake worker), `tests/unit/chaal-analysis.test.ts` and `tests/server/chaal-analysis.test.ts` (the board's tree, URL and import; Lichess's data; "My analyses"), `tests/unit/chaal-local.test.ts`, `tests/server/chaal-local.test.ts` and `tests/components/chaal/local-game.test.tsx` (local games), `tests/unit/chaal-live.test.ts`, `tests/server/chaal-play.test.ts` and `tests/components/chaal/live-game.test.tsx` (online play), `tests/unit/chaal-quick.test.ts` and `tests/components/chaal/quick-pair.test.tsx` (quick pairing, the games in progress, notices, berserk, zen), `tests/server/chaal-admin.test.ts` (the admin), `tests/unit/chaal-puzzles.test.ts` and `tests/server/chaal-puzzles.test.ts` (puzzles), `tests/unit/chaal-players.test.ts` and `tests/server/chaal-players.test.ts` (players and games), `tests/unit/chaal-watch.test.ts` and `tests/server/chaal-watch.test.ts` (watch), `tests/unit/chaal-lichess.test.ts`, `tests/unit/chaal-connect.test.ts`, `tests/unit/chaal-preferences.test.ts`, `tests/server/chaal-connect.test.ts`, `tests/server/chaal-access.test.ts`, `e2e/flows/chaal.spec.ts` |
| Fixtures | `tests/fixtures/lichess/` (`pnpm lichess:record`), `e2e/harness/lichess.ts` (the fake Lichess), `lichess-play.ts` (its online play), `lichess-puzzles.ts` (its puzzles), `lichess-players.ts` (following, Task 81) and `lichess-watch.ts` (the TV's feeds, a game being played, a live round, Task 82) |
| The engine | `stockfish` (devDependency), `scripts/engine-copy.ts` (`pnpm engine:copy` and the `chaalEngine()` Vite plugin), `public/chaal/engine/` (gitignored) |
| The look | `src/styles/chaal.css` (imported in `app.css` between `chaal:start` and `chaal:end`), `src/features/chaal/look/` (board themes, the "Chaal/Tokens" stories), `src/features/chaal/lib/fonts.ts`, `public/chaal/pieces/cburnett/`, `public/chaal/sounds/` (`pnpm chaal:sounds`), `tests/unit/chaal-tokens.test.ts`, `.storybook/mocks/chaal.tsx` (`withChaal`) |

Nothing here imports from the portfolio, the apps, Taskline or Parda (0215). The server's LRU (`src/server/cache/lru.ts`) is core and shared with Parda (0255).

## The shell and pages

Decision 0259. `/_chaal` is a pathless layout: `staticData: { brand: CHAAL_BRAND }` puts `data-section="chaal"` on `<html>` (which scopes `chaal.css`), "system" follows the device, and the icons (`public/chaal/icon.svg` and the PNGs rendered from it with Playwright) and the manifest replace the app's. Its head adds `chaalFontPreloads(locale)` and noindex; indexable pages override it with `seo({ siteName: CHAAL_NAME })` and join `CHAAL_SITEMAP` and the route-SEO test's `INDEXABLE`. Private pages use `chaalHead(title)`.

**The layout's loader** reads `chaalStatusQueryOptions` (switches, `connect`, the admin's `banner`) for everyone, and for a session `chaalConnectionQueryOptions` and `chaalPreferencesQueryOptions`. Pages read these with `useQuery` (they're in the cache); a page that needs more ensures its own in its loader.

**The frame** (`shell/chaal-frame.tsx`): the top bar, the notice, the page (which renders its own `<main {...MAIN_CONTENT}>`), the footer, and the phone's tab bar. A new section is a row in `SECTIONS` (top bar and tab bar) added with its route, never before; "More" holds the rest. Shortcuts go through `useHotkeys` and get a row in `shell/shortcuts-dialog.tsx`; palette entries go in `shell/chaal-palette.tsx`.

**Connecting from a page:** `useConnectLichess()` returns `connect(returnTo?)`: it starts a Chaal-scoped guest when there's no session, then sends the browser through the OAuth start route back to the page. `connectionState(connection)` is `ok`, `attention` (revoked, or missing an enabled feature's scope) or `none`, for the dot (`ConnectionDot`) and the buttons. `useDisconnectLichess()` asks first (it needs the section's `ConfirmProvider`).

**Preferences:** `useChaalPreferences()` returns `{ preferences, save, where }`. With a session they're the account's (`ch_preference`, saved optimistically and put back on a refusal); without one, this browser's (`settings/local.ts`, keys under `chaal:`, read after hydration, so the server renders the defaults). The frame imports the browser's copy into a new session once (`useImportLocalPreferences`); a row already there wins. Read stored values with `readPreferences`, which falls back field by field. A new preference is a field in `chaalPreferencesSchema`, a default, a column (migration), and a control on the settings page.

**`MiniBoard`** (`board/mini-board.tsx`): a static diagram from a FEN, drawn on the server, in a board theme, with marked squares (vermilion rings) and optional coordinates. Give it a `label` (one image to screen readers), or none when it's decoration beside its name. It shares the plate (`board/plate.tsx`) with the interactive `Board` (below).

## The game model and the board kit (Task 74, decisions 0261 and 0262)

**The game model** (`src/features/chaal/chess/`, isomorphic and pure; only pages that show a board import it):

| File | Gives |
| --- | --- |
| `rules.ts` | chess.js behind FEN functions: `play(fen, move)` (squares, UCI or lenient SAN; null when illegal) returns a `PlayedMove` (SAN, UCI, piece, capture, check, mate, the FEN after); `legalDests`, `isPromotion`, `checkSquare`, `turnOf`, `checkFen` (`kings`, `check`, `format`), `gameState(fen, history)`, `materialBalance`, `premoveDests` |
| `tree.ts` | The game tree: flat nodes by id, `children[0]` the main line. `createTree`, `addMove`, `playOn`, `pathTo`, `fensTo`, `lineFrom`, `mainline`, `stepFrom`, `isMainline`, `promoteLine`, `deleteFrom`, `sizeOf`. Never mutates |
| `pgn.ts` | `readPgn` (the first game; variations, comments, NAGs and suffixes, `[%clk]`, `[%eval]`; 500 KB and 2,000 moves at most; refuses variants, bad FENs, null and illegal moves, naming the move) and `writePgn` |
| `notation.ts` | `figurine`, `showSan(san, notation)`, `nagSymbol`, `readTypedMove` and `moveSuggestions` for the move input |
| `speech.ts` | `spokenMove(san)`, `spokenTurn(san, color)`, `pieceWord`, `sideName`: words from SAN alone, at render time |
| `clock.ts` | `formatClock` (tenths under 10 s), `speedOf`, `formatTimeControl`, and two clocks on a monotonic time: `remaining`, `pressClock`, `flagged` |
| `eval.ts` | `winChance` (Lichess's curve) and `formatScore` |

- **A game's state is computed, not stored:** `gameState(node.fen, fensTo(tree, node.id))`. `end` is checkmate, stalemate, dead material, fivefold or 75 moves; `claim` is threefold or fifty moves, which play goes on through until someone claims (the play tasks decide).
- **Hold FENs, never chess.js instances,** in state, queries or rows.

**The board** (`board/board.tsx`) is controlled. Pass `fen`, `lastMove` (`{ uci, san }`: ringed, spoken and sounded when it changes), `movable` (`"white"`, `"black"`, `"both"` or `"none"`) and `onMove`, which gets the move already played; put `move.fen` back in the same render. Options: `orientation`, `autoQueen`, `coordinates`, `theme`, `pieces`, `sound` (a volume or `false`), `label` (the grid's name), `premove` with `onPremove`, `shapes` with `onShapesChange` (right-drag draws). Pass the player's preferences (`useChaalPreferences`) into it; the kit itself reads none.
- **Size:** the board is as wide as its container and square; the page sizes the container (board first: `min(container, 100dvh − chrome)`).
- **Input:** a press on a movable piece selects it, a drag of 4 px moves it, a click on a target plays; Escape or a second click puts it back. Keyboard: the grid is one tab stop (`aria-activedescendant`), arrows move the cursor, Enter or Space picks up and puts down. `MoveInput` beside it takes typed moves (`/`).
- **What it says:** one polite live region per board: moves as they arrive ("Black: Knight to f6"), pick-ups, put-backs, illegal moves. Each square names itself.
- **Tests and stories** find squares by `data-square`, pieces by `data-at` and `data-piece`, marks by `data-mark` (`dot`, `capture`, `selected`, `premove`, `check`). A story's play function must not use English names, because the second pass is Nepali.

**The rest of the kit:** `MoveList` (`layout`: `table`, `strip` or `tree`; `current`, `onSelect`, `notation`), `Clock` (`ms` left at `since`, a `performance.now()` time; `running`; `low`), `PlayerStrip` (name, title, rating, `active`, `note`, `material`, the clock as children; a Lichess link is `nofollow ugc`), `Material`, `EvalBar` (`direction`), `EvalGraph` (`scores` by move, `current`, `onSelect`), `GameControls` with `useBoardKeys` (←/→, Home, End, `f`), `ResultBanner` (add new reasons to `REASONS` with their task), `PromotionPicker` (inside the board). Sounds: `playSound(name, volume)` and `soundOfSan`. The stories are "Chaal/Board" and "Chaal/Kit" (with the comps' game screen put together from the kit).

## The engine (Task 75, decision 0263)

- **Files:** `pnpm engine:copy` copies `stockfish-19-lite-single.js` and `.wasm` (and `COPYING.txt`) from the `stockfish` package into `public/chaal/engine/`, named with `ENGINE_HASH` (`src/features/chaal/engine/files.ts`). Vite runs it before `dev` and `build` (`chaalEngine()`), so nothing else needs to. **A new `stockfish` version** is refused until `ENGINE_PACKAGE.version` and `ENGINE_HASH` change (the copy prints the hash it found). The files are served immutable with their own CSP (`vite.config.ts`); Chaal's pages allow `worker-src 'self'`.
- **Client:** `createEngine()` (lazy: `await import("./engine")`), then `await engine.ready`; `analyse(fen, { multiPv, depth }, onInfo)` streams lines (scores from White's side), `bestMove(fen, { level })` plays at levels 1–8, `stop()`, `quit()`. One search at a time: calling `analyse` again replaces the running search.
- **On a page:** `useEngine({ fen, limits, skip })` gives `status` (`off`, `loading` with `progress`, `running`, `done`, `paused`, `failed`), `lines`, `depth`, `settled` (the finished search's score), `start()` and `stop()`. It creates the worker on the first `start()`, pauses while the tab is hidden, and quits when the page unmounts. `limits` are the status's `engine` (`ch_settings.engine`, clamped by `readEngineLimits`).

## The analysis board (Task 75, decision 0264)

`/app/chaal/analysis` (indexable). The board first, the eval bar beside it (a band above it on a phone), `GameControls` with Save and a menu (Import, Export, My analyses, New board), the move input, then the opening's name, the engine's block and three tabs: Moves (the tree, the move tools, the graph), Explorer and Tablebase.

- **State** (`use-analysis.ts`): the tree, the node shown, the side, the PGN tags, the saved analysis (id and title) and `dirty`. Every edit goes through it (`play`, `playLine`, `toggleNag`, `setComment`, `setShapes`, `promote`, `makeMain`, `remove` with `restore` for Undo, `load`, `reset`).
- **The URL** follows the board after 250 ms with `replace`: `fen`, `moves` (UCI joined by `_`), `ply`, `orientation`; a saved analysis is `?id=` only. A link followed while the page is open starts that board (the hook tells its own writes from a link by the search it last wrote). Build links with `chaalLinks.analysis({ fen, moves })`.
- **Lichess's data** (`analysis/queries.ts`, kept for the visit): `cloudEvalQueryOptions` (asked only while the engine is on, 40 plies deep at most; the engine waits for its answer and isn't run when it has one), `explorerQueryOptions` (masters by default; read for the opening's name for the first 30 plies even with its tab closed; a player's games poll every 5 s while Lichess indexes them), `tablebaseQueryOptions` (7 pieces or fewer, on its tab), `importLichessGame`. The server side (`server/chaal/analysis/lichess.ts`) checks each FEN and its feature's switch before Lichess is asked.
- **The explorer's token:** a connected user's own, else `LICHESS_APP_TOKEN`; without either, `{ ok: false, reason: "token" }` and the tab offers Connect. `getChaalStatus().explorerForVisitors` says whether visitors have it.
- **Tree editing:** the move symbols toggle (one of each kind), position symbols are a menu, comments are one text per move, right-drag draws arrows (stored per node as `shapes`, written to PGN as `[%cal]`/`[%csl]`), and the engine's best move is a vermilion arrow that isn't stored. Deleting shows an Undo toast.
- **Import and export:** PGN (pasted or a file, 500 KB at most), a FEN, or a finished Lichess game by address or id (`readImport`); export gives the PGN (copy, download), the FEN and a share link.
- **"My analyses"** (`ch_analysis`, `functions/chaal/analyses.ts`): saving needs a session, so it starts a Chaal guest first (`useEnsureChaalSession`); 200 per player; the server checks the tree's shape and every move before writing; another player's id is NOT_FOUND. The guest claim moves a guest's analyses to the account.
- **Fair play:** `useFairPlay()` (`live/fair-play.ts`) is locked while `setLiveGames` holds a real-time game (Task 77 feeds it from the event stream). Locked, the engine waits, cloud eval, the explorer and the tablebase aren't asked, and `FairPlayBanner` (in the frame) says why on every page.
- **Stories:** "Chaal/Analysis" (the engine's states, the explorer, the tablebase, the move tools, fair play) and "Chaal/Kit" → Opening.

## Local games (Task 76, decision 0265)

`/app/chaal/play` (indexable) is the hub: "Against the computer" (level 1–8, a side or Random, no clock or a time control), "Over the board" (a clock with increment, Flip or Face to face), then "Your games". `/app/chaal/local/$id` (noindex) is one game.

- **The model** (`local/game.ts`, pure; types and constants in `types.ts`, so the browser's store and the frame never load chess.js): `newLocalGame(setup, id, now)`, `addLocalMove` (ends the game on mate, stalemate, dead material, fivefold or 75 moves), `takeBack`, `endLocalGame`, `resignResult`, `flagResult` (FIDE 6.9), `stateOf` (claims), `toRecord` and `fromRecord` (the stored form, PGN with `[%clk]`), `localGamePgn(game, names)`, `analysisLineOf`. Every way a game ends is a `GameEndReason` (`chess/rules.ts`), and `ResultBanner` says it.
- **Playing** (`use-local-game.ts`): `useLocalGame({ initial, signedIn, locked })` gives the game, the clocks (`ClockState` on `performance.now()`), `paused`, the computer's status, `claim`, `movable` and the actions (`move`, `takeBack`, `resign`, `agreeDraw`, `claimDraw`, `pause`, `resume`). The actions are made once and read the latest state through a ref, so the engine's reply never acts on an older position. Pass the board's played move to `move`.
- **The computer:** Stockfish through the engine client, loaded when an engine game's page opens (`await import()`), asked for `bestMove` at the game's level on its turn, held while paused or while fair play locks the engine. It never shows a score; "Analyse" opens the finished game on the analysis board.
- **Clocks:** from the first move, the increment after each move, stopped at the end or by Pause; a reopened game with a clock starts paused ("Continue" starts the side to move). A flag ends the game through `flagResult`.
- **Where a game lives:** with a session, the account (`ch_local_game`, `functions/chaal/local-games.ts`), written 700 ms after the moves settle and at once at the end or when the page is hidden; without one, this browser (`local/browser.ts`, `chaal:game:<id>`). A failed account write keeps it in the browser. `useStartLocalGame()` makes the id, writes the first record and opens the page.
- **Moving to a session:** `useImportLocalGames()` in the frame sends the browser's games to a new session and forgets the ones it took; the guest claim moves a guest's games. 100 games per player (`LOCAL_GAMES_MAX`), the least recently played go.
- **The server** (`server/chaal/local/service.ts`) checks the Zod shape (`localGameRecordSchema`) and then the PGN move by move (`fromRecord`), and writes only the caller's own unfinished row: another player's id is NOT_FOUND, a finished game stays as it ended. The `local` switch turns saving and importing off (FORBIDDEN) and the hub says so.
- **The page:** with a session the loader reads the game and it renders on the server; without one a board-sized place (`BoardPlace`) holds until the browser's copy is read, and a missing game is said in that place, so nothing moves.
- **Stories:** "Chaal/Play" (the hub, against the computer, face to face with clocks, finished).

## Online play (Task 77, decision 0266)

The play hub's first part is "On Lichess": play the Lichess AI, challenge a player by name, or make a link for a friend, beside what's live now (the games in progress, the challenges to answer, those waiting). A game on Lichess is `/app/chaal/game/$id` (noindex). Everything goes through the player's own token on the server (`withToken(…, "play", …)`): a page never holds it.

- **What may be asked for** (`play/controls.ts`): Board-legal paces only. The Board API plays rapid, classical and correspondence; direct challenges, the AI and open links may also be blitz; bullet never (`boardLegal`). Clocks use Lichess's starts (0, ¼, ½, ¾, 1, 1½ minutes, then whole minutes to three hours) and 0–60 s increments; correspondence is 1, 2, 3, 5, 7, 10 or 14 days. The setup offers eight clocks (3+2 to 30+20) and 1, 3, 7 or 14 days; a pace travels as a key (`600+5`, `d3`: `paceKey`, `paceOfKey`).
- **The admin's limits:** `ch_settings.play` (`{ aiMaxLevel, rated }`, read through `readPlayLimits`, sent with the status; its form is Task 79's), the `play` switch (every function and stream route refuses; the hub and the game page say so calmly), and the `chat` switch (no scope: the chat is hidden, writing is refused, the stream drops its lines).
- **The inputs** (`play/schema.ts`): a Lichess name (2–30 letters, digits, `-`, `_`), an 8-character game or challenge id, the pace, a colour, rated; Lichess's seven decline reasons a person would give; the Board API's actions (`GAME_ACTIONS`). Server functions are `src/functions/chaal/challenges.ts` and `live-game.ts`; the hub and the page call them through `playCalls` (stories and tests pass their own).

**Challenges:**
- **To a player with a clock:** Lichess drops a real-time challenge nobody answers in 20 s unless the request stays open (`keepAliveStream`), so the page holds it through `POST /api/chaal/stream/challenge` (`useChallengeStream`): it says sending, waiting, accepted (the game opens), declined (with the reason from the event stream), cancelled, or expired (nobody answered in the stream's 270 s; the server cancels it at Lichess, as it does when the page goes).
- **Correspondence:** a function call (`challengeChaalPlayer`); it waits in "Your challenges".
- **An open link:** created with the player's token, then accepted at once with `?color=` as the player's side; the link shown is the other side's, and the game opens when the friend joins (its `gameStart` on the event stream).
- **The Lichess AI:** `challengeChaalAi` (levels up to the admin's limit; always casual) returns the game's id and the page opens it.
- **Answering:** Accept opens the game (its id is the challenge's); Decline asks why (Lichess translates the reason for the challenger); Cancel takes back one of the player's own.

**A game** (`game/`):
- **First paint:** the loader reads the game's Board API stream up to its first line (`gameFull`) with the player's token and closes it (`getChaalLiveGame`): Lichess delays ongoing games' exports, so they can't give the position. The player's side comes from the connection's Lichess id; a game they aren't in is NOT_FOUND and the page links to lichess.org. A visitor or a player not connected for play sees "Connect" where the board would be.
- **The model** (`live-game.ts`, pure): Lichess's lines applied in order; the moves replayed from its UCI list (Chess960-style castling, the king onto its rook, is read as standard); the player's move pending until a `gameState` has it (it survives an offer arriving meanwhile) and rolled back when Lichess refuses it (BAD_REQUEST, a toast); clocks from `wtime`/`btime` at receipt, running from the second move (Lichess's rule), a pending move pressing the clock at once; offers by side; abort until both sides have moved; how it ended from Lichess's status (`endingOf`: three reasons joined `GameEndReason`, `left`, `cheat`, `no-start`).
- **The hook** (`use-live-game.ts`): reads the stream with `keepStreaming` (every open restates the game), stops when the game is over, plays one premove when the turn comes if it's legal then (a pawn reaching the last rank becomes a queen), and gives the link's state for the dot and the banner after 3 s without it.
- **The page** (`live-game-page.tsx`): the board between the strips (names link to lichess.org, `nofollow ugc`), takeback, draw (not against the AI) and abort or resign; the opponent's offers to accept or decline; "left the game" with its countdown, then Claim the win or a draw; the first move's countdown; the game over (the result, the rating change for a rated game, Analyse with the moves, Play again: the same AI game at once, or the hub's challenge form filled in through its URL, `chaalLinks.play({ with: "friend", opponent, pace, color, rated })`); the chat (`live-chat.tsx`: what was said before, then the stream's lines, as text).

**Activity** (`ch_activity`, `server/chaal/activity.ts`): one row per thing a player did, for the admin's overview (Task 84): `connect`, `game` (by mode: `ai`, `challenge`, `seek`, `lichess`, `local-engine`, `local-board`), `analysis`, and `puzzle` (Task 80: once per player and puzzle). A game or an analysis carries its id in `ref`, written once per player (a unique index; `onConflictDoNothing`): the AI and an accepted challenge by their functions, a challenge accepted on its stream, any game the event stream sees start fresh (`hasMoved` false), a local game when its first record is saved, an analysis when it's first saved. A failed write is logged and dropped. `/api/cron/chaal` (02:45 UTC, `CRON_SECRET`) deletes rows older than 90 days.

**Fair play:** the event store's real-time games (correspondence doesn't count) feed `setLiveGames` in every tab, so the engine, cloud eval, the explorer and the tablebase stop everywhere while one is played. There's no check on the server: the same data is public at Lichess, so refusing it on our proxy would protect nothing.

**Stories:** "Chaal/Online" (the hub's online part connected, a link, not connected, off; a game: your move, the opponent's offer and leaving, against the AI, over; quick pairing, my games and the bell, berserk).

## Quick pairing, correspondence and notifications (Task 78, decision 0267)

- **Quick pairing** (`play/quick-pair.tsx`, first in the hub's online part): tiles for the paces the Board API may seek on (`QUICK_PAIRS`: Rapid 10+0, 10+5, 15+10; Classical 30+0, 30+20; 1, 3, 7 and 14 days) and Custom (whole minutes 0–180 and an increment of 0–180 s, rapid or slower: `seekLegal`), rated or casual (only when the admin allows rated play), and the opponent's rating (any, ±100, ±200, ±400 around the player's rating at that speed, read from `/api/account` when the seek is made: `seekForm`, `ratingRangeOf`). The input is `seekInput`.
- **A seek on a clock** (`useSeek`) goes through `POST /api/chaal/stream/seek` (same-origin, like the challenge stream): Lichess keeps it while the request is open and sends only keepalives; when someone accepts, Lichess closes it and the relay says `ended`. The game arrives on the event stream: the hook opens the first new game that hasn't moved (and gives up 10 s after `ended`: the seek expired). Our window says `reconnect` and the hook seeks again at once; Cancel or leaving the page closes the stream, which cancels the seek. The tiles wait until the event stream is open (Lichess: open it first).
- **A correspondence seek** is `seekChaalCorrespondence` (Lichess answers with its id at once). It waits in Lichess's lobby; Lichess has no call to take one back, so the hub says where it waits, and the game arrives later on the event stream with a toast.
- **The games in progress** (`getChaalPlaying`, `GET /api/account/playing`, `playingAnswer` maps each like an event's game): the event stream says when a game starts or ends, never when a move is made, so the tab leader reads the list once the stream settles, 1.5 s after a game starts or ends, and every minute (`PLAYING_EVERY_MS`) while a correspondence game is going on, and shares it (`{ kind: "playing" }`). `applyPlaying` updates the store's games and `readAt`, the time each was read: `secondsLeftOf` counts the player's time down from there.
- **My games** (`MyGames` in the hub's "On Lichess" column): `orderGames` puts the player's move first, then the least time left; each row has a `MiniBoard`, the opponent, the pace, whose move and the time left (`timeLeftText`).
- **Notices** (`live/notices.ts`, `shell/live-notices.tsx`): `NoticeBell` in the top bar (drawn on the server for a player connected for play, so nothing moves) lists the challenges to answer and the games on the player's move; `PlayBadge` counts those games on Play in the top bar and the tab bar; `useLiveNotices` (in the frame) toasts with the notify sound what `newNotices` finds new between two states of the store: a challenge to the player, the player's move in a correspondence game, a correspondence game that started. Nothing is new while the stream restates (`settled` false) nor in the first state after it, so a reload repeats nothing; a hidden tab stays quiet. Nothing is stored: there's nothing to mark as read.
- **Berserk** (`canBerserk`; the `berserk` action, `POST /api/board/game/{id}/berserk`): an arena game (`tournamentId`) with a clock, before the player's own first move. The button goes once it's done.
- **Zen** (`shell/zen.ts`): the `zen` preference applies on a game's page (`PLAY_PAGE`, read from the router's path, so a session's zen is on the first paint). `z` (`useZenKey`, in the frame) and "Leave zen" (`ZenExit`) switch it and save the preference. The frame drops the top bar, the notices, the footer and the tab bar; the pages drop their controls, move lists and side column, keeping the board, the strips (names and clocks), and anything that asks for an answer (offers, the opponent leaving). A finished game gives the page back.
- **The play pages' layout** (`shell/play-layout.tsx`, shared by the game and local game pages): `PLACE`, `PLAY_COLUMN`, `STRIP`, `playGrid(zen)`. A phone held upright keeps the strips above and below the board with the controls under it. **On its side** (the `land:` variant in `chaal.css`: landscape and at most 32rem tall) the board's column becomes two: the board sized by the height left under the top bar (`LAND_BOARD`), and beside it the strips and the controls (`LAND_SIDE`); the tab bar hides, the top bar shows the sections, and the admin's notice and the fair-play banner wait for the other pages.

## Puzzles (Task 80, decision 0269)

`/app/chaal/puzzles` (indexable): the daily puzzle without a mode, `?mode=train` (with `theme`, `difficulty` and `color`), `?mode=streak` and `?mode=replay&theme=`. `/app/chaal/puzzles/$id` (noindex) is one puzzle by its Lichess id. Board first, the panel beside it (under it on a phone): the heading, what's happening (a polite live region), Hint and Solution, then Next; under them the modes, training's choices and the progress panel.

- **A puzzle** (`ChaalPuzzle`, `puzzles/schema.ts`): `before` (the position before the opponent's last move), `lastMove`, `fen` (the player's), `color`, the `solution` in UCI from `fen`, rating, plays, themes and the game. The server makes it from Lichess's answer by replaying the game's PGN (`puzzleAnswer`); a batch's puzzle that doesn't replay is dropped.
- **The trainer** (`puzzles/trainer.ts`, pure): `startTrainer`, `showOpponentMove`, `tryMove` (right, solved, or wrong; any mate solves), `reply`, `retry`, `giveHint`, `startReveal` and `revealNext`; `isDone`, `isWon`. A miss, a hint or the solution sets `helped` and the attempt is a loss. `usePuzzleTrainer({ puzzle, streak, volume, onResult })` (`use-trainer.ts`) times the steps (`TRAINER_DELAYS`) and calls `onResult` once: at the first help, or at a clean solve. Render `PuzzleSolver` with `key={puzzle.id}`. In the streak a wrong move ends the puzzle and the solution shows.
- **Themes:** the keys are `angles.ts` (`PUZZLE_THEME_GROUPS`, `PUZZLE_ANGLES`: `mix` and 72 themes), the names our own messages in `themes.ts` (`THEME_NAMES`, `themeName`), kept apart so the browser's store, the schemas and the server never load the names. A theme Lichess adds later is neither offered nor shown until it has a name.
- **Batches** (`getChaalPuzzleBatch`, `usePuzzleQueue`): the loader reads the first (round 0); the queue asks for the next when fewer than `REFILL_AT` (5) are left ahead, skipping ids it has. `upcoming` reads another choice ahead (the streak's next difficulty). A visitor's batches are anyone's, cached by `round` (10 minutes for round 0, a minute after); a player connected with the puzzle scopes gets their own with their token (unseen, at their rating, `glicko`), never cached, and their waiting results are posted in the same call. A side asks Lichess for twice as many (it picks colours itself) and keeps that side's. `ch_settings.puzzles.ahead` is the batch's size (15).
- **The streak** (our own): anyone's `mix` puzzles, harder every `STREAK_TIER` (5) solved (`streakDifficulty`), no hints, one miss ends it. The best is the highest `streak` in the player's attempts. Off when the admin turns `ch_settings.puzzles.streak` off.
- **Attempts** (`PuzzleAttempt`, `ch_puzzle_attempt`): `useRecordAttempt()` writes to the account with a session, else to this browser (`puzzles/browser.ts`, `chaal:puzzles`, 200 at most); `useImportPuzzleAttempts()` in the frame moves them to a new session; the guest claim moves a guest's. The server (`server/chaal/puzzles/service.ts`) keeps 1,000 per player, counts each puzzle once in `ch_activity`, and marks a connected player's (not the streak's) `pending` until `postPending` sends them to Lichess (with the next batch, at `PUZZLE_SYNC_AT` (5) waiting, or before the dashboard is read), each with its rating change.
- **Progress** (`PuzzleProgress`): `progressOf(attempts, now)` (`progress.ts`, the same for the account's rows and the browser's) gives the last 30 days, the best streak, themes to work on (`weakestThemes`) and the latest attempts; `getChaalPuzzleProgress` adds Lichess's dashboard for a connected player (`lichess.state`: `ok`, `connect`, `reconnect`, `wait`, `unavailable`) with "Replay misses" per theme (`getChaalPuzzleReplay`). The panel keeps its height, so a visitor's figures, read after hydration, move nothing.
- **The switch:** `puzzles` off refuses every function; the page says so in the board's place.
- **Stories:** "Chaal/Puzzles" (the daily puzzle played, the progress panel connected, loading, nothing left).

## Players and games (Task 81, decision 0271)

`/app/chaal/players` (indexable) is Lichess's leaderboards, a tab per rating (`?perf=`: bullet, blitz, rapid, classical, UltraBullet), with whom a connected viewer follows beside them. `/app/chaal/players/$username` (noindex) is a player: the overview, or `?tab=games`. `/app/chaal/game/$id` (noindex) is the player's own game while it's played (Task 77), else its replay.

- **The service** (`server/chaal/players/service.ts`): public reads on the public lane through the cache (leaderboards an hour; a profile, its status, a page of games and the crosstable a minute; a rating's history and details and the activity ten minutes), each checking the `players` switch. What needs the viewer's token goes through `withToken(…, "social", …)` on their lane and is never cached: `following` on a profile (the profile is then read with their token; a refused token falls back to the public read), `following()` (`/api/rel/following`) and `setFollowing()`. The answers are lean (`players/schema.ts`; Lichess's are mapped in `lichess/schemas.ts`): standard ratings only, a closed account's name only, a player's own text clipped, links web addresses only.
- **A finite ndjson answer** (an export, the follows) is `lichess.lines(request, schema)`: read whole inside its lane, a line that doesn't map dropped and logged. Streams stay `stream()`.
- **The player's page** (`players/player-page.tsx`): the loader awaits the profile (a name Lichess doesn't know throws `notFound()`: Chaal's 404) and `prefetch`es the rest, which streams in: the rating's history (`historyRows` thins it to 120 points for the kit's `LineChart`), its details, the latest games (the games tab's first page: the game in progress first, as a `MiniBoard` from `lastFen`) and the activity. Each streamed part is a `Streamed` place (Suspense with a sized skeleton inside a `CatchBoundary`, so a failure says one line and the page stays). The overview opens on the rating with the most games (`mainPerf`); a rating card sets `?perf=` with `replace`. Follow (`FollowButton`, `followCalls`) shows when the viewer's `following` is known and updates the profile query at once (put back on a refusal); Challenge opens the play hub's challenge filled in.
- **The games tab** (`players/player-games.tsx`): the kit's FilterBar over `perf`, `color`, `mode` (rated or casual), `result`, `vs` and `since`/`until`, with a hidden empty `before` so a filter change starts from the newest. `gamesInputOf` turns the URL into the input (only what's set, so equal filters share a key), `gamesParams` into Lichess's parameters. A result filter reads three pages' worth (`RESULT_SCAN`) and the next page starts after the last game shown. Rows are `GameRow` (the last position, the sides, the score, the kind of game, the opening, the day).
- **The game page** (`game/game-page.tsx`, its loader `game/load.ts`): a session's loader reads the live game first, and one still going on is `LiveGameBoard`; anything else is `replayQueryOptions` (`getChaalReplay`: `null` when Lichess has no such game). The replay (`game/replay.ts`, pure; `game/replay-page.tsx`): `replayLine` builds the tree with each move's clock, eval and judgement (`JUDGEMENT_NAGS`: ?!, ?, ??), `clocksAt` gives both clocks after any move, `replayEnding` the result (through `endingOf`), `replayScores` the eval graph's. It opens at the end; ←/→, Home, End and `f` work as on every board. The export is `exportedGame` (`server/chaal/analysis/lichess.ts`), shared with importing into analysis.
- **The palette** (`shell/palette-players.tsx`, loaded with the first search): three letters or more, after a pause, through `searchChaalPlayers`; a typed name opens directly.
- **The switches:** `players` off refuses every players function and the pages say so; `social` off hides Follow and the following list (and refuses their functions).
- **Stories:** "Chaal/Players" (a leaderboard, game rows, a replay with and without Lichess's analysis).

## Watch (Task 82, decision 0272)

`/app/chaal/watch` (indexable) is Lichess's TV: a diagram per channel, the broadcasts live now and the streamers beside it. `/app/chaal/watch/$channel` (noindex) is one channel on the big board. `/app/chaal/broadcasts` (indexable) is Lichess's broadcasts; `/app/chaal/broadcasts/$id` (noindex) a tournament, a round's boards or one board followed. `/app/chaal/game/$id` follows anyone else's game while it's played. Watch is the frame's fourth section, current on the broadcasts' pages too (`also` in `SECTIONS`).

- **The rule:** the server reads what the first paint shows, on the public lane through the cache (`server/chaal/watch/service.ts`, each read checking the `watch` switch); what's live after that **the browser reads from Lichess** (`status.live`, LICHESS_API_BASE; Chaal's pages allow its origin in `connect-src`). Nothing live goes through our server, and no token is involved.
- **Keeping a public stream open:** `usePublicStream(url, onLine, options)` (`watch/use-live.ts`) runs `keepStreaming` while `url` is set (null closes it) and gives the link's state for `LiveDot`. Lichess's public streams send no keepalives, so the silence allowed is minutes (`PUBLIC_SILENCE_MS`); a drop restates on reopening. `usePageVisible()` closes streams in a hidden tab; `useOnScreen(ref)` opens a TV card's feed only while it can be seen. In stories `status.live` is empty: nothing is read.
- **The TV** (`tv()`): `/api/tv/channels` (5 s), then one `POST /api/games/export/_ids` with `moves=false&lastFen=true` for the channels' games (5 s, keyed by the ids): players, pace and last position. The admin's channels (`ch_settings.watch.channels`, `readWatchLimits`) choose which, in `TV_CHANNELS`' order. A failed export leaves the games out. Each card (`TvCard`) and the channel page apply the feed's lines with `applyTvLine` (`watch/live.ts`, pure, no chess.js): `featured` starts a game (players, clocks in seconds, the position), `fen` moves it. The channel page works out each move's SAN from the position before it (for the board's words and sound).
- **Following a game** (`watch/spectate.ts`, `SpectateBoard`): the game page shows a game the replay's export says is still being played, standard and not the viewer's own live game, when watch is on. `spectatedFrom(replay)` is the first paint; `applySpectateLine` takes the stream's lines: the description (at the end it carries the status: `over`), a position without a move (the start: the restatement begins, `cursor` 0), and each move, passed over while it repeats one shown, appended after. The board follows the latest move unless the viewer stepped back ("Back to the latest move"). `onOver` makes the page ask for the replay every 4 s until the export has the ending.
- **Broadcasts:** `broadcasts(page)` (top), `officialBroadcasts()` (ndjson, 20), `searchBroadcasts(q, page)` (lowercased), five minutes each; `broadcastTour(id)` (NOT_FOUND is the page's 404; a minute while a round is played), `broadcastRound(id)` (20 s until it's finished), `broadcastGame(round, board)` (the chapter's PGN via the client's `pgn()`, 500 kB at most; 20 s while its result is `*`). The answers are lean (`watch/schema.ts`): names, info and links as text, links web addresses only, clocks in ms, results `*`, `1-0`, `0-1`, `½-½`. `roundShown(tour, search)` picks the round: the URL's if the tournament has it, else Lichess's.
- **A round live** (`useRoundLive` in `broadcast-page.tsx`, `watch/round-live.ts`): while the round isn't finished, one PGN stream (`split: pgnGames`, `parse: asText`, `accept: application/x-chess-pgn`) brings every board's PGN, then a board's again each time it moves. `boardOf(pgn)` names its board from `GameURL` (or `Site`); `readBoard` reads it (`readPgn`); `updatedBoard` and `boardFromPgn` keep the grid's diagrams, results and clocks; the followed board (`FocusedBoard`) uses the latest PGN, else the server's. `clocksAfter(line, n)` gives each side's clock after `n` moves. When Lichess closes the stream the round is read again.
- **Streamers** (`streamers()`, a minute): off when the admin turns `ch_settings.watch.streamers` off (then Lichess isn't asked). Each links out in a new tab, `rel="nofollow ugc noopener"`.
- **The switch:** `watch` off refuses every watch function, the pages say so (`WatchOff`), and a game being played that isn't the viewer's is said as before ("still being played").
- **Stories:** "Chaal/Watch" (the TV's channels, the streamers, the broadcasts' lists, a round's boards, a board followed, a game being played).

## Settings, switches and blocks

`ch_settings` is one row (missing means the defaults), read at most every 5 s per process (`controls.ts`):

- `features`: `{ play: false }` turns a feature off; a feature not listed is on. The list and each feature's scopes are in `src/features/chaal/features.ts`. `local` (Task 76) is the games against the computer and over the board, apart from online `play`; `chat` (Task 77) is the players' chat in an online game. Each feature's server check arrives with the feature; `withToken(…, feature, …)` checks the switch for anything that uses a token.
- `guests_may_connect`, `extra_scopes`, `cache_epoch`, and the public lane's cooldown.
- `engine`: the engine's limits in the browser (`{ maxDepth, multiPv, hashMb }`, Task 75).
- `play`: online play's limits (`{ aiMaxLevel, rated, quickPair }`, Tasks 77 and 79). `quickPair` is `all`, `clock`, `days` or `off`: the hub shows only those tiles (none and no section for `off`), and `seekForm` refuses a pace it doesn't allow.
- `defaults`: the board, pieces and sound a player starts with until they choose (`{ board, pieces, sounds }`, Task 79).
- `puzzles`: training's batch size and the streak (`{ ahead, streak }`, Task 80, read through `readPuzzleLimits`).
- `watch`: the TV channels shown and whether the streamers live are listed (`{ channels, streamers }`, Task 82, read through `readWatchLimits`). The status carries them; `useChaalPreferences` starts from `startingPreferences(status.defaults)`.
- `banner`: the admin's notice under the top bar, `{ en, ne }` (Nepali falls back to English), shown when its English isn't empty.
- `maintenance` and `maintenance_message` (Task 79, decision 0268): on, `withToken` refuses everything (`requireNoMaintenance`, before the feature's switch), `connectRefusal` says `off`, and the status reports `connect: "off"`, `play` and `chat` off, and `maintenance: { message }`; the frame shows the message (or `m.ch_maintenance_default`) above the banner. Public reads and what runs in the browser go on.

All of these are set on `/admin/chaal/settings` (below). `ch_block` holds a site user or a Lichess account (its lowercase id). A blocked user's personal calls are refused (`chaalUserOf`), and neither can connect; they're listed on `/admin/chaal/blocks`.

## The admin (Task 79, decision 0268)

Under `/admin/chaal` (`chaal:read` for every page; it redirects to the settings until the overview, Task 84). Services in `src/server/chaal/admin/` take `chaalAdmin(services)` (the controls to invalidate, the connection service's dependencies, whether `CHAAL_TOKEN_KEY` is set); functions in `src/functions/chaal-admin/`; pages in `src/features/chaal/admin/`. Every write is audited (`chaal.*` actions; targets `chaal-settings`, `chaal-connection`, `chaal-block`) and clears this server's controls (others within 5 s).

- **Settings** (`chaal:configure` to change): one form saved from the row's `version` (a stale save is the form's "reload"): the feature switches (each with what it does and the scopes it adds; only the ones off are stored, so a feature added later starts on), guests may connect, extra scopes, quick pairing, the AI's highest level, rated play, puzzles (the batch's size, the streak), watch (the TV channels, the streamers), players' defaults, the engine's limits, the banner and the maintenance message. Maintenance and the purge (the cache epoch) are their own writes, so they never make an open form stale; turning maintenance on asks first.
- **Connections** (the CRUD standard; `chaal:moderate` to act): the site user (a guest has no email shown), the Lichess account (linked to lichess.org), the state (active, revoked, expired; blocked and "waiting" badges), scopes and dates; filters by state and members or guests, a search over the username, name and email, CSV. **Revoke** (one or many) asks Lichess to end each token (best effort, outside the transaction) and sets `revoked_at`: the player sees Reconnect. **Block this account** opens the block dialog filled in.
- **Blocks** (a tab beside connections; "Block" opens a dialog there and on the connections list, and a connection's "Block this account" opens it filled in): a Lichess username or a site user's email, with a reason. Blocking revokes the connection it names (its own audit entry); a second block or an email no account has is a field error on the target. Deleting a block lets them connect again.
- **Health:** the calls, errors and 429s by hour (24 hours or 7 days) and by endpoint class from `ch_api_stat`, the cooldowns running now (the public lane's and each connection's), the last 50 of `ch_api_error`'s 500 failed calls, and "Test Lichess" (`chaal:configure`): the daily puzzle through the public lane, past the cache, timed, or "Lichess asked us to wait" during a cooldown.

**The call stats** (`src/server/chaal/stats.ts`): the counters keep, besides the lab's running totals, a pending batch by hour and endpoint plus the failed calls. After each call the store's flush writes it (an upsert adding to the hour's row; failures inserted, then all but the newest 500 deleted) under `waitUntil`; one flush runs at a time per instance and the calls made meanwhile go in the next. A failed write is logged and dropped. The daily job prunes hours older than 30 days.

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

**The cache** (`cache.ts`, on the shared LRU): a TTL per read, stale-while-revalidate, one call for concurrent readers, and keys with the endpoint, path, parameters, `cache_epoch` and, for a personal read, `owner` (the user's id: one user's answers never reach another). During a cooldown or an outage, a read serves what the cache still holds, however old, before failing. Each TTL arrives with its feature (PLAN 13.5, "Cache TTLs"); the daily puzzle's is `untilUtcMidnight`. A TTL may depend on the answer (`(answer) => ms`): a position the cloud hasn't evaluated is kept an hour, a found one a day.

**Logging and counters:** every call logs `lichess call` with the endpoint, status, milliseconds and lane kind, never a token. `chaalLichess.counters.snapshot()` holds this instance's calls, errors, 429s and time per endpoint; the lab shows them, and the store flushes them to `ch_api_stat` and `ch_api_error` after each call for the health page (Task 79).

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

**Through our server** (tokens), one relay (`src/server/chaal/stream.ts`) for four routes: `GET /api/chaal/stream/events` (the user's Lichess event stream), `GET /api/chaal/stream/game/{id}` (a Board API game, Task 77) `POST /api/chaal/stream/challenge` (a real-time challenge kept open, Task 77) and `POST /api/chaal/stream/seek` (a seek on a clock, open while it waits, Task 78: `ended` when Lichess closes it, `reconnect` after a window or a break). Each passes Lichess's lines on as Chaal's (`src/features/chaal/live/events.ts`): unknown types are dropped, keepalives (empty lines) pass through, and the first line is a keepalive so the client knows it's open. After `STREAM_WINDOW_MS` (270 s: Vercel's limit is 300 s on Hobby) the event and game streams send `{"type":"reconnect","afterMs":0}` and close; when Lichess ends one, `afterMs` is 1000, and 2000 after a break. The client opens it again: Lichess restates every current challenge and game (and a game's whole state), so nothing is lost. The challenge stream says `{"type":"expired"}` instead and cancels the challenge at Lichess. Refusals are JSON: `{ error, reason? }` with 400, 401, 403 (blocked, play off, or `lichess-reconnect`), 404, 429 or 503. The challenge and seek routes take a POST of JSON from our own pages only (`sameOrigin`: Nitro routes don't run the server functions' CSRF check).

**In the browser** (`live/reader.ts`): `readStream` reads one response (with `ndjsonLines`, which the server uses too); `keepStreaming` keeps a stream open: at once after a window, backing off from 1 s to 30 s when a stream keeps ending soon after it opened, a minute after a 429, never again after a refusal it can't fix, and 20 s without even a keepalive counts as a drop.

**The tab leader** (`live/events-client.ts`, Task 77): Lichess allows **one event stream per token**, and opening another closes the first. So one tab holds it, the one holding the Web Lock `chaal-events`, and shares each event over the `chaal-events` BroadcastChannel; a tab that opens later says hello and gets the state so far; when the leader closes, a waiting tab gets the lock and opens the stream. Every tab applies the events to its own store (`live/store.ts`, `useLive()`): the challenges, the games in progress, the games that ended (for the rating change) and the declined challenges' reasons. On each open what's held is marked stale, and what isn't restated by Lichess's first keepalive (or 8 s) has gone. The frame loads the leader (`useLiveEvents`, an `await import()`) only for a session connected for play while play is on. Two devices take turns with the one stream; the backoff keeps them from knocking each other off every second.

**Public live data** (TV, spectating, broadcasts) answers `access-control-allow-origin: *`, so the browser reads it from lichess.org directly (decision 0257, Task 82: see "Watch"). Chaal's pages allow LICHESS_API_BASE's origin in `connect-src` (`src/middleware/security-headers.ts`), and the status tells the browser that base (`live`). These streams send no keepalives: `readStream`'s `silenceMs` is minutes for them, and its `split`/`parse` options read a PGN stream a game at a time.

## The lab (`/admin/chaal/lab`)

`chaal:configure`. Four sections:
- **Your Lichess account:** connect, see the account, scopes and state, reconnect, disconnect. The result of a connect shows as a banner.
- **Event stream:** opens `/api/chaal/stream/events` and times it: time to the first byte, keepalives, the events, and how long until the server asks for a reconnect. Use it on a deployment to check streaming there (spike 1).
- **Setup on this server:** whether the key and the app token are set (never their values), the key id new tokens use, the client id, the API, the redirect URI to give Lichess if asked, the scopes connecting asks for, the stream window and the public cooldown.
- **Lichess calls on this server:** the counters, and "Check the public lane" (the daily puzzle through the client and the cache).

## Fixtures and the fake Lichess

- **`pnpm lichess:record`** (`scripts/record-lichess-fixtures.ts`) writes `tests/fixtures/lichess/` from the real API, one request a second: the daily puzzle, the TV channels, cloud evals of the start and of 1. e4, a tablebase position, the first lines of the TV feed, the daily puzzle's game as importing reads it, a batch of puzzles (the fake's pool; `pnpm lichess:record puzzles` records only that), and a player (Task 81: `nihalsarin2004`, whose rating history is public: the leaderboards, the profile and status, the history, the main rating's details, the activity, the first page of games and a search; `pnpm lichess:record players` records only those), and watch (Task 82: the TV's channels and one export of their games, the streamers live, the broadcasts' top, official and a search for `spice`, the tournament `9NE16qcS` with its default and first rounds and each one's first board as PGN, a `.pgn` file; `pnpm lichess:record watch` records only those). With `LICHESS_APP_TOKEN` in `.env` it records the explorer too: masters and Lichess at the start and after 1. e4, and a player's games (the stream's last line, `.ndjson`). The parameters are the ones Chaal sends: a change in `server/chaal/analysis/lichess.ts` is a change there. Files are named by `lichessFixtureName(host, path, params)` (a hash of the parameters), one line each, and Biome skips them.
- **`events.ndjson`** is written by hand from the API's examples (recording needs a connected account and live games). It includes one unknown event type, which must be dropped. The unit tests read it; the fake Lichess restates its own state instead.
- **`e2e/harness/lichess.ts`** stands in for Lichess in e2e: the approval page (pick `E2E_Player` or `E2E_Rival`, Approve or Deny), a token exchange that checks the PKCE verifier, revocation, `/api/account`, the event stream (the recorded opening lines, then a keepalive a second), and recorded reads; the explorer refuses calls without a token, as the real one (e2e's server has `LICHESS_APP_TOKEN=lip_e2e_app`); a `.ndjson` recording is sent as a stream that ends. Online play (`e2e/harness/lichess-play.ts`, Task 77): the event stream restates the account's challenges and games; challenges to a player (kept open with `keepAliveStream`), open links and the AI; Board API games with clocks (from the second move), moves checked by chess.js, a scripted AI (as Black it walks into a four-move mate: e5, Nc6, Nf6), offers, takebacks, endings, chat and "opponent gone"; seeks (a clock's held open and cancelled when it closes, a correspondence one answered with its id), `/api/account/playing` and berserk (Task 78), and the account's ratings for a seek's range. Test controls: `POST /e2e/lichess/revoke`, `POST /e2e/lichess/event`, `POST /e2e/lichess/drop` (an account's streams break), `GET /e2e/lichess/streams?account=` (its open streams), the rival's `POST /e2e/lichess/challenge`, `/respond` and `/act` (a move, an offer or an answer, a resignation, a chat line, leaving), `GET /e2e/lichess/challenges` and `/games`, quick pairing's `POST /e2e/lichess/seek-accept` (`{ account, color }`: the rival accepts the account's oldest seek) and `GET /e2e/lichess/seeks`, `POST /e2e/lichess/arena` (an arena game for berserk), puzzles (`e2e/harness/lichess-puzzles.ts`, Task 80: by id, batches from the recorded pool, unseen ones for a token, posted solutions with their rating changes, the dashboard and replays; `GET /e2e/lichess/puzzle-solutions?account=` lists what an account posted), players (`e2e/harness/lichess-players.ts`, Task 81: following and unfollowing, the following list, a profile read with a token says `following`, a crosstable with no games; `GET /e2e/lichess/following?account=`), watch (`e2e/harness/lichess-watch.ts`, Task 82: the TV's feeds, each opening with its channel's game; `e2eWatch`, a game the fake plays itself, is the rapid channel's, with its export and its spectators' stream; the recorded tournament's first round is played live, with its PGN stream; `POST /e2e/lichess/watch-move` `{ uci }`, `/watch-end` `{ status, winner }`, `/round-push` `{ round, pgn }`, `/watch-reset`, and `GET /e2e/lichess/watch-streams`, what the browser holds open), `DELETE /e2e/lichess`, and `DELETE /e2e/chaal-connections` in the harness. **CI never calls Lichess.** A task that reads a new endpoint records it and, if e2e needs it, teaches the fake.

## Spikes (Task 71, decision 0257)

1. **Streams through Nitro:** unbuffered in the production build (the e2e flow sees a pushed event at once). On Vercel, 300 s per function on Hobby (800 s possible on Pro); the route closes at 270 s. Time it on the deployment with the lab.
2. **The engine:** `stockfish` 19.0.1, GPL-3.0. Use `stockfish-19-lite-single.js` (28 KB) and `.wasm` (1.85 MB); the package unpacks to 205 MB, so `engine:copy` copies only those two and `Copying.txt`. A dedicated worker follows its own response's CSP: serve the engine files with `script-src 'self' 'wasm-unsafe-eval'` and the page needs only `worker-src 'self'`, never `'wasm-unsafe-eval'`. Depth 18 took about 1 s on a desktop. A real mid-range phone's speed is still to measure (left for the owner in Task 75: CDP throttling doesn't slow workers); `ch_settings.engine.maxDepth` lowers the depth if it's slow.
3. **The explorer needs a token** (any, no scope): `LICHESS_APP_TOKEN` for visitors, the user's own when connected.
4. **Board API seeks, chat and endings:** not run (they need a live account). Task 77 built them against the spec and the fake Lichess; trying them on a real account is left for the owner (decision 0266).
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

Chess words are Chaal's own messages, in both languages, and must read the same everywhere. The board's words (Task 74) still need a Nepali speaker's check (left for the owner).

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
| settings | सेटिङ | Task 73 |
| board, board theme | बोर्ड, बोर्डको थिम | The themes: डायग्राम, छाप, ढुङ्गा |
| coordinates | निर्देशाङ्क | |
| files, ranks | फाइल, र्‍याङ्क | |
| premove | अग्रिम चाल | |
| promote (to a queen) | (रानीमा) बढुवा | |
| permissions (a connection's scopes, on the settings page) | अनुमतिहरू | The lab keeps स्कोप |
| guest | अतिथि | |
| king, queen, rook, bishop, knight, pawn | राजा, रानी, हात्ती, ऊँट, घोडा, प्यादा | Task 74 |
| piece (on the board) | गोटी | |
| square | कोठा | |
| White, Black | सेतो, कालो | |
| to (a square): "Knight to f3" | "{piece} {square} मा": घोडा f3 मा | Spoken moves |
| takes: "Bishop takes e5" | "{piece}ले {square} काट्छ": ऊँटले e5 काट्छ | |
| castles kingside, queenside | राजातर्फ क्यासलिङ, रानीतर्फ क्यासलिङ | |
| check, checkmate, stalemate | चेक, चेकमेट, स्टेलमेट | Loanwords, as players say them |
| draw | बराबरी | |
| move, moves | चाल, चालहरू | |
| legal (move) | नियमअनुसारको (चाल) | |
| clock | घडी | |
| evaluation | मूल्याङ्कन | |
| flip the board | बोर्ड पल्टाउनु | |
| analysis, analysis board | विश्लेषण, विश्लेषण बोर्ड | Task 75 |
| engine, depth | इन्जिन, गहिराइ | |
| line (an engine's) | लाइन | |
| opening, opening explorer | ओपनिङ, ओपनिङ एक्सप्लोरर | Opening names stay in English |
| tablebase | टेबलबेस | |
| variation, main line | भेरिएसन, मुख्य लाइन | |
| comment | टिप्पणी | |
| win, loss | जित, हार | |
| fair play | निष्पक्ष खेल | |
| import, export | आयात, निर्यात | |
| play, game | खेल्नुहोस्, खेल | Task 76 |
| against the computer, over the board | कम्प्युटरसँग, बोर्डमै | |
| level | तह | |
| take back (a move) | चाल फिर्ता लिनु | |
| resign | हार मान्नु | |
| claim a draw, agree a draw | बराबरीको दाबी, बराबरीमा सहमति | |
| face to face | आमनेसामने | The tablet layout |
| out of time | समय सकियो | |
| on Lichess, offline | Lichess मा, अफलाइन | Task 77 |
| challenge (a game) | चुनौती | |
| accept, decline | स्वीकार गर्नु, अस्वीकार गर्नु | |
| rated, casual | रेटेड, क्याजुअल | Loanwords, as players say them |
| with a clock, correspondence | घडीसहित, पत्राचार | |
| days a move | प्रति चाल दिन | |
| link (an open challenge's) | लिङ्क | |
| the Lichess AI | Lichess AI (the choice: Lichess को AI) | |
| abort (a game) | रद्द गर्नु | |
| ask to take back a move | चाल फिर्ता माग्नु | |
| offer a draw | बराबरीको प्रस्ताव | |
| claim the win, claim a draw | जितको दाबी, बराबरीको दाबी | |
| opponent | विपक्षी | |
| chat | च्याट | |
| rating | रेटिङ | |
| quick pair | छिटो जोडी | Task 78 |
| seek (look for a game) | खेल खोज्नु | |
| rapid, classical, correspondence | र्‍यापिड, क्लासिकल, पत्राचार | The speeds' existing words |
| increment | थप | |
| notifications | सूचनाहरू | |
| zen mode | जेन मोड | |
| berserk | बर्सर्क | A loanword, as players say it |
| left (time) | बाँकी | |
| puzzle, daily puzzle | पजल, दैनिक पजल | Task 80 |
| training | अभ्यास | |
| streak | स्ट्रिक | A loanword, as players say it |
| hint, solution | सङ्केत, समाधान | |
| miss (a puzzle) | चुक | |
| theme (a puzzle's) | थिम | The 72 themes' names are `ch_theme_*` |
| difficulty | कठिनाइ | |
| fork, pin, skewer | फोर्क, पिन, स्क्युअर | Loanwords; the motifs without one are described (खुलेको आक्रमण) |
| mate in 2 | २ चालमा मेट | |
| endgame, middlegame | इन्डगेम, मिडलगेम | |
| player, players | खेलाडी | Task 81 |
| leaderboard | लिडरबोर्ड | |
| follow, following | पछ्याउनु, पछ्याउँदै | As the social switch's name |
| online, away | अनलाइन, अनलाइन छैन | |
| UltraBullet | अल्ट्राबुलेट | With the other speeds |
| accuracy | शुद्धता | Lichess's analysis |
| inaccuracy, mistake, blunder | अशुद्धता, गल्ती, ठूलो गल्ती | ?!, ?, ?? |
| average centipawn loss | औसत सेन्टिपन क्षति | |
| activity | गतिविधि | |
| replay (a game) | खेल फेरि हेर्नु | |
| watch (the section) | हेर्नुहोस् | Task 82 |
| TV, channel | टिभी, च्यानल | Loanwords |
| top rated, bots | उच्च रेटिङ, बटहरू | Channels without a speed's name |
| live | प्रत्यक्ष | As the stream's dot |
| follow (a game being played) | (खेल) हेर्नु | Not पछ्याउनु, which is following a player |
| broadcast | प्रसारण | |
| round (a tournament's) | राउन्ड | |
| board (a game in a round) | बोर्ड | |
| official | आधिकारिक | |
| standings | स्थिति तालिका | |
| streamer, stream | स्ट्रिमर, स्ट्रिम | Loanwords |

## Pitfalls already solved

- **user-event clicks carry no coordinates:** Storybook's `userEvent.click` sends `clientX` 0, so the board takes the square from the pressed cell (`data-square`) and uses the point only while a drag holds the pointer. jsdom tests fire pointer events with coordinates on the grid instead.
- **A move button's name must contain what it shows** (axe's `label-content-name-mismatch`): an `aria-label` of "Knight to f3" on a button showing "♘f3" fails. The board speaks moves in words; the buttons are named by their text.
- **`aria-hidden` on an SVG** needs the value (`aria-hidden="true"`) for Biome's `noSvgWithoutTitle`.

- **A board theme for visitors appears after hydration:** without a session the preferences are in `localStorage`, which the server can't read, so the first paint uses the defaults and the theme swaps in (colours only, nothing moves). A session's are on the first paint.
- **`MiniBoard` without a label is `aria-hidden`:** an element with `role="img"` and an empty name fails axe.

- **A "no token" explorer answer is never cached:** it would outlive a visitor connecting a moment later. The read throws inside the cache and the service turns it into `{ ok: false, reason: "token" }`.
- **knip and the engine's package:** `scripts/engine-copy.ts` resolves `stockfish/package.json` with a literal `require.resolve`; built from a variable, knip calls the package unused and `strip-demo` would drop it.
- **The board grid owns the arrow keys while it has focus** (it moves its cursor); ←/→ step through the moves from anywhere else, and the step buttons always work.
- **Lichess's 401 isn't always "revoked":** only a call with a user's token becomes `LichessAuthError`. The explorer's 401 without a token means it needs one.
- **A stream's timeout covers its headers only:** `AbortSignal.timeout` on the whole fetch would kill the stream after 8 s.
- **Nitro routes don't run TanStack Start's middleware:** the OAuth and stream routes read the session with `auth.api.getSession({ headers })` themselves, and import with relative paths like the other Nitro routes.
- **The vault's key ids:** the first 8 characters of the key's SHA-256, so the same key always has the same id, and the key itself never appears.
- **Fixture names:** a FEN in a file name would break Windows' path limit; `lichessFixtureName` hashes the parameters.
- **Fake timers fake `performance.now()` too:** a test that drives the clocks with its own `performance.now` spy fakes only the timers (`vi.useFakeTimers({ toFake: ["setTimeout", …] })`), or the spy is replaced.
- **A factory prop that changes each render restarts the engine:** `useLocalGame` keeps the first `createEngine` it's given.
- **Two move lists on the game page** (the strip on a phone, the table from `lg`): e2e finds the shown one with `filter({ visible: true })`.

- **`networkidle` never comes for a connected player:** the frame's event stream keeps a request open. e2e waits for that request instead (`eventStreamOpened` in `e2e/flows/chaal.spec.ts`).
- **A real-time challenge needs its request open:** Lichess drops one nobody answers in 20 s unless `keepAliveStream` holds it, so it goes through the challenge stream, never a server function.
- **One event stream per token:** only the tab leader opens `/api/chaal/stream/events`; a second one, anywhere, closes the first.
- **Lichess ends a game's stream with the game,** and the relay then asks for a reconnect: the page's hook stops reading once the status says it's over, or it would open the stream again and again.
- **The play hub renders in stories, outside its route:** Storybook's router has one catch-all route, so the hub reads its search with `useSearch({ strict: false })` and `playSearch`, not `getRouteApi`.
- **Lichess never says a move was made on the event stream:** a correspondence opponent's move reaches Chaal only through `/api/account/playing`, which the tab leader reads (Task 78). A notice test that waits for it waits a minute; e2e reloads instead (the event stream restates each game's `isMyTurn`).
- **A seek's game comes on the event stream, not the seek's:** Lichess closes the seek's request with nothing in it. The hook watches the event store for a new game that hasn't moved.
- **Zen must not be set by a page's effect:** it would hide the bars after the first paint (a layout shift); `useZen` reads the router's path and the preference, both known on the server.
- **e2e: online play runs as `member`, never the viewer:** the review opens Chaal's pages as the viewer while the flows run, and Lichess (and the fake) allows one event stream per token, so the two would knock each other off. The online-play groups also clear the fake Lichess and the connections when they finish.
- **The admin's settings write invalidates only the server functions' controls:** the Nitro routes (the streams, OAuth) are their own bundle with their own `chaalControls`, and other instances have theirs, so they see a change within 5 s (the TTL). e2e polls for it (the play-off flow); the harness's reset deletes `ch_settings`, which a running server may keep for those 5 s.
- **Features named in a sentence are lowercase** (`m.ch_feature_play` reads "play" in "Reconnect to allow play"): the admin's switches use their own title-case names (`FEATURE_TITLES`).

- **A daily puzzle's cache key is shared:** the lab's public-lane check and the puzzles page read `/api/puzzle/daily` under the same key, so both use `puzzleAnswer`; a narrower schema on either would put a different shape in the other's cache.
- **Lichess's batch ignores `color` for more than one puzzle:** a side asks for twice as many and keeps that side's (`puzzleBatch`).
- **The trainer's timer runs per phase and move:** the solution stays in `reveal` from one move to the next, so the effect is keyed by `phase:step`, or it would stop after the first move.
- **An error in a loader's query is not dehydrated:** the browser asks again and logs a 404. A read whose "not there" is a normal answer returns `null` (the replay, a rating's details); only a page that should be a 404 throws (`notFound()` for an unknown player).
- **A streamed part needs its own boundary:** `useSuspenseQuery` throws a failed read to the nearest error boundary, which would be the route's; the player's page wraps each part in a `CatchBoundary` (Parda's rails do the same).
- **FilterBar resets `page`, not a cursor:** the games tab adds a hidden empty `before` to its form, so a filter change drops it.
- **The recorded player must show a history:** some accounts hide it (Lichess answers `[]`); `nihalsarin2004`'s is public, so the chart renders in e2e.
- **Regenerating the route tree without Vite** (the router generator alone) drops Start's `Register` block at the end of `src/routeTree.gen.ts`; `pnpm dev` or `pnpm build` writes the whole file.

- **Lichess's public streams send no keepalives:** a TV feed went 20 s without a line when measured, and a round can be quiet for minutes; the event stream's 20 s watchdog would drop them over and over. `usePublicStream` allows five minutes (ten for a round); a dropped stream restates when it reopens.
- **A live page never reaches network idle:** its streams stay open. The browser review waits for the load and a moment instead (`live: true` in `e2e/support/pages.ts`); the flows wait for `load` and poll the fake's `GET /e2e/lichess/watch-streams` before pushing a move.
- **Lichess answers in the language it's asked in:** a broadcast's rounds came back as "Раунд 1" without `accept-language`; the client sends `en`, so one cached answer serves both languages.
- **A TV game's position needs `lastFen=true`:** the export by ids gives no position without it (and `moves=false` keeps it small).
- **A board's PGN is a `.pgn` fixture:** `lichessFixtureName` keeps a path's `.pgn` as the file's extension, and the fake serves it as `application/x-chess-pgn`.
- **`Array.prototype.with` and `findLast` aren't in the project's TypeScript lib** (ES2022): `map` with the index and a reversed `find` do the same.
