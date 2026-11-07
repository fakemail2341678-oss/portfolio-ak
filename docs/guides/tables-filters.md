# Tables, filters and pagination

The shared list UI: `DataTable`, `FilterBar` with filter controls and chips, and `Pagination`. Feature code supplies only columns, filters and actions. Examples: `/dev/examples/data-table`, `/dev/examples/filters`; the full admin version is `CrudListPage` in `src/features/test-crud/components/test-crud-list.tsx` ([crud.md](crud.md)). The URL contract behind them is in [search-filters-masking.md](search-filters-masking.md).

## DataTable

```tsx
const columns = (): DataTableColumn<Thing>[] => [            // built at render time (locale)
	{ id: "title", header: m.things_title, sort: "title", cell: (row) => row.title, csv: (row) => row.title },
	{ id: "updated", header: m.things_updated, sort: "updated", hideable: true, cell: (row) => formatDate(row.updatedAt) },
];

<DataTable
	tableId="things"                       // key for saved preferences (hidden columns, page size)
	rows={page.items}
	columns={columns()}
	getRowId={(row) => row.id}
	getRowLabel={(row) => row.title}       // "Select …", "Actions for …"
	sort={search.sort}                     // sort headers are links: ?sort=title / -title, page reset
	busy={busy}                            // dims the rows while a new page loads
	toolbar={<FilterBar values={search} preserve={["sort", "pageSize"]}>{/* controls */}</FilterBar>}
	activeFilters={<ThingActiveFilters search={search} />}
	exportName="things"                    // "Export CSV": the rows on screen, columns with `csv`
	savedViews                             // "Views": named search strings, kept in this browser
	bulkActions={({ ids, clear }) => <Button onClick={() => remove(ids, clear)}>{m.delete()}</Button>}
	rowActions={(row) => [                 // data, not elements: the "…" menu and right-click
		{ id: "edit", label: m.edit(), permission: "things:update", render: (label) => <Link to="/admin/things/$id" params={{ id: row.id }}>{label}</Link> },
		{ id: "delete", label: m.delete(), permission: "things:delete", destructive: true, separated: true, onSelect: () => void askDelete(row) },
	]}
	empty={<EmptyState variant={filtered ? "no-matches" : "empty"} description={…} primaryAction={filtered ? <ClearFiltersButton clearAll={CLEAR} /> : <NewThingButton />} />}
/>
<Pagination {...pagination} />   // from useListPage: summary, rows-per-page picker (saved per table), prev/next
```

`page`, `busy` and `pagination` come from `useListPage({ tableId: "things", search, query: thingListQueryOptions })`; the loader uses `tableListInput` so both agree on the page size ([search-filters-masking.md](search-filters-masking.md)).

- **On TanStack Table v9** in manual mode (0169): it holds column visibility (the preferences cookie), selection and pinning. Sorting and paging stay URL links, so the whole table is in the HTML and works without JavaScript.
- **Toolbar:** `toolbar` (the FilterBar) on the left; on the right a button group with saved views, CSV export and the Columns menu, each only when it applies. `activeFilters` (the chips) go under it. The toolbar stays when the list is empty, so filters can be cleared.
- **Row actions** are `RowAction` objects: `onSelect`, or `render` for a link (it gets the label). An action with `permission` is left out for users without it, `hidden` leaves it out for one row, and the actions column disappears when no row has any. Right-clicking a row opens the same menu (non-modal, like the "…" menu).
- **Selection** is local to the page; the bulk bar appears when rows are selected.
- **Long pages** (more than 15 rows) scroll inside a focusable frame under a sticky header. On phones the first column (and the checkboxes) stay pinned while the table scrolls sideways.
- **Wide tables of plain text** (no link or button in the rows, e.g. a column per survey question): pass `scrollRegion` so the frame is a labelled tab stop and keyboard users can scroll it sideways (axe: scrollable-region-focusable).
- **Grouped rows:** `groupOf(row) => { id, label }` draws a heading row (`<th scope="rowgroup">`) before each run of rows of one group, each run its own `<tbody>`. The server sorts by the group first, so a page's rows of one group are together (Taskline's list, `?group=status|assignee`, 0211).
- **Density** follows the preference: cells use `--row-padding`.
- **Destructive actions** confirm with `useConfirm()` (`components/dialogs/confirm.tsx`; focus starts on Cancel).
- **Column resizing and row expansion** aren't built in: see [recipes.md](recipes.md), "Resizable columns and expandable rows".
- **Writes:** plain mutations followed by invalidating the list queries, or a TanStack DB collection for instant feedback with rollback ([state.md](state.md)).
- **Columns in a feature file:** `features/<name>/columns.tsx`, a constant (a factory only when they depend on something, like the users list's signed-in user). The name column is a `RecordLink` (a link for users who may open it). Don't build cells inline in the route.
- **A whole admin list** is `CrudListPage` ([crud.md](crud.md)): header, `FilterBar` and chips, the table, pagination, the empty states and confirmed deletes. Its chips come from chip specs (`defineFilters`, `src/lib/crud/filters.ts`): `textChip`, `choiceChip`, `eachChip`, `rangeChip`, `flagChip`.
- **Loading:** `DataTableSkeleton` for the pending component, `busy` for a new search.

## Filters

```tsx
<FilterBar values={search} preserve={["sort", "pageSize"]}>
	<SearchFilter label={m.things_search()} value={search.q} />
	<SelectFilter name="status" label={m.things_status()} value={search.status} options={statusOptions} />
	<MultiSelectFilter name="tags" label={m.things_tags()} value={search.tags} options={tagOptions} />
	<NumberRangeFilter label={m.things_price()} names={["priceMin", "priceMax"]} value={[search.priceMin, search.priceMax]} />
	<DateRangeFilter label={m.things_published()} names={["from", "to"]} value={[search.from, search.to]} />
	<BooleanFilter name="hasImage" label={m.things_image()} value={search.hasImage} />
</FilterBar>
<ActiveFilters {...thingFilters.applied(search)} />   // defineFilters([textChip("q", …), choiceChip("status", …), …])
```

- **`FilterBar` is a GET form of native controls:** without JavaScript it submits to the URL. With JavaScript it updates the URL as you type (debounced) or change a control, resets the page, and keeps the params in `preserve`.
- **Chips:** one per applied filter, each with the search change that removes it, from chip specs next to the controls (`features/<name>/filters.tsx`, `defineFilters`): `textChip`, `choiceChip` (none while "all"), `eachChip` (one per value), `rangeChip` (either end), `flagChip` (yes/no).
- **Every filter value** is a search param parsed by the route's schema; invalid values are corrected, never errors.

## Pagination

`Pagination` builds page links from the URL, so it works without JavaScript. Disabled steps are plain text. `hideWhenSingle` hides it for one page, and `pageSize` adds a rows-per-page picker saved in the table's preferences. The server clamps the page to the last one.

## Public lists

Use the same pieces with `PageHeader size="display"`, a card grid and `Pagination layout="center"`, plus `listSeo()` in `head` ([seo.md](seo.md)). `/dev/test-crud` and `/dev/stack` are the examples (dev-only, so their heads are private; a public list uses `listSeo()` and goes in the sitemap).
