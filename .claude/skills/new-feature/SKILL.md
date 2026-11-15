---
name: new-feature
description: Add a feature (an admin CRUD section, optionally with public pages) the standard way. Use when asked to add a feature, a section, a resource or a CRUD page.
argument-hint: "<name> [--public] [--localized]"
---

# A new feature

The one "add a feature" recipe is `docs/guides/crud.md`. Read it first. Test CRUD (`src/features/test-crud`, `src/server/test-crud`, `src/functions/test-crud.ts`) is the reference to copy.

## Steps

1. **Start from a committed tree** (`git status` clean). The generator refuses anything else and restores the tree if it fails.
2. **Generate:**

   ```bash
   pnpm new:feature <name> --title "Projects" --title-ne "परियोजनाहरू"   # an admin section
   pnpm new:feature <name> --public --localized                          # + public pages, text in both languages
   ```

   `<name>` is kebab-case and plural (`projects`, `event-logs`). The result passes every gate as generated: the table and its migration (`NNNN_core_<name>.sql`), `search.ts`, `schema.ts`, `keys.ts`, `queries.ts`, `collection.ts`, columns, filters, components, guarded functions, repository and service, thin routes, messages in both languages, stories, a PGlite test, and an entry in every shared list.
3. **Apply the migration:** `pnpm db:migrate` (or restart `pnpm dev:local`).
4. **Add your columns,** in this order, so each step type-checks against the last: the table (`src/server/db/schema/<name>.ts`), a migration (`pnpm db:generate --name core_<name>_<what>`), the input schema and DTOs (`schema.ts`), the repository, the form, the columns and filters, the messages (both files).
5. **Keep the `// @new-feature:<slot>` lines** in shared lists; the generator inserts above them.
6. **Check:** `pnpm standard` (no new deviation), then `pnpm gates`.

## Rules that the generator already follows, and you must keep

- The names: `<feature>Keys`, `<thing>QueryOptions`, `<feature>Mutations`, `<feature>Rows`, `<thing>Schema`; components `<name>-list.tsx`, `<name>-form.tsx`, `<name>-detail.tsx`, `<name>-pending.tsx`.
- Functions: `requirePermission("<name>:<action>")` then `withServices`, `zodInput(schema)`, one call into the service.
- Routes import `search.ts` statically and `queries.ts` inside the loader.
- Writes go through `useCrudMutation` and `useCrudForm`, optimistic over the feature's collection.

A module inside a product (`src/features/<product>/<module>`) has no generator yet (PLAN 15.3, Task 108a): copy a small module of that product, and follow `docs/guides/<product>.md`.
