---
name: Himal
description: The Himalaya seen from Kathmandu, printed in flat altitude layers, as a bilingual developer portfolio.
colors:
  snow: "oklch(0.975 0.006 235)"
  snow-2: "oklch(0.938 0.012 235)"
  granite-ink: "oklch(0.24 0.025 250)"
  slate-muted: "oklch(0.45 0.03 248)"
  rhododendron: "oklch(0.5 0.19 20)"
  on-action: "oklch(0.985 0.004 235)"
  ridge: "oklch(0.37 0.065 248)"
  pine: "oklch(0.34 0.05 168)"
  night: "oklch(0.2 0.03 255)"
  rhododendron-field: "oklch(0.47 0.18 20)"
  night-ridge: "oklch(0.195 0.03 252)"
  alt-0: "oklch(0.34 0.055 162)"
  alt-1: "oklch(0.42 0.05 178)"
  alt-2: "oklch(0.5 0.048 205)"
  alt-3: "oklch(0.58 0.045 228)"
  alt-4: "oklch(0.66 0.04 238)"
  alt-5: "oklch(0.75 0.032 240)"
  alt-6: "oklch(0.84 0.022 238)"
  alt-7: "oklch(0.915 0.012 236)"
  alt-8: "oklch(0.975 0.005 235)"
  alpenglow: "oklch(0.8 0.12 45)"
typography:
  name:
    fontFamily: "Eczar Variable, Eczar Fallback, Eczar Devanagari Fallback, Georgia, serif"
    fontSize: "clamp(3rem, calc(100cqi / fit), 22vw)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Eczar Variable, Eczar Fallback, Eczar Devanagari Fallback, Georgia, serif"
    fontSize: "clamp(2.5rem, 1.2rem + 7.5vw, 9.5rem)"
    fontWeight: 650
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  head:
    fontFamily: "Eczar Variable, Eczar Fallback, Eczar Devanagari Fallback, Georgia, serif"
    fontSize: "clamp(2.25rem, 1.35rem + 3.6vw, 4.5rem)"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  statement:
    fontFamily: "Eczar Variable, Eczar Fallback, Eczar Devanagari Fallback, Georgia, serif"
    fontSize: "clamp(1.25rem, 1.05rem + 0.75vw, 1.75rem)"
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: "-0.012em"
  lead:
    fontFamily: "Inter Variable, Noto Sans Devanagari Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.05rem + 0.75vw, 1.75rem)"
    fontWeight: 400
    lineHeight: 1.38
  body:
    fontFamily: "Inter Variable, Noto Sans Devanagari Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Inter Variable, Noto Sans Devanagari Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.45
  code:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono Fallback, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  none: "0"
spacing:
  margin: "clamp(1.125rem, 2.4vw, 2rem)"
  gutter: "clamp(1rem, 2vw, 1.75rem)"
  section: "clamp(6rem, 11vw, 12rem)"
  header: "4.5rem"
  max: "100rem"
components:
  button-primary:
    backgroundColor: "{colors.rhododendron}"
    textColor: "{colors.on-action}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  button-compact:
    backgroundColor: "{colors.rhododendron}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  filter-link:
    backgroundColor: "{colors.snow-2}"
    textColor: "{colors.granite-ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  filter-link-current:
    backgroundColor: "{colors.granite-ink}"
    textColor: "{colors.snow}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.snow-2}"
    textColor: "{colors.granite-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  nav-link:
    textColor: "{colors.slate-muted}"
    typography: "{typography.body}"
  nav-link-current:
    textColor: "{colors.granite-ink}"
---

# Design System: Himal

## Overview

**Creative North Star: "The Range at This Hour"**

The site has one picture: the Himalaya seen from Kathmandu, printed like a multi-block woodblock print. Each altitude is one flat sheet of colour, lifted one step above the one below, under a sky of flat bands lit for the real hour in Kathmandu. Everything else stays quiet so that picture and the type can carry the page.

