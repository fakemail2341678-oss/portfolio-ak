# CRUD: building a feature

The one way to build an admin section (decision 0173). Test CRUD, users, roles, the permission matrix and the audit log follow it, and `pnpm new:feature` generates it. Start there:

```bash
pnpm new:feature projects --title "Projects" --title-ne "परियोजनाहरू"   # an admin section
pnpm new:feature pages --public --localized                              # + public pages, text in both languages
```

- **What it writes:** the table and its migration, everything below, messages in both languages, stories with their mocks, a PGlite test, and an entry in every shared list (permissions, audit actions, sidebar, palette, guard test, e2e pages, and for `--public` the sitemap and route-SEO test).
- **`--public`:** a slug and a "published" switch, plus public list and detail pages under `_public` (`listSeo()`/`seo()`, in the sitemap), read without signing in.
- **`--localized`:** the title and notes are `{ en, ne }` (`LocalizedField`), searched in both languages and shown in the reader's.
- **Its rules:** it refuses to run with uncommitted changes to tracked files, and puts the tree back if anything fails (decision 0175).

The result passes every gate as generated. Then add your columns: the table, the input schema, the DTOs, the form, the columns, the messages.

## The shape

```
src/features/<name>/             search.ts      the URL contract (route files import only this, 0151)
                                 schema.ts      inputs (strict), DTO schemas, form values
                                 keys.ts        Query keys (createCrudKeys)
                                 queries.ts     queryOptions (reads) + mutationOptions (writes)
                                 columns.tsx    DataTable columns     filters.tsx  controls + chip specs
                                 labels.ts      enum labels           commands.ts  palette actions
                                 components/    <name>-list, <name>-form, <name>-detail, <name>-pending
src/functions/<name>.ts          createServerFn → requirePermission, withServices → validator → one service call
src/server/<name>/               repository.ts (Drizzle over an injected Db) + service.ts (rules, audit, versions)
src/routes/_admin/admin/<name>/  route.tsx, index.tsx, new.tsx, $id.tsx: literal createFileRoute objects
```

The shared pieces: `src/lib/crud/` (keys, schema, filters, route helpers), `src/components/crud/` (`CrudListPage`, `useCrudMutation`, `useCrudForm`/`CrudForm`, `NewButton`, `RecordLink`), `src/server/db/crud.ts` (repository helpers), `src/middleware/services.ts` and `src/server/services.ts` (what a handler hands to its service). They are React-free where they can be: route helpers in `src/lib/crud/route.ts` (routes only, it needs the Start runtime), components in `src/components/crud/`.

## URL contract (`search.ts`)

```ts
export const projectList = listSchema({
	sorts: ["-updated", "updated", "title", "-title"],          // the first is the default
	filters: { status: enumParam(["all", ...PROJECT_STATUSES], "all") },
});
export type ProjectSearch = z.output<typeof projectList.search>;
export type ProjectListInput = z.output<typeof projectList.input>;
```

