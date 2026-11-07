# Search params, filters and route masking

How list pages keep their state in the URL, how to add filters, and how to open
a record in a dialog without leaving the list. Reference implementation:
`src/routes/_admin/admin/test-crud/index.tsx` (all filter types plus the edit
dialog) and `src/routes/dev/test-crud/index.tsx` (search plus quick view).
Decisions 0084 and 0088–0093 explain the choices.

## The URL is the state

A filter URL looks the same whether JavaScript built it or a plain form submitted it:

```
/admin/test-crud?status=draft&tags=food&tags=nepal&priceMin=100&from=2026-01-01&hasImage=true&sort=title
```

| Param kind | Helper | URL | Parsed |
| --- | --- | --- | --- |
| free text | `searchParam()` (list/params.ts) | `q=momo` | `"momo"` (default `""`) |
| one of a list | `enumParam(values, fallback)` | `status=draft` | `"draft"` |
| page / page size | `pageParam()`, `pageSizeParam()` | `page=2` | `2` |
| several values | `arrayParam(itemSchema, { max })` | `tags=a&tags=b` | `["a", "b"]` (default `[]`) |
| number (range ends) | `numberParam({ min, max })` | `priceMin=100` | `100` or `undefined` |
| calendar date | `dateParam()` | `from=2026-01-01` | `"2026-01-01"` or `undefined` |
| yes / no / any | `booleanParam()` | `hasImage=true` | `true`, `false` or `undefined` |

Every helper is forgiving: an empty form field means "not set", and a bad value
is dropped (`.catch`) rather than failing the page. Arrays are written as repeated
keys by the router's `stringifySearch` (`src/lib/list/url.ts`, wired in
`src/router.tsx`).

## Adding a filtered list

1. **URL contract** (`features/<name>/search.ts`, [crud.md](crud.md)):

   ```ts
   export const projectList = listSchema({
   	sorts: ["-updated", "updated", "title", "-title"],   // the first is the default
   	filters: {
   		status: enumParam(STATUS_FILTERS, "all"),
   		tags: arrayParam(z.string().max(32), { max: 10 }),
   		budgetMin: numberParam(), budgetMax: numberParam(),
   		from: dateParam(), to: dateParam(),
   	},
   });
   // projectList.search: validateSearch (adds q, sort, page, pageSize); .input: the server input (strict,
   // page size resolved); .defaults: kept out of links; .filterKeys: what "Clear all" resets
   ```

2. **Repository:** turn each param into SQL with the helpers in `src/server/db/list.ts`:

   ```ts
   const where = allOf(
   	input.status === "all" ? undefined : eq(projects.status, input.status),
   	textSearch(input.q, [projects.title]),
   	overlapsAny(projects.tags, input.tags),          // any of (&&); add a GIN index
   	numberRange(projects.budget, input.budgetMin, input.budgetMax),
   	dateRange(projects.startedAt, input.from, input.to), // Nepal calendar days
   );
   ```

   Test every filter on PGlite, as in `tests/server/test-crud-repository.test.ts` ("listTestCrud filters").

