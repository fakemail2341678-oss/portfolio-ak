---
paths:
  - "src/server/**/*.ts"
---

# Server code

Guides: `docs/guides/crud.md` ("Server"), `docs/guides/security.md`, `docs/guides/observability.md`. The reference: `src/server/test-crud/`.

- A module is a folder with `repository.ts` (SQL only, over an injected `Db` or `Tx`) and `service.ts` (rules, transactions, audit). NEVER `<thing>-repository.ts` or `<thing>-service.ts`.
- A service takes the call's services first (`update({ db, actor }: Services, input)`) and MUST resolve access before it reads or writes anything. The server is the authority; the UI only hides.
- A refusal MUST be an `AppError`: `new AppError(code, …)` or `ruleError(…)` from `src/lib/errors.ts`, `notFound(what)` from `src/server/db/crud.ts`. NEVER `throw new Error(…)` for something a user can cause.
- Repositories MUST use the helpers of `src/server/db/crud.ts` and `src/server/db/list.ts` (`listPage`, `findOrThrow`, `updateVersioned`, `uniqueViolation`, `withAudit`). Uniqueness is a constraint's job: insert, then map the violation; NEVER check first.
- Rows leave through DTO schemas (`xDetailSchema.parse(row)`); NEVER a hand-written mapper or `toISOString()`.
- Log with `log()` from `src/server/log.ts`, NEVER `console.*`. NEVER log a token, a password or a secret.
- Server-only code stays here or in `*.server.ts`. NEVER import a component, a hook, a route or a server function from server code.
- Money is integer minor units (`toMinor`, `formatMoney`); NEVER add floats.
- A changed table MUST come with its migration (the `migration` skill).