`listSchema` adds `q`, `sort`, `page` and `pageSize` and returns the `search` schema (the route's `validateSearch`: forgiving, unknown keys such as utm tags are dropped), the list function's `input` (strict, page size resolved), the `defaults` (kept out of links) and the `filterKeys`. A route search with UI-only params extends it (`projectList.search.extend({ edit: … })`) and removes them in `loaderDeps`.

## Schemas and DTOs (`schema.ts`)

- **Inputs are `z.strictObject`:** an unknown key is a BAD_REQUEST. One schema for the form and the server function; the update schema extends it with `id` and `updatedAt: versionSchema()` (0122).
- **DTOs are schemas too:** the repository parses its rows with them. `isoDateTime()` (a `z.codec`) turns a row's Date into the ISO string on the wire, and fields the DTO doesn't name are left out, so there are no hand-written mappers and no `toISOString()`. The type is `z.output<typeof projectListItem>`.
- **Shared pieces:** `idSchema` (`{ id }`: a function's input and a `$id` route's params), `bulkIdsSchema()`, `slug()`, `localizedText()` and `required()`/`optionalText()` from `src/lib/validation.ts`.

## Server

```ts
// src/functions/projects.ts: thin, literal (Start extracts server functions statically)
export const updateProject = createServerFn({ method: "POST" })
	.middleware([requirePermission("projects:update"), withServices])
	.validator(zodInput(projectUpdateSchema))
	.handler(({ data, context }): Promise<ProjectDetail> => projects.update(context, data));
```

- **Order:** `requirePermission` first (the guard test checks it), then `withServices`, which adds `context.db`, `context.actor` (the one `Actor` type, `features/rbac/types.ts`) and `context.imageStore`. Public reads use `withPublicServices` (no actor).
- **Names:** `listX`, `getX`, `createX`, `updateX`, `deleteX`, `setXStatus`, with explicit return types. Services are called through their module (`projects.update`) and take the call's services first: `update({ db, actor }: Services, input)`. Tests pass their own (`{ db, actor: { id, isAdmin, permissions }, imageStore: null }`).
- **Repository helpers** (`src/server/db/crud.ts`), one rule each:

  | Helper | Rule |
  | --- | --- |
  | `listPage(db, table, { input, where, sort, map })` | count, clamp the page, read it in `sort` order (the id breaks ties), `map` the page's rows in one go |
  | `findOrThrow(db, table, id, what)`, `notFound(what)` | a missing record is NOT_FOUND |
  | `updateVersioned(tx, table, { id, version, set, what })` | the version is checked in the UPDATE's WHERE; zero rows is NOT_FOUND or a stale CONFLICT. No separate lock |
  | `uniqueViolation(error, { constraint: { field, message } })` | insert or update, then map the violation to a field error; never check first (it races) |
  | `isValueFree(db, table, column, value, exceptId)` | the form's check while typing (the save still relies on the constraint) |
  | `uniqueSlug(tx, table, column, base, reserved)` | `base`, `base-2`, `base-3`… (role keys) |
  | `withAudit(db, actor, (tx, audit) => …)` | the transaction, and the audit rows the change reports, in it |

- **Audit:** every change of admin data and content is audited, creates and edits too (0173 widens 0132). Edits record `changes(before, after, compared, recorded)`: only the fields that changed, long ones (a body) counted but not copied; an unchanged save records nothing.

## Routes

```ts
export const Route = createFileRoute("/_admin/admin/projects/")({
	...listSearch(projectList.search, projectList.defaults),
	loaderDeps: ({ search }) => search,
	loader: (route) => listLoader(route, { tableId: PROJECTS_TABLE_ID, query: projectListQueryOptions }),
	head: titleHead(m.projects_title),
	pendingComponent: ProjectsPending,
	component: ProjectList,
});
// $id.tsx
loader: async ({ context, params }) => ({ title: (await loadDetailOr404(context.queryClient, projectDetailQueryOptions(params.id))).title }),
```

- **Literal route objects:** helpers fill `search`, `loader` and `head` only; `component` and `pendingComponent` are written in the object so the router splits them out (0151).
- **Components read the URL with `getRouteApi("/_admin/admin/projects/")`,** never by importing the route file.
- **Section layout** (`route.tsx`): `assertRoutePermission` for the read permission and the breadcrumb.

## List page

```tsx
<CrudListPage
	title={m.projects_title()} description={m.projects_description()} actions={<NewProjectButton />}
	tableId={PROJECTS_TABLE_ID} list={useListPage({ tableId, search, query: projectListQueryOptions })}
	columns={projectColumns} getRowLabel={(row) => row.title} search={search}
	filters={{ controls: <ProjectFilterControls search={search} />, ...projectFilters.applied(search) }}
	rowActions={(row) => [{ id: "edit", label: m.crud_edit(), permission: "projects:update", render: … }]}
	remove={{ permission: "projects:delete", run: (ids) => remove.mutateAsync(ids) }}
	empty={{ description: m.projects_empty(), filtered: m.projects_empty_filtered(), action: <NewProjectButton /> }}
/>
```

- **It renders:** the header, `FilterBar` and the chips, the DataTable, `Pagination`, the empty state (nothing yet, or nothing matching with "Clear filters"), and for `remove` a Delete row action and "Delete selected", each confirmed (`useConfirm`) and toasted with the shared messages. A short list read whole passes `list={{ rows }}` (roles).
- **Filters:** `defineFilters<ProjectSearch>([textChip("q", m.crud_search), choiceChip("status", label, text), eachChip, rangeChip, flagChip])`. Each spec makes the chip of one applied filter; their keys are what "Clear all" resets.
- **Columns:** a constant (a factory only when they depend on something: the users list marks the signed-in user). The name column is a `RecordLink` (a link for users who may edit, text for the rest).
- **"New":** `NewButton` (`to`, `permission`); the pending component reuses it.

## Writes

```ts
const remove = useCrudMutation(projectMutations.delete(), {
	invalidate: [projectKeys.all],
	optimistic: { queryKey: projectKeys.lists(), update: withoutRows<ProjectListItem> },
});
```

- **`mutationOptions` live in `queries.ts`** (a key and the server function). `useCrudMutation` adds the rest: with `optimistic`, it cancels the lists' reads, patches **every cached page** (`patchRow`, `withoutRows`, `onRows`) and restores the snapshot on failure; afterwards it invalidates `invalidate`; a failure is the shared "nothing was changed" toast, a stale CONFLICT offers a reload.
- **Query mutations for admin CRUD; TanStack DB for client-first apps** (Taskline's board, Habits, Notes), where live queries and optimistic transactions pay off (decision 0174).

## Forms

```tsx
const crud = useCrudForm({
	item, toInput: (values) => projectInputSchema.parse(values),
	create: projectMutations.create(), update: projectMutations.update(),
	invalidate: [projectKeys.all], reload: item && projectKeys.detail(item.id),
	onSaved: () => navigate({ to: "/admin/projects" }),
});
const form = useAppForm({ ...projectFormOptions(item), ...crud.formProps });
return <CrudForm form={form} crud={crud}>…fields, StickyFormBar…</CrudForm>;   // rendered with key={crudFormKey(item)}
```

- **`formOptions` per feature** (default values from the record, `formValidators(schema)`); `withForm` sections share it (Test CRUD's details section).
- **`useCrudForm`** saves through the mutations (an edit sends `id` and `updatedAt`), puts server field errors on their fields, turns a stale CONFLICT into `StaleVersionAlert`, toasts, calls `onSaved`, then refreshes `invalidate`.
- **Reload, one way:** "Reload" refetches the record's query (`reload`); the record's new version changes `crudFormKey(item)`, which remounts the form with fresh defaults. A dialog reads its record from the list's cache by id for the same reason (roles, users).
- **Page or dialog:** `CrudForm` (guard, `<form>`, stale alert, error summary) on a page; `FormDialog` with `stale={crud.stale}` in a dialog.
- **As you type:** `slugValidators` (follows its source field) and `availabilityValidators` (an email that's taken) run debounced server checks; the save still checks.
- **Masked dialogs** that load their record use `QueryDialog` (loading, error, then the content).

## Permissions

`useCan` and `<Can>` are the only checks in UI code; rules that compare two people's permissions use `canGrant(actor, permissions)` on both sides (`features/rbac/types.ts`). Every new permission goes in the catalog with its label; the matrix groups resources under the sidebar's groups. The section itself is an `ADMIN_SECTIONS` entry (sidebar, palette), and its actions go in `features/<name>/commands.ts`.

## Tests and the gates

A PGlite service test per feature (create, list, a stale edit, delete, the audit rows), the function file in `tests/server/guarded-functions.test.ts`, every page in `e2e/support/pages.ts` and, if public, in `tests/unit/route-seo.test.ts`. The generator writes all of these.

## Pitfalls already solved

- **Strict inputs, forgiving URLs:** never `z.strictObject` for `validateSearch` (links carry utm tags); a list input is strict, so remove UI-only params (`edit`) before using the search as the input.
- **`requirePermission` first:** `withServices` goes after it, so a refused call builds nothing; the guard test's regex allows exactly that.
- **Optimistic updates patch every cached page** (`queryKey: keys.lists()`), or another page shows a deleted row.
- **A route `loader` is a function of the route context** (`(route) => listLoader(route, …)`): passing the helper's result directly loses the loader deps' inferred type.
- **Uniqueness is the constraint's job:** a unique index (`role_name_lower_unique`, a slug's `…_slug_unique`) and `uniqueViolation`; the typing-time check is a courtesy.
- **Better Auth's `timestamp` columns have no time zone:** `sameVersion` compares them in UTC, which is how Drizzle writes and reads them.
- **Admin writes are Query mutations** (`useCrudMutation`, 0174): optimistic updates patch every cached list page (`keys.lists()`). TanStack DB is for client-first apps; don't add collections to admin lists.
