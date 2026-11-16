# Routing, data loading and server functions

The SSR pattern every page follows, how server functions are written, and how errors travel. Examples: `/dev/examples/loader-query`, `/dev/examples/streaming`, `/dev/examples/errors`.

## Routes

- **Layouts by section** (`src/routes/`), each rendering its own header (the root renders none, 0161):
  - `_site`: the portfolio at `/` (`/work`, `/about`, `/journal`, `/contact`), with its own header and footer. It skips the session lookup (`staticData.session: "skip"`). <!-- @portfolio -->
  - `dev`: `/dev`, the demo home, `/dev/stack`, the public Test CRUD pages (`/dev/test-crud`), `/dev/forms` and `/dev/examples`. A 404 unless `DEV_ROUTES` (`vite dev`, or a build with `VITE_DEV_ROUTES=true`, which only the e2e harness makes; 0162). Never indexed.
  - `_public`: pages anyone may open that belong to no section (health, verify email, reset password; 0046). Public pages you add go here.
  - `_auth`: sign-in pages; signed-in users are sent on.
  - `_authed`: needs a session.
  - `_admin`: the admin area; the server is asked on entry, and any permission opens it.
- **A new layout renders its header:** `<SiteHeader links={…} />` (`components/layout/site-header.tsx`: the brand, its section links, Admin when permitted, account or sign-in, language and theme), or its own. The root only renders the skip link, banners and toasts, so a page under a layout without one has no header.
- **Skipping the session:** the root `beforeLoad` looks the session up for every navigation (memoized per request, 0153). A section that never reads it sets `staticData: { session: "skip" }` on its layout (`src/lib/session-scope.ts`): `context.session` is then `null`, and root-mounted readers of the session query pass `enabled: !useSessionSkipped()`, or the browser fetches it after hydration. Navigating on to another section looks it up again.
- **Locales:** routes are defined once. The router rewrites `/ne/…` onto them and back (`src/router.tsx`, Paraglide's URL strategy).
- **A section's `route.tsx`** names its breadcrumb (`staticData: { breadcrumb: staticCrumb(m.x) }`). Detail routes use `loaderTitleCrumb`, with the loader returning `{ title }`.
- **Path params** are validated by the route (`params: { parse: (raw) => parseParams(schema, raw) }`). An invalid one doesn't match, so the localized 404 renders without a request (0092).
- **Search params:** see [search-filters-masking.md](search-filters-masking.md).

## Loading data (SSR without refetching)

```ts
export const Route = createFileRoute("/_public/things/$id")({
	loader: async ({ context, params }) => {
		const thing = await ensureQuery(context.queryClient, thingQueryOptions(params.id));
		return { title: thing.title }; // only what head/staticData need
	},
	head: ({ loaderData }) => seo({ title: loaderData?.title, … }),
	component: ThingPage,
});

function ThingPage() {
	const { id } = Route.useParams();
	const { data } = useSuspenseQuery(thingQueryOptions(id)); // from the dehydrated cache
}
```

- **Query client:** one per request on the server, one per tab in the browser (`src/lib/query.ts`). `staleTime` is 60 s, so hydration doesn't refetch. App errors (4xx) aren't retried.
- **Loader data:** keep it small. The item already travels in the Query cache; returning it again sends it twice.
- **Lists:** `loadList(queryClient, options, cause)` in the loader and `useListQuery(options)` in the component. A new search on the same page keeps the old rows on screen, marked busy, instead of showing a pending screen (0089).
- **Streaming:** return a promise without awaiting it (`return { stats: getStats() }`) and render it with `<Await promise fallback>`. Reserve the result's height in the fallback.
- **No first-paint fetching in effects.** If the page needs it, the loader loads it.
- **The session is looked up once per request** (0153): the root `beforeLoad`, the admin gate and every server function called while rendering share one result (`requestMemo` in `src/server/http/request-scope.ts`). Calling `getSession` or `requirePermission` again in the same request costs nothing.

## What lands in every page's JavaScript

The router splits `component`, `pendingComponent`, `errorComponent` and `notFoundComponent` into their own chunks (0151). Everything else in a route's options (`validateSearch`, `params`, `loader`, `beforeLoad`, `head`, `staticData`) and everything those import is part of the entry chunk, for every page. So:

- **Route files import a feature's URL contract from `search.ts`**, never `schema.ts`: form schemas pull in rich-text and phone validation (Test CRUD's `search.ts` is the example).
- **Route helpers** (`src/lib/crud/route.ts`, routes only): `listSearch`, `listLoader`, `loadDetailOr404` (the record or the localized 404) and `titleHead` fill a route's options; the object stays a literal `createFileRoute("…")({ … })` with its `component` in it ([crud.md](crud.md)). Feature components read their route's search and params with `getRouteApi("<route id>")`, never by importing the route file.
- **Structural sharing is on** (`defaultStructuralSharing` in `src/router.tsx`): what `useSearch`, `useParams` and `useLoaderData` select keeps its identity while unchanged. A `select` must return JSON-like data (TypeScript checks).
- **Keep route options inline** in `createFileRoute("…")({ … })`. The splitter only moves inline properties: a component or skeleton returned by a helper or spread in stays in the entry chunk.
- **Load rarely used libraries on demand** (`await import("…")`), as the sign-out button does with the auth client.
- `node scripts/check-bundle.ts` (after `pnpm build`, and in CI) prints what every page loads and fails over budget.
- **Lazy imports' preload lists leave out what the entry already loads** (`vite/entry-preloads.ts`, 0291): Vite named each list's files in the entry's `__vite__mapDeps`, and most began with React, the router and Query, which every page has loaded before any lazy import runs. Dropping them took 4.3 kB gzip off every page.