Pages are long and spacious. Sections sit far apart and each one owns a whole field of colour: snow, a second snow, ridge blue, pine, night or rhododendron. Nothing is a card and nothing floats above the page at rest. Type does the structural work: Eczar display headings in both scripts, a fitted name that runs margin to margin, and plain text in Inter and Noto Sans Devanagari.

The system lives under `.himal` with `hm-` utilities (`src/styles/himal.css`), so the admin's Graphite system is untouched. Implementation detail, budgets and pitfalls live in [docs/guides/portfolio.md](docs/guides/portfolio.md) ("Design system: Himal") and decisions 0179 to 0184.

**Key Characteristics:**
- Flat altitude sheets as the one picture, generated from a seed, the same markup on server and browser.
- Whole-section colour fields; no cards, gradients, shadows at rest or hairline rules.
- One red, for what can be acted on.
- Eczar display in Latin and Devanagari; five type sizes.
- Square, filled buttons.
- Motion that moves only transform, clip-path and colour, and switches off under reduced motion.

## Colors

A cool, low-chroma mountain palette (snow, granite, ridge blue, pine, night) with one saturated red.

### Primary
- **Rhododendron** (`rhododendron`): the one accent. It fills the primary button, colours a link's underline on hover and focus, draws the focus ring, and marks form errors. Its dark-theme value is lighter (oklch(0.77 0.12 18)) to keep contrast on night. On the ridge and pine fields actions turn snow-white instead, and the accent there is a pale pink used only for hover underlines.
- **Rhododendron Field** (`rhododendron-field`): the contact section and contact page, the owner's choice. On it ink, actions and focus are near-white, and the duotone prints the valley map in the field's own reds.

### Neutral
- **Snow** (`snow`): the default ground of every page.
- **Second Snow** (`snow-2`): the surface step. A field for alternating sections, and the fill of inputs, filter links, code captions and pre blocks.
- **Granite Ink** (`granite-ink`): all text and headings; also the current filter fill, text selection and the reading line.
- **Slate** (`slate-muted`): secondary text, metadata, quote marks, list markers, inactive navigation.
- **Ridge Blue** (`ridge`): a dark field for the selected work, a case study's next project and the article's closing links.
- **Pine** (`pine`): a dark field for the process section.
- **Night** (`night`): a dark field for testimonials, code blocks and the footer.
- **Night on the Ridge** (`night-ridge`): the dark theme's ground. Every field has its own dark value (sidecar).

### The art's colours
- **Altitude ramp** (`alt-0` to `alt-8`): pine-dark hills, blue rock and ice, snow. Used only by the relief.
- **Sky bands**: three flat bands per phase (day, dawn, dusk, night), top to horizon (`--hm-sky-<phase>-1..3`, sidecar).
- **Alpenglow** (`alpenglow`): mixed into the highest sheets at first and last light. Moonlight, sun and star tones exist for the art only.
- **Duotone inks** (`--hm-duo-light`, `--hm-duo-dark`): the two inks of the archival pictures; a field may set its own.

### Named Rules
**The One Red Rule.** Rhododendron marks only what can be acted on, plus the contact field. Active states, selection, quote marks, list markers and the reading line use ink or muted. There are no status colours.

**The Whole Field Rule.** A section takes one whole ground and the inks that read on it (`hm-field-*`). Neighbouring sections never share a field. Fields are never cards, insets or tinted boxes.

**The Contrast Floor Rule.** Every text pair is at least 4.5:1 on its ground and its second ground, in both themes, on every field and on the art (`tests/unit/himal-tokens.test.ts`). Text on a new colour adds a pair there.

## Typography

