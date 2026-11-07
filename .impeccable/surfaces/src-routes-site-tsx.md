---
version: 1
slug: "src-routes-site-tsx"
primary_target: "src/routes/_site.tsx"
related_targets: ["src/features/portfolio"]
---

# Surface brief: the portfolio at /

**Scope:** every page of the `_site` layout (home, work, case study, about, journal, article, contact, 404), in English and Nepali, light and dark.

**Mode:** Experience (the work leads from the first viewport). The article and journal pages read in Read mode.

**Audience and job:**
- Clients and employers, equally, decide in seconds whether to write. The main action is "Get in touch", with the résumé beside it.
- Nepali readers get the same site in Devanagari.

**Proof:**
- the owner's projects and case studies;
- the site's own speed and bilingual typography;
- the live hour in Kathmandu.

**Constraints:**
- Pages and fields are fixed (Task 39).
- CLS ≤ 0.01, Lighthouse mobile ≥ 95, strict CSP, axe clean.

**Memorable moment:** the flat map tilts and lifts into a stepped relief as you scroll, under a sky lit for Kathmandu's real hour.

## Direction contract

THESIS: The Himalaya seen from Kathmandu is the site's one picture: a range printed in flat altitude layers that rises into relief as you scroll. It refuses the category default: a centred headline over cards, topo hairlines on cream, a serif with a red accent.

OWN-WORLD: The palette:
- a cool snow ground, granite ink and slate secondary text;
- five ridge blues from far (pale) to near (deep), and a pine field;
- rhododendron red on what can be acted on (the primary button, link hover, focus, form errors) and on the contact field, which the owner pinned in the approved plan (docs/PLAN.md, Task 40: "contact on rhododendron");
- night blue for dark;
- alpenglow and glacier in the art only.

Fields own whole sections and are never cards; there are no rules, shadows or gradients. The sky is flat bands. Eczar sets the display type in both scripts, Inter and Noto Sans Devanagari the text. Buttons are square fills.

STORY: The visitor sees who this is and where, then the range at this hour. They scroll the work by name, see each project's own mountain, read how the owner works and what came of it, and write, or take the résumé.

FIRST VIEWPORT: Nav at the top edge (initials left; four links, language and theme right). The sky and a nine-layer range fill what the first screen leaves after the fitted name and the text, up to 56% of its height (about 57% with the nav on a 1280×900 screen). The fold rule wins over a fixed share: "Get in touch" stays on the first screen of a laptop. The name runs margin to margin, bottom-anchored in Eczar 700, fitted to its length. Under it at the left: the role and city in one sentence, and the live time; at the right, "Get in touch" (a rhododendron fill, 48px tall) and the résumé link. On phones: the range, then the name on two lines, then the sentence and the action.

FORM: Pinned by the owner: the Himal pick, over the assigned lokta woodblock print (5th of 7), which donates the layered print and its print-on-load ritual. Raises taken from the challengers: real solar light (daylight section), the struck-forward index (cathode gauze), flat to volume in one gesture (drawcord cape), "where now is" (step row), staged arrival (deco lobby). seed:b3d9cd8a084181f1

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The owner's real content, portrait and project screenshots replace the demo content later, in the admin.