3. **Route:**

   ```ts
   ...listSearch(projectRouteSearch, projectList.defaults),     // validateSearch, and defaults never appear in URLs
   loaderDeps: ({ search: { edit: _edit, ...list } }) => list,    // dialog params don't reload the list
   loader: (route) => listLoader(route, { tableId: PROJECTS_TABLE_ID, query: projectListQueryOptions }),
   ```

   `listLoader` (`src/lib/crud/route.ts`) is `loadList` over `tableListInput`: awaited when entering, prefetched when the search changes on the page.

   In the component, `useListPage` (`src/hooks/use-list-page.ts`) does the rest: it resolves the page size the same way as the loader (URL, then the user's saved choice for this table, then 20), reads the list, and returns the props for `<Pagination>`:

   ```tsx
   const { edit, ...listSearch } = getRouteApi("/_admin/admin/projects/").useSearch();   // UI-only params stay out of the list input
   const { input, page, busy, pagination } = useListPage({ tableId: PROJECTS_TABLE_ID, search: listSearch, query: projectListQueryOptions });
   …
   {page && pagination ? (
   	<>
   		<DataTable tableId={PROJECTS_TABLE_ID} rows={page.items} busy={busy} … />
   		<Pagination {...pagination} />
   	</>
   ) : <DataTableSkeleton columns={projectColumns.length} rows={8} />}
   ```

   An admin list renders all of that with `CrudListPage` (crud.md). Lists without a table (public card grids) read with `useListQuery(options)` directly and pass `busy` as `aria-busy`.

4. **Filters UI:** put the controls in `<FilterBar values={search} preserve={["sort", "pageSize"]}>` (see `features/test-crud/filters.tsx`). The chips come from chip specs: `defineFilters<ProjectSearch>([textChip("q", m.crud_search), choiceChip("status", …), eachChip("tags", …), rangeChip(["budgetMin", "budgetMax"], …), rangeChip(["from", "to"], …, dayValue)])`; `applied(search)` gives `<ActiveFilters>` and the empty state's `<ClearFiltersButton>` their chips and "Clear all". Labels are messages, called at render time.

**What you get without extra work:**
- server rendering;
- shareable URLs;
- Back/Forward through filter states;
- debounced typing that keeps focus;
- no pending screen while results load (the old rows dim);
- a working form and chips without JavaScript.

## Route masking: a record in a dialog over its list

The list's URL gets a param (`?edit=<id>`), while the address bar shows the record's own page (`/admin/test-crud/<id>`).

```tsx
// a link (see features/test-crud/components/masked-links.tsx)
<Link
	from="/admin/test-crud/" to="."
	search={(prev) => ({ ...prev, edit: id })}
	mask={{ to: "/admin/test-crud/$id", params: { id }, unmaskOnReload: true }}
/>

// the list route: `edit` in validateSearch (not in loaderDeps), and
{search.edit ? <EditDialog id={search.edit} /> : null}

// the dialog closes with
const close = useCloseOverlay({ edit: undefined }); // Back if possible, else removes the param
```

**Rules:**
- **Always `unmaskOnReload: true`.** The server only sees the masked URL, so after a reload the browser must render the same full page, or hydration fails.
- **The masked target must be a real route** that renders the record by itself. Reload, shared links, new tabs and no-JS clicks land there.
- **Load the dialog's data with `useQuery`** and an inline skeleton. Don't make the list's loader wait for it.
- **Saving closes the dialog** (`onSaved={close}`); invalidating the list queries refreshes the rows underneath.

## Path params

Validate them on the route, not in the loader:

```ts
params: { parse: (raw) => parseParams(z.object({ id: z.uuid() }), raw) },
```

`parseParams` returns `false` for invalid input, so the route doesn't match and the localized 404 is served with status 404. Loaders and components receive typed params.

## Tests to copy

- **`tests/unit/search.test.ts`:** params, serialization, form patches, time-zone day ranges.
- **`tests/components/filters/filter-bar.test.tsx`:** URL updates, debounce, chips, Clear all, the no-JS form.
- **`tests/components/navigation/route-masking.test.tsx`:** href, masked address, Back/Forward, reload, 404 for invalid params.
- **`tests/server/test-crud-repository.test.ts`:** each filter against Postgres.

## Live example

- **Search params + filters:** `/dev/examples/filters` (`src/routes/dev/examples/filters.tsx`), with `pnpm dev`.
- **Route masking:** `/dev/examples/masking` (`src/routes/dev/examples/masking/index.tsx`), with `pnpm dev`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Masked routes need `unmaskOnReload: true`.** Without it a reload keeps the mask from history state, so the client renders something the server didn't (a hydration error).
- **A numeric `?q=` is a number to the router:** TanStack Router JSON-parses search values, so `?q=123` reaches a `z.string()` search schema as `123` and falls back to its default. Links and forms the app builds quote it; hand-written URLs (e2e) should use text.
