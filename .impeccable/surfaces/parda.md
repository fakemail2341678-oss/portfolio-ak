---
version: 1
slug: "parda"
primary_target: "src/routes/_parda/route.tsx"
related_targets: ["src/features/parda"]
---

# Surface brief: Parda at /app/parda

**Scope:** every page of the `_parda` layout (home, hubs, discover, search, title, credits, person, collection, watch, party, library, schedule, profiles, about, sign-in, sign-up, 404), in English and Nepali, dark and light. The admin at `/admin/parda` stays on Graphite.

**Mode:** Experience: the picture leads. The watch page and the library are worked in, so they get precision over expression inside the same world.

**Audience and job:**
- Viewers in Nepal and anywhere else, on a phone or a laptop in equal measure (owner, 2026-11-04), often on slow connections. They come to pick something and press play.
- They browse and watch without an account.

**Proof:** the catalogue itself (TMDB's backdrops and posters), resume across devices, and a player that starts on the best source.

**Constraints:**
- Never imitate a real streaming service's look (PLAN 12.6).
- Nepal is quiet (owner, 2026-11-04): it shows in the name and the first-class Nepali type, not in motifs.
- CLS ≤ 0.01, Lighthouse mobile ≥ 95, strict CSP, axe clean.
- No video plays until the owner connects a provider (decision 0228).

**Memorable moment:** the masks move. Going from a poster to a title to the player, the two black masks glide to fit each picture's real shape, the way a cinema fits its screen to the film.

**The approved comp:** `.impeccable/mocks/parda/masking.html`, with its frames on `.impeccable/mocks/parda/board.html` (gitignored, because they load TMDB's images). It's the critique reference for the finish review.

## Direction contract

THESIS: The page is a cinema screen. Two masks hold all the interface and fit the screen to each picture's real shape: 2.39:1 on home, 16:9 on a title and in the player, 2:3 on a phone's home. It refuses the category default: a billboard fading into the page under a transparent header, with text laid over the picture.

OWN-WORLD: Masks are a velvet near-black in the dark theme and a warm stone in the light one, with the page a step lighter than the masks. Ink is warm white or near-black. Subtitle yellow is the one colour: the tagline on the picture, the progress bar, and the action fill in dark (in light the action is ink with yellow text). Pictures are never tinted or faded into the page: they end at a hard edge where a mask begins. Corners are square. Anek Devanagari sets display type, wide in Latin; Inter and Noto Sans Devanagari set text. Sentence case, no eyebrows, no cards around content.

STORY: The viewer sees one great picture and knows what it is, presses play or scrolls to Continue watching, the Top 10 and the rails, opens a title, and watches with the masks closed tight around the frame. The server choice and the ad-blocker link sit in the lower mask, plain and always findable.

FIRST VIEWPORT: Laptop, 1280×800: a top mask 60px tall holds the wordmark at the left, the links beside it, search and account at the right. A 2.39:1 picture runs edge to edge under it, with the tagline centred low on it in subtitle yellow over a scrim. The lower mask holds the title in wide Anek at 64px at the left with year, runtime, certificate and rating under it, and at the right Play in a yellow fill, My list and the slideshow's pause button. The next section's heading shows at the fold. Phone, 390: the same, with the poster at 2:3 between the masks, the title at 36px, the actions in a row, and a tab bar at the bottom.

FORM: Cinema masking, first on the ordered list of seven: masking, title-sequence cut paper, the marquee letter board, the home-video spine shelf, film leader marks, late-night listings, the ticket stub. The owner chose it over the rolled late-night listings and the cyclorama challenger. Signature interaction: the masks glide to the next picture's shape on navigation, by transform only, and simply sit in place under reduced motion. seed:6cf9ce18cc7f5145

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The finish review ran in Task 70 ("ship after fixes"; its fixes and what was kept are decision 0244), and the design record is `docs/design/parda.md`. Still open: the watch page's lower mask as the comp draws it (the title at its left, servers as plain buttons, one ad-blocker button, a full-width progress line), and the masks gliding between pages (not built).
- Bad pictures: a title without a backdrop needs a designed state in the masks (Task 61's `TmdbImage` and `Billboard`).
- Taglines are often missing, and TMDB rarely has them in Nepali: the subtitle line is simply absent then, not filled in.
