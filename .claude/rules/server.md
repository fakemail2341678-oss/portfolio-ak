---
paths:
  - "src/server/**/*.ts"
  - "src/routes/api/**/*.ts"
---

# Server code

Guides: `docs/guides/crud.md` ("Server"), `docs/guides/security.md`, `docs/guides/observability.md`. The reference: `src/server/test-crud/`.

- A module is a folder with `repository.ts` (SQL only, over an injected `Db` or `Tx`) and `service.ts` (rules, transactions, audit). NEVER `<thing>-repository.ts` or `<thing>-service.ts`.
- A service takes the call's services first (`update({ db, actor }: Services, input)`) and MUST resolve access before it reads or writes anything. The server is the authority; the UI only hides.
- A refusal MUST be an `AppError`: `new AppError(code, …)` or `ruleError(…)` from `src/lib/errors.ts`, `notFound(what)` from `src/server/db/crud.ts`. A broken invariant (an insert that returned no row) is `internalError(message)`. NEVER `throw new Error(…)`. What the database, Zod or another service throws is mapped in one place (`src/server/http/errors.ts`); don't catch it to rethrow a code by hand.
- A server route MUST be `defineApiRoute` (`src/server/http/api-route.ts`) or `defineCron` (`cron.ts`), a job's work a set of named steps. A call to another service MUST go through `createOutbound` (`outbound.ts`) with the service's base URLs, or `outboundCall` around an SDK.
- Repositories MUST use the helpers of `src/server/db/crud.ts` and `src/server/db/list.ts` (`listPage`, `findOrThrow`, `updateVersioned`, `uniqueViolation`, `withAudit`). Uniqueness is a constraint's job: insert, then map the violation; NEVER check first.
- Rows leave through DTO schemas (`xDetailSchema.parse(row)`); NEVER a hand-written mapper or `toISOString()`.
- Log with `log()` from `src/server/log.ts`, NEVER `console.*`. It redacts what looks like a secret, but NEVER log a token, a password or a secret on purpose. An error goes in as `errorFields(error)` (its cause chain; `{ stack: true }` only for a bug).
- Server-only code stays here or in `*.server.ts`. NEVER import a component, a hook, a route or a server function from server code.
- Money is integer minor units (`toMinor`, `formatMoney`); NEVER add floats.
- A changed table MUST come with its migration (the `migration` skill).
