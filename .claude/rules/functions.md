---
paths:
  - "src/functions/**/*.ts"
  - "src/middleware/**/*.ts"
---

# Server functions

Guide: `docs/guides/routing-data.md` and `docs/guides/crud.md` ("Server"). The reference: `src/functions/test-crud.ts`. The recipe: the `server-function` skill.

- A server function MUST be this literal chain, assigned to a `const` (Start extracts it statically):

  ```ts
  export const updateProject = createServerFn({ method: "POST" })
  	.middleware([requirePermission("projects:update"), withServices])
  	.validator(zodInput(projectUpdateSchema))
  	.handler(({ data, context }): Promise<ProjectDetail> => projects.update(context, data));
  ```

- Guards: `require<Who>` refuses, then `with<What>` provides, in that order. Use the words of `scripts/standard/vocabulary.ts` (`requirePermission`, `requireUser`, `requireDev`, `withServices`, `withPublic`, `require<Product>User`, `with<Product>Services`, `with<Product>Public`). A public function says so with `with…Public`.
- The name MUST start with a verb of the standard: `list`, `get`, `search`, `create`, `update`, `delete`, `set<Field>`, `add`, `remove`, `trash`, `restore`, `purge`, `reorder`, `is<Check>`, `import`, `export`, or a listed domain verb. NEVER `save`, `find`, `fetch`, `patch`, `toggle` or `mark`.
- A function that takes data MUST validate it with `.validator(zodInput(schema))`. Inputs are `z.strictObject`.
- The handler MUST be one call into a service in `src/server/**`, with an explicit return type. Logic NEVER lives in the handler.
- Every function MUST have its row in `tests/server/functions-guards.test.ts`; a product's function also in its access test.
- Writes are `POST`, reads are `GET`.
