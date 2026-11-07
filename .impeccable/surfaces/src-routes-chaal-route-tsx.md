---
version: 1
slug: "src-routes-chaal-route-tsx"
primary_target: "src/routes/_chaal/route.tsx"
related_targets: ["src/features/chaal"]
---

# Surface brief: Chaal at /app/chaal

**Scope:** every page of the `_chaal` layout (home, play, the live game, analysis, puzzles, watch, players, community, settings, about, sign-in, sign-up, 404), in English and Nepali, light and dark. The admin at `/admin/chaal` stays on Graphite.

**Mode:** Operate. People play, solve and analyse here; the world lends type, palette, density and one signature move, never the layout, navigation or controls.

**Audience and job:**
- Casual to club players, on a phone and at a laptop in equal measure (owner, 2026-11-08), often on slow connections in Nepal. They come to play a game, solve a puzzle, or look at a position.
- Everything public works without an account; playing online needs a Lichess account connected to the session.

**Proof:** the board itself: fast, legible, keyboard-playable, and spoken in both languages. Lichess's data (games, puzzles, TV) with "Powered by Lichess, not affiliated".

**Constraints:**
- Never imitate Lichess or chess.com (PLAN 13.6). Board first: the board is the largest thing on play, puzzle and analysis pages, and a phone never scrolls to reach the board, clocks or move buttons.
- Follow the device for light and dark (owner, 2026-11-08). Nepal is quiet: the name चाल and first-class Devanagari type, no motifs (owner, 2026-11-08).
- The cburnett pieces (CC BY-SA 3.0, attributed). Our own SVG board. One display face for Latin and Devanagari, at most two preloads per locale.
- CLS ≤ 0.01, strict CSP, axe clean; text 4.5:1, square highlights 3:1.

**Memorable moment:** the board is a printed diagram plate, and the game's commentary is written in the annotator's symbols beside the moves.

**The approved comps:** `.impeccable/mocks/chaal/board.html` (Home, live game, Analysis, Puzzle at 390 and 1280, light and dark; approved by the owner 2026-11-08), built from the sketch `.impeccable/mocks/decision/chaal-diagram.html`. Both are gitignored. They are the critique reference for the finish review (Task 85). Tokens: `src/styles/chaal.css` (decision 0258).

## Direction contract

THESIS: The board is a printed chess diagram, the kind every player has read in a book or a column: hatched dark squares inside a heavy double frame, coordinates set outside it. It refuses the category default of a soft two-tone board floating in dark slate panels with a green action.

OWN-WORLD: Paper and ink. Light: a warm paper ground, white plates, ink near-black; dark: the same print reversed, ink-black ground and paper-white ink, not a tinted slate; the board stays paper in both themes, dimmed a step in dark. One spot colour, vermilion, the annotator's pencil: the last move's rings, annotation symbols, the current move's underline, check. Rules are heavy (2px) at section heads and hairline between rows; corners are square; no cards, shadows or gradients. A heavy grotesk display face (Mukta) for clocks, headings and the wordmark; Inter and Noto Sans Devanagari for text. Figurine notation everywhere on screen.

STORY: The player opens Chaal, starts a game or a puzzle in one step, plays on a board that reads like the diagrams they learned from, and afterwards sees the game annotated in the same symbols (!, ?, !?, ±, ∞) in analysis.

FIRST VIEWPORT: Laptop, live game: a 58px top bar with the wordmark Chaal चाल, Play, Puzzles, Analysis, Watch, and the account at the right, ruled off with a 2px ink line. The diagram plate fills the height at the left (about 744px). At the right under a heavy rule: the opponent and their clock in 54px figures, the opening name and game type, a dense two-column move list with vermilion symbols, your name and your clock (ink, the other grey), then Takeback, Offer draw and Resign. Phone: the board edge to edge under a slim bar, the opponent above and you below with the clocks, the move strip scrolling sideways, and the actions in thumb reach above the tab bar.

FORM: The printed diagram and the annotator's symbol language, first on the ordered list of seven: the printed diagram, the tournament scoresheet and pairing wall, the Bauhaus chess set, the ECO encyclopedia volumes, the championship stage, correspondence postcards (the roll's assignment, Airmail), the park stone table. The owner chose it over Airmail and two competitive challengers (Score staff, Bitmap specimen). Signature move: hatched dark squares in a framed plate, and annotations in vermilion symbols beside the moves. seed:7b6902aa010a546e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Hatching on a 390px phone (squares about 46px): check moiré and legibility in the comps; a plain board theme is always one setting away.
- Highlights on hatched squares are rings and outlines, not fills; the 3:1 test measures them against both square colours.
- The annotation symbols come from the engine (analysis) and Lichess's judgements (archived games); a live game shows none.