## Server functions

```ts
export const updateThing = createServerFn({ method: "POST" })
	.middleware([requirePermission("things:update")])
	.validator(zodInput(thingUpdateSchema))
	.handler(({ data, context }) => updateItem(db, data, { userId: context.user.id }));
```

- **Thin:** the middleware checks the permission, `zodInput` validates with the shared schema (field errors come back keyed by field), and the handler is one call into `src/server/**`. Logic lives there, where tests run it on PGlite.
- **Every protected function** runs `requirePermission` first, and `tests/server/functions-guards.test.ts` lists each function with its permission ([rbac.md](rbac.md)). Use `requireUser` for "any signed-in account" (it refuses guests, 0185), `requireAppsUser` for the showcase apps (guests included) and `requireDev` for `/dev` helpers.
- **Global function middleware** (`src/start.ts`): it sends the page locale as a header (so `m.*` and `getLocale()` work inside handlers), passes on the request's id (`context.requestId`, the same as the `x-request-id` header, 0123), logs one JSON line per call, gives the call `REQUEST_TIMEOUT_MS` (30 s; then `TIMEOUT`), and turns whatever it throws into the envelope (0300).
- **Runtime:** server functions run only inside Start. Test the plain functions they call, not the wrappers. `tests/server/functions-contract.test.ts` runs every function's real middleware chain without its handler: anonymous is `UNAUTHORIZED`, a guest `UNAUTHORIZED` where an account is needed, no role `FORBIDDEN`, bad input `VALIDATION` with field errors, each in the envelope with the request's id.

## The request (0300)

