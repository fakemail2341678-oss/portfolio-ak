---
paths:
  - "src/routes/**/*.{ts,tsx}"
---

# Route files

Guide: `docs/guides/routing-data.md`. The reference: `src/routes/_admin/admin/test-crud/`.

- A route file MUST hold only its search, `beforeLoad`, `loader`, `head`, `staticData` and components that each render one component from `src/features/<name>/components`. It calls no hook but the router's (`Route.useSearch()`, `Route.useParams()`).
- The loader MUST `await ensureQuery(queryClient, options)` (or `listLoader`, `loadList`, `loadDetailOr404`) for everything the first paint shows. It returns only what `head` and `staticData` need.
- A route file imports a feature's `search.ts` statically. It MUST import `queries.ts` inside the loader: `const { xQueryOptions } = await import("@/features/x/queries")`. NEVER import `schema.ts`, `collection.ts` or `queries.ts` at the top (type-only imports are fine).
- `component`, `pendingComponent`, `errorComponent` and `notFoundComponent` MUST be written inline in the literal `createFileRoute("…")({ … })` object, so the router splits them out.
- Search schemas are forgiving `z.object`, NEVER `z.strictObject`: links carry utm tags.
- A protected route MUST call `assertRoutePermission` in `beforeLoad`.
- Every page MUST be indexable (`seo()`, `listSeo()`, in the sitemap) or private (`privateHead()` or its layout). `tests/unit/route-seo.test.ts` checks.
- Breadcrumbs are declared in `staticData`, NEVER in a page.
- The `/dev` examples are one file each on purpose; that exception is theirs alone.
