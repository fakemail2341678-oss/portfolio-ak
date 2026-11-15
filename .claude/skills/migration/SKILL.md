---
name: migration
description: Change the database schema with a migration the standard way. Use when adding or changing a table, a column, an index or a constraint.
---

# A schema change

Guide: `docs/guides/deployment.md` ("Every release"). Tables live in `src/server/db/schema/` (a product's in its own folder); migrations in `drizzle/`.

## Steps

1. **Edit the table** in `src/server/db/schema/…`. A new table carries its layer's prefix (`TABLE_PREFIXES` in `scripts/standard/vocabulary.ts`; the core's tables have none). Columns are camelCase in TypeScript and snake_case in SQL (the schema's `casing`). A new file is exported from the schema index, above its `// @new-feature:schema` line where there is one.
2. **Generate the migration,** named after the layer whose tables it changes:

   ```bash
   pnpm db:generate --name <layer>_<what>      # core_projects, taskline_labels, kharcha_budgets
   ```

   The layer is `core`, `apps`, `portfolio` or a product's name. Read the SQL it wrote.
3. **Keep it safe to deploy:** add first, backfill in the same or a later migration, drop in a later release, so the version still running keeps working. A destructive change (a dropped column or table, a narrowed type) needs the owner's word.
4. **Never edit or rename a migration that has shipped** (anything already on `main`). Fix forward with a new one.
5. **Apply and check:** `pnpm db:migrate` (or restart `pnpm dev:local`), then `pnpm db:check`. The tests' PGlite snapshot is rebuilt from `drizzle/` on the next run.
6. **Update what reads the table:** the repository and its DTO schema, a product's merge and delete paths when the table points at its people, and the seeds if they fill it.
7. **Check:** `pnpm standard`, then `pnpm gates` (a change under `drizzle/` runs the whole test suite).

There is no `db:push`: CI fails when `drizzle-kit generate` would still write a migration.
