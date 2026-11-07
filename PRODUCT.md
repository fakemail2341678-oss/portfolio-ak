# Product

<!-- impeccable:product-schema 1 -->

This file is the product record the design tools read (impeccable). It covers the portfolio at `/`; the admin's design system is described in [docs/guides/design-system.md](docs/guides/design-system.md). `pnpm strip-demo` removes it with the portfolio layer.

## Platform

web

## Users

- **Primary, equally:**
  - clients hiring the owner freelance: founders and product leads at small teams (fintech, commerce, NGOs);
  - employers and recruiters hiring full-time.
- **How they arrive:** from a link (LinkedIn, GitHub, a referral). They scan the first screen in seconds, open one or two case studies, then either write or leave.
- **Secondary:** Nepali-speaking visitors (clients, peers, students) who read the site in Nepali under `/ne`.
- **Peers:** engineers who judge the craft by the site itself.

## Product Purpose

The owner's personal portfolio at `/`: who they are, the work (case studies), how they work, their writing (journal), and a contact form that reaches the owner's inbox. Success: a qualified visitor understands what the owner does from the first screen, reads a case study, and either sends a message or takes the résumé.

## Positioning

A developer from Nepal who builds web products end to end, from the schema to the last pixel. The site itself is the proof:
- server-rendered;
- bilingual English/Nepali with real Devanagari typography;
- accessible and fast on slow phones;
- from Task 41, live showcase apps a visitor can try without signing up.

## Operating Context

- Visitors use desktops and phones, often on slow networks in Nepal.
- The owner edits the content in the admin: profile, projects with case-study blocks, journal, experience, skills, process, testimonials and the media library.
- Every page renders on the server, in English and Nepali, in light and dark.

## Capabilities and Constraints

- **Pages are fixed:** home, work index (discipline filter), case study, about, journal, article, contact (form), 404.
- **Fields are fixed** (the Task 39 data model):
  - profile: name, role, location, timezone, availability, headline lines, intro, manifesto, bio, principles, impact metrics, socials, toolbox, portrait, résumé;
  - projects: title, client, year, disciplines, role, duration, summary, stack, cover (motif, glyph, seed, or an image), metrics, links, gallery, and case-study blocks (chapter, quote, code, architecture diagram, screens);
  - posts, experience, skills, process steps, testimonials.
- **Technical bar:** strict CSP (no eval, self-hosted fonts), CLS ≤ 0.01, Lighthouse mobile performance ≥ 95, axe clean, no horizontal overflow at 390/768/1280.
- **The main action** is "Get in touch", with the résumé beside it (both audiences weigh equally).

## Brand Commitments

- **Art direction, chosen by the owner:** "Himalayan topography" (2026-10-21), refined 2026-10-23 as "Himal". The range seen from Kathmandu is printed in flat altitude layers that rise into relief on scroll, and the sky follows Kathmandu's real hour.
- **Nepali is a first-class language,** not a translation afterthought. One display face covers both scripts.
- **Archival pictures:** public-domain pictures of the Himalaya and Kathmandu are allowed, always credited, never presented as the owner's own work.

## Evidence on Hand

- **Demo content only:** a fictional developer, "Aarav Shrestha", seeded from `scripts/lib/portfolio-data`. The owner replaces it in the admin.
- **No real photographs, portrait or project screenshots yet.** Covers are generated art.
- **Testimonials are demo content.** Never present them as real endorsements.

## Product Principles

- The site is the proof of craft: fast, accessible, bilingual.
- Content first: every section renders the owner's data, and nothing is invented.
- Nepal is the point of view, not decoration.

## Accessibility & Inclusion

WCAG AA: text pairs ≥ 4.5:1, every path works from the keyboard, reduced motion is respected, and Devanagari is set in proper fonts with room for its vowel signs.