**Display Font:** Eczar Variable (with metric-matched Times New Roman and Nirmala UI fallbacks)
**Body Font:** Inter Variable and Noto Sans Devanagari Variable (the app's text faces)
**Mono Font:** JetBrains Mono Variable, in code blocks only

**Character:** Eczar is a sturdy, warm display face that covers both scripts, so a Nepali heading and an English one are one voice. The text faces stay neutral and readable underneath it.

### Hierarchy
- **Name** (700, fitted, 0.92): the owner's name as a monument in the hero and footer. Sized from its own length to run margin to margin; one line from 48rem, one word per line on phones.
- **Title** (650, clamp 2.5 to 9.5rem, 0.95): page titles and the next project.
- **Head** (650, clamp 2.25 to 4.5rem, 1.02): section headings. Every section opens with a heading that names it, plus at most one lead sentence.
- **Statement** (Eczar 500, lead size, 1.38): quotations and large running statements.
- **Lead** (400, clamp 1.25 to 1.75rem, 1.38): intros under headings, figure lines, contact lines.
- **Body** (400, clamp 1.0625 to 1.1875rem, 1.6): running text, at most 66ch. Article prose sets slightly larger (1.125 to 1.25rem, 1.65).
- **Small** (500, 0.9375rem, 1.45): metadata and captions, muted, sentence case.

### Named Rules
**The Five Sizes Rule.** Small, body, lead, head and title do all the work; the fitted name is the only exception. No other sizes enter a page.

**The Figures Are Facts Rule.** A number is set at its sentence's size, in Eczar semibold beside the sentence it belongs to. It is never a headline or a big stat.

**The Devanagari Rule.** Nepali display type drops the negative tracking and opens the leading. Nepali headings start at 30px on phones and reach the English size on wide screens. The name gets a lower ceiling.

**The Sentence Case Rule.** No uppercase labels, no letter-spaced small caps, no eyebrows above headings.

## Layout

One content column (max 100rem) with one pair of tight outer margins at every width. A 4-column grid on phones and 12 columns from 48rem, with fluid gutters. Sections are far apart (96 to 192px), and the space between them is the field changing, not a rule.

The header is not sticky: initials and name at the left, four plain links, language and theme at the right; a native disclosure menu on phones. The first viewport is the sky and range above the fitted name, with the role, city, live Kathmandu time and the primary action under it. Frames for pictures have fixed ratios, so nothing shifts while loading.

## Elevation & Depth

Flat. There are no shadows at rest, no blur and no gradients. Depth comes from two places only: the colour step between fields, and the relief itself, whose sheets are lifted one step per altitude and spread apart as the page scrolls. The sky is flat bands, never a gradient.

### Named Rules
**The Flat Print Rule.** Every surface is a flat fill. Depth belongs to the art, made of stacked sheets, never to the interface.

## Shapes

Square corners everywhere: buttons, inputs, filter links, fields, picture frames and code blocks have no radius. The only round forms are the sun and the stars in the sky. Inputs carry a 2px bottom stroke that appears on hover (muted), focus (ink) and error (rhododendron). The relief's silhouettes are smoothed contour rings that bleed past both edges of the frame, so the low land runs off the page instead of ending in rounded caps.

## Components

### Buttons
Square, filled and plain.
- **Shape:** square (0 radius), 48px tall, 24px side padding, body size at weight 600.
- **Primary:** rhododendron fill with near-white text (on dark fields, a snow fill with field-coloured text). Used for "Get in touch", sending the form, opening a showcase app and the 404's way home.
- **Hover / Focus:** the fill mixes 14% toward ink on hover; a 2px focus outline offset 3px; a 0.98 press scale.
- **Compact:** 44px tall, 16px padding, with a 14px line icon, for the copy-email control only.

### Chips (filter links)
- **Style:** second-snow fill, ink text, 44px tall, square.
- **State:** the current filter swaps to an ink fill with snow text; hover underlines. Never red.

### Cards / Containers
There are none. Content sits directly on its section's field. A picture sits in a fixed-ratio clipped frame with no border or shadow.

### Inputs / Fields
- **Style:** second-snow fill, no radius, 12px by 16px padding, body size, a transparent 2px bottom stroke.
- **Focus:** the stroke turns ink, plus the 2px focus outline.
- **Error:** the stroke and the message under the field turn rhododendron.

### Navigation
Plain links in muted text at weight 500, turning ink on hover. The current page is ink with a 2px underline set well below the text. Phones get a native disclosure menu that works before JavaScript.

### Links in text
Underlined at 0.06em in half-strength current colour, offset 0.2em. On hover and focus the line turns rhododendron and thickens to 0.12em. Large index entries (work rows, journal lines, next project) underline in rhododendron on hover.

### Printed Relief (signature)
A generated landform drawn as stacked contour sheets, each filled flat in its altitude colour and lifted one step. Levels above the snow line (the top 38%) take the two snows, so every summit that clears it carries snow. The plan bleeds past the frame, and rings too small to read are filtered out as specks at every level. Every project grows its own mountain from its seed and motif, with its glyph where a map would print a sheet's name. The work index's panorama board uses the same engine: one summit per project, named on a board with a leader line down to its snow.

### Sky at This Hour (signature)
Three flat bands behind the range, coloured by the phase of the real sun over Kathmandu (day, dawn, dusk, night), with the low sun, alpenglow on the summits at first and last light, moonlight on the whole range at night, and stars.

### Archival Picture
Five credited public-domain pictures of the Himalaya and Kathmandu (Sella's 1899 photographs, Kangchenjunga at first light, Kathmandu about 1920, Landon's 1928 valley map), printed in two inks with a CSS duotone: greyscale multiplied over the light ink, the dark ink lightened on top. Fixed frames, lazy, captioned, credited in the footer. Each file's provenance sits beside it in `public/himal/<file>.webp.json`.

### Code Block
A figure on the night field: the language in small muted text, JetBrains Mono at small size, a second-ground caption. Long lines scroll inside the block, which is focusable.

### Motion
Everything is visible and at rest by default. On screens, for readers who have not asked for reduced motion:
- the range lifts on load in three altitude bands, low land first (transform only, 1.3s, staggered 160ms);
- the name rises word by word through a clip;
- scrolling past the hero spreads the sheets apart; the cursor drifts them by depth;
- section parts rise into view with clip and transform; pictures settle from a slight zoom;
- a project's mountain morphs into its case study (view transition, 650ms);
- articles draw a 4px ink reading line across the top;
- while a page loads, a 4px ink line grows across the top, and a slow page prints a small panorama over and over: its bands rise out of the ground low land first and sink snow first, so no sheet ever floats.
All of it uses one ease (cubic-bezier(0.16, 1, 0.3, 1)) and is off under reduced motion.

## Do's and Don'ts

### Do:
- **Do** give each section one whole field (`hm-field-*`) and never repeat a neighbour's field.
- **Do** reserve rhododendron for actions, link hover, focus and errors, plus the contact field.
- **Do** use ink or muted for active states, selection, quote marks, list markers and the reading line.
- **Do** set display type in Eczar in both scripts, and text in Inter and Noto Sans Devanagari.
- **Do** keep to the five sizes, and set figures at their sentence's size.
- **Do** keep buttons square, filled and 48px tall.
- **Do** draw new art with the terrain engine: flat altitude sheets, lifted one step, with the snow line and the bleed.
- **Do** animate only transform, translate, clip-path and colour, and switch it all off under reduced motion.
- **Do** credit every archival picture and record its provenance beside the file.

### Don't:
- **Don't** use gradients, including in the sky.
- **Don't** add shadows at rest, blur or floating surfaces.
- **Don't** draw hairline rules or borders to divide content; change the field instead.
- **Don't** put content in cards.
- **Don't** add eyebrows, index numbers or uppercase labels.
- **Don't** round corners on interface elements.
- **Don't** use JetBrains Mono outside code blocks.
- **Don't** set a figure as a headline-sized stat.
- **Don't** add status colours.