`src/server/http/request-scope.ts` opens one scope per request: in the server entry for pages and functions, in `defineApiRoute` for a route (inside a page request's scope, a route joins it).

- **What it holds:** the id (`x-request-id`), the user once the session is resolved (`setRequestUser`), the locale, the start time, and a memo for work every part of the request would repeat (the session, 0153).
- **`Server-Timing`:** every response says how long it took (`total`) and what took the time: `session`, `fn;desc=<name>`, each call out (`tmdb`, `lichess`…). Add a part with `timed(name, work)` or `recordTiming(name, ms)`; at most 12 are named.
- **Slow requests:** past `SLOW_REQUEST_MS` (2 s; 0 turns it off) the request leaves a `slow request` line with its method, path (never the query), status and parts.
- **Timeouts:** a function or a route that takes longer than `REQUEST_TIMEOUT_MS` (30 s; 0 turns it off; keep it under the host's limit) answers `TIMEOUT` (504). The work isn't stopped, only no longer waited for, which ids and versions make safe to send again. Streams and jobs say `timeoutMs: false`.

## Errors

One envelope (0300): `code`, `reason`, `message`, `fieldErrors`, `requestId`. A function sends it as an `AppError` (the serialization adapter rebuilds the class in the browser); a route sends the same fields as problem JSON (`application/problem+json`, RFC 9457, with `type`, `title` and `status`).

| Code | Status | When |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | a well-formed request the rules refuse (a value the database refuses, a body over its limit) |
| `VALIDATION` | 422 | the input failed its schema; `fieldErrors` says where (`_` is the whole input) |
| `UNAUTHORIZED`, `FORBIDDEN` | 401, 403 | no session (or a guest where an account is needed); no permission |
| `NOT_FOUND`, `METHOD_NOT_ALLOWED` | 404, 405 | no such row or route; a route asked with another method (`Allow` says which) |
| `CONFLICT` | 409 | taken, changed since read (`reason: "stale"`), or a lost race (`reason: "retry"`: nothing was written, send it again) |
| `RATE_LIMITED` | 429 | too many; a route adds `Retry-After` |
| `INTERNAL` | 500 | a bug: the message is only "Internal error" |
| `UPSTREAM_UNAVAILABLE`, `TIMEOUT` | 503, 504 | a service or the database failed; the work took too long |

A status of 500 or more is an **unknown** outcome (the write may have happened), anything below it a **refusal** (`isRefusal(error)`, PLAN 15.6).

- **Throw `AppError(code, devMessage, { fieldErrors })`** for expected failures. User-facing text is picked on the client by code (`errorMessage(error)`). `fieldErrors` hold localized messages for form fields; `ruleError(code, dev, user)` makes a whole-form message; `staleError(what)` is the `CONFLICT` for an edit that started from an older version (`reason: "stale"`, see [forms.md](forms.md)).
- **A broken invariant** (an insert that returned no row) is `internalError(message)`: `INTERNAL` for the caller, its message and stack in the log. Never `throw new Error` in server code (the standard's `bare-error`).
- **What others throw is mapped in one place** (`toAppError`, `src/server/http/errors.ts`): Zod is `VALIDATION`; Postgres' SQLSTATE, anywhere in the cause chain, is `CONFLICT` (23505 unique, 23503 foreign key, 40001/40P01 `reason: "retry"`), `BAD_REQUEST` (23502, 23514, 22xxx), `TIMEOUT` (57014) or `UPSTREAM_UNAVAILABLE` (08xxx, 53300, 57P0x, a refused connection); a call out that failed (`UpstreamError`) is `UPSTREAM_UNAVAILABLE`; Better Auth's `APIError` keeps its status. A repository still maps the unique constraints it knows onto their form fields first (`uniqueViolation`).
- **Logged once:** a bug at `error` with its stack and sent to Sentry with the request id; a mapped error at `warn` with its cause chain; a refusal the code meant only in the function's own `server-fn` line.
- **Over HTTP**, a server-function error is a 200 with a serialized payload (`x-tss-serialized`). Look for the code in the body.
- **In loaders:**
  - `throw notFound()` for missing records, which renders the localized 404.
  - For an `AppError`, call `await setErrorStatus(error)` before rethrowing, so the SSR response carries 403/404 instead of 500.
  - The route's error component is `ErrorPage`; `src/client.tsx` doesn't log expected errors.
- **In actions:** catch where they happen. Use `handleSaveError(form, error, onStale?)` for forms, otherwise a toast with `errorMessage(error)`.

## Server routes and jobs (0300)

A route outside the client route tree is a Nitro route (`src/server/routes`, registered in `vite.config.ts`) or a Start route under `src/routes/api`. Either is written with `defineApiRoute` (`src/server/http/api-route.ts`); the standard's `server-route` rule refuses anything else.

```ts
export default defineApiRoute({
	name: "chaal-stream",          // the log line's `route`
	methods: ["GET", "POST"],      // 405 with Allow for any other
	auth: "optional",              // "public" (default) | "optional" | "session" (guests too) | "user" (an account): 401
	sameOrigin: true,              // a POST, PUT, PATCH or DELETE from our own pages only: 403
	rateLimit: { max: 20, windowSeconds: 60 }, // per user or client address, in Postgres: 429 + Retry-After
	bodyLimit: 2_048,              // `text()` and `json()` refuse more: 400; `json()` refuses what isn't JSON: 422
	timeoutMs: false,              // a stream; REQUEST_TIMEOUT_MS by default
	handler: async ({ request, url, user, locale, json }) => …,
}).nitro;                          // a Start route: server: { handlers: defineApiRoute({ … }).handlers }
```

- **In this order:** the request's scope, the secret (`secret: () => env.X`: unset is 404, another token 401, compared in constant time), the method, the origin, the session, the rate limit, the body, then the handler under its deadline. What any of them throws is problem JSON with the envelope, and every request leaves one `api-route` log line with its status and time.
- **Jobs** are `defineCron({ name, steps })` (`src/server/http/cron.ts`): `Authorization: Bearer $CRON_SECRET` (unset: 404), one run at a time on every instance (a lease in the `rate_limit` table; a second request answers `{ ok: true, skipped: "running" }`, a lease older than 15 minutes is taken over), and named steps, each timed and on its own: one that throws is logged with its stack and sent to Sentry, the others still run, and the run answers 500 with `ok: false`. The answer is `{ ok, ms, timings, <step>: { ok, … } }`. A product's job exports its steps (`kharchaCronSteps(db)`), and `run<Product>Cron` runs them for its tests.
- **Tests:** `tests/server/api-route.test.ts` and `cron.test.ts` for the helpers; `tests/server/routes.test.ts` calls every route with the wrong method, without its secret and with bad input.

## Calls out (0300)

Every call to another service goes through `createOutbound` (`src/server/http/outbound.ts`): TMDB, Lichess, Cloudinary, Turnstile and PostHog get their `fetch` from it, and Resend's SDK call is wrapped in `outboundCall`.

- **Its hosts only:** a URL outside the service's base URLs is refused before anything is sent, and a redirect is an error, so nothing a user types can point a call at another machine.
- **A timeout** (8 s by default, the whole answer; a stream's head only, with `outbound: { stream: true }`), joined with the caller's own signal.
- **Retries** for a GET or a HEAD answered 429 or 5xx (`retries`, 1 by default), waiting what `Retry-After` asks (capped at 10 s) or backing off from 200 ms. A write is sent once, a timeout isn't tried again.
- **A size cap** (5 MB by default) on the answer's body, declared or streamed.
- **One log line** (`outbound`: service, method, path, status, time, attempts) and a `Server-Timing` part; never a header, a query string or a body. A failure throws `UpstreamError`, which the error mapper makes `UPSTREAM_UNAVAILABLE`.
- Lichess keeps its own lanes, cooldowns and timeouts (0255) and takes the host allowlist and the size cap from it.

## Idempotency keys (recipe)

For actions with side effects outside the database (sending an email or an invite, charging, calling a webhook), a double submit or a retry after a lost response must not do it twice. The client makes one key per intended action (when the form opens, a new one after success; never per click) and sends it with every attempt; the server runs the action once per key and answers repeats with the first result. Live example: `/dev/examples/idempotency` (in memory, `src/server/examples/idempotency.ts`). The base doesn't need it: its creates are admin forms and the submit button disables itself while saving (0125).

Kharcha's and Taskline's CSV imports keep their keys in Postgres as below (`kh_import`, `tl_import`; decisions 0287, 0215). <!-- @kharcha -->

In a real feature, keep keys in Postgres so every instance sees them:

```ts
// schema: key, scope (user + action), fingerprint (the input), response (jsonb), created_at; primary key (key)
export async function once<T>(db: Db, key: string, scope: string, input: unknown, run: (tx: Tx) => Promise<T>) {
	const fingerprint = JSON.stringify(input);
	return db.transaction(async (tx) => {
		// Claims the key, or waits for the transaction that holds it and sees its row.
		const [claimed] = await tx.insert(idempotencyKey).values({ key, scope, fingerprint }).onConflictDoNothing().returning();
		if (!claimed) {
			const [row] = await tx.select().from(idempotencyKey).where(eq(idempotencyKey.key, key));
			if (row?.scope !== scope || row.fingerprint !== fingerprint) throw new AppError("CONFLICT", "Key reused");
			return row.response as T;
		}
		const response = await run(tx); // the insert and the side effect's record commit together
		await tx.update(idempotencyKey).set({ response }).where(eq(idempotencyKey.key, key));
		return response;
	});
}
```

The server function takes the key in its input (`key: z.uuid()`), the scope is `${context.user.id}:<action>`, and a scheduled job deletes keys older than a day. Send emails after the transaction commits (or from an outbox table), so a rollback doesn't leave a sent email behind.

## Server-only code

`src/server/**` and `*.server.*` never reach the client: TanStack Start's import protection fails the build, and `tests/server/env-boundary.test.ts` scans imports. Allowed importers are `src/server`, `src/functions`, `src/middleware` (dynamic import inside `.server()` only), and server routes (`.ts` route files with only `server.handlers`, like `/sitemap.xml`).

Modules that use Start runtime helpers (`createIsomorphicFn`, e.g. `src/lib/start/http-status.ts`) are for routes and server code only. Storybook has no Start plugin, so a component importing them breaks every story that renders it. Example: `assertRoutePermission` lives in `rbac/lib/route-guard.ts`, not `rbac/hooks/use-can.ts`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **The root `beforeLoad` and `matches`:** reading `matches` there makes the route tree's types circular (`match.routeId` turns `unknown` everywhere). Its return type is written out (`Promise<{ session: Session | null }>`) to break the cycle (0161).
- **Nitro routes** (`vite.config.ts` → `nitro.routes`) are for endpoints outside Start, e.g. the cron job and the web manifest. Nitro's dev server hands requests whose `Sec-Fetch-Dest` isn't a document (`image`, `manifest`…) to Vite unless a Nitro route matches, so a Start server route fetched that way is a 404 in dev only (0067, 0103). Its default export is `defineApiRoute({ … }).nitro`, a plain `(event) => Response` that h3 takes as it is.
- **Start's helpers need Start's request** (`getRequest`, `getCookie`, `getRequestIP`): a Nitro route has none, so `defineApiRoute` passes the request and the socket's address itself (`clientIpOf`). A test that calls a Start route's handler runs it in `inStartEvent` (`tests/utils/start-event.ts`).
- **Server-function errors are HTTP 200:** Start sends them as a serialized payload (`x-tss-serialized`). When checking a refusal over HTTP, look for the code (`FORBIDDEN`) in the body.
- **Dev-only pages** live under `src/routes/dev/`: the layout 404s unless `DEV_ROUTES` (`src/lib/dev-routes.ts`: `vite dev`, or a build with `VITE_DEV_ROUTES=true`, which the e2e harness uses and production refuses; 0162). Their server functions use `requireDev`. Gate dev-only code on `DEV_ROUTES`, not `import.meta.env.DEV`, or the e2e build breaks it.
- **Server-only imports in middleware go inside `.server()`** (`await import("@/server/…")`). A dynamic import in an exported helper is still in the client graph, and import protection warns in dev.
