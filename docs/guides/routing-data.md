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

## Server functions

```ts
export const updateThing = createServerFn({ method: "POST" })
	.middleware([requirePermission("things:update")])
	.validator(zodInput(thingUpdateSchema))
	.handler(({ data, context }) => updateItem(db, data, { userId: context.user.id }));
```

- **Thin:** the middleware checks the permission, `zodInput` validates with the shared schema (field errors come back keyed by field), and the handler is one call into `src/server/**`. Logic lives there, where tests run it on PGlite.
- **Every protected function** runs `requirePermission` first, and `tests/server/guarded-functions.test.ts` lists each function with its permission ([rbac.md](rbac.md)). Use `requireUserMiddleware` for "any signed-in account" (it refuses guests, 0185), `requireAppUser` for the showcase apps (guests included) and `devOnlyMiddleware` for `/dev` helpers.
- **Global function middleware** (`src/start.ts`): it sends the page locale as a header (so `m.*` and `getLocale()` work inside handlers), passes on the request's id (`context.requestId`, the same as the `x-request-id` header, 0123), logs one JSON line per call, and normalises errors.
- **Runtime:** server functions run only inside Start. Test the plain functions they call, not the wrappers.

## Errors

- **Throw `AppError(code, devMessage, { fieldErrors })`** for expected failures: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`. User-facing text is picked on the client by code (`errorMessage(error)`). `fieldErrors` hold localized messages for form fields; `ruleError(code, dev, user)` makes a whole-form message; `staleError(what)` is the `CONFLICT` for an edit that started from an older version (`reason: "stale"`, see [forms.md](forms.md)).
- **Anything else** becomes `INTERNAL` with only a request id. The original is logged and sent to Sentry once (`src/middleware/errors.ts`).
- **Over HTTP**, a server-function error is a 200 with a serialized payload (`x-tss-serialized`). Look for the code in the body.
- **In loaders:**
  - `throw notFound()` for missing records, which renders the localized 404.
  - For an `AppError`, call `await setErrorStatus(error)` before rethrowing, so the SSR response carries 403/404 instead of 500.
  - The route's error component is `ErrorPage`; `src/client.tsx` doesn't log expected errors.
- **In actions:** catch where they happen. Use `handleSaveError(form, error, onStale?)` for forms, otherwise a toast with `errorMessage(error)`.

## Idempotency keys (recipe)

For actions with side effects outside the database (sending an email or an invite, charging, calling a webhook), a double submit or a retry after a lost response must not do it twice. The client makes one key per intended action (when the form opens, a new one after success; never per click) and sends it with every attempt; the server runs the action once per key and answers repeats with the first result. Live example: `/dev/examples/idempotency` (in memory, `src/server/examples/idempotency.ts`). The base doesn't need it: its creates are admin forms and the submit button disables itself while saving (0125).

Expenses' CSV import keeps its keys in Postgres as below (`expense_import`, decision 0192). <!-- @apps -->

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

Modules that use Start runtime helpers (`createIsomorphicFn`, e.g. `src/lib/start/http-status.ts`) are for routes and server code only. Storybook has no Start plugin, so a component importing them breaks every story that renders it. Example: `assertRoutePermission` lives in `rbac/route-guard.ts`, not `rbac/can.tsx`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **The root `beforeLoad` and `matches`:** reading `matches` there makes the route tree's types circular (`match.routeId` turns `unknown` everywhere). Its return type is written out (`Promise<{ session: Session | null }>`) to break the cycle (0161).
- **Nitro routes** (`vite.config.ts` → `nitro.routes`) are for endpoints outside Start, e.g. the cron job and the web manifest. Nitro's dev server hands requests whose `Sec-Fetch-Dest` isn't a document (`image`, `manifest`…) to Vite unless a Nitro route matches, so a Start server route fetched that way is a 404 in dev only (0067, 0103).
- **Server-function errors are HTTP 200:** Start sends them as a serialized payload (`x-tss-serialized`). When checking a refusal over HTTP, look for the code (`FORBIDDEN`) in the body.
- **Dev-only pages** live under `src/routes/dev/`: the layout 404s unless `DEV_ROUTES` (`src/lib/dev-routes.ts`: `vite dev`, or a build with `VITE_DEV_ROUTES=true`, which the e2e harness uses and production refuses; 0162). Their server functions use `devOnlyMiddleware`. Gate dev-only code on `DEV_ROUTES`, not `import.meta.env.DEV`, or the e2e build breaks it.
- **Server-only imports in middleware go inside `.server()`** (`await import("@/server/…")`). A dynamic import in an exported helper is still in the client graph, and import protection warns in dev.
