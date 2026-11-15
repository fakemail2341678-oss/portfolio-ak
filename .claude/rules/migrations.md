---
paths:
  - "drizzle/**"
  - "src/server/db/schema/**/*.ts"
---

# Schema and migrations

Guide: `docs/guides/deployment.md` ("Every release"). The recipe: the `migration` skill.

- A schema change MUST come with its migration in the same commit: `pnpm db:generate --name <layer>_<what>`, where the layer is `core`, `apps`, `portfolio` or a product's name. CI fails when `drizzle-kit generate` would still produce one. There is no `db:push`.
- NEVER edit or rename a migration that has shipped. Fix forward with a new one.
- A table carries its layer's prefix (`TABLE_PREFIXES` in `scripts/standard/vocabulary.ts`; an app's tables start with the app's name); the core's tables have none. Columns are snake_case (the schema's `casing` does it).
- Add first, backfill, and drop in a later migration. A destructive change needs the owner's word.
- A new table that points at a product's person or user MUST be added to that product's merge and delete paths (the product's guide says where).
- After changing the schema: `pnpm db:check`, then the server tests of the feature.
