---
name: server-function
description: Add or change a server function (createServerFn) the standard way, with its guard, validator, service call and test rows. Use when adding an endpoint, an action, a read or a write on the server.
---

# A server function

Guides: `docs/guides/routing-data.md`, `docs/guides/crud.md` ("Server"), `docs/guides/rbac.md`. The reference: `src/functions/test-crud.ts` with `src/server/test-crud/`.

## Steps

1. **Name it** with a verb of the standard and the thing: `list`, `get`, `search`, `create`, `update`, `delete`, `set<Field>`, `add`, `remove`, `trash`, `restore`, `purge`, `reorder`, `is<Check>`, `import`, `export`. A domain verb only when none of those says it; a new one is added to `DOMAIN_VERBS` in `scripts/standard/vocabulary.ts` with a line in a decision.
2. **Write the input schema** in the feature's `schema.ts`: `z.strictObject`, named `<thing>InputSchema` (an update extends it with `id` and `updatedAt: versionSchema()`).
3. **Write the service** in `src/server/<feature>/service.ts` (SQL in `repository.ts`). It takes the call's services first, resolves access before anything else, refuses with an `AppError` helper, and returns a DTO parsed by its schema.
4. **Write the function** in `src/functions/<feature>.ts` (a product: `src/functions/<product>/<module>.ts`), as a literal chain:

   ```ts
   export const setProjectStatus = createServerFn({ method: "POST" })
   	.middleware([requirePermission("projects:update"), withServices])
   	.validator(zodInput(projectStatusUpdateSchema))
   	.handler(({ data, context }): Promise<ProjectDetail> => projects.setStatus(context, data));
   ```

   `require…` first, then `with…`. A product uses its own pair (`require<Product>User`, `with<Product>Services`); a public read uses `withPublic` (or `with<Product>Public`).
5. **Add the test rows:** the function in `tests/server/guarded-functions.test.ts`; in a product, its operation in the product's access test (`tests/server/<product>-access.test.ts`). A new permission goes in the catalog (`src/features/rbac/permissions.ts`) with its labels in both languages.
6. **Call it from the client** through `queries.ts`: a read as `<thing>QueryOptions`, a write as an entry of `<feature>Mutations`, used with `useCrudMutation` or `useCrudForm`.
7. **Test the service** on PGlite (`tests/server/<feature>-….test.ts`): the happy path, a refusal, and for an edit a stale version.
8. **Check:** `pnpm standard`, then `pnpm gates`.

## Never

- Logic, a second statement or a `try` in the handler: it belongs in the service.
- A function built by a helper: `createServerFn(…)` must be literal in the file.
- A protected function without `requirePermission` (or the product's `require…User`) first.
- A write that tells someone, or moves money, outside its transaction: follow the product's guide (notifications are produced in the transaction and delivered after it commits).
