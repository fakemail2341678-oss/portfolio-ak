# SEO

How every page gets its head tags, what search engines can index, and what to do when you add a page. Decisions 0100–0102 explain the choices.

## The rule

Every page is one of two kinds, and `tests/unit/route-seo.test.ts` checks every route in both languages:

| Kind | Head | In the sitemap |
| --- | --- | --- |
| **Indexable** (public content: the home page and the portfolio's pages; any public page or list you add) | `seo()` or `listSeo()` | yes |
| **Private** (admin, sign-in pages, account, health, everything under `/dev`, token links) | `privateHead()` or a private layout | no |

A new page that is neither fails the test with "needs privateHead() or seo()".

## Indexable pages: `seo()`

```ts
head: () =>
	seo({
		title: m.projects_title(),            // "Projects · <site>"; omit on the home page (site name alone)
		description: m.projects_description(), // unique per page and language
		path: "/projects",                     // de-localized; include a query only if it identifies the page
		image: { url, width, height, alt },    // optional; defaults to public/og-default.png
		type: "article",                       // optional; "website" by default
		jsonLd: productJsonLd({ ... }),        // optional; one object or an array
		siteName: "Taskline",                  // optional: a product of its own (title suffix, og:site_name; 0208)
	}),
```

It returns, in the current language:
- the title and description;
- `robots`: `index, follow, max-image-preview:large` (or `noindex, follow` with `noindex: true`);
- the canonical URL, `hreflang` alternates for en, ne and `x-default` (English);
- Open Graph (type, site name, title, description, URL, locale and alternate locale, image with width, height and alt);
- Twitter's `summary_large_image` card with the same image;
- JSON-LD entries, each with `"@context": "https://schema.org"` added.

Merging: TanStack Router keeps the deepest route's `<meta>` per `name`/`property` and its title; links and JSON-LD from every level add up. That's why layouts can set `robots` for all their children.

### Lists: `listSeo()`

```ts
head: ({ match: { search } }) =>
	listSeo({ title: m.projects_title(), description: m.projects_description(), path: "/projects", q: search.q, page: search.page }),
```

- Page 1 is canonical at the bare path. Later pages are their own canonical URLs (`?page=2`), with "page 2" added to the title and description so each is unique.
- A search (`q`) is `noindex, follow`, titled after the query, canonical to the list.
- Other params (sort, filters) don't change the canonical.

### Item pages

Return the few fields the head needs from the loader (not the whole item; see golden rule 1), and build the image from the attachment's `og` URL (1200×630 JPEG cropped around the subject by Cloudinary):

```ts
ogImage: image ? { url: image.og, width: 1200, height: 630, alt: image.alt || title } : null,
```

The portfolio's case studies (`src/routes/_site/work/$slug.tsx`) are the example. Test CRUD's public pages under `/dev/test-crud` show the loader and the image, but are private like all of `/dev` (0162).

## JSON-LD

Builders live in `src/lib/structured-data.ts`, typed with `schema-dts` (a misspelt property or wrong value type fails typecheck):

| Where | Types |
| --- | --- |
| Home | `WebSite` (in the page's language, `websiteJsonLd(description, publisher?)`); on the portfolio its publisher is the owner's `Person` (`@id` `/#person`) |
| Pages with breadcrumbs | `BreadcrumbList`, from `<Breadcrumbs jsonLd />` (above the page's `PageHeader`) |
| Portfolio pages | `Person`, `ProfilePage`, `CollectionPage`, `Blog`, `CreativeWork` (case studies), `BlogPosting` (`src/features/portfolio/lib/structured-data.ts`) <!-- @portfolio --> |

Add a builder there for a new type, and assert its output in the route test.

## Private pages

- **Layouts:** `_admin`, `_auth`, `_authed` and `dev` add `NOINDEX` (`noindex, nofollow`) in their `head`; their pages only set a title (`privateHead()`). Don't use `seo()`/`listSeo()` under them: the deepest route's `robots` wins, so the page would say `index`.
- **Single pages** under `_public` (health, reset-password, verify-email): `head: () => privateHead(m.title())`.

## Crawler files

| URL | Source | Notes |
| --- | --- | --- |
| `/sitemap.xml` | `src/routes/sitemap[.]xml.ts` → `src/server/seo/sitemap.ts` | The home page and the portfolio's pages (`/work`, each case study, `/about`, `/journal`, each article, `/contact`; the published slugs and their last change from the database, guides/portfolio.md); one `<url>` per language, each listing every `hreflang` alternate. Nothing under `/dev` (0101, 0162). |
| `/robots.txt` | `src/server/seo/robots.ts` | Disallows `/admin`, `/ne/admin`, `/api/`, `/_serverFn/`; points to the sitemap. Other private pages stay crawlable so crawlers can read their `noindex`. |
| `/manifest.webmanifest` | `src/server/routes/manifest.ts` (Nitro) → `src/server/seo/manifest.ts` | Localized (`/ne/manifest.webmanifest`); the root head links the current language's. |

The sitemap and robots are Start server routes (`.ts` files with only `server.handlers`); `/ne/sitemap.xml` and `/ne/robots.txt` are 404s. The manifest is a Nitro route (one entry per locale in `vite.config.ts`): browsers fetch it with `Sec-Fetch-Dest: manifest`, which Nitro's dev server otherwise hands to Vite (0067). Responses are cached at the edge for an hour.

**Adding pages to the sitemap:** add them to `sitemapEntries()` (published rows only; a list's later pages as `?page=N`, as `listSeo()` makes them) and to `INDEXABLE` in the route test.

## Icons and images (`public/`)

| File | Use |
| --- | --- |
| `favicon.svg`, `favicon.ico` (32 px) | Tab icon (SVG first; ICO for the rest and for `/favicon.ico` requests) |
| `apple-touch-icon.png` (180 px) | iOS home screen |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Manifest icons (maskable has the mark inside the safe zone) |
| `og-default.png` (1200×630) | Social preview for pages without their own image |

To rebrand, replace these files at the same sizes. `theme-color` follows the theme preference (`ThemeColor` in `__root.tsx`): one colour for light or dark, both with media queries for "system".

## Checking a page

- `pnpm test`: the route test (every route, both languages), `seo()`, sitemap, robots and manifest tests.
- Production build: `curl` the page and read its `<head>`; check `/sitemap.xml`. Absolute URLs use `VITE_SITE_URL`, which is set at build time.
- After deploying: Google's Rich Results Test and the Search Console sitemap report.

## Live example

- **seo() output and JSON-LD:** `/dev/examples/seo` (`src/routes/dev/examples/seo.tsx`), with `pnpm dev`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Duplicate meta names:** `head()` keeps one `<meta>` per `name`/`property` (the deepest route's). Tags that need several of the same name (`theme-color` per colour scheme) are rendered in `__root.tsx`'s `<head>`.
