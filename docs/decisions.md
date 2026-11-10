# Decisions

Record every non-obvious choice here: **What**, **Why**, **Alternatives considered**. Newest entries at the bottom.

<details>
<summary>Index (240 entries)</summary>

- [0001](#0001-project-has-its-own-git-repository): Project has its own git repository
- [0002](#0002-default-deployment-target-is-vercel-assumption): Default deployment target is Vercel (assumption)
- [0003](#0003-scaffold-with-the-official-tanstack-cli-biome-vercel-shadcn-add-ons): Scaffold with the official TanStack CLI (Biome, Vercel, shadcn add-ons)
- [0004](#0004-nitro-is-the-server-build-the-vercel-preset-is-auto-detected): Nitro is the server build; the Vercel preset is auto-detected
- [0005](#0005-only-use-client-warnings-from-dependencies-are-filtered-in-the-nitro-build): Only "use client" warnings from dependencies are filtered in the Nitro build
- [0006](#0006-import-alias-is-not-the-starters): Import alias is `@/`, not the starter's `#/`
- [0007](#0007-self-hosted-fonts-with-preloads-and-metric-matched-fallbacks): Self-hosted fonts with preloads and metric-matched fallbacks
- [0008](#0008-next-themes-removed-from-the-shadcn-sonner-component): `next-themes` removed from the shadcn Sonner component
- [0009](#0009-tanstack-router-cli-removed-the-route-tree-is-committed): TanStack router CLI removed; the route tree is committed
- [0010](#0010-prettier-remains-only-as-a-transitive-dependency): Prettier remains only as a transitive dependency
- [0011](#0011-when-and-where-env-is-validated): When and where env is validated
- [0012](#0012-client-schema-lives-in-its-own-file-client-env-files-avoid-the-client-name): Client schema lives in its own file; client env files avoid the `*.client.*` name
- [0013](#0013-three-layers-keep-server-only-code-off-the-client): Three layers keep server-only code off the client
- [0014](#0014-env-validation-details): Env validation details
- [0015](#0015-neon-driver-is-node-postgres-tcp-with-a-small-pool-and-attachdatabasepool): Neon driver is node-postgres (TCP) with a small pool and `attachDatabasePool`
- [0016](#0016-drizzle-stable-045x-not-the-10-release-candidate): Drizzle stable 0.45.x, not the 1.0 release candidate
- [0017](#0017-sslmoderequire-is-rewritten-to-verify-full): `sslmode=require` is rewritten to `verify-full`
- [0018](#0018-migrations-use-the-direct-url-and-start-from-an-empty-baseline): Migrations use the direct URL and start from an empty baseline
- [0019](#0019-the-health-check-hides-failure-details-from-clients): The health check hides failure details from clients
- [0020](#0020-paraglide-follows-the-official-tanstack-start-example-options-live-in-paraglideconfigts): Paraglide follows the official TanStack Start example; options live in `paraglide.config.ts`
- [0021](#0021-locale-strategy-is-url-only-for-pages-english-unprefixed-nepali-under-ne): Locale strategy is URL-only for pages; English unprefixed, Nepali under `/ne`
- [0022](#0022-server-functions-receive-the-page-locale-in-a-header): Server functions receive the page locale in a header
- [0023](#0023-the-language-switcher-uses-plain-links-to-localized-urls): The language switcher uses plain links to localized URLs
- [0024](#0024-nepali-formatting-never-uses-icu-ne-data): Nepali formatting never uses ICU `ne` data
- [0025](#0025-dates-render-in-a-fixed-app-time-zone-relative-time-takes-an-explicit-now): Dates render in a fixed app time zone; relative time takes an explicit `now`
- [0026](#0026-devanagari-font-preloads-only-on-nepali-pages-no-preloads-in-dev): Devanagari font preloads only on Nepali pages; no preloads in dev
- [0027](#0027-react-is-split-into-its-own-client-chunk): React is split into its own client chunk
- [0028](#0028-how-no-hydration-warnings-was-verified): How "no hydration warnings" was verified
- [0029](#0029-windows-checkouts-need-a-short-path): Windows checkouts need a short path
- [0030](#0030-tanstack-query-via-the-official-ssr-integration-with-a-60-second-staletime): TanStack Query via the official SSR integration, with a 60-second `staleTime`
- [0031](#0031-one-apperror-shape-normalised-by-middleware-and-serialised-with-an-adapter): One `AppError` shape, normalised by middleware and serialised with an adapter
- [0032](#0032-zodinput-instead-of-passing-zod-schemas-straight-to-inputvalidator): `zodInput()` instead of passing Zod schemas straight to `inputValidator`
- [0033](#0033-middleware-lives-in-srcmiddleware-not-srcservermiddleware): Middleware lives in `src/middleware/`, not `src/server/middleware/`
- [0034](#0034-csrf-protection-for-server-functions): CSRF protection for server functions
- [0035](#0035-layout-routes-guards-and-the-session-slot): Layout routes, guards and the session slot
- [0036](#0036-stack-is-the-phase-5-reference-page): `/stack` is the Phase 5 reference page
- [0037](#0037-email-provider-selection-and-fail-fast-in-production): Email provider selection and fail-fast in production
- [0038](#0038-react-email-6-rendered-in-an-explicit-locale): React Email 6, rendered in an explicit locale
- [0039](#0039-the-email-preview-is-a-vite-dev-server-middleware-not-an-app-route): The email preview is a Vite dev-server middleware, not an app route
- [0040](#0040-better-auth-configuration): Better Auth configuration
- [0041](#0041-auth-emails-are-sent-in-the-users-language-in-the-background): Auth emails are sent in the user's language, in the background
- [0042](#0042-email-change-notice-to-the-old-address): Email-change notice to the old address
- [0043](#0043-session-in-the-router-context-via-tanstack-query-admin-checked-on-the-server): Session in the router context via TanStack Query; admin checked on the server
- [0044](#0044-apperror-status-codes-survive-ssr): AppError status codes survive SSR
- [0045](#0045-rate-limits-keyed-by-a-trusted-client-ip): Rate limits keyed by a trusted client IP
- [0046](#0046-auth-pages-and-placement): Auth pages and placement
- [0047](#0047-the-admin-seed-wraps-better-auths-create-admin): The admin seed wraps Better Auth's `create-admin`
- [0048](#0048-better-auths-env-name-appears-in-the-client-bundle): Better Auth's env *name* appears in the client bundle
- [0049](#0049-local-e2e-database-must-be-utf-8): Local e2e database must be UTF-8
- [0050](#0050-form-system-built-on-tanstack-form-composition-and-shadcn-field): Form system built on TanStack Form composition and shadcn Field
- [0051](#0051-when-errors-appear-and-formvalidators): When errors appear, and `formValidators()`
- [0052](#0052-formerrorsummary-focuses-itself-submitbutton-never-blocks): FormErrorSummary focuses itself; SubmitButton never blocks
- [0053](#0053-validation-helpers-return-localized-messages-at-validation-time): Validation helpers return localized messages at validation time
- [0054](#0054-number-and-currency-inputs-keep-a-draft-string): Number and currency inputs keep a draft string
- [0055](#0055-local-changes-to-shadcn-components): Local changes to shadcn components
- [0056](#0056-component-tests-run-in-jsdom-with-a-shared-harness): Component tests run in jsdom with a shared harness
- [0057](#0057-phone-numbers-are-stored-as-e164-with-a-separate-country-picker): Phone numbers are stored as E.164 with a separate country picker
- [0058](#0058-date-fields-store-calendar-dates-as-strings): Date fields store calendar dates as strings
- [0059](#0059-rich-text-loads-only-in-the-browser-behind-a-placeholder-of-the-same-size): Rich text loads only in the browser, behind a placeholder of the same size
- [0060](#0060-sanitizing-rich-text-on-the-server-with-a-safehtml-brand): Sanitizing rich text on the server, with a SafeHtml brand
- [0061](#0061-the-dev-only-showcase-is-a-real-route-dropped-from-production-builds): The dev-only showcase is a real route, dropped from production builds
- [0062](#0062-file-fields-use-the-native-input-plus-drag-and-drop-and-validate-in-the-schema): File fields use the native input plus drag-and-drop, and validate in the schema
- [0063](#0063-mustaccept-takes-a-boolean-input): `mustAccept()` takes a boolean input
- [0064](#0064-when-to-use-tanstack-db-query-or-store-and-the-rest): When to use TanStack DB, Query or Store, and the rest
- [0065](#0065-preferences-live-in-cookies-with-one-store-per-router): Preferences live in cookies, with one store per router
- [0066](#0066-tanstack-db-uses-the-official-router-integration-and-has-its-own-chunk): TanStack DB uses the official router integration and has its own chunk
- [0067](#0067-uploaded-images-are-stored-in-postgres-and-served-by-a-nitro-route): Uploaded images are stored in Postgres and served by a Nitro route
- [0068](#0068-the-admin-list-is-url-driven-query-owns-ssr-and-a-db-collection-owns-optimism): The admin list is URL-driven; Query owns SSR and a DB collection owns optimism
- [0069](#0069-server-functions-use-validator-and-report-field-errors-the-form-can-show): Server functions use `.validator()` and report field errors the form can show
- [0070](#0070-testing-data-access-against-pglite-and-how-admin-only-access-is-verified): Testing data access against PGlite, and how admin-only access is verified
- [0071](#0071-seo-tags-come-from-one-helper-and-a-required-vitesiteurl): SEO tags come from one helper and a required `VITE_SITE_URL`
- [0072](#0072-public-reads-are-a-separate-published-only-path): Public reads are a separate, published-only path
- [0073](#0073-sentry-via-sentrytanstackstart-react-1140-beta-pinned-off-without-a-dsn): Sentry via `@sentry/tanstackstart-react` 11.4.0 (beta, pinned), off without a DSN
- [0074](#0074-posthog-is-opt-in-consent-is-a-cookie-and-posthog-js-loads-only-after-yes): PostHog is opt-in; consent is a cookie, and posthog-js loads only after "yes"
- [0075](#0075-feature-flags-are-evaluated-on-the-server-and-shipped-with-the-page): Feature flags are evaluated on the server and shipped with the page
- [0076](#0076-csp-and-ad-blockers-deferred-to-task-16): CSP and ad blockers (deferred to Task 16)
- [0077](#0077-storybook-has-its-own-vite-config-and-replaces-server-modules-wholesale): Storybook has its own Vite config and replaces server modules wholesale
- [0078](#0078-stories-are-tests-two-browser-passes-a11y-violations-fail): Stories are tests: two browser passes, a11y violations fail
- [0079](#0079-accessibility-fixes-found-by-the-stories): Accessibility fixes found by the stories
- [0080](#0080-server-function-logic-lives-in-plain-functions-coverage-is-reported-per-area): Server-function logic lives in plain functions; coverage is reported per area
- [0081](#0081-security-headers-static-headers-via-nitro-a-per-request-csp-nonce-via-start-middleware): Security headers: static headers via Nitro, a per-request CSP nonce via Start middleware
- [0082](#0082-final-review-fixes-accessibility-responsiveness-layout-stability): Final review fixes (accessibility, responsiveness, layout stability)

- [0083](#0083-breadcrumbs-come-from-route-staticdata-labels-resolved-at-render-time): Breadcrumbs come from route `staticData`, labels resolved at render time
- [0084](#0084-one-list-contract-shared-by-url-server-function-and-repository): One list contract, shared by URL, server function and repository
- [0085](#0085-reusable-page-building-blocks-feature-code-is-columns-filters-and-actions): Reusable page building blocks; feature code is columns, filters and actions
- [0086](#0086-zod-resolves-to-a-configured-module-jitless-before-any-schema-exists): `zod` resolves to a configured module (jitless before any schema exists)
- [0087](#0087-story-tests-need-no-setup-file-unused-messages-fail-the-build): Story tests need no setup file; unused messages fail the build
- [0088](#0088-filters-are-one-get-form-of-native-controls-arrays-are-repeated-keys): Filters are one GET form of native controls; arrays are repeated keys
- [0089](#0089-search-driven-lists-keep-showing-results-while-new-ones-load): Search-driven lists keep showing results while new ones load
- [0090](#0090-the-admin-guard-checks-the-server-when-entering-the-area-not-on-every-inner-navigation): The admin guard checks the server when entering the area, not on every inner navigation
- [0091](#0091-route-masking-for-the-edit-dialog-and-quick-view-masked-links-always-unmask-on-reload): Route masking for the edit dialog and quick view; masked links always unmask on reload
- [0092](#0092-path-params-are-validated-by-the-route-paramsparse-not-in-loaders): Path params are validated by the route (`params.parse`), not in loaders
- [0093](#0093-date-filters-are-calendar-days-in-the-app-time-zone-compared-as-instants): Date filters are calendar days in the app time zone, compared as instants
- [0094](#0094-roles-and-permissions-live-in-app-tables-better-auth-keeps-identity-sessions-and-the-admin-flag): Roles and permissions live in app tables; Better Auth keeps identity, sessions and the admin flag
- [0095](#0095-every-server-function-names-its-permission-pages-guard-by-permission-the-ui-only-hides): Every server function names its permission; pages guard by permission; the UI only hides
- [0096](#0096-rules-against-self-escalation-and-lockout): Rules against self-escalation and lockout
- [0097](#0097-the-permission-matrix-saves-each-change-optimistically-and-rolls-back-on-refusal): The permission matrix saves each change optimistically and rolls back on refusal
- [0098](#0098-attachments-signed-direct-uploads-to-cloudinary-verified-on-the-server): Attachments: signed direct uploads to Cloudinary, verified on the server
- [0099](#0099-the-image-editor-is-a-feature-field-concurrent-uploads-append-atomically): The image editor is a feature field; concurrent uploads append atomically
- [0100](#0100-every-page-is-indexable-through-seo-or-private-through-noindex-a-test-checks-every-route): Every page is indexable through seo() or private through noindex; a test checks every route
- [0101](#0101-the-sitemap-robotstxt-and-manifest-are-built-from-the-same-data-as-the-pages-the-manifest-is-a-nitro-route): The sitemap, robots.txt and manifest are built from the same data as the pages; the manifest is a Nitro route
- [0102](#0102-json-ld-is-typed-with-schema-dts-and-emitted-through-route-heads-items-are-products): JSON-LD is typed with schema-dts and emitted through route heads; items are Products
- [0103](#0103-module-examples-are-dev-only-routes-over-in-memory-data-guarded-by-one-layout): Module examples are dev-only routes over in-memory data, guarded by one layout
- [0104](#0104-forms-handled-in-javascript-use-methodpost): Forms handled in JavaScript use `method="post"`
- [0105](#0105-sections-can-opt-out-of-the-app-header-with-staticdatachrome): Sections can opt out of the app header with `staticData.chrome`
- [0106](#0106-portfolio-content-sits-behind-a-portfoliosource-port-the-demo-adapter-lazy-loads-fixtures): Portfolio content sits behind a `PortfolioSource` port; the demo adapter lazy-loads fixtures
- [0107](#0107-portfolio-content-is-localized-in-the-data--en-ne--ui-chrome-in-paraglide): Portfolio content is localized in the data (`{ en, ne }`), UI chrome in Paraglide
- [0108](#0108-the-portfolios-design-system-is-scoped-under-portfolio-generated-art-fonts-pinned-to-an-optical-size): The portfolio's design system is scoped under `.portfolio`; generated art; fonts pinned to an optical size
- [0109](#0109-portfolio-motion-is-css-only-scroll-driven-animations-clip-path-reveals-and-view-transitions): Portfolio motion is CSS only: scroll-driven animations, clip-path reveals and View Transitions
- [0110](#0110-the-portfolio-is-dressed-as-dhaka-cloth-anek-type-generated-weaves-no-house-style-defaults): The portfolio is dressed as Dhaka cloth: Anek type, generated weaves, no house-style defaults
- [0111](#0111-loaders-read-through-ensurequery-not-the-deprecated-ensurequerydata): Loaders read through ensureQuery(), not the deprecated ensureQueryData
- [0112](#0112-better-auths-admin-endpoints-are-disabled-over-http): Better Auth's admin endpoints are disabled over HTTP
- [0113](#0113-expired-sessions-are-handled-by-a-global-client-middleware-not-an-http-interceptor): Expired sessions are handled by a global client middleware, not an HTTP interceptor
- [0114](#0114-session-tokens-stay-on-the-server-the-account-page-revokes-sessions-by-id): Session tokens stay on the server; the account page revokes sessions by id
- [0115](#0115-the-last-admin-guard-locks-the-admin-rows-inside-the-changes-transaction): The last-admin guard locks the admin rows inside the change's transaction
- [0116](#0116-list-pages-share-uselistpage-and-tablelistinput): List pages share useListPage() and tableListInput()
- [0117](#0117-every-server-function-file-is-declared-in-the-guard-test-demo-data-is-a-seeded-script): Every server function file is declared in the guard test; demo data is a seeded script
- [0118](#0118-knip-guards-against-dead-code-cn-date-fns-and-dbpush-removed): Knip guards against dead code; `cn`, `date-fns` and `db:push` removed
- [0119](#0119-version-pinning-caret-by-default-exact-only-with-a-reason): Version pinning: caret by default, exact only with a reason
- [0120](#0120-ci-on-github-actions-git-hooks-with-lefthook-dependabot-for-updates): CI on GitHub Actions, git hooks with lefthook, Dependabot for updates
- [0121](#0121-the-browser-review-is-a-playwright-suite-against-a-harnessed-production-server): The browser review is a Playwright suite against a harnessed production server
- [0122](#0122-edits-carry-the-version-they-started-from-a-stale-save-is-a-conflict): Edits carry the version they started from; a stale save is a CONFLICT
- [0123](#0123-one-request-id-per-request-kept-in-asynclocalstorage-by-the-server-entry): One request id per request, kept in AsyncLocalStorage by the server entry
- [0124](#0124-get-apihealth-for-monitors-the-health-page-stays-for-people): GET /api/health for monitors; the /health page stays for people
- [0125](#0125-idempotency-keys-are-a-recipe-not-core): Idempotency keys are a recipe, not core
- [0126](#0126-two-factor-is-totp-with-backup-codes-admins-can-be-required-to-use-it): Two-factor is TOTP with backup codes; admins can be required to use it
- [0127](#0127-breached-passwords-are-refused-through-have-i-been-pwned-on-by-default): Breached passwords are refused through Have I Been Pwned, on by default
- [0128](#0128-turnstile-on-the-endpoints-that-send-email-or-create-accounts-plus-a-honeypot): Turnstile on the endpoints that send email or create accounts, plus a honeypot
- [0129](#0129-account-deletion-always-takes-an-emailed-link-the-export-is-a-json-download): Account deletion always takes an emailed link; the export is a JSON download
- [0130](#0130-linked-accounts-add-a-password-link-and-unlink-google-never-the-last-way-in): Linked accounts: add a password, link and unlink Google, never the last way in
- [0131](#0131-last-login-method-and-passkeys-are-recipes): Last login method and passkeys are recipes
- [0132](#0132-admin-actions-are-audited-in-the-same-transaction-as-the-change): Admin actions are audited in the same transaction as the change
- [0133](#0133-inviting-a-user-creates-the-account-and-emails-a-long-lived-reset-token): Inviting a user creates the account and emails a long-lived reset token
- [0134](#0134-impersonation-is-admin-only-audited-and-cant-change-the-account): Impersonation is admin-only, audited, and can't change the account
- [0135](#0135-better-auths-role--admin-stays-the-superuser-flag): Better Auth's `role = "admin"` stays the superuser flag
- [0136](#0136-the-react-compiler-runs-on-client-builds-through-babel): The React Compiler runs on client builds, through Babel
- [0137](#0137-a-skip-link-on-every-page-reduced-motion-finishes-animations-at-once): A skip link on every page; reduced motion finishes animations at once
- [0138](#0138-real-user-web-vitals-go-to-posthog-after-consent): Real-user Web Vitals go to PostHog, after consent
- [0139](#0139-csp-violations-are-reported-to-apicsp-report-and-forwarded-to-sentry): CSP violations are reported to /api/csp-report and forwarded to Sentry
- [0140](#0140-the-admin-command-palette-and-view-transitions-are-a-recipe): The admin command palette and view transitions are a recipe
- [0141](#0141-pnpm-newfeature-generates-an-admin-crud-section-from-templates-and-marker-lines): `pnpm new:feature` generates an admin CRUD section from templates and marker lines
- [0142](#0142-pnpm-strip-demo-removes-the-demo-by-file-list-markers-and-unused-messages): `pnpm strip-demo` removes the demo by file list, markers and unused messages
- [0143](#0143-routes-stay-thin-claudemd-keeps-only-the-pitfalls-that-apply-everywhere): Routes stay thin; CLAUDE.md keeps only the pitfalls that apply everywhere
- [0144](#0144-two-part-3-bugs-found-by-the-e2e-suite): Two Part 3 bugs found by the e2e suite
- [0145](#0145-background-jobs-and-cursor-pagination-are-recipes): Background jobs and cursor pagination are recipes
- [0146](#0146-server-function-rate-limits-are-stored-in-better-auths-rate_limit-table): Server-function rate limits are stored in Better Auth's `rate_limit` table
- [0147](#0147-public-page-caching-is-a-header-helper-not-a-default): Public-page caching is a header helper, not a default
- [0148](#0148-contact-form-avatar-upload-and-list-extras-are-examples-to-copy): Contact form, avatar upload and list extras are examples to copy
- [0149](#0149-pnpm-devoffline-runs-on-in-memory-pglite-with-every-outside-service-off): `pnpm dev:offline` runs on in-memory PGlite with every outside service off
- [0150](#0150-preview-branches-changelog-checks-organizations-and-billing-are-documented-not-wired): Preview branches, changelog checks, organizations and billing are documented, not wired
- [0151](#0151-every-pages-javascript-has-a-budget-and-route-options-stay-light): Every page's JavaScript has a budget, and route options stay light
- [0152](#0152-browser-sentry-loads-after-the-entry-chunk): Browser Sentry loads after the entry chunk
- [0153](#0153-the-session-is-resolved-once-per-request): The session is resolved once per request
- [0154](#0154-feature-flags-never-wait-more-than-300-ms): Feature flags never wait more than 300 ms
- [0155](#0155-dev-speed-one-message-module-per-locale-babel-only-on-our-code-a-local-database): Dev speed: one message module per locale, Babel only on our code, a local database
- [0156](#0156-pnpm-setuplocal-and-pnpm-diagnose): `pnpm setup:local` and `pnpm diagnose`
- [0157](#0157-inlang-cli-for-machine-translation-and-checks-plugins-load-from-node_modules): inlang CLI for machine translation and checks; plugins load from node_modules
- [0158](#0158-srclib-is-grouped-by-area-and-biome-enforces-the-import-boundaries): `src/lib` is grouped by area, and Biome enforces the import boundaries
- [0159](#0159-tests-start-from-one-migrated-pglite-database-per-run): Tests start from one migrated PGlite database per run
- [0160](#0160-postgres-image-storage-from-part-1-is-dropped): Postgres image storage from Part 1 is dropped
- [0161](#0161-the-portfolio-is-the-site-at--each-layout-renders-its-own-header-sections-can-skip-the-session): The portfolio is the site at `/`; each layout renders its own header; sections can skip the session
- [0162](#0162-dev-pages-exist-in-dev-and-in-e2e-builds-dev_routes-a-production-deploy-refuses-the-flag): `/dev` pages exist in dev and in e2e builds (`DEV_ROUTES`); a production deploy refuses the flag
- [0163](#0163-pnpm-strip-demo-removes-layers-portfolio-apps-by-data-lists-and-markers-the-core-stays): `pnpm strip-demo` removes layers (portfolio, apps) by data lists and markers; the core stays
- [0164](#0164-graphite-layered-oklch-tokens-accent-radius-and-density-presets-on-html-contrast-tested): "Graphite": layered oklch tokens, accent, radius and density presets on `<html>`, contrast tested
- [0165](#0165-the-command-palette-is-part-of-the-admin-shell): The command palette is part of the admin shell
- [0166](#0166-the-admin-dashboard-reads-one-server-function-filtered-by-permission): The admin dashboard reads one server function, filtered by permission
- [0168](#0168-the-admin-component-kit-heavy-fields-arent-registered-dialogs-load-on-click-confirms-are-a-promise): The admin component kit: heavy fields aren't registered, dialogs load on click, confirms are a promise
- [0169](#0169-datatable-v2-runs-on-tanstack-table-v9-in-manual-mode): DataTable v2 runs on TanStack Table v9, in manual mode
- [0170](#0170-sortable-lists-use-dnd-kitreact-pinned-exactly-plus-alt--arrows): Sortable lists use `@dnd-kit/react`, pinned exactly, plus Alt + arrows
- [0171](#0171-charts-recharts-3-loaded-on-demand-into-a-fixed-size-frame-with-a-data-table-for-screen-readers): Charts: Recharts 3 loaded on demand into a fixed-size frame, with a data table for screen readers
- [0172](#0172-slugs-are-linked-to-their-source-checked-as-you-type-and-a-submit-waits-for-async-validation): Slugs are linked to their source, checked as you type, and a submit waits for async validation
- [0173](#0173-the-crud-standard-one-shape-shared-helpers-on-both-sides-every-section-on-it): The CRUD standard: one shape, shared helpers on both sides, every section on it
- [0174](#0174-admin-crud-writes-use-query-mutations-tanstack-db-is-for-client-first-apps): Admin CRUD writes use Query mutations; TanStack DB is for client-first apps
- [0175](#0175-pnpm-newfeature-v2-the-standards-shape---public-and---localized-and-a-clean-tree): `pnpm new:feature` v2: the standard's shape, `--public` and `--localized`, and a clean tree
- [0176](#0176-the-portfolios-content-lives-in-the-database-edited-in-the-admin-read-through-public-server-functions): The portfolio's content lives in the database, edited in the admin, read through public server functions
- [0177](#0177-a-media-library-items-reference-library-attachments-by-id-alt-text-in-both-languages): A media library: items reference library attachments by id; alt text in both languages
- [0178](#0178-missing-nepali-falls-back-to-english-marked-langen-on-the-record-or-block): Missing Nepali falls back to English, marked `lang="en"` on the record or block
- [0179](#0179-the-portfolio-is-himal-the-himalaya-from-kathmandu-printed-in-altitude-layers-in-fields-of-colour): The portfolio is "Himal": the Himalaya from Kathmandu, printed in altitude layers, in fields of colour
- [0180](#0180-the-generated-mountains-seeded-peaks-marching-squares-stacked-sheets-the-same-markup-everywhere): The generated mountains: seeded peaks, marching squares, stacked sheets, the same markup everywhere
- [0181](#0181-portfolio-motion-stays-css-plus-a-1-kb-pointer-drift-no-motion-library): Portfolio motion stays CSS, plus a 1 kB pointer drift (no Motion library)
- [0182](#0182-kathmandu-at-this-hour-the-sky-from-the-suns-real-position-hydrated-from-the-servers-read-time): "Kathmandu at this hour": the sky from the sun's real position, hydrated from the server's read time
- [0183](#0183-archival-pictures-public-domain-credited-printed-in-the-pages-two-inks): Archival pictures: public domain, credited, printed in the page's two inks
- [0184](#0184-eczar-for-display-in-both-scripts-preloaded-with-measured-fallbacks-per-weight): Eczar for display in both scripts, preloaded, with measured fallbacks per weight
- [0185](#0185-guest-sessions-better-auths-anonymous-plugin-no-permissions-refused-everywhere-an-account-is-needed): Guest sessions: Better Auth's anonymous plugin, no permissions, refused everywhere an account is needed
- [0186](#0186-guest-data-sample-rows-on-start-moved-to-the-account-on-sign-up-or-sign-in-deleted-after-7-days): Guest data: sample rows on start, moved to the account on sign-up or sign-in, deleted after 7 days
- [0187](#0187-the-showcase-apps-a-registry-in-two-halves-an-_apps-frame-every-row-owned): The showcase apps: a registry in two halves, an `_apps` frame, every row owned
- [0188](#0188-kanban-fractional-positions-moves-by-pointer-or-keyboard-optimistic-in-tanstack-db): Kanban: fractional positions, moves by pointer or keyboard, optimistic in TanStack DB
- [0189](#0189-tanstack-db-loads-only-with-the-pages-that-use-it): TanStack DB loads only with the pages that use it
- [0190](#0190-notes-full-text-search-with-the-simple-configuration-app-uploads-revocable-share-links): Notes: full-text search with the `simple` configuration, app uploads, revocable share links
- [0191](#0191-links-a-redirect-route-with-request-middleware-clicks-without-ips-moderation): Links: a redirect route with request middleware, clicks without IPs, moderation
- [0192](#0192-expenses-minor-units-per-currency-budgets-per-month-a-csv-import-that-runs-once): Expenses: minor units per currency, budgets per month, a CSV import that runs once
- [0193](#0193-habits-streaks-on-calendar-days-in-kathmandu-a-server-drawn-heatmap-optimistic-check-ins): Habits: streaks on calendar days in Kathmandu, a server-drawn heatmap, optimistic check-ins
- [0194](#0194-a-routes-loader-imports-its-queries-on-demand): A route's loader imports its queries on demand
- [0195](#0195-forms-field-definitions-as-data-one-schema-for-both-sides-a-public-page-outside-the-sections): Forms: field definitions as data, one schema for both sides, a public page outside the sections
- [0196](#0196-every-form-clears-a-fields-stale-errors-when-it-changes): Every form clears a field's stale errors when it changes
- [0197](#0197-every-route-loader-imports-its-queries-on-demand): Every route loader imports its queries on demand
- [0198](#0198-paraglides-cli-is-told-the-output-structure): Paraglide's CLI is told the output structure
- [0199](#0199-app-quotas-are-checked-under-a-transaction-scoped-advisory-lock): App quotas are checked under a transaction-scoped advisory lock
- [0200](#0200-part-4-measured-task-45): Part 4 measured (Task 45)
- [0201](#0201-loading-states-in-every-section-guest-sign-ins-per-address-and-the-home-pages-first-layout): Loading states in every section, guest sign-ins per address, and the home page's first layout
- [0202](#0202-nitro-30261029-rc-h3-208-and-dev-servers-start-on-per-locale-messages): Nitro 3.0.261029-rc (h3 2.0.8), and dev servers start on per-locale messages
- [0203](#0203-taskline-one-team-workspace-and-a-sandbox-per-user-in-a-layer-of-its-own): Taskline: one team workspace and a sandbox per user, in a layer of its own
- [0204](#0204-tasklines-access-one-resolver-not-found-for-what-you-cant-see-forbidden-for-what-you-can): Taskline's access: one resolver, not found for what you can't see, forbidden for what you can
- [0205](#0205-tasklines-history-is-its-own-activity-log-rev-for-freshness-version-for-forms): Taskline's history is its own activity log; `rev` for freshness, `version` for forms
- [0206](#0206-lockquota-moves-to-core): `lockQuota` moves to core
- [0207](#0207-tasklines-members-are-the-identity-for-assignment-and-history): Taskline's members are the identity for assignment and history
- [0208](#0208-taskline-is-a-standalone-section-its-own-frame-brand-auth-pages-and-manifest-in-the-same-app): Taskline is a standalone section: its own frame, brand, auth pages and manifest, in the same app
- [0209](#0209-open-taskline-pages-poll-the-projects-rev-no-websockets): Open Taskline pages poll the project's `rev`; no websockets
- [0210](#0210-kanbans-boards-became-taskline-projects-by-migration-with-the-same-ids-and-its-addresses-redirect): Kanban's boards became Taskline projects by migration, with the same ids, and its addresses redirect
- [0211](#0211-tasklines-views-one-project-query-a-board-over-a-db-collection-a-list-on-the-list-contract-the-task-as-a-masked-sheet): Taskline's views: one project query, a board over a DB collection, a list on the list contract, the task as a masked sheet
- [0212](#0212-tasklines-team-is-its-own-list-invitations-join-on-the-first-verified-sign-in): Taskline's team is its own list; invitations join on the first verified sign-in
- [0213](#0213-the-admin-acts-through-the-apps-services-deleted-keys-are-retired-workflows-and-task-types-are-workspace-settings): The admin acts through the app's services; deleted keys are retired; workflows and task types are workspace settings
- [0214](#0214-tasklines-notifications-written-in-the-changes-transaction-emailed-at-once-coalesced-or-in-a-daily-digest): Taskline's notifications: written in the change's transaction, emailed at once (coalesced) or in a daily digest
- [0215](#0215-finding-things-in-taskline-a-calendar-over-the-boards-collection-saved-views-per-member-prefix-search-the-csv-import): Finding things in Taskline: a calendar over the board's collection, saved views per member, prefix search, the CSV import
- [0216](#0216-tasklines-sprints-one-active-per-project-a-rank-across-the-project-daily-snapshots-for-the-burndown): Taskline's sprints: one active per project, a rank across the project, daily snapshots for the burndown
- [0217](#0217-the-bundle-budget-counts-what-every-page-loads-not-only-what-it-preloads): The bundle budget counts what every page loads, not only what it preloads
- [0218](#0218-tasklines-time-entries-per-member-one-timer-per-person-stamped-by-the-server-cells-that-rewrite-the-fewest-entries-a-lock-date-nobody-passes): Taskline's time: entries per member, one timer per person stamped by the server, cells that rewrite the fewest entries, a lock date nobody passes
- [0219](#0219-tasklines-timeline-dependencies-across-a-workspaces-projects-without-loops-a-blocker-counts-while-open-the-completion-rule-refuses-completing-only-the-gantt-as-svg-with-buttons-for-bars): Taskline's timeline: dependencies across a workspace's projects without loops, a blocker counts while open, the completion rule refuses completing only, the Gantt as SVG with buttons for bars
- [0220](#0220-tasklines-custom-fields-definitions-per-scope-values-in-jsonb-checked-against-them-options-by-id-required-means-before-its-completed): Taskline's custom fields: definitions per scope, values in jsonb checked against them, options by id, required means "before it's completed"
- [0221](#0221-tasklines-automations-in-the-changes-transaction-a-savepoint-per-rule-no-chaining-recurring-tasks-move-their-rule-from-task-to-task): Taskline's automations: in the change's transaction, a savepoint per rule, no chaining; recurring tasks move their rule from task to task
- [0222](#0222-the-typecheck-runs-tsc-with-a-4-gb-heap): The typecheck runs tsc with a 4 GB heap
- [0223](#0223-claudemd-holds-only-what-most-tasks-need): CLAUDE.md holds only what most tasks need
- [0224](#0224-tasklines-templates-one-definition-with-local-ids-built-ins-in-code-edited-as-json): Taskline's templates: one definition with local ids, built-ins in code, edited as JSON
- [0225](#0225-tasklines-reports-computed-from-live-tasks-and-the-activity-log-updates-set-the-health): Taskline's reports: computed from live tasks and the activity log; updates set the health
- [0226](#0226-part-5-reviewed-what-changed-and-what-stayed): Part 5 reviewed: what changed and what stayed
- [0227](#0227-part-5-measured-task-58): Part 5 measured (Task 58)
- [0228](#0228-parda-is-a-layer-its-playback-starts-as-a-placeholder): Parda is a layer; its playback starts as a placeholder
- [0229](#0229-tmdb-behind-one-client-one-cache-and-one-service): TMDB behind one client, one cache and one service
- [0230](#0230-sources-as-data-adapters-as-code-a-frame-only-csp): Sources as data, adapters as code, a frame-only CSP
- [0231](#0231-no-sandbox-decision-is-taken-yet): No sandbox decision is taken yet
- [0232](#0232-pardas-look-is-masking-dark-by-default-and-a-section-can-resolve-its-own-theme): Parda's look is "Masking", dark by default, and a section can resolve its own theme
- [0233](#0233-pardas-frame-and-media-kit): Parda's frame and media kit
- [0234](#0234-pardas-home-and-hubs-the-catalogue-gate-and-a-title-page-stub): Parda's home and hubs, the catalogue gate, and a title page stub
- [0235](#0235-pardas-title-credits-person-and-collection-pages): Parda's title, credits, person and collection pages
- [0236](#0236-pardas-player-progress-and-continue-watching): Parda's player, progress and Continue watching
- [0237](#0237-pardas-admin-i-sources-takedowns-reports-and-settings): Parda's admin I: sources, takedowns, reports and settings
- [0238](#0238-parda-ranks-its-sources-from-viewers-and-a-daily-probe): Parda ranks its sources from viewers and a daily probe
- [0239](#0239-parda-searches-and-discovers-through-the-catalogue-service): Parda searches and discovers through the catalogue service
- [0240](#0240-pardas-library-profiles-and-the-kids-cap): Parda's library, profiles and the kids' cap
- [0241](#0241-pardas-schedule-and-new-episode-alerts): Parda's schedule and new-episode alerts
- [0242](#0242-pardas-admin-ii-overview-curation-and-layout): Parda's admin II: overview, curation and layout
- [0243](#0243-pardas-watch-party-ably-and-sync-through-commands): Parda's watch party: Ably, and sync through commands
- [0244](#0244-part-6-reviewed-what-changed-and-what-stayed): Part 6 reviewed: what changed and what stayed
- [0245](#0245-part-6-measured-task-70): Part 6 measured (Task 70)
- [0246](#0246-parda_player_base-holds-the-whole-prefix): `PARDA_PLAYER_BASE` holds the whole prefix
- [0247](#0247-parda-switches-servers-only-on-a-crash-and-only-in-auto): Parda switches servers only on a crash, and only in Auto
- [0248](#0248-servers-1-to-4-follow-the-viduki-embed-contract): Servers 1 to 4 follow the Viduki embed contract
- [0249](#0249-pardas-billboard-fills-the-first-screen-names-no-provider-and-has-its-own-account-page): Parda's billboard fills the first screen, names no provider, and has its own account page
- [0250](#0250-a-resting-mouse-holds-the-billboard-only-over-its-lower-mask): A resting mouse holds the billboard only over its lower mask
- [0251](#0251-the-database-pool-listens-for-dropped-idle-connections): The database pool listens for dropped idle connections
- [0252](#0252-the-vercel-deployment-opens-on-parda): The Vercel deployment opens on Parda
- [0253](#0253-vercel-web-analytics-renders-only-in-vercel-builds): Vercel Web Analytics renders only in Vercel builds
- [0254](#0254-chaal-is-a-layer-that-connects-lichess-to-a-session): Chaal is a layer that connects Lichess to a session
- [0255](#0255-one-lichess-client-with-lanes-cooldowns-and-a-shared-cache): One Lichess client with lanes, cooldowns and a shared cache
- [0256](#0256-lichess-tokens-are-sealed-and-never-leave-the-server): Lichess tokens are sealed and never leave the server
- [0257](#0257-what-task-71s-spikes-found): What Task 71's spikes found
- [0258](#0258-chaals-look-is-diagram-a-printed-chess-diagram-paper-and-ink-one-vermilion): Chaal's look is "Diagram": a printed chess diagram, paper and ink, one vermilion
- [0259](#0259-chaals-shell-a-frame-of-its-own-preferences-on-the-account-or-in-the-browser-connecting-from-any-page): Chaal's shell: a frame of its own, preferences on the account or in the browser, connecting from any page
- [0260](#0260-the-entry-budget-rises-to-290-kb-for-part-7s-routes): The entry budget rises to 290 kB for Part 7's routes
- [0261](#0261-chaals-game-model-chessjs-behind-fen-functions-a-flat-tree-our-own-pgn): Chaal's game model: chess.js behind FEN functions, a flat tree, our own PGN
- [0262](#0262-chaals-board-our-own-pointer-handling-a-keyboard-grid-html-squares): Chaal's board: our own pointer handling, a keyboard grid, HTML squares
- [0263](#0263-chaals-engine-a-hashed-copy-of-the-lite-build-a-worker-client-with-one-search-at-a-time-started-on-demand): Chaal's engine: a hashed copy of the lite build, a worker client with one search at a time, started on demand
- [0264](#0264-chaals-analysis-board-the-url-is-the-line-lichesss-data-through-our-server-a-checked-tree-saved-as-jsonb): Chaal's analysis board: the URL is the line, Lichess's data through our server, a checked tree saved as jsonb
- [0265](#0265-chaals-local-games-played-in-the-browser-kept-where-the-player-is-pgn-checked-on-the-server): Chaal's local games: played in the browser, kept where the player is, PGN checked on the server
- [0266](#0266-chaals-online-play-lichesss-streams-through-our-server-one-tab-holding-the-event-stream-challenges-kept-open-by-a-stream): Chaal's online play: Lichess's streams through our server, one tab holding the event stream, challenges kept open by a stream
- [0267](#0267-chaals-quick-pairing-and-notifications-seeks-kept-open-by-a-stream-your-move-read-from-the-games-in-progress-notices-drawn-from-the-event-store): Chaal's quick pairing and notifications: seeks kept open by a stream, "your move" read from the games in progress, notices drawn from the event store
- [0268](#0268-chaals-admin-one-versioned-settings-row-with-maintenance-as-its-own-switch-revoking-keeps-the-row-call-stats-flushed-after-each-call): Chaal's admin: one versioned settings row with maintenance as its own switch, revoking keeps the row, call stats flushed after each call
- [0269](#0269-chaals-puzzles-lichesss-puzzles-replayed-from-their-pgn-a-trainer-of-our-own-attempts-kept-where-the-player-is-and-posted-to-lichess-in-batches): Chaal's puzzles: Lichess's puzzles replayed from their PGN, a trainer of our own, attempts kept where the player is and posted to Lichess in batches
- [0270](#0270-the-entry-budget-rises-to-295-kb-for-tasks-8084s-routes): The entry budget rises to 295 kB for Tasks 80–84's routes
- [0271](#0271-chaals-players-and-games-lichesss-public-reads-through-the-cache-the-viewers-token-only-for-following-a-replay-that-shares-the-analysis-imports-read): Chaal's players and games: Lichess's public reads through the cache, the viewer's token only for following, a replay that shares the analysis import's read
- [0272](#0272-chaals-watch-the-first-paint-from-our-server-whats-live-read-by-the-browser-from-lichess-one-pgn-stream-per-round): Chaal's watch: the first paint from our server, what's live read by the browser from Lichess, one PGN stream per round
- [0273](#0273-chaals-community-public-reads-through-the-cache-the-players-own-place-read-with-their-token-joining-and-saving-behind-the-admins-controls): Chaal's community: public reads through the cache, the player's own place read with their token, joining and saving behind the admin's controls
- [0274](#0274-chaals-admin-ii-the-overview-from-a-daily-rollup-curation-as-one-page-the-home-in-the-admins-order): Chaal's admin II: the overview from a daily rollup, curation as one page, the home in the admin's order
- [0275](#0275-part-7-reviewed-typed-moves-on-every-board-and-what-the-template-matrix-found): Part 7 reviewed: typed moves on every board, and what the template matrix found
- [0276](#0276-part-7-measured-task-85): Part 7 measured (Task 85)
</details>

---

## 0001: Project has its own git repository

- **What:** `git init` inside the project folder instead of committing to the enclosing repository.
- **Why:** The only enclosing repository was rooted at `C:\` and tracks the whole drive. Project history must be isolated and pushable on its own.
- **Alternatives considered:** Committing to the drive-level repository (rejected: pollutes an unrelated repo and risks leaking unrelated files).

## 0002: Default deployment target is Vercel (assumption)

- **What:** The plan assumes a Node-compatible serverless host (Vercel) using TanStack Start's official hosting adapter.
- **Why:** The Neon driver choice (Phase 3) and the security-header mechanism (Phase 12) depend on the runtime. A default avoids blocking.
- **Alternatives considered:** Long-running Node server, Netlify, Cloudflare Workers. Revisit before Phase 3 if the target differs.

## 0003: Scaffold with the official TanStack CLI (Biome, Vercel, shadcn add-ons)

- **What:** `@tanstack/cli create --toolchain biome --deployment vercel --add-ons shadcn --no-examples`. Only Phase 1 add-ons were selected. The `.cta.json` file is kept so later phases can use `tanstack add` for official add-ons.
- **Why:** This is the starter the TanStack Start docs point to. It wires the Start, Tailwind v4 and Nitro Vite plugins the officially supported way.
- **Alternatives considered:** Cloning `examples/react/start-basic` with gitpick (no Biome, Tailwind or deploy adapter). `shadcn init -t start` (a different starter with its own conventions).

## 0004: Nitro is the server build; the Vercel preset is auto-detected

- **What:** The Vercel add-on uses `nitro/vite` plus `vercel.json`. Local builds use Nitro's `node-server` preset, and `pnpm start` runs `.output/server/index.mjs`. On Vercel, Nitro switches to its Vercel preset automatically.
- **Why:** This is the adapter the official CLI generates for Vercel. `nitro` is pinned to the exact beta version the CLI chose, because beta versions can break between releases.
- **Alternatives considered:** Hardcoding `preset: "vercel"`, which would break the local `pnpm start`.

## 0005: Only "use client" warnings from dependencies are filtered in the Nitro build

- **What:** `vite.config.ts` gives Nitro an `onwarn` handler. It drops only `MODULE_LEVEL_DIRECTIVE` warnings about `"use client"` in `node_modules`. Nitro's default ignore list is re-applied, because a custom handler replaces it.
- **Why:** `@tanstack/react-router` and `sonner` ship `"use client"` for React Server Component frameworks. The directive has no meaning in this app. `@vitejs/plugin-react` already silences it for the client and SSR builds, but Nitro's separate Rolldown pass does not. The warnings come from upstream packages, so they can't be fixed in this repo.
- **Alternatives considered:** Ignoring all `MODULE_LEVEL_DIRECTIVE` warnings (too broad, would hide directives in our own code). Living with 21 warnings per build.

## 0006: Import alias is `@/`, not the starter's `#/`

- **What:** `@/*` maps to `src/*` through tsconfig `paths`, resolved by Vite's `resolve.tsconfigPaths`. The starter's `#/*` Node subpath import was removed.
- **Why:** `@/` is shadcn's documented default and has one source of truth. Two aliases for the same folder invite inconsistency. The shadcn CLI (4.21.0) emits a bare `"cn"` import for either alias, which is fixed by hand and noted in the README.
- **Alternatives considered:** Keeping `#/` (native, but non-standard for shadcn and other tooling).

## 0007: Self-hosted fonts with preloads and metric-matched fallbacks

- **What:** Inter Variable (Latin) and Noto Sans Devanagari Variable come from Fontsource packages imported in `app.css`. The Inter Latin subset and the Noto Devanagari subset are preloaded, with `crossorigin` set, from `src/lib/fonts.ts`. Other subsets load on demand through `unicode-range`. `font-display: swap` comes from Fontsource. The fallback faces keep line boxes stable during the swap. `Inter Fallback` is Arial with size, ascent and descent overrides. `Noto Sans Devanagari Fallback` uses system Devanagari fonts with Noto's vertical metrics.
- **Why:** Self-hosting avoids a third-party request, is privacy-friendly, and keeps the Phase 12 CSP simple. The preload `?url` imports resolve to the same hashed files the CSS uses, so nothing downloads twice (verified in the network log). Inter overrides are computed with `@capsizecss/metrics` and match next/font's published values. Devanagari `size-adjust` stays at 100% because no system-font width metrics exist to compute it from. Measured layout shift is 0 on the home page on a throttled network.
- **Alternatives considered:** A Google Fonts `@import` (the starter's approach: render-blocking, third-party, not preloadable by hash). `font-display: optional` (no shift, but the web font often never shows on a first visit). The Fontaine plugin (an extra build dependency for two fonts).
- **Follow-up (Phase 4):** Preload the Devanagari subset only on `ne` pages, so English pages don't download 121 kB they may not use.

## 0008: `next-themes` removed from the shadcn Sonner component

- **What:** `Toaster` takes a `theme` prop, defaulting to `"system"`, instead of calling `useTheme()` from `next-themes`.
- **Why:** Theme state belongs to the TanStack Store theme in Phase 8. `next-themes` is Next.js-oriented and would be a second source of truth.
- **Alternatives considered:** Keeping `next-themes` until Phase 8 (dependency churn).

## 0009: TanStack router CLI removed; the route tree is committed

- **What:** `@tanstack/router-cli` was dropped. The Start Vite plugin regenerates `src/routeTree.gen.ts` on `dev` and `build`. The file is committed so `pnpm typecheck` works on a fresh clone.
- **Why:** The CLI printed a Node circular-dependency warning on every run, and the Vite plugin already does its job.
- **Alternatives considered:** Running `tsr generate` before `tsc` (duplicate work, plus the warning).

## 0010: Prettier remains only as a transitive dependency

- **What:** Prettier is installed only because `@tanstack/router-generator` uses it internally to format the generated route tree. There is no Prettier config, no script, and no direct dependency.
- **Why:** It is an internal detail of TanStack's generator and can't be removed without forking it. Biome is the project's only formatter and linter.

## 0011: When and where env is validated

- **What:**
  - `vite.config.ts` loads `.env` files and validates the client schema on `dev` and `build`, and the server schema on `dev` only.
  - In production, a Nitro plugin (`src/server/plugins/validate-env.ts`) validates the server env when the server boots.
  - `pnpm start` loads `.env` with Node's `--env-file-if-exists`.
- **Why:**
  - `VITE_` values are inlined at build time, so a bad one must stop the build.
  - Server values are runtime config. Requiring production secrets at build time would couple CI to secrets for no benefit.
  - TanStack Start's SSR handler is loaded lazily on the first request, so validating inside it wouldn't fail at startup. A Nitro plugin runs at boot, and on Vercel at cold start.
  - Real environment variables take precedence over `.env` files, matching Vite.
- **Alternatives considered:**
  - A custom `src/server.ts` entry that imports the env. It only runs on the first request (verified).
  - Validating server env during `build` (forces secrets into CI).
  - Reading env per request, as TanStack's docs suggest for edge runtimes. Not needed on Node/Vercel. Revisit if the deploy target moves to Cloudflare.

## 0012: Client schema lives in its own file; client env files avoid the `*.client.*` name

- **What:**
  - `src/lib/env/client.schema.ts` holds the schema and a `createClientEnv` factory.
  - `src/lib/env/client.ts` holds the instance built from `import.meta.env`.
  - The server env is a single file, `src/server/env.ts`.
- **Why:**
  - `import.meta.env` doesn't exist while Vite loads its config, so the config imports the schema file, not the instance.
  - TanStack Start's import protection denies `**/*.client.*` files on the server. The plan's original name, `env.client.ts`, broke the SSR build.
  - Env files use relative imports with `.ts` extensions because `vite.config.ts` imports them and Vite's upcoming native config loader requires explicit extensions. It currently warns without them.
- **Alternatives considered:**
  - A `process.env` fallback inside the client module (leaves `process.env` references in the browser bundle).
  - Duplicating the schema in the config.

## 0013: Three layers keep server-only code off the client

- **What:**
  - **Build:** TanStack Start import protection, with `client.files` set to `**/*.server.*` and `**/src/server/**`. `files` replaces the defaults, so the default `*.server.*` rule is restated. `src/server/env.ts` also carries the `@tanstack/react-start/server-only` marker.
  - **Runtime:** `src/server/env.ts` throws if evaluated where `window` exists. T3 Env's own proxy would also throw on any server-variable access in a browser.
  - **Test:** A static scan (`tests/utils/import-boundary.ts`) fails if any file outside `src/server/` and `src/functions/` imports `src/server/`. Fixtures prove it detects direct, relative, dynamic and re-export imports.
- **Why:** Import protection is the official mechanism and fails production builds, but only warns in dev. The test catches violations in CI without a full build and documents the rule. Both were verified by adding a real violation to a route: the test failed and the build failed with "Import denied in client environment".
- **Alternatives considered:** Only T3 Env's runtime proxy (catches access, not bundling). Running a full Vite build inside Vitest (slow and brittle).

## 0014: Env validation details

- **What:**
  - `emptyStringAsUndefined` is on, so blank lines in `.env` count as missing.
  - `DATABASE_URL` must use the `postgres` or `postgresql` scheme.
  - `EMAIL_FROM` accepts either `a@b.co` or `Name <a@b.co>`.
  - `RESEND_API_KEY` must start with `re_`, and `createFinalSchema` requires it when `EMAIL_PROVIDER=resend`.
  - `EMAIL_PROVIDER` is optional for now. Phase 6 defines the dev and production defaults.
  - Error messages list every invalid variable by name and never include values.
- **Why:** These give clear, actionable startup errors without leaking secrets into logs.
- **Alternatives considered:** Making `EMAIL_PROVIDER` required now (it would pre-empt Phase 6's selection rules).

## 0015: Neon driver is node-postgres (TCP) with a small pool and `attachDatabasePool`

- **What:**
  - `drizzle-orm/node-postgres` with a `pg` `Pool` (max 5, 10 s idle timeout), connected to Neon's pooled (`-pooler`) connection string.
  - `attachDatabasePool` from `@vercel/functions` is registered on the pool.
  - In dev, one pool is cached on `globalThis` so hot reloads don't leak pools.
- **Why:**
  - Neon's current "choose a connection method" guidance recommends TCP with `pg` for Vercel Fluid compute, which is the deploy target (decision 0002), and for long-running Node servers. Warm instances reuse TCP connections, so later queries skip connection setup.
  - `attachDatabasePool` keeps the function alive until idle connections close before Vercel suspends it. Outside Vercel it is a no-op (verified in its source).
  - Neon's PgBouncer does the real pooling, so the client pool stays small.
  - TCP also supports interactive transactions, which Better Auth and Test CRUD may need.
- **Alternatives considered:**
  - `neon-http`: fastest for one-shot queries, but no interactive transactions. Neon now positions it for edge runtimes where TCP isn't available.
  - `neon-serverless` over WebSocket: supports transactions, but needs `ws` and gives no benefit over TCP on Node.
  - `postgres.js`: also recommended, but Neon's Vercel example and `attachDatabasePool`'s pg support make `pg` the most documented path.
- **Revisit if:** The deploy target moves to Cloudflare Workers or another edge runtime. Switch to `neon-http` or `neon-serverless` there.

## 0016: Drizzle stable 0.45.x, not the 1.0 release candidate

- **What:** `drizzle-orm@0.45` and `drizzle-kit@0.31` (npm `latest`).
- **Why:** Drizzle's Neon docs show `drizzle-orm@rc` (1.0.0-rc). Better Auth's Drizzle adapter (Phase 6) and TanStack DB integrations target the stable line, and an RC can change APIs before GA.
- **Alternatives considered:** 1.0 RC (newer relational query API, higher churn risk). Revisit when 1.0 is published as `latest`.

## 0017: `sslmode=require` is rewritten to `verify-full`

- **What:** `withVerifiedSsl()` (`src/server/db/connection-string.ts`) rewrites `sslmode=prefer`, `require` and `verify-ca` to `verify-full`, unless `uselibpqcompat` is set. It runs for both the app pool and drizzle-kit.
- **Why:**
  - Neon's connection strings use `sslmode=require`. pg 8 already treats that as `verify-full`, but prints a "SECURITY WARNING" at runtime. The project rule is no warnings.
  - pg 9 will switch `require` to libpq semantics, which don't verify the certificate.
  - The rewrite keeps today's certificate-verifying behavior, silences the warning (verified) and survives the upgrade. Neon uses publicly trusted certificates, so `verify-full` works without extra configuration.
- **Alternatives considered:**
  - Asking users to edit the URL, or rejecting `require` in validation (friction with Neon's copy-paste string).
  - `uselibpqcompat=true&sslmode=require` (weaker: no certificate verification).

## 0018: Migrations use the direct URL and start from an empty baseline

- **What:**
  - drizzle-kit connects with `DATABASE_URL_UNPOOLED` when set (Vercel's Neon integration provides it), otherwise `DATABASE_URL`.
  - `drizzle.config.ts` loads `.env` itself and validates only the two URLs.
  - `drizzle/0000_init.sql` is an empty baseline (`SELECT 1`).
  - The schema uses `casing: "snake_case"`.
- **Why:**
  - Neon recommends direct connections for schema changes. PgBouncer's transaction mode can break DDL and session-level locks.
  - Validating only the URLs lets a CI migrate step run without app secrets such as email keys.
  - The baseline gives `db:migrate` a journal to apply before the first real table exists, so the pipeline is proven end to end.
  - With `snake_case` casing, TypeScript keys stay camelCase while columns stay snake_case, without naming every column twice.
- **Alternatives considered:** Deferring `db:migrate` until Phase 6 (the script would be untested). `db:push` only (no migration history for production).

## 0019: The health check hides failure details from clients

- **What:**
  - `checkDatabaseHealth()` (`src/server/db/health.ts`) runs `select 1` and returns `{ status, latencyMs, checkedAt }`.
  - The `getDbHealth` server function (`src/functions/health.ts`) wraps it.
  - A `/health` page renders the result through a route loader.
  - On failure, the driver error and its `cause` are logged on the server only.
- **Why:** Connection errors contain hostnames, ports and sometimes credentials. The client only needs to know whether the database is reachable. The page makes the check visible in SSR and exercises the server-function path.
- **Alternatives considered:** A server route at `/api/health` for uptime monitors (can be added when monitoring is set up in Phase 10). Returning the error message (leaks infrastructure details).
- **Verification:** A real Postgres 17 (embedded, local) was used because Docker wasn't available and no Neon credentials were configured yet. All four `db:*` scripts worked, and migrations applied to a fresh database. `/health` rendered OK with JS on and off, and "Unreachable" with no leaked details when the port was wrong. The check against a real Neon database was completed during Phase 6: `/health` returned OK over the pooled connection. The first request took 3.4 s while Neon woke from idle, and later ones about 280 ms, including the network round trip to the database region. `sslmode=require` was rewritten to `verify-full` against Neon's real certificates without warnings.

## 0020: Paraglide follows the official TanStack Start example; options live in `paraglide.config.ts`

- **What:**
  - The wiring matches `TanStack/router/examples/react/start-i18n-paraglide`: the Vite plugin, `paraglideMiddleware` in `src/server.ts` (given the original request), and router `rewrite` with `deLocalizeUrl` / `localizeUrl`.
  - Compiler options are in `project.inlang/paraglide.config.ts` (`defineConfig`), which both the Vite plugin and the `paraglide-js compile` CLI read.
  - `pnpm typecheck` compiles first, so it works on a fresh clone. `vitest.config.ts` also loads the plugin.
  - `emitTsDeclarations: true` generates `.d.ts` files, instead of the example's `allowJs`.
- **Why:**
  - One options source prevents drift between dev, build, tests and typecheck.
  - `emitTsDeclarations` keeps the tsconfig strict (`verbatimModuleSyntax`, no `allowJs`).
- **Alternatives considered:**
  - Inline plugin options plus duplicated CLI flags (drift risk).
  - A custom shared TS module (the config file is the official mechanism, available since Paraglide 2.x).
  - Committing the generated output.

## 0021: Locale strategy is URL-only for pages; English unprefixed, Nepali under `/ne`

- **What:**
  - `strategy: ["url", "baseLocale"]`, with `urlPatterns` listing `/ne/:path(.*)?` before `/:path(.*)?`. Paraglide matches in order.
  - No cookie or `Accept-Language` strategy for pages.
- **Why:**
  - Paraglide's routing docs give `["url", "baseLocale"]` as the setup for an unprefixed base locale.
  - With an unprefixed base locale, the URL strategy always resolves, so later strategies are never consulted. The docs say always-resolving strategies belong last.
  - Putting cookie or `Accept-Language` before `url` would make `/` language-dependent. That hurts canonical URLs, `hreflang` and caching, and makes the middleware redirect.
  - The URL is authoritative, and the switcher is the user's control. A test asserts that `Accept-Language: ne` doesn't change `/`.
- **Alternatives considered:**
  - `["url", "cookie", "preferredLanguage", "baseLocale"]` as in the example, which prefixes every locale including `/en`. It conflicts with the plan's "`/` for English".
  - Auto-redirecting first-time visitors based on `Accept-Language` (surprising, bad for SEO; could be added later as a dismissible suggestion banner).
- **Note:** Bare `/ne` gets a 307 to `/ne/`. The canonical Nepali home is `/ne/`.

## 0022: Server functions receive the page locale in a header

- **What:**
  - A global function middleware (`src/start.ts`, `src/middleware/locale.ts`) adds an `x-paraglide-locale` header with the page's locale to every server function call.
  - A Paraglide custom strategy, `custom-header`, is defined in `src/server.ts` and applied only to `/_serverFn/*` through `routeStrategies`. `toLocale()` rejects unknown values.
- **Why:**
  - Server function RPCs go to `/_serverFn/...` with no locale prefix. An experiment showed a call from `/ne/...` resolving to `en` on the server.
  - The header carries the exact locale of the page that made the call, and stays correct with two tabs in different languages. A shared cookie would not.
  - With the header, the probe returned `ne` from Nepali pages and `en` from English pages.
  - SSR-time calls run inside the page request's AsyncLocalStorage, so they are unaffected.
- **Alternatives considered:**
  - A cookie strategy for RPCs, as in the example (wrong with multiple tabs, and needs `setLocale()` on the client to write the cookie).
  - Passing `locale` as an explicit argument to every server function (easy to forget).

## 0023: The language switcher uses plain links to localized URLs

- **What:** `LanguageSwitcher` renders `<a href={localizeHref(location.href, { locale })} hreflang lang>` for each locale, from the router's de-localized location.
- **Why:**
  - Paraglide messages aren't reactive. A locale change needs a document load so SSR renders the new language, `<html lang>` and font preloads. This is the same thing `setLocale()` does with the URL strategy.
  - Anchors work without JavaScript, are crawlable, and keep path and search params (verified in the browser, both directions).
  - The URL hash can't be preserved in SSR, because browsers never send it.
- **Alternatives considered:** `setLocale()` buttons (need JS). Router `<Link>` (client navigation would show stale strings).

## 0024: Nepali formatting never uses ICU `ne` data

- **What:**
  - `src/lib/i18n/intl.ts` formats English with `Intl` directly.
  - For Nepali it uses only data every runtime has: `en-IN-u-nu-deva` for lakh grouping and Devanagari digits, locale-neutral date fields, and CLDR 47 `ne` month, weekday, currency and relative-time data transcribed into `src/lib/i18n/intl-ne.ts`.
  - The API exposes a portable subset: `dateStyle` / `timeStyle`, and decimal, percent and currency styles.
- **Why:**
  - Desktop Chrome's reduced ICU data has no Nepali: `Intl.DateTimeFormat.supportedLocalesOf("ne")` returns `[]`, so the browser silently formats English.
  - Node has full ICU and formats real Nepali. The result was a hydration mismatch (React error #418) on every Nepali page, and English formatting after React re-rendered.
  - The portable implementation produces identical strings everywhere. Tests compare it with Node's full-ICU `ne-NP` output for every date and time style, 16 dates across all months and weekdays, numbers, percent, currency, and every relative unit from -10 to +12 in both numeric modes. It matches exactly, including CLDR quirks like `+१ सत्रमा`.
- **Alternatives considered:**
  - `suppressHydrationWarning` (hides the error, but client re-renders still show English).
  - Client-only formatting (breaks SSR and no-JS).
  - Shipping full ICU data to browsers (not possible).
  - A formatting library (large, and still needs Nepali data).

## 0025: Dates render in a fixed app time zone; relative time takes an explicit `now`

- **What:** `APP_TIME_ZONE = "Asia/Kathmandu"` is the default for all date formatting. `formatRelativeTimeFrom(value, now)` requires `now`.
- **Why:** Servers run in UTC and browsers in local time, so machine-zone formatting differs between SSR and hydration. `Date.now()` during render also differs between server and client.
- **Alternatives considered:** The user's own zone (only knowable on the client, which forces client-only rendering or a cookie round-trip). UTC (wrong for the target audience).

## 0026: Devanagari font preloads only on Nepali pages; no preloads in dev

- **What:**
  - `fontPreloads(locale)` returns the Inter Latin preload everywhere, and the Noto Devanagari preload only for `ne`. It returns nothing in dev.
  - On English pages, the switcher's "नेपाली" label uses a system Devanagari font stack (`font-devanagari-system`), so English pages never download the 121 kB web font. Verified in the network log.
- **Why:**
  - This follows up decision 0007.
  - In dev, Vite injects extra stylesheet copies, so the browser re-requests the font instead of using the preload and logs a warning. Preloads are a production optimization.
- **Known benign warning:** After switching from an English page to Nepali in the same tab, Chrome can log "preloaded but not used within a few seconds" for the Devanagari font. The cached stylesheet requests the font milliseconds after the preload starts and doesn't attach to it. It is still downloaded only once. Cold loads of `/ne/`, including on a throttled network, use the preload with no warning.
- **Layout shift:** Nepali pages measured a CLS of 0.0006 to 0.0008, far below the 0.1 "good" threshold. The Devanagari fallback can match vertical metrics only; widths are unknown for system fonts (decision 0007). English pages measured 0.

## 0027: React is split into its own client chunk

- **What:** The client build's `codeSplitting.groups` puts `react`, `react-dom` and `scheduler` into a `react-vendor` chunk.
- **Why:** Adding Paraglide's URLPattern polyfill pushed the entry chunk past Vite's 500 kB warning, to 507 kB. React DOM alone is about 200 kB and rarely changes, so a separate chunk stays cached across deploys. The entry is now 287 kB and React is 219 kB.
- **Alternatives considered:** Raising `chunkSizeWarningLimit` (silences the warning without improving anything). Swapping client-side Zod for `zod/mini` (the forms in Phase 7 will bring Zod to the client anyway).

## 0028: How "no hydration warnings" was verified

- **What:** Headless Chrome 154 (puppeteer-core) loaded `/`, `/ne/`, `/health?tab=db&x=1` and `/ne/health?tab=db&x=1` on both the Vite dev server and the production build. It captured every console message and page error, clicked the language switcher, and recorded the URL, `<html lang>`, the rendered formatting samples, preloads and downloaded fonts before and after.
- **Result:**
  - The dev server (React's development build, which reports hydration mismatches in detail) had a clean console on all four pages, before and after switching.
  - Production had no hydration errors.
  - A no-JS load renders the full localized content with the correct `lang`.
- **Why:** React's production build reports hydration failures only as minified error #418, so a dev-server run was required to catch and diagnose the Nepali `Intl` mismatch (decision 0024).

## 0029: Windows checkouts need a short path

- **What:** The README asks Windows users to keep the project path to about 90 characters or fewer.
- **Why:**
  - A fresh-clone check under a long temporary directory failed tests and the build with `ERR_REQUIRE_CYCLE_MODULE` on `@tanstack/react-start/dist/esm/server-only.js`. The module path was 274 characters, and Node treated the ES module as CommonJS.
  - The same commit cloned to a shorter path passed install, typecheck, all 60 tests and the build with zero warnings.
  - The working copy's longest dependency paths are about 170 characters. pnpm already truncates `.pnpm` directory names on Windows (`virtualStoreDirMaxLength`).
- **Alternatives considered:** pnpm `node-linker=hoisted` (loses pnpm's strictness). Enabling long paths only (already on in this machine's registry, and not enough for Node here).

## 0030: TanStack Query via the official SSR integration, with a 60-second `staleTime`

- **What:**
  - `setupRouterSsrQueryIntegration` from `@tanstack/react-router-ssr-query`, with a new `QueryClient` per `getRouter()` call (once per request on the server).
  - `staleTime` defaults to 60 s, and `AppError`s aren't retried.
  - Loaders `await queryClient.ensureQueryData(...)`, and components read with `useSuspenseQuery`.
  - Query keys for translated data include the locale.
- **Why:**
  - The integration dehydrates and hydrates automatically and provides `QueryClientProvider`. There is no hand-written dehydration.
  - With the default `staleTime` of 0, freshly hydrated data counts as stale and refetches on mount. Verified: with 60 s, zero server-function requests are made after hydrating `/stack`.
  - Locale in the key stops English and Nepali results from sharing cache entries.
- **Alternatives considered:** Router loader data only, without Query (no shared cache or background refresh, and Test CRUD needs Query for TanStack DB). `useQuery` (doesn't run during SSR).

## 0031: One `AppError` shape, normalised by middleware and serialised with an adapter

- **What:**
  - `AppError` (`src/lib/errors.ts`) carries `code` (7 codes), `status`, a developer `message`, optional `fieldErrors`, and `requestId`.
  - Global function middleware assigns a request ID, logs one JSON line per call (function name, method, duration, outcome), and normalises every thrown value:
    - redirect and notFound pass through;
    - an `AppError` keeps its code;
    - a `ZodError` becomes `BAD_REQUEST`;
    - anything else becomes `INTERNAL` with no details, and the original is logged.
  - A `createSerializationAdapter` registered in `createStart` rebuilds a real `AppError` on the client.
  - `ErrorPage` shows a localized message chosen by `code`, plus the request ID.
- **Why:**
  - Clients can branch on `error instanceof AppError` and `code`, never on message strings.
  - Raw errors leak infrastructure details. Verified: a thrown message containing a host and password never appears in the SSR HTML or on the RPC wire, while the server log keeps it under the same request ID.
  - User-facing text stays in Paraglide, so the same error reads correctly in either language.
- **Alternatives considered:** Returning `{ ok, error }` result objects from every function (verbose, and loses throw semantics in loaders). Relying on Start's default error serialisation (class and fields not guaranteed).

## 0032: `zodInput()` instead of passing Zod schemas straight to `inputValidator`

- **What:** `zodInput(schema)` wraps a schema in a `{ parse }` validator that throws `AppError("BAD_REQUEST")` with field errors keyed by dotted path. Input and output types come from the schema.
- **Why:** For Standard Schema validators, Start throws a plain `Error` whose message is a JSON dump of the issues. That would need string parsing to normalise.
- **Alternatives considered:** Parsing the JSON error message in middleware (fragile). Validating manually inside each handler (easy to forget).

## 0033: Middleware lives in `src/middleware/`, not `src/server/middleware/`

- **What:** The CSRF, logging, error and auth middleware live in `src/middleware/`.
- **Why:** `src/start.ts` registers global middleware and is part of the client bundle. The locale middleware has a client half. Import protection denies `src/server/**` on the client, so middleware can't live there. The Start compiler strips `.server()` bodies from the client build (verified: the client bundle scan is clean). This changes the folder plan in PLAN.md.
- **Alternatives considered:** Excluding middleware files from import protection (weakens the boundary).

## 0034: CSRF protection for server functions

- **What:** Start's `createCsrfMiddleware({ filter: ctx => ctx.handlerType === "serverFn" })` is registered as request middleware.
- **Why:**
  - In dev, Start warned that server functions were unprotected.
  - Verified by replaying a real server-function request. Before the change, cross-site, foreign-`Origin` and signal-less requests all returned 200. After it, they return 403 while same-origin requests return 200.
  - Page navigation is unaffected.
- **Alternatives considered:** Silencing the warning (leaves the endpoints open). A token-based CSRF scheme (unnecessary for same-origin RPC with Fetch Metadata, and needs state).

## 0035: Layout routes, guards and the session slot

- **What:**
  - Pathless layouts: `_public` (footer), `_auth` (login and register, which bounce signed-in users to a safe `?redirect=`), `_authed` (redirects anonymous users to `/login?redirect=<path>`), `_admin` (anonymous users go to login, non-admins get `AppError("FORBIDDEN")`).
  - The router context is typed `{ queryClient, session: Session | null }`, and `session` is always `null` until Phase 6.
  - The guards already run their real logic against that slot. `_authed` and `_admin` narrow `session` to non-null for child routes.
  - Placeholder server middleware follows the same contracts: `sessionMiddleware`, `requireUserMiddleware` (UNAUTHORIZED) and `requireAdminMiddleware` (FORBIDDEN).
  - `?redirect=` only accepts same-site paths (`/…`, not `//host` or `/\host`), so login can't become an open redirect.
- **Why:** Phase 6 only has to fill the session in. Routes, redirects and server checks are already wired and tested. Route guards control navigation only; server functions must still use the middleware.
- **Verification:** `/account` and `/admin` return 307 to `/login?redirect=…`, and `/ne/account` returns 307 to `/ne/login?redirect=%2Faccount`. `?redirect=//evil.example` is dropped. Unknown paths return 404 with the localized page.

## 0036: `/stack` is the Phase 5 reference page

- **What:** A public page listing this project's tech stack, with the Phase 5 patterns applied:
  - Zod search params with `.default().catch()` (invalid values are corrected and default values stripped from the URL);
  - a loader using `ensureQueryData`;
  - a `pendingComponent` skeleton;
  - a deferred stats promise rendered with `<Await>` and streamed;
  - a search `<form>` that works without JS, and links for sorting and pagination;
  - a dev-only `?simulate=error` that throws a deliberately leaky error.
- **Why:** The patterns get exercised on real, localized content without building ahead into Test CRUD.
- **Streaming verified by chunk timing:** A browser user agent receives the list, fallback and dehydrated state in the first chunk (79 ms), and the stats in a later chunk (881 ms). Crawler user agents get one complete document, because Start buffers for bots, which is good for SEO. With JS disabled, the fallback stays visible, since streamed content is inserted by inline script.

## 0037: Email provider selection and fail-fast in production

- **What:** `selectEmailProvider()` (`src/server/email/config.ts`) is a pure, tested function:
  - `EMAIL_PROVIDER=resend` → Resend (the env schema already requires a key).
  - `EMAIL_PROVIDER=console` → console in development, an error in production.
  - Unset → Resend if `RESEND_API_KEY` is set; otherwise console in development and an error in production.
  - "Production" means `import.meta.env.PROD`, fixed at build time.
  - The boot-time Nitro plugin calls `getEmailProvider()`, so a misconfigured production server refuses to start.
- **Why:**
  - A production app that silently prints verification and reset emails to a log is broken in a way nobody notices until users complain.
  - `NODE_ENV` isn't reliable: `pnpm start` doesn't set it, and a production build could run with it unset.
  - Verified by booting the production build: `console` and "no provider" both stop with the messages above, and a Resend key boots normally.
- **Alternatives considered:** Deciding at send time (fails on the first signup, not at deploy). Allowing console in production with a warning (emails lost).
- **Consequence:** Smoke-testing a production build locally needs `RESEND_API_KEY` set for that run (see the README).

## 0038: React Email 6, rendered in an explicit locale

- **What:**
  - The unified `react-email` package provides both components and `render` / `toPlainText`.
  - The five templates share a layout and a typed registry (`EmailPropsMap` → subject builder + sample data).
  - `renderEmail(id, data, { locale, siteName })` returns subject, HTML and plain text.
  - Every message call passes `{ locale }` explicitly, rather than reading `getLocale()`.
- **Why:**
  - The recipient's language isn't the current request's: an admin action, a background job or an email change can send to someone else. Explicit locale makes that correct by construction.
  - Plain text is included for accessibility and spam scores.
- **Devanagari:**
  - The Nepali layout sets `lang="ne"` and a stack of fonts that ship with each major OS (Nirmala UI, Kohinoor Devanagari, Noto Sans Devanagari, Mangal).
  - Clients that support web fonts also get Noto Sans Devanagari from the Fontsource CDN.
  - Verified visually in Chrome: conjuncts and vowel signs shape correctly, and numbers use Devanagari digits.
  - OTP codes stay in Latin digits so they can be typed on any keyboard.
- **Alternatives considered:** Tailwind in emails (heavier, and inline style objects are enough here). One template per locale (duplication).

## 0039: The email preview is a Vite dev-server middleware, not an app route

- **What:**
  - `/dev/emails` is served by `vite/email-preview-plugin.ts` (`apply: "serve"`).
  - It lists every template × locale with iframes, plus raw HTML and `.txt` URLs.
  - Templates load through a dedicated runnable Vite environment (`email_preview`).
- **Why:**
  - Vite never registers `apply: "serve"` plugins during `vite build`, so production output can't contain the preview.
  - Verified: the build output has no "dev/emails" or preview code, and `/dev/emails`, `/dev/emails/otp-code/ne` and `/ne/dev/emails` return 404 on the production server.
  - An app route would sit in the committed route tree. Excluding it only for builds (`routeFileIgnorePattern`) would make `routeTree.gen.ts` differ between dev and build and churn in git.
  - Start runs its "ssr" environment inside Nitro, where `ssrLoadModule` isn't available, hence the dedicated environment.
- **Alternatives considered:**
  - A route guarded with `import.meta.env.DEV` (still shipped as a 404 route).
  - `react-email`'s own preview server (a second dev server; it wouldn't use the app's Paraglide setup or aliases).
- **Note:** The index page's labels are English. It's a developer tool, not user-facing; the emails themselves are fully localized.

## 0040: Better Auth configuration

- **What:** Better Auth 1.7 with `@better-auth/drizzle-adapter` (the adapter now ships separately), the `admin` and `emailOTP` plugins, and `tanstackStartCookies()` as the last plugin. The API is mounted at `src/routes/api/auth/$.ts`, and the schema is generated with the `auth` CLI (`pnpm auth:schema`). Settings:
  - email and password with `requireEmailVerification`, `sendOnSignIn` (an unverified user who tries to log in gets a new link), `autoSignInAfterVerification`, and `revokeSessionsOnPasswordReset`;
  - `changeEmail` enabled;
  - Google only when both env vars are set;
  - OTP with `disableSignUp`, so codes sign in existing users only and new accounts always go through verified sign-up.
- **Why:** This follows the official TanStack Start integration and plugin docs. The session cookie cache stays off, so a revoked session stops working on the next request (verified: a revoked second device is sent to login).
- **Alternatives considered:** Hand-written Drizzle auth tables (drift from Better Auth's expectations). Allowing OTP sign-up (creates accounts without a password or name).

## 0041: Auth emails are sent in the user's language, in the background

- **What:**
  - The auth client sends the page locale in `x-paraglide-locale`. A Paraglide route strategy reads it for `/api/auth/*`, the same mechanism as server functions (0022).
  - `resolveEmailLocale()` uses that header, then the locale of the request's `callbackURL`, because emailed links are opened without our header, then `getLocale()`.
  - Emails are sent without blocking the response, and `advanced.backgroundTasks.handler` is set to Vercel's `waitUntil`.
- **Why:**
  - A user on `/ne/register` gets Nepali verification and welcome emails, verified end to end.
  - Not awaiting delivery avoids a timing side channel that would reveal which emails have accounts, as the Better Auth docs advise.
- **Alternatives considered:** A `locale` column on the user (extra migration, and still needs the request locale for anonymous flows like OTP and reset). Always sending English.

## 0042: Email-change notice to the old address

- **What:** When a change-email link is confirmed, `afterEmailVerification` re-verifies the request's token with `verifyJWT` and the app secret, reads the previous address from it, and sends it the `email-changed` security notice. For ordinary verification it sends the `welcome` email instead.
- **Why:** Better Auth passes only the already-updated user to the hook. The signed token is the one place that still names the previous address. Better Auth has already validated the token, and the second verification makes the hook independent of that. Verified end to end: the new address gets the link, and the old address gets the notice.
- **Alternatives considered:**
  - `sendChangeEmailConfirmation`, which makes the old address approve first (a different flow, and the plan's template is a notice).
  - A DB hook (update hooks receive only the changed fields).
- **Risk:** This relies on Better Auth's token payload (`email`, `updateTo`). The e2e flow will catch a change on upgrade.

## 0043: Session in the router context via TanStack Query; admin checked on the server

- **What:**
  - The root `beforeLoad` fills `context.session` from `sessionQueryOptions()` (the `getSession` server function, cached for 60 s on the client), and sign-in, sign-out and account changes invalidate it.
  - `_authed` redirects to `/login?redirect=<path>`.
  - `_admin` calls the `ensureAdmin` server function (`requireAdminMiddleware`) on every navigation instead of trusting the cached context. Anonymous visitors are redirected to login; signed-in non-admins get the FORBIDDEN page. *(Revised by 0090: on entering the admin area and on every SSR request; inner navigations reuse the loaded admin session. Since 0095 the gate is any permission, not the admin role.)*
- **Why:** One session lookup per SSR request, and no extra RPC on client navigations for ordinary pages. The admin area gets a server decision each time. Data safety never depends on these guards, because server functions carry their own middleware.
- **Alternatives considered:** Calling `getSession` in every `beforeLoad` (an RPC per navigation). Trusting the cached role for `_admin` (fails the plan's "checks the role on the server").

## 0044: AppError status codes survive SSR

- **What:**
  - `setErrorStatus(error)` (an isomorphic helper) records an AppError's status in a per-request `AsyncLocalStorage` record (`src/server/http/error-status.ts`).
  - The server entry wraps each request in that record and, when the SSR response is 500 and a status was recorded, returns it with that status.
  - `_admin` uses it, so a non-admin gets a real 403.
- **Why:** TanStack Router's SSR sets any errored match to 500 (`router-core` `applyFailure`), and headers set during rendering don't reach the final Response (both tried and verified). A 403 page served as 500 misleads monitoring and crawlers.
- **Alternatives considered:** `setResponseStatus` in `beforeLoad` (overwritten). A response header marker (dropped).

## 0045: Rate limits keyed by a trusted client IP

*Extended by 0185: guest sign-in (`/sign-in/anonymous`) allows 5 per hour per IP.*

- **What:**
  - Rate limiting is on in every environment, stored in the database, and has stricter rules for sign-in, sign-up, OTP, reset, verification and account changes.
  - The `/api/auth` route rewrites the request with `x-client-ip` taken from a trusted source (Vercel's edge headers on Vercel, otherwise the socket address), and Better Auth reads only that header.
- **Why:**
  - Better Auth disables rate limiting in development by default, which left nothing to test.
  - In the production build it warned it couldn't find a client IP and fell back to one shared bucket per path, so one attacker could lock everyone out.
  - Trusting client-supplied `X-Forwarded-For` would let attackers rotate fake IPs.
  - Verified on the production build: seven failed logins with a different forged `x-client-ip` and `x-forwarded-for` on each returned 401 five times, then 429, all in one bucket, with no warnings.
  - Database storage works across serverless instances.
- **Alternatives considered:** Memory storage (per instance). Trusting `X-Forwarded-For` (spoofable).
- **Note:** The server runtime's Request subclass (srvx) can't be passed to `new Request()`, so the copy is rebuilt from url, method, headers and body.

## 0046: Auth pages and placement

- **What:**
  - `_auth` holds login, register, sign-in-code and forgot-password, and bounces signed-in users to a safe `?redirect=` target (re-localized).
  - `verify-email` and `reset-password` live under `_public`: a successful verification arrives signed in, and a signed-in user may still reset from an emailed link.
  - Forms are simple accessible controlled forms (label, `aria-invalid`, `aria-describedby`, `role="alert"`). Phase 7's form system replaces them.
  - Better Auth error codes map to localized messages, and raw server text is never shown.
  - "Forgot password" and "send code" show the same confirmation whether or not the account exists; only rate limits are surfaced.
- **Why:** This avoids account enumeration, keeps pages working in both languages, and avoids building the Phase 7 form library early.

*Restated in 0161 (Task 35): `_public` keeps verify-email and reset-password; the site's other pages moved to `_site` (the portfolio at `/`) and `/dev`.*

## 0047: The admin seed wraps Better Auth's `create-admin`

- **What:** `pnpm db:seed-admin` (`scripts/seed-admin.mjs`) validates `--email`, `--password` (12+ characters) and `--name`, falling back to `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME`. It then runs the official `auth create-admin` with the app's auth config, spawned with Node directly, without a shell.
- **Why:** The official command hashes the password, marks the email verified and sets the role the same way the app does. There's no second implementation to keep in sync.
- **Alternatives considered:** Inserting rows by hand (would duplicate password hashing). Admin-plugin `createUser` (needs an admin session).

## 0048: Better Auth's env *name* appears in the client bundle

- **What:** The client bundle contains the string `BETTER_AUTH_SECRET` inside Better Auth's generic env reader, which reads from an empty object in the browser. No value is ever present.
- **Why it's acceptable:** It's library code shared between client and server builds. The plan's "no server variable names" check targets our own env. The build-output scan confirms no values and no server modules; all of our server code is absent.

## 0049: Local e2e database must be UTF-8

- **What:** The end-to-end runs used a throwaway embedded Postgres created with UTF-8 encoding. Neon databases are UTF-8 (verified read-only on the project's database).
- **Why:** Windows' default encoding (WIN1252) rejected the Devanagari name "राम" with error 22P05. It's a test-environment trap, not an app bug, but any self-hosted Postgres for this app must be UTF-8.

## 0050: Form system built on TanStack Form composition and shadcn Field

- **What:**
  - `src/components/forms` sets up `createFormHookContexts` and `createFormHook`, exporting `useAppForm` and `withForm`, with 14 field components and three form components (`Form`, `SubmitButton`, `FormErrorSummary`).
  - Every field renders through `useFieldA11y` or `FieldShell`, which provide:
    - stable ids (a per-form `useId` prefix plus the field name);
    - a label (`htmlFor`), a description and an error (shadcn `FieldError`, `role="alert"`);
    - `aria-invalid`, and `aria-describedby` listing the description and the error.
  - Groups (radio, checkbox group) use `<fieldset>` and `<legend>`.
- **Why:**
  - This is the documented TanStack Form composition API: fields get typed state from context, so forms stay terse.
  - shadcn's `Field` family is the design system's own form layout and accepts Standard Schema issues.
  - Per-form id prefixes keep two forms on one page from colliding.
- **Alternatives considered:** react-hook-form (the plan names TanStack Form). Hand-rolled layout (duplicates shadcn).

## 0051: When errors appear, and `formValidators()`

- **What:**
  - Errors show once a field has been blurred or a submit was attempted, never while the user types into a pristine field.
  - `formValidators(schema)` applies one schema to `onChange`, `onBlur` and `onSubmit`.
- **Why:**
  - With only `onChange`, tabbing past an empty required field never validated it. A test caught this.
  - Blur covers fields the user skipped, and submit covers untouched ones. Duplicate messages across causes are de-duplicated.
- **Alternatives considered:** Showing errors immediately (noisy). Validating only on submit (late feedback).

## 0052: FormErrorSummary focuses itself; SubmitButton never blocks

- **What:**
  - After a failed submit, the summary (`role="alert"`, labelled by its heading) lists each problem as "Label: message", with a link that focuses the field (the first option for groups). The summary takes focus on each failed attempt, but not while the user types a fix.
  - `SubmitButton` is disabled only while submitting (`aria-busy`, pending label), not while the form is invalid.
- **Why:** This is the GOV.UK error-summary pattern: keyboard and screen-reader users learn what failed and can jump to it. A disabled submit button gives no feedback about why.

## 0053: Validation helpers return localized messages at validation time

- **What:** `src/lib/validation.ts` provides:
  - text: `required`, `optionalText`, `email`, `url`;
  - passwords: `password` with a 0–4 `passwordStrength` score;
  - numbers: `numberRange`, `currency` (two decimals, non-negative by default);
  - choices: `choice`, `choices`, `mustAccept`.
- **How messages work:** They're Zod `error` callbacks that call Paraglide messages, so the same schema reports in the current locale on client and server, with numbers formatted per locale (for example "कम्तीमा ८ अक्षर …"). Tests confirm a schema created in English reports in Nepali after the locale changes.
- **Why:** One schema for forms and server functions, with no per-locale schemas.

## 0054: Number and currency inputs keep a draft string

- **What:**
  - `NumberField` and `CurrencyField` keep what the user typed separately from the stored number. `parseLocaleNumber` accepts Devanagari digits, grouping commas and spaces, and yields NaN for garbage, which the schema reports as "Enter a number".
  - Currency shows the locale's symbol (NPR or नेरू) and reformats to two decimals with local grouping on blur.
  - Both use `type="text"` with a numeric `inputmode`.
- **Why:** `<input type="number">` rejects Devanagari digits and grouping, and silently empties invalid input. A draft string also stops partial input like "12." from being clobbered while typing.

## 0055: Local changes to shadcn components

- **What:**
  - `Field` no longer has `role="group"`.
  - The `input-group` wrapper and addon lost `role="group"`, and the addon lost its click-to-focus handler.
  - `FieldError` uses `===` and message keys instead of index keys.
  - `dialog.tsx` keeps its localized "Close" labels when shadcn adds components that depend on it: the CLI overwrite was reverted from a backup.
- **Why:**
  - Biome's a11y rules flagged these as real issues. Labels already name single controls, and genuine groups use `<fieldset>`.
  - The click-to-focus handler was a mouse-only nicety that needed two lint suppressions.
- **How to add shadcn components:** Back up `src/components/ui`, run `shadcn add … --overwrite`, restore changed existing files, then fix the CLI's `from "cn"` import.

## 0056: Component tests run in jsdom with a shared harness

- **What:**
  - Component tests opt in with `// @vitest-environment jsdom`.
  - `tests/setup/dom.ts` adds jest-dom matchers, cleanup, and stubs for `ResizeObserver`, `scrollIntoView` and pointer capture, which Radix UI and cmdk use but jsdom lacks.
  - `tests/components/forms/harness.tsx` renders a real `useAppForm` form with one field and checks the accessibility contract (`aria-invalid`, plus `aria-describedby` pointing at the error text).
- **Why:** The fields are tested through the same form machinery the app uses, including validation timing and the error summary, rather than in isolation.

## 0057: Phone numbers are stored as E.164 with a separate country picker

- **What:** `PhoneField` pairs a searchable country picker (Nepal +977 by default) with a national-number input. It stores E.164 and validates with libphonenumber-js `isValidPhoneNumber`. Devanagari digits are accepted, and the number is reformatted in national style on blur.
- **Why:**
  - E.164 is one unambiguous format for storage, SMS providers and `tel:` links.
  - Country names come from `Intl.DisplayNames("en")` in both languages. Desktop Chrome has no Nepali region names, so the server and browser would render different text and cause a hydration mismatch.
- **Alternatives:**
  - `react-phone-number-input`: brings its own styling and flag assets, and doesn't use our field shell.
  - A single free-text input: parsing is ambiguous without a country.

## 0058: Date fields store calendar dates as strings

- **What:**
  - `DateField` stores `"YYYY-MM-DD"` and `DateRangeField` stores `{ from, to }` in that format. `src/lib/i18n/date-only.ts` converts them.
  - Dates are displayed via `isoDateInstant` (noon UTC) and `formatDate` in Asia/Kathmandu.
  - The picker is react-day-picker 10 (shadcn Calendar) wrapped as `LocalizedCalendar`. Captions, weekdays, digits and day labels come from `src/lib/i18n/intl.ts`.
  - `TimeField` is a text input normalised to `"HH:mm"`, with Devanagari digits in Nepali.
- **Why:**
  - A birthday or deadline is a calendar day, not an instant. Storing `Date` objects shifts the day across time zones and serialization.
  - `<input type="time">` can't show Devanagari digits and differs per browser.
- **Alternatives:**
  - A date-fns locale for Nepali: none exists that matches our CLDR data.
  - The native date input: not localizable and not consistent across browsers.

## 0059: Rich text loads only in the browser, behind a placeholder of the same size

- **What:**
  - `RichTextField` renders `<ClientOnly fallback={placeholder}>` with `<Suspense fallback={placeholder}>` around `React.lazy(() => import("./rich-text-editor"))`.
  - The editor uses Tiptap 3 `useEditor({ immediatelyRender: false })`.
  - The placeholder and the editor share their frame classes (`rich-text-frame.ts`): a 40px toolbar row and a 160px minimum surface.
- **Measured:** In Chrome, both are 202px tall at the same position in en and ne. CLS is about 0.00001. There are no hydration warnings.
- **Why:**
  - ProseMirror needs the DOM. Loading it lazily keeps Tiptap out of the main client bundle and out of the SSR render.
  - Matching geometry means nothing moves when the editor arrives.
- **Toolbar:**
  - Follows the WAI-ARIA toolbar pattern: one tab stop, arrow keys, Home and End.
  - Toggle buttons use `aria-pressed`.
  - Unavailable Undo/Redo use `aria-disabled`, not `disabled`, so arrow keys don't skip them.
- **Alternatives:** Rendering the editor's HTML on the server: Tiptap's SSR output doesn't match the client-mounted editor, so it would cause hydration warnings.

## 0060: Sanitizing rich text on the server, with a SafeHtml brand

- **What:**
  - `sanitizeRichText()` in `src/server/rich-text/sanitize.ts` uses sanitize-html with an allowlist that exactly matches what the toolbar produces. Allowed tags: p, br, strong, em, u, s, code, pre, h2, h3, ul, ol, li, blockquote, hr, a.
  - Links allow only href (http, https, mailto) and are forced to `rel="noopener noreferrer nofollow" target="_blank"`. A link that loses its href becomes plain text.
  - It returns `SafeHtml`, a compile-time brand. `RichTextContent` is the app's only `dangerouslySetInnerHTML`, and it accepts only `SafeHtml`.
  - The rule: sanitize before storage and again on the server read path before rendering.
  - The editor additionally only allows http, https and mailto links (`normalizeLinkHref`).
- **Why:**
  - Server-side sanitizing can't be bypassed by a modified client. The brand makes rendering unsanitized HTML a type error.
  - The second pass protects against rows written by older code or directly in the database.
- **Alternatives:**
  - DOMPurify in the browser: it adds client weight, and client-side sanitizing alone is bypassable. Rendering in the browser would also need the sanitizer in the client bundle, while sanitizing on the server read path keeps it server-only. In production, sanitize-html and its PostCSS dependency are not in the client bundle (verified).

## 0061: The dev-only showcase is a real route, dropped from production builds

- **What:**
  - `src/routes/_public/dev/forms.tsx` throws `notFound()` in `beforeLoad` unless `import.meta.env.DEV`. Its component is `import.meta.env.DEV ? FormsShowcase : () => null`.
  - The showcase module builds its schema and options inside functions, so it has no top-level side effects and the bundler drops it.
  - `previewRichText`, a dev server function, also refuses outside dev.
- **Verified:** The production server returns 404 for `/dev/forms` and `/ne/dev/forms`. The build output contains no showcase component or schema.
- **Why:**
  - A real route exercises the actual layout, locale routing and hydration.
  - A static import is used because `lazyRouteComponent` made React log "called use() to suspend … did not call use()" while hydrating this route in dev.
- **Alternatives:**
  - Storybook (Task 14): it doesn't exercise SSR or the router.
  - A Vite `apply: "serve"` plugin, as for `/dev/emails`: it can't render inside the app shell.

*Superseded by 0162: the guard is `DEV_ROUTES` (`src/lib/dev-routes.ts`), and the route is `src/routes/dev/forms.tsx`.*

## 0062: File fields use the native input plus drag-and-drop, and validate in the schema

- **What:**
  - `FileField` and `ImageField` keep a visually hidden but focusable `<input type="file">` labelled by the field. A second `<label>` acts as the visible "Choose" button and shows a focus ring through `peer-focus-visible`.
  - The drop zone is a pointer-only enhancement, with a lint suppression and comment.
  - The value is `File[]`. `files({ maxBytes, accept, min, max })` reports size and type errors with the file name, localized.
  - `accept` also narrows the native picker. Image previews use object URLs that are revoked on change and on unmount.
- **Why:**
  - The native input gives keyboard users and assistive technology the platform file picker.
  - Dropped files bypass `accept`, so validation has to live in the schema.
- **Alternatives:** react-dropzone: it duplicates what roughly 40 lines do here and has its own input handling.

## 0063: `mustAccept()` takes a boolean input

- **What:** `mustAccept()` is now `z.boolean().refine(v => v)` instead of `z.literal(true)`.
- **Why:** The form's default value is honestly `false`. With a literal input type, every form needed a cast to start unticked. The output and error message are unchanged.

## 0064: When to use TanStack DB, Query or Store, and the rest

*The "edit with instant feedback" row is superseded by 0174: admin CRUD uses Query mutations; TanStack DB is for client-first apps.*

| State | Tool | Example in this app |
| --- | --- | --- |
| Server data you **read** (lists, details, stats) | **TanStack Query**, using `queryOptions` and `ensureQueryData` in loaders. It is SSR-dehydrated by the official integration. | `/stack` list and stats, session (`sessionQueryOptions`) |
| Server data you **edit** in place and want instant feedback (optimistic, with rollback) | **TanStack DB query collection**, backed by Query, with live queries over it | Test CRUD admin table (Task 11): edit, delete and bulk delete update instantly and roll back when the server function fails |
| Client-only **UI preferences** shared across components and persisted | **TanStack Store** (`src/lib/stores`) | Theme, admin sidebar collapsed, table page size and hidden columns |
| Values being typed into a form | **TanStack Form** | Every form (`useAppForm`) |
| Shareable, bookmarkable view state | **URL search params** (Zod `validateSearch`) | `/stack?q=&sort=&page=`, and Test CRUD filters later |
| Local, one-component state | `useState` | Popover open, password visibility |

- **Rules of thumb:**
  - Never copy server data into a Store. Query or DB own it.
  - Don't use DB for read-only pages. Query is simpler and is already SSR-hydrated.
  - Don't put view state in a Store if a link should reproduce it. Use the URL.
- **Alternatives considered:**
  - Query alone with `onMutate` and manual cache patching: workable, but every feature re-implements optimistic updates and rollback. DB makes that the default.
  - Zustand or React context for preferences: TanStack Store is in the stack, has fine-grained `useSelector` subscriptions, and supports actions.

## 0065: Preferences live in cookies, with one store per router

- **What:**
  - `createPreferencesStore(readPreferences())` is created in `getRouter()`, so there is one per request on the server and one per tab in the browser, exposed as `context.preferences`.
  - `readPreferences` is a `createIsomorphicFn`. It reads `getCookies()` on the server and `document.cookie` in the browser, so both renders start from the same values.
  - Store actions write `theme`, `sidebar` and `table-prefs` cookies (one year, `SameSite=Lax`, `Secure` on https, not httpOnly because the browser writes them).
  - Values are parsed with Zod. Tampered values fall back to defaults, and page sizes are limited to an allowlist.
- **Theme without a flash:**
  - An explicit "dark" is rendered by the server as `<html class="dark">`.
  - "system" is resolved before first paint by a tiny inline `ScriptOnce` script in `<head>` (emitted in the SSR HTML only, removes itself, supports a CSP nonce for Task 16).
  - `ThemeSync` then keeps the class in sync and follows OS changes.
  - `<html>` has `suppressHydrationWarning`, needed only because that script may add the class before hydration.
  - `color-scheme` is set per theme so native controls match.
- **Verified in Chrome** (dev server):
  - With a dark cookie, or "system" on a dark OS, `.dark` and the dark background are already applied when `<body>` is first parsed.
  - Choosing Dark in the menu and hard-reloading also shows no light frame.
  - Production SSR renders `class="dark"` for the dark cookie and falls back to "system" for a tampered cookie.
  - Sidebar: collapsing persists, the JS-off server render shows it collapsed (56px), and it is still collapsed after a reload.
  - There were no console warnings in either locale.
- **Why cookies:** `localStorage` is invisible to the server. The server would render defaults and the client would correct them after hydration, causing a flash or a hydration mismatch. The store must not be module-level, because on the server it would be shared between visitors.
- **Alternatives:**
  - `localStorage` plus a blocking script for everything: it still can't render the sidebar width or page size on the server.
  - A server function to set cookies: an extra round trip for a purely cosmetic change.

## 0066: TanStack DB uses the official router integration and has its own chunk

*Superseded by 0189: TanStack DB loads only with the pages that use it (`DbScope`).*

- **What:**
  - `getRouter()` creates a `DbClient` with the request's `QueryClient` as a dependency (`src/lib/tanstack-db.ts`, `queryClientOf`). It wraps the router with `routerWithDbClient` from `@tanstack/react-router-with-db` 0.1.0, after `setupRouterSsrQueryIntegration`, because it chains the existing `dehydrate`, `hydrate` and `Wrap`.
  - Feature collections are module-level descriptors (`collectionOptions(id, factory)`) that each DbClient materializes separately, so SSR requests never share rows. Tests cover this.
  - A `tanstack-db` client chunk group (alongside `react-vendor`) keeps the entry chunk under Vite's 500 kB warning: entry 299 kB, DB 284 kB, 84 kB gzipped.
- **Why:**
  - This is the officially documented Start integration. It streams live queries rendered during SSR and hydrates them.
  - Mutation handlers that throw make DB roll back the optimistic change, which is exactly what Test CRUD's admin needs. `tests/unit/db-collection.test.ts` shows it.
- **Costs and risks:**
  - The DB runtime loads on every page, about 84 kB gzipped and cached separately.
  - Both packages are pre-1.0. Query collections still auto-refetch after a handler unless it returns `{ refetch: false }`, and that changes at 1.0. Pin versions and re-check on upgrade.
- **Alternatives:** Creating the DbClient only on admin routes: it has no official SSR path and would duplicate the provider wiring.

## 0067: Uploaded images are stored in Postgres and served by a Nitro route

*Superseded by 0098 (Cloudinary attachments); the legacy table remains only for `pnpm attachments:import-legacy`.*

- **What:**
  - `test_crud_image` (`bytea`, sniffed MIME type, size) is referenced by `test_crud.image` with `ON DELETE SET NULL`. Create and update are ONE FormData request: shared-schema JSON plus an optional file. The image is inserted, replaced or removed in the same transaction as the row, and replaced or orphaned images are deleted there too.
  - The type comes from the file's magic bytes (PNG, JPEG or WebP). The browser's `File.type` and the extension are ignored. The limit is 2 MB, checked before reading the file.
  - `GET /api/images/:id` is served with `Cache-Control: immutable` (ids are never reused) and `nosniff`.
- **Why a Nitro route, not a Start server route:** in dev, Nitro (3.0 beta) sends any request with `Sec-Fetch-Dest: image` that matches no Nitro-level route to Vite's static server. So every `<img>` pointing at a TanStack Start server route returned 404 in dev, although curl got 200. Registering the handler via `nitro({ routes })` makes dev and production use the same path. Verified: 200 with `Sec-Fetch-Dest: image`; 404 for unknown or malformed ids.
- **Why Postgres:** the stack has no object storage, and this keeps the template self-contained and transactional. Image ids are random UUIDs, but images of draft items are not access-controlled. Note that before storing anything sensitive.
- **Alternatives:**
  - Vercel Blob or S3 with signed uploads: the right choice at scale. Swap `insertImage`, `getImage` and the route behind the same shape when needed.
  - Uploading the file first in its own request: leaves orphans when the form is abandoned.
  - A URL text field: makes the reusable ImageField pointless.

## 0068: The admin list is URL-driven; Query owns SSR and a DB collection owns optimism

*Superseded by 0174 (the list stays URL-driven; writes are Query mutations that patch every cached page).*

- **What:**
  - Search, status, sort, page and page size are Zod-validated search params (`.catch()` corrects bad values) and are also the `listTestCrud` input.
  - Without `pageSize` in the URL, the saved table preference applies. The server reads it from the preferences cookie, so SSR matches.
  - The loader awaits `ensureQueryData`, so the page is in the SSR HTML.
  - A TanStack DB query collection per list page uses the SAME query key, so its initial rows come from that cache. Rows render from the collection when it is ready and from the identical Query rows before that, so hydration matches.
  - Publish/unpublish, delete and bulk delete go through `collection.update` / `collection.delete`. A failing handler rolls the change back, and the table shows a localized toast. After success, every list page is invalidated.
- **Verified in Chrome** (dev, local Postgres):
  - With the server call forced to fail (500 after 1.2 s), the badge showed "Published" immediately, rolled back to "Draft", and the toast read "That didn't work, so the change was undone." The row in the DB stayed `draft`.
  - Real publish, single delete with confirmation, bulk delete of 2 items, column hiding and page size all work and persist across a reload.
- **Alternatives:**
  - DB on-demand sync with predicate push-down: total counts and `ILIKE` search don't map cleanly, so this is revisited when DB is 1.0.
  - Optimistic updates through Query `onMutate`: more hand-written cache code per feature.

## 0069: Server functions use `.validator()` and report field errors the form can show

- **What:**
  - New server functions use `.validator()`, the current name; `.inputValidator()` is deprecated. Existing functions keep the old name for now, which logs a deprecation warning in dev; migrate them in Task 16.
  - Server-only failures (slug taken → CONFLICT, image rejected → BAD_REQUEST) carry `fieldErrors` with localized messages. `applyServerFieldErrors()` puts them on the fields under `errorMap.onServer`, so they show in the field and in FormErrorSummary. `clearServerErrorOnChange` (a form `listeners.onChange`) removes one when the user edits that field.
  - `UnsavedChangesGuard` uses `useBlocker({ shouldBlockFn, enableBeforeUnload, withResolver })` with a localized AlertDialog. The form passes `!saved && !form.state.isDefaultValue`.
- **Why:** The same validation is reported in the same place whether it ran in the browser or on the server. Reverting edits to the original values doesn't trigger a false "unsaved changes" prompt.

## 0070: Testing data access against PGlite, and how admin-only access is verified

- **What:**
  - Repository tests run the committed migrations on `@electric-sql/pglite` (in-process Postgres), so real SQL, constraints (unique slug), transactions and `ILIKE` escaping are exercised without a server.
  - Server functions can't run under Vitest because their middleware only runs in the Start runtime. A static test asserts that every `createServerFn` in `src/functions/test-crud.ts` is chained with `.middleware([requireAdminMiddleware])`. The middleware itself is unit-tested.
  - Live check (dev): the browser's real list (GET) and publish (POST) calls, replayed without cookies, returned `UNAUTHORIZED`. Replayed as a signed-in verified non-admin, they returned `FORBIDDEN`. Start reports function errors in the payload with HTTP 200.
- **Alternatives:**
  - Mocking Drizzle: misses SQL bugs.
  - A shared test Neon branch: slower, and needs network and credentials in CI.

## 0071: SEO tags come from one helper and a required `VITE_SITE_URL`

- **What:**
  - `seo({ title, description, path, image, type, noindex })` in `src/lib/seo.ts` returns `head` meta and links: the title template, description, canonical, `hreflang` alternates for every locale plus `x-default` (base locale), and Open Graph tags (`og:locale` and its alternates; `og:image` only when there is an image). It also returns Twitter card tags.
  - URLs are absolute, built from the new required client variable `VITE_SITE_URL`: an origin only, no path, no trailing slash, http(s). Locale paths come from Paraglide's `localizeHref`, so they follow the same URL strategy as routing.
  - Canonicals: list page 1 is `/test-crud`, later pages are their own canonical URLs, and search results are `noindex, follow` with the list as canonical. The detail page adds `article:published_time`.
- **Why:** canonical and hreflang must be absolute, and the request's Host header is not trustworthy, so the origin is configured. Making it required means a deploy without it fails at build or start instead of shipping wrong canonicals.
- **Verified:**
  - In dev and the production build: one title, one description and one canonical per page (child heads replace the root defaults).
  - Nepali pages are canonical at `/ne/...`, with English as `x-default`.
  - Unit tests cover both locales, noindex and images.
- **Alternatives:**
  - Deriving the origin from the request: can't be trusted and differs behind proxies.
  - Per-route hand-written tags: easy to get inconsistent.

## 0072: Public reads are a separate, published-only path

- **What:**
  - `src/functions/test-crud-public.ts` (no auth) calls `listPublishedTestCrud` and `getPublishedTestCrud`. Both always filter on `status = 'published'` and return public DTOs that leave out the id, status, creator and timestamps other than `publishedAt`.
  - A draft and a missing slug both become NOT_FOUND, so the route throws `notFound()` and responds with the localized 404 page and HTTP 404. A malformed slug 404s without a query.
  - The body is sanitized again on read. Verified with a row written straight into the DB with `<img onerror>`, `<script>` and a `javascript:` link: all were stripped and only the link text remained.
  - Public query keys live under `["test-crud", "public"]`, which admin writes invalidate.
- **Verified:**
  - With JavaScript disabled, the list (12 cards per page, search, pagination) and the detail page render fully.
  - No console warnings in en or ne, light or dark.
  - Card widths are fixed (`min-w-0`), and the site header now wraps, so there is no horizontal scroll at 360, 390, 768 or 1280 px.
- **Alternatives:** Reusing the admin functions with a "public" flag: one mistake would expose drafts.

## 0073: Sentry via `@sentry/tanstackstart-react` 11.4.0 (beta, pinned), off without a DSN

- **What:**
  - The official SDK is pinned to an exact version because it is beta. Initialisation follows Sentry's manual setup for serverless hosts:
    - `src/instrument.client.ts` is imported first by a custom `src/client.tsx`.
    - `src/instrument.server.ts` is imported first by `src/server.ts`, which wraps the entry in `wrapFetchWithSentry`.
    - `sentryGlobalRequestMiddleware` runs first in `start.ts`.
    - `tanstackRouterBrowserTracingIntegration` is added in `getRouter()` in the browser.
  - Both sides share `sentryOptions()`: `environment` is the Vite mode, `tracesSampleRate` is 1 in dev and 0.1 in prod, and `sendDefaultPii: false`.
  - One DSN variable, `VITE_SENTRY_DSN`. DSNs are public by design.
- **Where errors are captured:**
  - Unexpected server-function errors are captured in `normalizeServerError` while the original error still exists, tagged with the `requestId` shown to the user. They are not captured by an outer function middleware, which would only see the generic INTERNAL `AppError`.
  - `beforeSend` drops every `AppError` (4xx are expected; INTERNAL was already reported) and strips `user.ip_address`, which the server SDK adds even with `sendDefaultPii: false`.
  - The route error page captures non-`AppError` client errors.
  - `Sentry.setUser({ id })` follows the session; it is cleared on logout.
- **Source maps:** `sentryTanstackStart()` is added to Vite only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set (validated together), with `telemetry: false` and `autoInstrumentMiddleware: false` (the middleware is wired explicitly). Not verified end to end: there is no Sentry account in this environment.
- **Verified** against a local fake ingest:
  - A client error arrived with the user id.
  - A server-function failure arrived once, with a readable stack (`functions/stack.ts:17`), the `requestId` tag and no IP address.
  - Without a DSN, the production build made no external requests.
- **Consent:** Sentry is error monitoring, not product analytics, so it is not tied to the analytics consent banner. It sends no PII beyond the user id. Error message text is not scrubbed by the app; enable Sentry's server-side data scrubbing (the default) and avoid putting secrets in error messages.
- **Alternatives:**
  - The `--import` flag setup: not available on Vercel functions.
  - Session Replay: left out for privacy and bundle size. Add `replayIntegration()` if wanted.

## 0074: PostHog is opt-in; consent is a cookie, and posthog-js loads only after "yes"

- **What:**
  - `analyticsConsent` (`unset` / `granted` / `denied`) lives in the preferences store and the `analytics-consent` cookie, so the server renders the banner (or not) and the page doesn't shift after hydration.
  - The banner is shown only when `VITE_POSTHOG_KEY` is set and the choice is `unset`. A footer link reopens it.
  - `posthog-js` is a dynamic import started only by "Allow analytics". Before that there is no PostHog code, cookie or request.
  - Configuration: no autocapture, no session recording, no surveys, `person_profiles: identified_only`, and pageviews sent on router navigation.
  - Withdrawing consent calls `opt_out_capturing()` and `reset()` and deletes PostHog's cookie and localStorage.
  - Server events (posthog-node, `captureImmediate`, `disableGeoip`) are sent only when the request carries `analytics-consent=granted`.
  - Test CRUD events:
    - Created, updated (edit or status change) and deleted are sent from the admin server functions, with the admin's user id as the distinct id.
    - Viewed is sent from the public detail page, once per item.
- **Verified** against the fake ingest, with a normal user agent: posthog-js drops events from headless Chrome as bots, which hid events in the first run.
  - Before consent: no browser requests to PostHog, and posthog-js not loaded.
  - After "Allow": `$pageview`, then `test_crud_viewed`, `$identify` with the user id on login, and the server's `test_crud_updated` with the admin's id.
  - After logout, events use a new anonymous id.
  - "No thanks" stops sending and removes `ph_*` storage.
  - With no key, nothing was requested.
- **Alternatives:**
  - Initialising PostHog with `opt_out_capturing_by_default`: the SDK still loads and may make config requests before consent.
  - Cookieless mode: weaker funnels, and still a consent question in many jurisdictions.

## 0075: Feature flags are evaluated on the server and shipped with the page

- **What:**
  - `getHomeFlags` (a server function) calls `posthog.getFeatureFlag(key, distinctId, { sendFeatureFlagEvents: false, disableGeoip: true })` with a 1.5 s timeout. Missing key, `false`, `undefined`, `"control"` or any failure means off.
  - The home loader awaits it into the Query cache, which is dehydrated with the SSR HTML, so the server and the hydrated client render the same branch.
  - The distinct id is the visitor's PostHog id read from PostHog's cookie, but only with consent. Otherwise every visitor is evaluated as `"anonymous"`, so no per-visitor identifier leaves the server before consent and no flag-call event is recorded.
  - Example flag: `home-items-cta` shows a call-to-action card on the home page.
- **Verified:** with the flag on at the fake ingest, the card was in the SSR HTML and still present after hydration, with no console warnings. With no key it was absent in both.
- **Alternatives:**
  - Client-side `posthog.isFeatureEnabled`: renders a default first and then flips, unless bootstrapped. It also needs posthog-js before consent.
  - Local evaluation with a personal API key: faster, but another secret. Revisit at scale.

## 0076: CSP and ad blockers (deferred to Task 16)

- **What:** Sentry (`*.ingest.sentry.io` or a tunnel) and PostHog (`VITE_POSTHOG_HOST`, plus its assets host for posthog-js extensions) must be added to the Content Security Policy in Task 16. The inline theme script needs the router's nonce.
- **Why noted now:** both SDKs fail silently when blocked. A managed tunnel (`sentryTanstackStart({ tunnelRoute })`) and a PostHog reverse proxy are options if ad blockers become a problem.

## 0077: Storybook has its own Vite config and replaces server modules wholesale

- **What:**
  - Storybook 10.6.1 (`@storybook/react-vite`, pinned) with `viteConfigPath: .storybook/vite.config.ts`. That config has only Paraglide, Tailwind and React, plus tsconfig paths.
  - `.env` loading is off (`envDir: false`). The two public values Storybook needs (`VITE_APP_TITLE`, `VITE_SITE_URL`) are set in `.storybook/aliases.ts`, and the Sentry/PostHog keys are removed.
  - Vite aliases replace `@/functions/*` and `@/lib/auth-client` with mocks built from `fn()`, so play functions can assert calls (for example the FormData sent by the Test CRUD form).
  - A global decorator wraps every story in the real providers (router with memory history, Query, DB client, preferences store) and applies the locale and theme toolbar globals.
  - The login form was extracted from its route into `LoginForm` (with an `onSignedIn` callback) so it can be rendered and interaction-tested on its own.
- **Why:**
  - The app's Vite config runs TanStack Start, Nitro and env validation, none of which belong in a component workshop.
  - `sb.mock()` still evaluates the original module and its dependencies, which would bundle the database driver and Better Auth into the browser. Aliases swap the whole module, so that server code is never bundled.
- **Alternatives:**
  - `package.json` subpath imports (`#functions/...`): they would change every app import.
  - MSW for server functions: Start's RPC wire format is an internal detail.

## 0078: Stories are tests: two browser passes, a11y violations fail

- **What:**
  - `@storybook/addon-vitest` runs every story as a Vitest browser test (Playwright provider using the installed Chrome via `channel: "chrome"`; no browser download). Play functions are assertions.
  - `parameters.a11y.test = "error"` makes any axe violation fail the story.
  - There are two projects: `storybook` (English, light) and `storybook-dark-ne` (Nepali, dark, via `initialGlobals` in its setup file). They run one after the other, each with a 30 s timeout per test. Running both browsers in parallel caused sporadic timeouts on this machine.
  - `pnpm test` stays the fast jsdom/node suite (`--project unit`).
- **Verified:** 50 stories × 2 passes = 100 tests, green on three consecutive runs. `pnpm build-storybook` is green with no warnings. The 1.5 MB preview iframe chunk has its warning limit raised in `viteFinal` (a dev tool, never served to users).
- **Alternatives:** `@storybook/test-runner`, which needs a running Storybook and a separate Jest setup.

## 0079: Accessibility fixes found by the stories

- **What:**
  - Light theme `--destructive` changed from shadcn's red-600 to red-700 (`oklch(0.505 0.213 27.518)`). Error text on the tinted error panels (form error summary, auth messages) measured 4.36:1, below WCAG AA's 4.5:1.
  - Light theme `--muted-foreground` darkened from `oklch(0.552 …)` to `oklch(0.5 …)`. Muted text on `--muted` (selected table rows) measured 4.39:1.
  - The theme menu, table row actions and column picker use `DropdownMenu modal={false}`. The modal default `aria-hide`s the rest of the page while it still contains focusable elements, which axe flags (`aria-hidden-focus`). For small menus that close on Escape or an outside click, non-modal is the better pattern.
- **Why:** these were real defects in the app, caught by running axe in both themes and both languages, not only in Storybook.

## 0080: Server-function logic lives in plain functions; coverage is reported per area

- **What:**
  - `createServerFn` handlers only run inside the TanStack Start runtime. Calling one under Vitest fails with "No Start context found in AsyncLocalStorage", and faking that context means importing an internal package.
  - So the Test CRUD server functions are now one-line wrappers:
    - The work lives in `src/server/test-crud/service.ts`, plain functions over an injected `db`: image change selection, validation, the NOT_FOUND mapping and the analytics events.
    - The create/update wire format lives in `src/features/test-crud/form-data.ts`. `toFormData` (used by the form) and `parseSaveForm`/`parseUpdateForm` (used by the validators) sit side by side, so a round-trip test proves they agree.
  - Tests:
    - The service runs against PGlite with the real migrations (`tests/utils/test-db.ts`).
    - Route guards (`_authed`, `_auth`, `_admin`) are tested through their `beforeLoad`.
    - The global middleware (CSRF, request logging, error normalisation, locale header) is tested through its server/client steps.
  - Admin-only access is proven by three things together: the middleware tests, the static check that every Test CRUD function uses `requireAdminMiddleware`, and the live replay recorded in 0070.
  - `pnpm test:coverage`: v8 coverage of `src/**` (excluding generated Paraglide output, the route tree and stories), with text, JSON summary and HTML reporters. `scripts/coverage-report.mjs` then prints line, branch and function coverage for the plan's areas plus the overall total.
- **Result** (334 unit tests):

  | Area | Lines | Branches | Functions |
  | --- | --- | --- | --- |
  | Schemas & validation | 94.9% | 92.7% | 87.0% |
  | Form fields | 90.8% | 81.3% | 87.1% |
  | Server functions | 77.2% | 81.0% | 66.2% |
  | Guards | 94.3% | 84.5% | 89.5% |
  | Email | 84.3% | 73.7% | 75.9% |
  | i18n | 100% | 87.1% | 100% |
  | Env | 97.7% | 78.0% | 100% |

  Overall is 57.8% of lines, because route pages and UI composition are exercised by the Storybook browser tests and live checks, not by this run.
- **Why not merge the browser coverage too:** it would make `pnpm test:coverage` depend on Chrome and roughly triple its time. The Storybook run stays a separate gate.
- **Known gap:** the `src/functions/*` wrapper files show 0%. They can't execute outside Start, and their contents are a middleware list, a validator and a single call.
- **Alternatives:**
  - Mocking `@tanstack/start-storage-context`: depends on internals.
  - An HTTP-level test harness against a running server: the live checks already do this, and it's too slow for every run.

## 0081: Security headers: static headers via Nitro, a per-request CSP nonce via Start middleware

- **What:**
  - **Every response** (pages, assets, `/api/images`) gets static headers through Nitro `routeRules`:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy` with camera, microphone, geolocation, payment, usb and browsing-topics disabled
    - `X-Frame-Options: DENY`
    - `Cross-Origin-Opener-Policy: same-origin`
  - **HTML pages** get a Content-Security-Policy from `securityHeadersMiddleware` (`src/middleware/security-headers.ts`), production only:
    - A fresh 128-bit nonce per request goes into the request context. `getRouter()` passes it to `ssr.nonce` via `getGlobalStartContext()`, so Start's inline hydration scripts, its entry module script and the `ScriptOnce` theme script all carry it.
    - `script-src 'nonce-…' 'strict-dynamic'` (no `unsafe-inline`, no `unsafe-eval`).
    - `style-src 'self' 'unsafe-inline'`, because Radix positions popovers with style attributes.
    - `img-src 'self' data: blob:`, for image previews.
    - `connect-src 'self'` plus the Sentry DSN's origin and the PostHog host, only when configured.
    - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`.
  - **Zod jitless:** Zod 4 probes `new Function` to decide whether to JIT-compile schemas, and the CSP correctly blocks it. `src/lib/zod-config.ts` sets `z.config({ jitless: true })`. It's imported first by both entries and by `client-env.schema.ts`, because code splitting runs the env schema (parsed at import time) before the entry's own imports. *(Superseded by 0086: `zod` now resolves to a configured module, because import order alone proved fragile.)*
- **Verified on the production build:**
  - All headers are present on an HTML page, a JS asset and the image route, and every inline script has the nonce.
  - 204 page loads (17 pages × en/ne × light/dark × 390/768/1280 px) had zero `securitypolicyviolation` events.
  - A separate build with Sentry and PostHog pointed at a local ingest still sent `$pageview`, `test_crud_viewed` and a Sentry error under the enforced CSP, with no violations or blocked requests.
  - Unit tests cover the policy builder and the middleware.
- **Why production only:** Vite's dev server and the TanStack Devtools inject scripts without a nonce.
- **Alternatives:**
  - A hash-based CSP: Start's inline scripts change per render.
  - `'unsafe-inline'` scripts: would defeat the point.
  - Headers in `vercel.json`: not portable, and no per-request nonce.

## 0082: Final review fixes (accessibility, responsiveness, layout stability)

- **Method:** axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practice), a horizontal-overflow check and console/CSP capture on every page (anonymous, user and admin) in both locales, both themes and three widths. Plus keyboard Tab walks and CLS measurements with an empty cache.
- **Fixes:**
  - **Contrast:** the disabled pagination step on `/test-crud` was `opacity-50` (3.73:1). It now uses the muted text colour with `aria-disabled`.
  - **Admin on phones:** the search field had a fixed width (`w-64`), so it now fills the row below `sm`. The sidebar is icon-only below `md` regardless of the saved preference, because a 224 px sidebar on a 390 px screen left too little room.
  - **Rich-text toolbar:** it scrolls sideways on narrow screens. Its height is unchanged, so it still matches the SSR placeholder.
  - **Layout shift on `/test-crud`** (0.03): the card's `aspect-[16/9]` box grew to the image's own aspect when it loaded. The image is now absolutely positioned over a clipped box, and title and summary reserve fixed line counts. CLS is now ≤ 0.0004 on every measured page, in both locales, at phone and desktop widths.
- **Result:** 204/204 page loads with no axe violations, no overflow, no CSP violations and no console errors (the 404 page's own 404 aside). Every Tab stop has a visible focus indicator; cards use a `focus-within` ring.

## 0083: Breadcrumbs come from route `staticData`, labels resolved at render time

- **What:** A route joins the trail by declaring `staticData: { breadcrumb }` (typed by declaration merging on `StaticDataRouteOption` in `src/lib/breadcrumbs.ts`). `staticCrumb(m.x)` gives a fixed, localized label. `loaderTitleCrumb` reads the `title` returned by the route's loader (detail pages). Sections get a `route.tsx` layout (`/_admin/admin`, `/_admin/admin/test-crud`, `/_public/test-crud`) whose only job is naming the section. `_public` names "Home". `<Breadcrumbs>` builds the trail from `useMatches()` and merges a layout with its index route (same path, deeper label wins). `jsonLd` also emits a schema.org `BreadcrumbList` with absolute, localized URLs. `<PageHeader>` shows the trail by default.
- **Why:** TanStack Router's documented breadcrumb pattern walks the matched routes. The trail then needs no per-page code, renders identically on the server and the client (no shift), and follows the URL structure. Labels are functions, not strings, so they're read in the request's locale at render time. Detail loaders return only `{ title, … }`, not the item: the item already travels in the Query cache, and returning it from the loader would serialize it twice.
- **Alternatives considered:** `beforeLoad` context (`getTitle`), as in the router-context guide. It runs before the loader, so it can't name a detail page from its data. Per-page `items` props: repetitive and easy to forget. They remain available (`<Breadcrumbs items>`) for pages whose trail doesn't follow the URL, and for stories.

## 0084: One list contract, shared by URL, server function and repository

- **What:** `src/lib/list.ts` defines the list params every list uses: `searchParam()` (`q`), `enumParam(values, fallback)` (`sort`, status filters), `pageParam()`, `pageSizeParam()` (optional in the URL, so it falls back to the saved table preference) and `resolvedPageSize()` (server input). It also defines `Paged<T>`, `parseSort`, `pageWindow` (clamping and offset), `paginateArray` and `bulkIdsSchema`. The server half, `src/server/db/list.ts`, has `textSearch` (ILIKE with escaped wildcards), `allOf`, `orderBySort` (a whitelist of columns plus a unique tiebreaker), `countRows` and `paginate`. The Test CRUD and stack schemas and repositories are rebuilt on them. `Db`/`Tx` moved to `src/server/db/types.ts`.
- **Why:** The same rules (forgiving URL parsing, page clamping, literal search, stable ordering) were written out per feature. The frontend building blocks (`<DataTable sort>`, `<Pagination>`, `<SearchLink>`) read and write exactly these params, so the backend must agree on them in one place. `paginate` takes `count`/`rows` callbacks rather than a table, so each repository keeps fully typed Drizzle queries.
- **Alternatives considered:** A generic `paginate(db, table, …)` that builds the select itself. Typing the row shape across arbitrary tables needs casts. Cursor pagination: not needed at this scale, and page numbers are what admin users expect.

## 0085: Reusable page building blocks; feature code is columns, filters and actions

- **What:** These live in `src/components/`:
  - `page/`: `Page` (standard widths), `PageHeader` (breadcrumbs, h1, description, actions), `Breadcrumbs`, `EmptyState`, `PageHeaderSkeleton` and `ListSkeleton`
  - `data-table/`: `DataTable<Row>` (typed columns, URL sort links with `aria-sort`, row selection with a bulk bar, a row-actions menu, column visibility from the table preference cookie, empty state), `DataTableColumnsMenu` and `DataTableSkeleton`
  - `navigation/`: `Pagination` (URL-driven; disabled steps are text) and `SearchLink` (a link to the current page with search params changed; works without JS)
  - `dialogs/ConfirmDialog`

  Test CRUD's admin list now defines only its columns (`features/test-crud/components/admin-columns.tsx`), its actions and its data wiring. The bespoke table, delete dialog and three hand-written paginations were removed. The admin dashboard became a section index.
- **Why:** Part 2 rule: reuse before writing. Every list gets the same accessibility (sort state, labelled checkboxes, focus to Cancel in confirmations), the same SSR and no-JS behaviour, and the same look.
- **Alternatives considered:** TanStack Table. Sorting, paging and filtering happen on the server here, so a headless table engine would add a dependency for column visibility and selection, both of which are a few lines. It can still be adopted inside `DataTable` later without changing its props.

## 0086: `zod` resolves to a configured module (jitless before any schema exists)

- **What:** The bare specifier `zod` is aliased (`vite/zod-alias.ts`, used by the app, Storybook and Vitest configs) to `src/lib/zod.ts`, which imports `zod/v4`, calls `z.config({ jitless: true })` and re-exports everything. The side-effect module `src/lib/zod-config.ts` and its "import first" lines in the entries are gone. `tests/unit/zod-config.test.ts` guards it.
- **Why:** In Zod 4.6, creating a `z.object` already runs the eval probe (not just the first parse). After this task's refactor, Rolldown evaluated the chunk with the preferences and list schemas before the chunk that set jitless, and every page reported a CSP `eval` violation. "Import it first" depends on chunk order. Being the module that `zod` resolves to makes it an ES-module guarantee.
- **Alternatives considered:** Importing the config in every file with module-level schemas: easy to forget. Allowing `'unsafe-eval'` in the CSP: no.

## 0087: Story tests need no setup file; unused messages fail the build

- **What:** `addon-vitest` applies the preview and addon annotations itself (Storybook ≥ 10.3), so `.storybook/vitest.setup*.ts` were removed. The Nepali/dark pass is selected with a `STORYBOOK_VARIANT` define (`vitest.config.ts`), and `.storybook/preview.tsx` reads it for `initialGlobals`. A `VariantProbe` story asserts each pass really runs in its locale and theme. `tests/i18n/message-usage.test.ts` fails when a message key is referenced nowhere. The 19 dead keys found (16 replaced by shared `table_*`/`pagination_*`/`common_*` keys, plus 3 that were already unused) were deleted. jsdom gets a `scrollTo` stub, which silences "Not implemented" noise from router scroll restoration.
- **Why:** These clear two notices that printed on every test run, and keep the message files from collecting dead translations.

## 0088: Filters are one GET form of native controls; arrays are repeated keys

- **What:**
  - **The form:** `<FilterBar>` (`src/components/filters/`) is a `<form method="get">` with no `action`, so it submits to the current URL in any locale. It wraps native controls: `SearchFilter`, `SelectFilter` (a styled native `<select>`, `ui/native-select.tsx`), `MultiSelectFilter` (checkboxes in a `<details>` dropdown), `BooleanFilter`, `NumberRangeFilter` and `DateRangeFilter` (`<input type="date">`).
  - **With JavaScript:** a change updates the URL at once. Text, number and date inputs wait 400 ms and replace the history entry. The page resets to 1, and the `preserve`d params (sort, page size) are kept. Controls are uncontrolled and re-synced from the URL after back/forward, a chip or "Clear all", skipping the field being typed in.
  - **Chips:** `<ActiveFilters>` shows one removable chip per applied filter, plus "Clear all". These are links (`SearchLink`).
  - **URL format:** the router's `stringifySearch` (`src/lib/search.ts`) writes arrays as repeated keys (`tags=a&tags=b`), the format HTML forms submit; parsing already reads them as arrays.
  - **Params:** `arrayParam`, `numberParam`, `dateParam` and `booleanParam` accept what forms send (empty means "not set"), and `.catch` bad values.
- **Why:** The same URL comes out with or without JavaScript, filters render on the server, and every state can be shared. Native controls work before hydration. The Radix Select, used for the old status filter, did nothing without JS. A `<details>` dropdown opens without JS and floats, so opening it causes no layout shift.
- **Alternatives considered:**
  - TanStack's default JSON arrays (`tags=%5B%22a%22%5D`): unreadable, and different from what a form submits.
  - Controlled inputs keyed by URL value: remounting while typing loses focus.
  - Radix popovers: they need JS.
  - A localized date picker: its native counterpart needs no JS and is accessible; dates still show localized in the chips.

## 0089: Search-driven lists keep showing results while new ones load

- **What:** List loaders call `loadList(queryClient, options, cause)` (`src/lib/query.ts`). On SSR and when entering the route, it awaits the data as before. When only the search changes on the same route (`cause: "stay"`), it prefetches without awaiting, so the navigation commits immediately. Pages read the data with `useListQuery` (`src/hooks/use-list-query.ts`): `useQuery` with `placeholderData: keepPreviousData`. Its `busy` flag also covers the router's own pending state. The table and grids dim (`aria-busy`) while busy. Parameters that only open a dialog (`edit`, `view`) are left out of `loaderDeps`.
- **Why:** A loaderDeps change creates a new match. If loading takes longer than `pendingMs`, the router swaps in the pending component, which unmounted the filter being typed in and moved the page. Measured with 2.5 s of latency: before, a skeleton flash and lost focus; after, focus and text are kept and the old rows dim until the new ones arrive.
- **Alternatives considered:** Raising `pendingMs`, which only delays the flash. Disabling the pending component, which would also remove it when entering a route.

## 0090: The admin guard checks the server when entering the area, not on every inner navigation

- **What:** `_admin`'s `beforeLoad` calls the `ensureAdmin` server function on SSR and whenever the admin area is entered. On navigations inside it (`cause: "stay"`), it reuses the session the root route already loaded, if that session is an admin's; otherwise it still asks the server. This revises the "on every navigation" rule of decision 0043.
- **Why:** Every filter change paid a full round trip before the list could even start loading. That doubled the latency and, on slow networks, triggered the pending screen (0089). The guard is a UX gate. The security boundary is `requireAdminMiddleware` on every admin server function, which still runs on every call, so a revoked admin gets FORBIDDEN on the next data request. Task 20 (RBAC) builds on the same split.

## 0091: Route masking for the edit dialog and quick view; masked links always unmask on reload

- **What:**
  - **Admin "Quick edit":** opens the edit form in a dialog over the list. The real location is `/admin/test-crud?edit=<id>`; the address bar shows `/admin/test-crud/<id>`.
  - **Public "Quick view":** opens over the grid. The real location is `/test-crud?view=<slug>`; it shows the canonical `/test-crud/<slug>`.
  - **The links** (`features/test-crud/components/masked-links.tsx`) pass `mask: { …, unmaskOnReload: true }`, and their href is the masked URL.
  - **Closing** (`useCloseOverlay`) goes back in history when it can, otherwise it removes the param.
  - **Data:** the dialogs load with `useQuery` and show inline skeletons. The edit form gained `onSaved`/`onCancel`.
- **Why:**
  - **SSR:** masks persist in history state, and by default a reload keeps them. The server never sees history state, though: it renders the masked URL, so the client must render the same page or hydration breaks. `unmaskOnReload` makes reload, sharing, new tabs and no-JS clicks all land on the full page.
  - **Closing:** going back means Back after closing doesn't reopen the dialog, and the list underneath (filters, scroll) is exactly as it was.
- **Verified:**
  - **jsdom:** href, masked address, Back/Forward and a fresh load of the masked URL.
  - **Production:** open, save, Escape, Back/Forward, reload to the full page, and axe on the open dialogs.

## 0092: Path params are validated by the route (`params.parse`), not in loaders

- **What:** `/admin/test-crud/$id` (UUID) and `/test-crud/$slug` (slug pattern) use `params: { parse: (raw) => parseParams(schema, raw) }`. `parseParams` returns the parsed params, or `false` so the route doesn't match. The loaders no longer re-check.
- **Why:** This is TanStack Router's documented contract: `false` means "no match", so the request falls through to the localized not-found page with a real 404 status, and loaders and components get typed params. Verified: `/test-crud/Not_A_Slug` and `/admin/test-crud/not-a-uuid` return 404.

## 0093: Date filters are calendar days in the app time zone, compared as instants

- **What:** `?from=`/`?to=` are `YYYY-MM-DD`. `dayRangeInZone` (`src/lib/i18n/date-only.ts`) turns them into `[start of from, start of the day after to)` in `APP_TIME_ZONE` (Asia/Kathmandu), using Intl offsets (correct across DST, tested with New York). `dateRange(column, from, to)` (`src/server/db/list.ts`) compares the timestamp column with those instants. Also added: `numberRange`, `overlapsAny` (array `&&`) and a GIN index on `test_crud.tags` plus a B-tree index on `price` (migration 0003).
- **Why:** Dates are displayed in Nepal time (0025), so "published on 2 Sep" must mean the Nepal day, not the UTC day: 18:20 UTC on 1 Sep is already 2 Sep in Nepal, and the tests cover that edge. Comparing instants keeps indexes usable, which `AT TIME ZONE` on the column would not.

## 0094: Roles and permissions live in app tables; Better Auth keeps identity, sessions and the admin flag

- **What:**
  - **Catalog:** the permission catalog is code: `src/features/rbac/permissions.ts`, with `"<resource>:<action>"` strings and a localized label for each (`labels.ts`, typed as `Record<Permission, …>` so none can be missing).
  - **Tables:**
    - `role`: the seeded system roles `admin` and `user` (migration 0005) plus custom roles;
    - `role_permission`;
    - `user_role`: custom roles only.
  - **Admin:** Better Auth's `user.role = "admin"` remains the one admin flag. It's what `pnpm db:seed-admin` and Better Auth's own admin endpoints use, and it grants every permission implicitly. `user` is everyone's baseline (it starts empty).
  - **Ban:** a ban sets `user.banned` and deletes the user's sessions in one transaction. Better Auth's admin plugin then refuses new sign-ins.
- **Why:** Better Auth's admin-plugin roles are defined statically in code. Its database-stored roles ("dynamic access control") belong to the organization plugin and are scoped to organizations and their members, which this app doesn't have. Admins have to be able to create roles and tick permissions at runtime, so roles are app data. Keeping the admin flag where Better Auth has it avoids a second, drifting source of truth.
- **Alternatives considered:**
  - The organization plugin with one implicit organization: more tables and APIs for no benefit.
  - Roles as a comma-separated `user.role`: no foreign keys, and no clean place for permissions.
  - Better Auth's `banUser` endpoint: it checks Better Auth's static roles, so a custom role holding `users:ban` couldn't use it.

## 0095: Every server function names its permission; pages guard by permission; the UI only hides

- **What:**
  - **Per request:** `getServerSession` resolves the user's permissions from the database on every request: one query, or none for admins; banned users get none. They travel in the `Session`.
  - **Server functions:** each one runs `requirePermission("<resource>:<action>", …)`, for example `test-crud:publish` for publishing. A test checks every function in `src/functions/test-crud.ts` and `rbac.ts` against an explicit name-to-permission table.
  - **Admin area:** the `_admin` gate needs any permission (`ensureAdminAccess`).
  - **Routes:** each section route calls `assertRoutePermission(context.session, …)` in `beforeLoad`, which gives the localized FORBIDDEN page with a real 403 during SSR.
  - **UI:** `useCan`, `<Can>` and `usePermissions` decide what to show: sidebar sections, dashboard cards, buttons, row actions, bulk selection.
  - **Client:** `hydrateRoot`'s `onCaughtError` no longer logs expected app errors (status < 500); everything else is logged as before.
- **Why:** The server is the authority, and naming the permission at each function makes the mapping reviewable and testable. Resolving per request means removing a permission takes effect on the user's next request.
- **Verified live (production build):**
  - An Editor's replayed "publish" call came back `FORBIDDEN` / "Missing permission: test-crud:publish", and the item stayed unchanged. Start transports function errors in the payload with HTTP 200, as already noted in 0070.
  - The Editor's direct visits to Users, Roles and Permissions returned a 403 page.
  - After the admin revoked "create", the Editor's next request to the new-item page returned 403.

## 0096: Rules against self-escalation and lockout

- **What** (`src/server/rbac/service.ts`, enforced on the server whatever the UI shows):
  - The admin role is fixed: it has every permission, and its permissions can't be edited.
  - Only admins change who is an admin. Non-admins can't change an admin's roles or ban an admin.
  - There is always at least one active admin: you can't demote or ban the last one.
  - Nobody changes their own roles or bans themselves.
  - A non-admin can only grant, revoke, hand out or take away permissions they hold themselves. This covers matrix edits, role assignments and role deletion.
  - System roles can't be renamed or deleted. Custom role names are unique, case-insensitively.
- **Messages:** rule violations carry a localized explanation in `fieldErrors._form` (`ruleError`), which `errorMessage()` shows instead of the generic text for the code.
- **Tests:** PGlite tests cover each rule, including a `roles:manage` holder trying to grant themselves `users:ban` and a `users:update` holder handing out a stronger role. The UI mirrors the rules by disabling what the actor can't change.

## 0097: The permission matrix saves each change optimistically and rolls back on refusal

- **What:**
  - **Layout:** roles are columns; permissions are rows grouped by resource, each group with an "all" box that is indeterminate when partly granted. The first column is sticky so the matrix scrolls sideways on phones.
  - **Saving:** each change is one `updateRolePermissions({ roleId, grant, revoke })` call, run as a TanStack Query mutation. `onMutate` updates the cached roles, `onError` restores them and shows a toast, and `onSettled` refetches roles and the session.
  - **Disabled cells:** the Admin column, everything for read-only viewers, and permissions a non-admin doesn't hold.
- **Why:** Instant feedback and no "Save" step to forget. A rule violation or a network failure visibly undoes itself. Plain Query mutations are enough here; the roles list is small and has no paging that would call for a TanStack DB collection.

## 0098: Attachments: signed direct uploads to Cloudinary, verified on the server

- **What:**
  - **Upload flow:** the browser asks `signImageUpload` (permission `attachments:upload`) for a ticket. The server picks the `public_id` (`<CLOUDINARY_FOLDER>/<scope>/<uuid>`) and signs it together with `allowed_formats` and `overwrite=false`. The browser then POSTs the file straight to Cloudinary (XHR, for progress and cancel). `confirmImageUpload` reads the asset back through Cloudinary's Admin API, checks the format and the size (10 MB), and records an `attachment` row as *pending*.
  - **Linking:** the item's own save links pending uploads, in the user's order with their alt text, in the same transaction (`syncEntityAttachments`). Only the user's own pending uploads, or images already on that item, can be linked.
  - **Removal:** images an item drops, and the images of deleted items, are marked removed. Their assets are deleted at once when Cloudinary answers. A daily Vercel Cron job (`/api/cron/attachments`, bearer `CRON_SECRET`) deletes what's left, plus day-old orphans.
  - **Delivery:** URLs are built on the server (`ImageAsset`: `full`, a 16:9 `cover` and a `thumb`, each with a `srcSet` using `f_auto,q_auto`). `CloudImage` renders them with width/height, `sizes` and lazy loading; the detail page's cover is eager with high fetch priority. The CSP allows Cloudinary's upload origin (`connect-src`) and delivery origin (`img-src`) only when it's configured.
  - **Unconfigured:** without the three `CLOUDINARY_*` variables, uploads are refused with a clear message and items have no images.
  - **Client:** a thin client over Cloudinary's REST API (`src/server/attachments/cloudinary.ts`) instead of the SDK.
- **Why:**
  - **Direct uploads:** files never pass through our server (no body-size limits, no memory pressure).
  - **The signature:** it fixes where a file goes and which formats Cloudinary accepts.
  - **Size limit:** Cloudinary has no size parameter for signed uploads, so the size is enforced from the Admin API's authoritative `bytes`, and an oversized asset is deleted.
  - **Pending, then linked:** a failed or abandoned form can't attach anything to an item, and orphans are cleaned up.
  - **Server-built URLs:** the browser needs no Cloudinary config, and every image gets one consistent set of transformations.
  - **REST over the SDK:** the SDK is CommonJS with dependencies, and the four calls used are small. Signing follows Cloudinary's documented algorithm, and the test reproduces the documentation's example signatures.
- **Legacy images:** Test CRUD's Postgres images (decision 0067) are no longer read. `pnpm attachments:import-legacy` moves existing ones to Cloudinary; the old table and column stay until that has run, then a migration can drop them.
- **Verified live** against a real Cloudinary account (production build, all test assets deleted afterwards):
  - **Upload and save:** uploading two images straight to Cloudinary, verification, saving in a chosen order with alt text.
  - **Public pages:** responsive delivery on cards and the detail page (no layout shift, no CSP violations), and the cover as `og:image`.
  - **Cloudinary-side rules:** it refused an SVG outside the signed formats and a reused signature for another `public_id`.
  - **Clean-up:** discard before saving, item deletion, and the cron cleanup each deleted the assets.
  - **Permissions:** no picker without `attachments:upload`.
- **Alternatives considered:**
  - Unsigned upload presets: anyone could upload.
  - Streaming uploads through our server: memory and time limits on Vercel.
  - Cloudinary's Upload Widget: a third-party script under our CSP, and not our UI.
  - Verifying only the upload response signature: it proves the asset exists, but its size and format fields aren't signed.

## 0099: The image editor is a feature field; concurrent uploads append atomically

- **What:**
  - **The field:** `AttachmentsField` (`src/features/attachments/components`) is used inside `form.AppField`. Its value is `{ id, alt, preview }[]`, and `toTestCrudInput` sends ids and alt text only.
  - **Editing:** a native file picker or drag-and-drop adds images. Up/down buttons reorder them, with drag-and-drop as a bonus. Each image has an alt-text input and a remove button, the first image is marked as the cover, and a live region announces changes.
  - **Without permission:** a user without `attachments:upload` can still reorder, describe and remove images, but not add them.
  - **Busy state:** the form refuses to submit while uploads are running.
  - **Concurrency:** finished uploads are added with TanStack Form's `pushValue`.
- **Why:** The first version appended to the value read when the upload started, so when two uploads finished together one image was lost. The live test caught it, and a regression test now fails without the fix. The field lives in the feature, not the generic field library, because it calls the app's server functions.

## 0100: Every page is indexable through seo() or private through noindex; a test checks every route

- **What:**
  - **Indexable pages** (home, `/stack`, `/test-crud`, items) build their head with `seo()` (`src/lib/seo.ts`):
    - title, description and `robots: index, follow, max-image-preview:large`;
    - a canonical, and `hreflang` alternates for en, ne and `x-default`;
    - Open Graph and Twitter tags with an image that always exists: the item's own, or `public/og-default.png`;
    - JSON-LD.
  - **Lists** use `listSeo()`: page 1 is canonical at the bare path; later pages are their own canonical URLs with "page N" in the title and description; searches are `noindex, follow`; sort doesn't change the canonical.
  - **Private pages** get `noindex, nofollow`. The `_admin`, `_auth` and `_authed` layouts set it for all their children (TanStack keeps the deepest route's meta per name, so a child that sets only a title inherits it). Single pages under `_public` (health, reset-password, verify-email, dev) use `privateHead()`.
  - **The test:** `tests/unit/route-seo.test.ts` builds the real router, computes each page's merged head the way the router does, in both languages. It checks:
    - the indexable pages' tags, and that their titles and descriptions are unique;
    - that every other page is noindex.
    A new page that is neither fails it.
- **Why:**
  - **Layout-level noindex:** a private page can't be forgotten; the test catches anything outside the layouts.
  - **Paginated pages self-canonical:** Google no longer uses rel=prev/next and recommends that each page of a series be its own canonical. Pointing them all at page 1 hides the items on later pages.
  - **Searches noindex but followed:** search result URLs are infinite and thin, but their links lead to real pages.
  - **A default image:** shared links always get a large preview card instead of a text-only card.
- **theme-color:** rendered in the document head from the theme preference: one colour, or both with media queries for "system". `head()` can't do this because the router dedupes meta by name.
- **Alternatives considered:**
  - `noindex` via an `X-Robots-Tag` header in middleware: invisible in the page, and it duplicates route knowledge in a path list.
  - Disallowing every private path in robots.txt: crawlers then never see the `noindex`, and a linked URL can still be indexed without content.

## 0101: The sitemap, robots.txt and manifest are built from the same data as the pages; the manifest is a Nitro route

- **What:**
  - **`/sitemap.xml`:**
    - Contents: the home page, `/stack` with its later pages, `/test-crud` with its later pages, and every published item (`lastmod` from `updated_at`; the list uses the newest item's).
    - Format: each page appears once per language, and each `<url>` lists all `hreflang` alternates, as Google documents for localized sitemaps.
  - **`/robots.txt`:** allows everything except `/admin`, `/ne/admin`, `/api/` and `/_serverFn/`, and names the sitemap.
  - **`/manifest.webmanifest`:** localized; the root head links `/ne/manifest.webmanifest` on Nepali pages. Icons: 192, 512 and a maskable 512.
  - **Routes:** the handlers live in `src/server/seo/` behind `.ts` route files with only `server.handlers`. `/ne/sitemap.xml` and `/ne/robots.txt` are 404s (the router maps `/ne/*` onto every route, so the handler checks the path). Responses are cached at the edge for an hour.
  - **Import boundary:** the rule now recognises such server routes structurally (a `.ts` route file with `server.handlers` and no component) instead of only `src/routes/api/`.
- **Why:**
  - **From the database at request time:** a newly published item is listed without a rebuild.
  - **The same page list:** the sitemap's pages match what `seo()` marks indexable (page N URLs are built the same way as `listSeo()`), so no page is listed that says noindex.
  - **Server routes over Nitro routes:** they get the locale middleware and the app's server-only import protection. Nitro routes stay for endpoints outside Start, such as the cron job.
- **Static files:** the icons and `og-default.png` are generated from the logo mark and live in `public/`. They are replaced at the same sizes to rebrand (see docs/guides/seo.md).

*Updated by 0162: the sitemap lists only the home page and the portfolio's pages.*

## 0102: JSON-LD is typed with schema-dts and emitted through route heads; items are Products

- **What:**
  - **Builders:** `src/lib/structured-data.ts` returns schema-dts types: `organizationJsonLd`, `websiteJsonLd` and `productJsonLd`.
  - **Emitting:** `seo({ jsonLd })` adds each one as a head entry `{ "script:ld+json": data }`. TanStack renders that as `<script type="application/ld+json">` with `<`, `>` and `&` escaped as JSON unicode escapes, so content can't close the tag. The entries swap on client navigation like the rest of the head.
  - **Home:** `WebSite` (in the page's language) and `Organization` (`@id` `<site>/#organization`, logo `/icon-512.png`). Other entities refer to it by `@id`.
  - **Test CRUD item:** `Product` with an `Offer`: price with two decimals, NPR, `InStock`, URL, and seller and brand pointing at the Organization. It also has images (the 1200×630 `og` renditions), keywords from the tags, and `releaseDate`. The page keeps `og:type=article` with `article:published_time`.
  - **BreadcrumbList:** unchanged (0083): rendered by `<Breadcrumbs jsonLd>` in the body.
  - **Per-item Open Graph image:** a new `ImageAsset.og` URL (`c_fill,g_auto,w_1200,h_630,f_jpg,q_auto`), with the image's alt text, or the item title when it has none.
- **Why:**
  - **schema-dts:** it is the schema.org vocabulary as TypeScript types, so "validated against the schema.org types" holds at compile time at zero runtime cost (types only). The route test pins the exact output.
  - **Product, not Article:** items have a price, and Google's product snippets need `offers`. The body text doesn't make them articles.
  - **A JPEG `og` rendition:** some crawlers don't read AVIF or WebP from `f_auto`, and 1200×630 is the size every platform's large card expects.
- **The cast:** React's `<meta>` props type doesn't list the `script:ld+json` key the router accepts. `jsonLdMeta()` casts it in one documented place.
- **Alternatives considered:**
  - Rendering JSON-LD `<script>` tags in page components: they stay in the body, and data needed by the head would be duplicated in components.
  - A `@graph` per page: one more nesting level for no gain at this size.

*Updated by 0161: Test CRUD's pages are private dev references now, so the `Product` and `Organization` builders were removed.*

## 0103: Module examples are dev-only routes over in-memory data, guarded by one layout

- **What:**
  - **Pages:** `/dev/examples` lists 14 example pages, one per module: loader + Query, streaming, filters, masking, forms, DataTable, optimistic update, preferences, permissions, attachments, SEO, i18n, errors, analytics and flags.
    - Each page is a real route under `src/routes/_public/dev/examples/` that uses the same building blocks as the app.
    - Each shows its source file and guide (`ExamplePage`), and the guides link back.
  - **Registry:** `features/dev/examples/registry.ts` drives the index; a test checks it against the route tree, and that every source and guide file exists.
  - **One guard:** `src/routes/_public/dev/route.tsx`'s `beforeLoad` throws `notFound()` when `import.meta.env.DEV` is false, so every `/dev` page (examples and `/dev/forms`) is the localized 404 in builds, before any loader runs. Its head is `noindex`.
  - **Server functions:** in `src/functions/examples.ts` behind `devOnlyMiddleware` (NOT_FOUND in builds). The permission example's two functions are in `examples-permissions.ts`; they run `requirePermission` first like every guarded function (the guarded-functions test covers that file), then the dev check.
  - **Data:** an in-memory task list in the dev server process (`src/server/examples/tasks.ts`), with fixed ids and dates. It is shared by the filters, DataTable, masking and optimistic examples, and the DataTable page can reset it.
  - **Uploads:** they use a new `examples` scope (`UPLOAD_SCOPES`), so example uploads land in their own Cloudinary folder. They're never linked, so the daily cleanup deletes them.
- **Why:**
  - **Real routes, not stories:** the patterns are about loaders, SSR, URLs, server functions and the router (masking, streaming, status codes), which only a running app shows.
  - **In-memory data:** examples can be clicked freely (bulk delete, refusals) without touching the database or needing a migration, and the store module is never part of a client bundle.
  - **The layout guard:** one place decides that /dev doesn't exist in production; the per-function middleware covers direct calls to the endpoints.
- **The manifest moved to a Nitro route:** the live check found `/manifest.webmanifest` 404 in dev. Browsers fetch it with `Sec-Fetch-Dest: manifest`, and Nitro's dev server sends non-document destinations to Vite unless a Nitro route matches (as with images, 0067). It is now `src/server/routes/manifest.ts`, registered per locale in `vite.config.ts`, with the locale taken from the path. Production behaved the same either way; dev logged an error on every page.
- **Verified:**
  - **Statuses:** every page answers 200 in dev; missing and invalid ids, `notFound()`, a refusal and a crash give 404, 404, 403 and 500.
  - **Browser review** (axe, overflow, console, CSP, CLS; en/ne × light/dark × 390/768/1280; 228 loads):
    - **Where:** on a production build with the /dev guards temporarily turned off (then restored and rebuilt).
    - **Why not dev:** dev skips font preloads (src/lib/fonts.ts), so the first paint uses fallback metrics. That wrapped a long breadcrumb 1 px earlier and registered as CLS that production doesn't have.
    - **Result:** one real issue, now fixed: permission badges overflowed at 390 px in Nepali (`Facts` now stacks on phones).
  - **Scripted flows:** no request while hydrating; streaming fallback then value; the filter URL; the masked dialog, Back and reload; a server field error; the bulk action; optimistic success and rollback; the theme surviving a reload; the server's permission answers for an admin and an editor; the action-error toast; consent changes.
  - **Production build:** all of `/dev/*` is 404.
- **Alternatives considered:**
  - Storybook stories: no router, loaders or server functions.
  - Examples on the database (a seeded table): a migration and cleanup for development-only data.
  - An env flag to enable the pages in production: the brief says unreachable in production, and `import.meta.env.DEV` is a build-time constant.

*Superseded in part by 0162: the guard is `DEV_ROUTES`, the pages are under `src/routes/dev/`, and the e2e suite reviews them.*

## 0104: Forms handled in JavaScript use method="post"

- **What:** the shared `Form` (useAppForm) and every hand-written form (sign-in, register, sign-in code, forgot and reset password, verify email, account) set `method="post"`. FilterBar keeps `method="get"`, because its values belong in the URL. `tests/unit/form-method.test.ts` checks every `<form>` in `src`.
- **Why:**
  - **The problem:** a form without a method submits as GET. A submit before hydration (a slow phone, a click during load) then put the fields in the URL: passwords in the address bar, history, referrers and server logs. The dev examples' scripted flows hit exactly that (`?username=…&email=…`) while the dev server was busy.
  - **The fix:** with POST, a pre-hydration submit sends the values in the body. The server renders the page again (a page URL accepts POST and ignores the body), and the user simply submits again once it has loaded.
- **Verified:** with JavaScript off, submitting the sign-in form and the examples form leaves the URL unchanged. With JavaScript, the forms behave as before (unit tests, the auth flows and the example flows).
- **Alternatives considered:**
  - Disabling submit buttons until hydration: the buttons change state after load, and nothing at all works without JavaScript.
  - `action="javascript:void(0)"`: blocked by the CSP and flagged by React.

## 0105: Sections can opt out of the app header with staticData.chrome

- **What:** `src/lib/chrome.ts` adds `chrome?: "bare"` to `StaticDataRouteOption` (the same augmentation as breadcrumbs). `SiteHeader` reads the matched routes with `useMatches({ select: isBareChrome })` and renders nothing when any of them is bare. The `/portfolio` layout sets it and brings its own header. `tests/components/layout/site-chrome.test.tsx` checks that `/` and `/stack` keep the header and a bare section's children don't.
- **Why:**
  - **Immersive design:** an editorial site with a full-bleed header can't sit under a second, unrelated header.
  - **Opt-in:** the rule had to change no existing page. A route that doesn't set it behaves exactly as before.
  - **Declared on routes:** it lives where breadcrumbs already do (`staticData`), so the root layout doesn't need a list of paths.
- **Alternatives considered:**
  - A pathless layout outside the root layout: impossible, since every route is under `__root`.
  - Hiding the header with CSS from the section: it would still be in the HTML and the accessibility tree.
  - A path check (`pathname.startsWith("/portfolio")`) in the header: it breaks with the `/ne` prefix and spreads knowledge of one section into shared code.

*Superseded by 0161: the root renders no header; each layout renders its own.*

## 0106: Portfolio content sits behind a PortfolioSource port; the demo adapter lazy-loads fixtures

*Superseded by 0176 (the content is in the database; the port and the fixture adapter are gone, the fixtures seed the database).*

- **What:**
  - **The port:** `src/features/portfolio/source.ts` defines the reads the UI needs (profile, projects, a project with its neighbour, posts, experience…). Every method takes the locale and returns records resolved to it; a missing slug is `null`.
  - **The adapter:** `sources/fixture-source.ts` implements it over typed fixtures in `data/`, imported with `import("../data")`. `sources/index.ts` picks the adapter.
  - **The UI:** `queries.ts` wraps every read in `queryOptions` (keys include the locale, `staleTime: Infinity`), and routes follow the usual loader + `useSuspenseQuery` pattern.
- **Why:**
  - **The brief:** a static frontend with demo data now, real data later. The port makes "later" a one-file change: no route or component knows where content comes from.
  - **Same SSR path as real data:** loaders await queries, so the page arrives complete and hydrates without a request. A future server-function adapter keeps that.
  - **No cost to other pages:** the dynamic import makes the fixtures (about 80 kB) their own chunk. Pages outside `/portfolio` never load it, and a portfolio page loaded from the server doesn't either (its queries are already filled). Only a client-side navigation into the section fetches it.
  - **Testable:** the adapter is plain async functions, tested directly (`tests/unit/portfolio-source.test.ts`).
- **Alternatives considered:**
  - Importing fixtures straight into components: simplest today, but every component would need rewriting for real data, and the data would land in the route chunks.
  - Server functions over the fixtures right away: a server round trip on client navigation for data that is static, and more moving parts for a demo.
  - A database table and migration now: real infrastructure for placeholder content the owner will replace.

## 0107: Portfolio content is localized in the data ({ en, ne }), UI chrome in Paraglide

- **What:**
  - **Content fields:** every human-language field of a content record is `Localized` (`{ en, ne }`, `schema.ts`). `resolveLocalized(record, locale)` (`lib/localize.ts`) resolves a whole record deeply, and its type `Resolved<T>` keeps tuples as tuples. The source returns resolved records, so components only ever see strings.
  - **What stays unlocalized:** brand names, tech names and code are plain strings.
  - **UI chrome:** labels, buttons and the site's own headings are `portfolio_*` Paraglide messages.
- **Why:**
  - **Content is data, like database rows:** Test CRUD items aren't messages either. Putting 300+ paragraphs of case studies in `messages/*.json` would bury the UI strings and tie content edits to a rebuild of the message bundle.
  - **Pairs stay together:** keeping both languages side by side in one file makes translations easy to review and impossible to forget. `tests/unit/portfolio-data.test.ts` fails if a Nepali text has no Devanagari or an English text has some.
  - **No mixed caching:** query keys include the locale, so English and Nepali results never share a cache entry.
- **Alternatives considered:**
  - Messages for everything: rule 6 is about UI text. Content keys would be unbounded and meaningless (`project_ledgerline_chapter_2_paragraph_1`).
  - One file per language: translations drift apart silently.

## 0108: The portfolio's design system is scoped under .portfolio; generated art; fonts pinned to an optical size

*The scoping rule stands (now `.himal`, `hm-`); the look and the art are superseded by 0179 and 0180.*

- **What:**
  - **Scoped tokens:** `src/styles/portfolio.css` (imported once from `app.css`) holds the "Ink & Paper" system:
    - colour tokens under `.portfolio`, with a dark palette and `.pf-inverse` bands
    - `@theme inline` mappings (`bg-pf-paper`, `text-pf-h2`, `font-pf-mono`)
    - `pf-*` utilities and the motion rules
  - **Fonts:** Fraunces, JetBrains Mono and Noto Serif Devanagari, self-hosted with Fontsource and preloaded by the portfolio layout only.
  - **Covers and screens** are SVG generated from a seed (`CoverArt`, `ScreenArt`).
  - **Portfolio `cn`:** components use `features/portfolio/lib/cn.ts`, which registers the `text-pf-*` size scale with tailwind-merge.
  - **Vite never inlines fonts:** `build.assetsInlineLimit` returns `false` for `.woff`/`.woff2`.
- **Why:**
  - **Scoping:** the rest of the app keeps the shadcn tokens untouched. Unused `pf-*` utilities add a few kB of CSS and no behaviour, and `@font-face` files download only when a portfolio page uses them.
  - **Generated art:** no binary placeholders to replace later, nothing for the CSP to allow, and covers follow the theme. A fixed aspect ratio means zero layout shift. Rounded coordinates from a seeded generator keep server and client markup identical.
  - **Fallback metrics and optical size:**
    - **The problem:** Fraunces changes width with its optical size. Measured in Chrome, it is 1.02× Georgia at 24px and 0.82× at 160px. A single `size-adjust` can't match it, and the hero's first line wrapped differently before and after the font swap (CLS 0.05).
    - **The fix:** pinning `opsz` (144 for display, 36 for h3-size type) makes the ratio constant. Each gets a fallback face with the measured glyph ratio (83.35% / 78.29% italic, and 102.19% / 95.3%). Measured CLS is now 0.
  - **Never inline fonts:** JetBrains Mono's cyrillic-ext subset is 2 kB, under Vite's 4 kB inline limit, so it was emitted as a `data:` URL, which the CSP's `font-src 'self'` blocks (a console error found by the browser review). No existing font was small enough to be inlined, so current output is unchanged.
  - **tailwind-merge:** with the app's `cn`, `cn("text-pf-h2", "text-pf-accent")` kept only the colour, because both look like colour classes to tailwind-merge.
- **Alternatives considered:**
  - Extending the app's shadcn tokens: it would change the look of every existing page.
  - Placeholder images in `public/`: binary files to replace, plus `srcset` and size work for content that's temporary.
  - `font-display: optional`: not configurable with Fontsource's CSS, and it would show the fallback on most first visits.
  - Allowing `data:` in `font-src`: it loosens the CSP for every page.

## 0109: Portfolio motion is CSS only: scroll-driven animations, clip-path reveals and View Transitions

*Extended by 0181 (a 1 kB pointer drift script; still no animation library).*

- **What:**
  - **Effects:** hero lines rise out of masks on load. Blocks wipe in with `animation-timeline: view()` (`.pf-reveal`). The manifesto inks in word by word (`SplitWords` sets `--i`/`--n`). The toolbox marquee slides in pure CSS. Articles show a reading-progress bar (`scroll(root)`).
  - **Shared element:** a card's cover morphs into the case study hero through View Transitions (`CoverFrame` sets `view-transition-name`, links pass `viewTransition`, and the transition styles are scoped to a `pf-cover` class).
  - **Guards:** everything sits inside `@media screen and (prefers-reduced-motion: no-preference)` and `@supports`. No animation library was added.
- **Why:**
  - **Progressive enhancement:** content is visible by default. Browsers without scroll timelines, readers who prefer reduced motion and print simply get the static page, and the JavaScript budget stays at zero.
  - **Only `transform`, `clip-path` and `color` move:** layout never shifts (CLS 0), and axe never measures half-faded text. An opacity fade did exactly that in practice: elements caught mid-fade fail contrast.
  - **Marquee pause button:** auto-moving content longer than 5 s needs a way to pause (WCAG 2.2.2), not just hover.
- **Alternatives considered:**
  - GSAP or Motion: richer choreography, but tens of kB on every portfolio page, and work that must wait for hydration.
  - IntersectionObserver reveals in React: needs JavaScript, and risks content hidden until hydration (or forever if it fails).

## 0110: The portfolio is dressed as Dhaka cloth: Anek type, generated weaves, no house-style defaults

*Superseded by 0179 (Himal) and 0184 (Eczar).*

- **What:**
  - **Identity:** the "Ink & Paper" look (cream paper, Fraunces, a vermilion accent, uppercase mono eyebrows numbered "01 ——") is replaced by "Dhaka", after the handloom cloth of Palpa. Cotton-white ground and indigo ink. Dark mode is an indigo night. Three thread colours (crimson, marigold, jade) are shared by both themes.
  - **Type:** Anek Latin + Anek Devanagari, one family for both scripts. Headlines are condensed (`wdth` 75) and bold. Body, quotes and labels are at normal width. Labels are sentence case. JetBrains Mono remains for code blocks only.
  - **Weaves:** `lib/weave.ts` generates stepped, mirrored bands (stripes, zigzags, diamonds, triangles, checks) on a cell grid from a seed. `Weave` draws them as SVG runs. The hero's cloth weaves in row by row once on load (`.pf-weaving`, a `steps()` clip-path animation). Every project cover is its own cloth with the glyph on a cotton label. The footer is edged with a selvedge.
  - **Markers:** chapters are marked by a diamond in the next thread colour. Numerals only appear on real sequences (process steps, project n of m).
  - **Fallback metrics:** "Anek Fallback" (Arial, 93.51%) and "Anek Display Fallback" (Arial Bold, 67.12%), measured in Chrome.
- **Why:**
  - **Distinctive, not generic:** the previous look matched a widely shared house style. Dhaka ties the site to its owner (a Nepali developer) and to the craft (a loom is a grid and its rows). It stays coherent in both scripts and both themes: the indigo ground of a weave becomes white cloth in dark mode, because the ground is the ink token.
  - **One family:** Anek's width axis gives the contrast two families would, and its Latin and Devanagari cuts are designed together, so Nepali pages look as intended rather than as a fallback.
  - **Generated, not drawn:** same reasons as 0108. It is deterministic (integer cells, seeded), themeable and causes no layout shift. Runs of the same thread merge, which keeps a cover to a few hundred `<rect>`s.
  - **No cotton stripes:** a full row of cotton is the page colour and reads as a hole in the cloth.
- **Alternatives considered:**
  - Prayer-flag colours as section bands: the five colours carry religious meaning, and flat bands of colour say less than woven geometry.
  - A topographic (contour-line) theme: common on developer portfolios.
  - Keeping Fraunces with a new palette: the serif display would still read as the same house style.

## 0111: Loaders read through ensureQuery(), not the deprecated ensureQueryData

- **What:** `src/lib/query.ts` has `ensureQuery(queryClient, options)` (`queryClient.query({ ...options, staleTime: "static" })`) and `prefetch(queryClient, options)` (`query(options).catch(noop)`); `loadList` uses both. Every loader outside the portfolio calls `ensureQuery`. The root route reads the session with `queryClient.query(sessionQueryOptions())`, which honours the session's one-minute `staleTime`.
- **Why:** TanStack Query 5.104 deprecates `ensureQueryData`, `fetchQuery` and `prefetchQuery` (to be removed in v6); `query()` with `staleTime: "static"` is the documented replacement. One helper keeps the "static" detail out of every route and makes the next change one edit. `ensureQueryData` also never refetched cached data, so client-side route guards could trust a session for as long as the tab stayed open; the root now refetches it once it is a minute old.
- **Alternatives considered:** calling `queryClient.query({ ..., staleTime: "static" })` inline in each loader (repetitive, easy to forget the option); `revalidateIfStale` on the session (deprecated with `ensureQueryData`, and it doesn't wait, so the guard would still decide with the old value). The portfolio routes still use `ensureQueryData` until that work is next touched; it keeps working until Query v6.

## 0112: Better Auth's admin endpoints are disabled over HTTP

*Extended by 0185: the anonymous plugin's `/delete-anonymous-user` is off too.*

- **What:** every `/api/auth/admin/*` path of the admin plugin is in `disabledPaths` (`src/server/auth/disabled-paths.ts`); Better Auth answers 404. A test compares the list with the plugin's endpoints, so an upgrade that adds one fails until it is listed.
- **Why:** the plugin let any `role: "admin"` user call set-role, ban-user, remove-user, impersonate-user and set-user-password directly, skipping `src/server/rbac/service.ts` (an admin could demote the last admin, or themselves). The UI never used them; roles and bans go through `src/functions/rbac.ts`. The plugin stays for its `role`/`banned` fields and sign-in checks; `disabledPaths` only affects the HTTP router, so server code (and `db:seed-admin`'s CLI) can still call `auth.api.*`.
- **Alternatives considered:** removing the admin plugin (loses the banned-user sign-in refusal and the `role` field the schema relies on); re-implementing the service rules inside Better Auth hooks (two places for one set of rules).

## 0113: Expired sessions are handled by a global client middleware, not an HTTP interceptor

- **What:** `src/middleware/session-expiry.ts` is a `createMiddleware({ type: "function" }).client(...)` registered in `createStart({ functionMiddleware })`. When any server function answers UNAUTHORIZED in the browser, it clears the cached session and navigates to `/login?redirect=<current page>`, then rethrows so the caller's own handling still runs. FORBIDDEN is left to the caller (a toast, or the forbidden page).
- **Why:** server functions don't go through axios or a `fetch` wrapper the app owns; Start's function middleware is the documented place for logic around every call on the client, the equivalent of a response interceptor. Before, an expired session showed "Please log in" in a toast or error page without taking the user anywhere.
- **Alternatives considered:** axios interceptors (server functions don't use axios); `QueryCache`/`MutationCache` `onError` (misses server functions called outside Query, e.g. forms and TanStack DB handlers); throwing `redirect()` from the middleware (the router only handles it inside loaders and `beforeLoad`, not in event handlers).

## 0114: Session tokens stay on the server; the account page revokes sessions by id

- **What:** `listMySessions` no longer returns tokens. `revokeMySession({ id })` (requireUserMiddleware) looks the token up among the caller's own sessions on the server and revokes it; ids that aren't the caller's are NOT_FOUND, and the current session is refused.
- **Why:** session tokens are bearer credentials. Sending every session's token to the page meant one injected script could take over all of a user's devices. The browser only needs an id to say which device to sign out.
- **Alternatives considered:** Better Auth's client `revokeSession({ token })` (needs the token in the browser); deleting the session row directly (bypasses Better Auth's hooks and cookie handling).

## 0115: The last-admin guard locks the admin rows inside the change's transaction

- **What:** demoting or banning an admin runs in one transaction that first locks the active admins (`SELECT … FOR UPDATE`, `lockActiveAdmins`) and refuses the change if the target is the last one. The repository writes run inside it (nested as savepoints).
- **Why:** the count used to run before, and outside, the write. Two admins demoting each other at the same moment could both see "another admin is left" and leave none. With the lock, the second transaction waits, re-reads the rows (one admin left) and is refused.
- **Alternatives considered:** a database trigger (rules split between SQL and the service); `SERIALIZABLE` isolation (retries to handle wherever it's used).

## 0116: List pages share useListPage() and tableListInput()

- **What:** `src/hooks/use-list-page.ts`. `tableListInput(search, preferences, tableId)` resolves the page size (URL, then the table's saved preference, then 20) and is called by the loader. `useListPage({ tableId, search, query })` uses the same resolution, reads the list with `useListQuery`, rethrows a first-load error to the route's error page, and returns `pagination` props for `<Pagination>` whose rows-per-page picker saves the preference and updates the URL. `<ClearFiltersButton>` is the filtered empty state's action.
- **Why:** the Test CRUD and users pages repeated the same ~60 lines (page-size fallback, saved preference, pagination wiring, the empty state's clear link), and every new CRUD would have copied them again (golden rule 2). Loader and component sharing one resolution keep SSR and hydration on the same page size.
- **Alternatives considered:** a `<ListPage>` component taking columns, filters and actions (hides too much: pages differ in dialogs, bulk actions and data sources such as the TanStack DB collection); leaving it as documented copy-paste.

## 0117: Every server function file is declared in the guard test; demo data is a seeded script

- **What:** `tests/server/guarded-functions.test.ts` reads `src/functions/` and fails for any file that isn't listed, either with each function's permission or as deliberately unguarded with a reason and its function names. `pnpm db:seed-demo` (`scripts/seed-demo.mjs`, data in `scripts/lib/demo-data.ts`, tested on PGlite) adds an editor and a viewer role, three users (one without a role, to see the forbidden page) and 30 Test CRUD items.
- **Why:** the old test only checked the files it already listed, so a new `src/functions/<feature>.ts` without `requirePermission` passed. The demo seed makes the permission flows (forbidden page, read-only admin, pagination) testable by hand on a fresh database. It is plain SQL with Better Auth's own password hash, so it runs with `node` alone; the app's TypeScript modules use path aliases Node can't resolve.
- **Alternatives considered:** a lint rule for `requirePermission` (can't express "public on purpose"); seeding through the app's repositories with a TypeScript runner (a new dev dependency for one script).

## 0118: Knip guards against dead code; cn, date-fns and db:push removed

- **What:** `pnpm knip` (config in `knip.json`) reports unused files, exports, types and dependencies, and runs in CI. Entries knip can't find on its own are listed: Nitro routes and plugins (named by string in `vite.config.ts`), the email preview (loaded by a Vite plugin), `src/lib/zod.ts` (an alias target), the Storybook mocks (alias targets), `tests/` and `scripts/`. CSS is part of the project so `@import`/`@plugin` count as uses. `src/components/ui/` is ignored: it's the vendored shadcn kit, kept whole so a component's unused parts are there when needed. `ignoreExportsUsedInFile` is on: exporting a constant the file itself uses is harmless.
- **Removed on the first run:** the `cn` package, `date-fns`, the unused `src/components/filters/index.ts` barrel, and type exports nothing imported (`Auth`, `FormImage`, `WorkSearch`, `ExampleSort`, `ExampleSignup`, and four barrel re-exports). Also the `db:push` script.
- **Why:**
  - `cn` was an unrelated npm package, most likely installed to satisfy the shadcn CLI's `import { cn } from "cn"` (see the README). With it installed, that wrong import type-checked and shipped someone else's code; without it, `pnpm typecheck` fails until the import is fixed, as intended.
  - `date-fns` was never imported; `react-day-picker` depends on its own copy.
  - `db:push` changes the database schema without writing a migration. The app is migration-based (0018), so push could leave production and `drizzle/` out of step. CI now also fails when the schema changes without a migration (`drizzle-kit generate` must produce nothing) and runs `pnpm db:check`.
  - Biome and TypeScript see one file at a time; only a whole-project tool notices that nothing uses an export or a package.
- **Alternatives considered:** depcheck (dependencies only, no exports); TypeScript's `noUnusedLocals` (file-local only); listing every shadcn export as used (noise for vendored code).

## 0119: Version pinning: caret by default, exact only with a reason

- **What:** dependencies use `^` unless one of these applies, in which case they are exact and the reason is recorded:
  - **Pre-release:** `nitro` (3.0 beta, 0004) and `@sentry/tanstackstart-react` (beta, 0073).
  - **Output that gates check:** `@biomejs/biome` (formatting and lint rules change in minors, failing `pnpm check`); the Anek fonts (fallback metrics measured per version, 0108, 0110).
  - **Families that must match:** Storybook packages, and `@vitest/*` with `playwright`.
  - **Verified privacy behaviour:** `posthog-js` and `posthog-node`. The consent flow (no request before consent, cookie and storage removed on withdrawal, 0074) was checked against these versions; an update is re-verified before the pin moves.
  The lockfile is what installs; the range only says what an update may move to. Dependabot (0120) opens grouped PRs for both kinds, and CI runs every gate on them.
- **Nitro beta in production:** kept because it's the server build TanStack Start generates for Vercel (0004), and there is no stable Nitro 3 yet. Move to the first stable Nitro 3 release (or the version the TanStack CLI then pins) in its own PR with a full production browser review; re-check the dev-only routing workarounds (0067, 0103) at that point.
- **Why:** the repo had both styles with no rule, so nobody could tell a deliberate pin from an accident.
- **Alternatives considered:** pin everything exactly (every update becomes a manual edit; the lockfile already gives reproducible installs); caret everywhere (beta and output-changing packages would move under the gates without a decision).

## 0120: CI on GitHub Actions, git hooks with lefthook, Dependabot for updates

- **What:**
  - `.github/workflows/ci.yml` runs on every PR and push to `main`, in four parallel jobs: typecheck + check + knip + the migration check; `pnpm test`; `pnpm test:storybook` + `build-storybook`; `pnpm build`. The build gets placeholder `VITE_` values (only public variables are needed at build time, 0011). Story tests use the runner's installed Chrome, as locally.
  - `lefthook.yml`: Biome on staged files before commit (fixes re-staged; warnings block), `pnpm typecheck` and `knip --dependencies` before push. `pnpm install` installs the hooks via `scripts/install-hooks.mjs`, which skips CI and installs without a `.git` folder (Vercel builds), where `lefthook install` fails.
  - `.github/dependabot.yml`: weekly npm and GitHub Actions updates, grouped by packages that move together (TanStack, Storybook, Vitest + Playwright, Better Auth, Tiptap, Tailwind, Drizzle, React, `@types`).
  - `.nvmrc` is `24` (the current LTS, used to verify the gates); `engines` stays `>=22`. The package is named `start-template` and licensed MIT.
- **Why:** the gates only ran on the author's machine, so a PR could merge red. Hooks catch the cheap mistakes before a push; CI is the authority. The browser review joins CI in Task 27.
- **Alternatives considered:** Husky + lint-staged (two packages and a shell script per hook; lefthook is one binary with parallel commands); Renovate (more options, but needs a GitHub app; Dependabot's groups cover what's needed); one sequential CI job (simpler, about twice as slow); running the full `knip` before push (unused exports are normal mid-work; CI runs it).

## 0121: The browser review is a Playwright suite against a harnessed production server

- **What:** `pnpm test:e2e` (Playwright, `e2e/`) replaces the review scripts that lived outside the repo. Its `webServer` is `e2e/harness/server.ts`, which builds the app, starts a database, migrates and seeds it, starts a fake Resend API, and runs `.output/server/index.mjs` with only the env it sets. A unit test checks the page list against the route tree. CI runs the suite in 3 shards on a Postgres 17 service.
- **Choices:**
  - **Playwright test runner** (`@playwright/test`, pinned to the same exact version as `playwright`, which the Vitest browser tests already pin) with `@axe-core/playwright`. It uses the installed Chrome (`channel: "chrome"`) like the story tests, so neither CI nor a fresh clone downloads a browser.
  - **Emails through the real provider:** the server runs with `EMAIL_PROVIDER=resend` and `RESEND_BASE_URL` (read by the Resend SDK) pointing at the harness, which stores each message. The app carries no test-only code, and a production build still refuses the console provider.
  - **Database:** locally, in-memory PGlite served over TCP by `e2e/harness/pglite-server.ts` (nothing to install); in CI, a real Postgres (`E2E_DATABASE_URL`). That database is emptied first, so its name must contain `e2e` or `test`. `@electric-sql/pglite-socket` was tried and dropped: its queue takes single protocol messages from all connections in arrival order, so two pooled connections can interleave Parse/Bind/Execute and run each other's unnamed statements. The harness's server takes turns per whole request (up to Sync, or a simple query) and keeps a connection's turn for the length of a transaction. 300 concurrent pooled queries and transactions ran without a wrong result.
  - **Seeding** reuses `scripts/lib/demo-data.ts` plus an admin row written the same way, instead of `db:seed-admin` (which loads the app's auth config through Better Auth's CLI).
  - **Rate limits** stay on (they're part of what's tested). Every test comes from 127.0.0.1, so the harness clears the `rate_limit` table before tests that sign in. Seeded users sign in through the API the first time a test needs them, and the saved state is reused for the rest of that harness run (it's keyed on a per-run id, because each run has a new database). An earlier version used a setup project; Playwright's UI mode doesn't run a setup project unless it's ticked, so tests there started from sessions of an older database and failed.
  - **Every route is reviewed or excused:** `REVIEWED_PAGES` names each route with its user, how `$param` values are found (from `/sitemap.xml`, or a seeded row through the harness) and any expected 403/404. `tests/unit/e2e-pages.test.ts` reads `FileRoutesByTo` from `src/routeTree.gen.ts` (importing the tree would load every route) and fails on a route that's in neither list. It's a unit test so it fails fast in `pnpm test` and the pre-push hooks.
  - **Console, page errors and CSP** are checked by an automatic fixture in every test, flows included. Each test can allow the lines it expects (a 403/404 document).
  - **A warm-up load before the measured one.** Cold loads on a CPU running six browsers sometimes painted the fallback faces before the preloaded fonts arrived, and the swap then shifted text. The worst case was 0.13 on `/admin/test-crud/$id` at 390 px, where the last breadcrumb wraps in the fallback face and fits in Inter. Unloaded, or with fonts cached, CLS is 0. The section 7 method assumed fonts arrive before first paint (an idle machine), so the suite makes that deterministic instead of letting CLS depend on machine load. The underlying gap: the single "Inter Fallback" face is tuned for regular weight, so medium and bold text is about 1.7% wider in the fallback. Per-weight fallbacks are left to Task 31.
  - **UI mode:** the config lists `flows` first, because UI mode ticks only the first project at start. A successful build's stderr (Vite's timing notes) goes to stdout, because UI mode flags any webServer stderr as an error. The harness exits when its parent process is gone; on Windows a killed UI process otherwise left the harness and server on their ports, and the next local run silently reused them.
  - **Traces only on the CI retry:** recording a trace for every test under parallel load on Windows failed with `ENOENT` on Playwright's artifact files, and doubled the run time.
- **Why:** only whoever had the scripts could run the review, so a regression on a page nobody re-checked went unnoticed. Now it's one command, and CI runs it on every PR.
- **Alternatives considered:** keeping the review scripts outside the repo (not reproducible); `@electric-sql/pglite-socket` (interleaving, above); requiring Docker or a local Postgres (more setup for every contributor); a test-only email provider in the app (production code would carry it); a Mailpit/SMTP container (Resend's API is what production calls); discovering pages by crawling (misses pages behind a sign-in or a seeded id, and can't tell a missing page from an intentionally private one).

## 0122: Edits carry the version they started from; a stale save is a CONFLICT

*Since 0173 the version is checked one way everywhere: in the UPDATE's WHERE (`updateVersioned`), without a separate row lock.*

- **What:** an edit sends the row's `updatedAt` as it received it (`versionSchema()`, `src/lib/concurrency.ts`). The repository writes only while the row still has that version (`sameVersion(column, version)`, `src/server/db/concurrency.ts`) and otherwise throws `staleError()`: a `CONFLICT` with `reason: "stale"`. Forms catch it with `handleSaveError(form, error, onStale)` and show `StaleVersionAlert`, whose "Reload" refetches the record and resets the form to it. Test CRUD's edit form and the role rename dialog use it.
- **Choices:**
  - **`updatedAt` is the version.** Both tables already have it, maintained by Drizzle's `$onUpdate`, so no migration and no extra column. Postgres keeps microseconds (an insert's `defaultNow()`) and a JS Date milliseconds, so the comparison is `date_trunc('milliseconds', updated_at) = $version`.
  - **Checked under the row lock** in Test CRUD (the update already selects the row `for update`), so two saves of the same version can't both pass; for roles, the check is in the `UPDATE ... WHERE` itself. A zero-row update is then told apart as deleted (`NOT_FOUND`) or changed (stale).
  - **A `reason` on AppError**, carried by the serialization adapter, rather than a magic `fieldErrors` key: the client branches on it (`isStaleError`) and `errorMessage` localizes it on the client.
  - **What's versioned:** whole-record edits. The list's publish toggle and deletes aren't (one field or the whole row, and the edit form's version check catches a publish that happened meanwhile). The permission matrix sends grant/revoke deltas, which can't overwrite someone else's change, so it doesn't bump the role's version.
  - **Reload, not merge:** the alert says nothing was saved and reloads the latest version. A field-by-field merge UI is a lot of code for a rare case; a feature that needs it can build it on `isStaleError`.
  - Also fixed while here: `applyServerFieldErrors` treated `_form` (a `ruleError`'s message) as a field, so forms swallowed rule errors (e.g. "last admin") without a toast.
- **Why:** before this, the second of two concurrent edits silently overwrote the first.
- **Alternatives considered:** an integer `version` column (a migration per table, same result); ETags/`If-Match` headers (server functions aren't REST resources); `SELECT ... FOR UPDATE` alone (stops simultaneous writes, not a save from a form opened before someone else's save); last-write-wins with an audit trail (Task 30's audit log records changes but doesn't prevent loss).

## 0123: One request id per request, kept in AsyncLocalStorage by the server entry

- **What:** `src/server.ts` wraps every request in `runWithRequestId` (`src/server/http/request-id.ts`): a fresh UUID in AsyncLocalStorage, returned as `x-request-id`. Server functions get it as `context.requestId` (the logging middleware reads it, so `AppError.requestId` and the error page's reference match the header), `log()` (`src/server/log.ts`) adds it to every server log line, and `instrument.server.ts`'s `beforeSend` tags each Sentry event with it.
- **Choices:**
  - **Always generated**, never taken from an incoming `x-request-id`: that header is client input. Vercel's own `x-vercel-id` stays available in its logs for edge correlation.
  - **AsyncLocalStorage**, like the existing per-request error status (`error-status.ts`) and Paraglide's locale: one place sets it, and code deep inside a request (the DB health check, auth email delivery, PostHog) reads it without threading a parameter.
  - **`withHeader`** copies the response when its headers are immutable (`Response.redirect`).
  - **Function middleware** reaches the server-only module by a dynamic import inside `.server()` (the same rule as the rest of `src/middleware`). Nitro routes (cron, manifest) bypass the Start entry and have no id.
- **Why:** each server-function call made its own id, so a page request had none and its log lines couldn't be tied to the response or to Sentry.
- **Alternatives considered:** trusting an upstream id (spoofable); a Start request middleware putting the id in context (it wouldn't reach code outside the middleware chain, such as Better Auth's hooks); OpenTelemetry trace ids (Sentry already traces; a separate id is simpler to show to users).

## 0124: GET /api/health for monitors; the /health page stays for people

- **What:** `src/routes/api/health.ts` (a server route, GET and HEAD) answers `200` with `{ status, checks: { database: { status, latencyMs } }, checkedAt }`, or `503` when the database doesn't answer, with `cache-control: no-store`. The ping times out after 3 s (`HEALTH_TIMEOUT_MS`), so a hung connection counts as down instead of hanging the monitor. The `/health` page renders the same check.
- **Why:** monitors need a status code, not an HTML page that's 200 even when the database is down. No details leave the server (0019): the reason is in the log line.
- **Alternatives considered:** a Nitro route (only needed for requests Vite intercepts in dev, 0103; monitors send ordinary requests); checking more dependencies (Cloudinary, Resend: their outages don't make the site unusable, and a monitor would page for a third party).

## 0125: Idempotency keys are a recipe, not core

- **What:** `/dev/examples/idempotency` and the routing guide's "Idempotency keys" section. `createIdempotencyStore()` (`src/server/examples/idempotency.ts`) runs an action once per key, answers repeats (a double submit, a retry after a lost response) with the first result, makes a duplicate that arrives while the first is still running wait for it, refuses a key reused with different input or by another user, and forgets a key whose action failed. The guide shows the Postgres version a real feature uses.
- **Why a recipe:** the shared submit button already disables itself while saving, and the app's creates are admin forms where a duplicate is visible and deletable. Keys matter for actions with side effects outside the database (emails, payments, webhooks), which the base doesn't have. The in-memory store is for the example only (one process).
- **Alternatives considered:** a core `idempotency_key` table and middleware on every POST (a table and a write per call for a problem the base doesn't have); unique constraints alone (they stop duplicate rows, not duplicate emails).

## 0126: Two-factor is TOTP with backup codes; admins can be required to use it

- **What:** Better Auth's `twoFactor` plugin (TOTP + 10 encrypted backup codes, migration `0007_auth_hardening`). The account page's two-factor section turns it on (password, scan a QR code or type the key, confirm a code, save the backup codes), issues new backup codes and turns it off. The login form shows a second step (app code or backup code, "trust this browser for 30 days"). `AUTH_REQUIRE_ADMIN_2FA=true` makes it mandatory for anyone holding an admin permission.
- **Choices:**
  - **Enforcement in one place:** `getServerSession` (`src/server/auth/session.ts`) gives a user who must set it up (`mustSetUpTwoFactor`, `src/server/auth/policy.ts`) no permissions and `twoFactorRequired: true`. Every `requirePermission` then refuses, `useCan` hides admin UI, and `requireAdminAccessMiddleware` throws FORBIDDEN with the new `two-factor-required` reason, which the `_admin` layout turns into a redirect to `/account?twoFactor=required#two-factor`. Nothing else in the app needed to learn about it.
  - **Default off** (Part 3 rule: nothing silently changes behaviour). Existing admins would otherwise be locked out of `/admin` on deploy.
  - **Policy for the other sign-in methods.** Better Auth's second factor only runs after password sign-in. An emailed sign-in code would get around it, so an email-code sign-in to an account with two-factor on is undone and refused (`refuseEmailCodeWithTwoFactor`, `src/server/auth/hooks.ts`, an `after` hook that deletes the new session and clears the cookie). It runs after the code is checked, so only someone holding a valid code learns that the account uses two-factor. **Google sign-in is trusted as is:** Google runs its own second factor, and asking for ours after an OAuth redirect needs a challenge flow Better Auth doesn't have for social sign-in. A password reset doesn't sign in, so it doesn't bypass anything.
  - **`allowPasswordless: true`:** a Google-only admin can still satisfy the requirement (the factor applies once they set a password).
  - **QR code:** `uqr` (zero dependencies) renders the `otpauth://` URI as an SVG shown through a `data:` image (allowed by `img-src`), with the key as text next to it.
  - **Rate limits:** `/two-factor/*` 10 a minute, on top of the plugin's account lockout (10 failed codes lock the account for 15 minutes).
  - **Notices:** turning it on or off emails a `security-notice` (Better Auth's `user.update.after` hook, by path).
- **Why:** a password alone is one leaked credential away from an admin takeover.
- **Alternatives considered:** email or SMS codes as the second factor (email is the account-recovery channel already, SMS costs money and is phishable); blocking `/admin` with a route check only (functions would still answer, so the requirement would be cosmetic); refusing email-code sign-in before the code is checked (tells anyone who types an address whether it has two-factor).

## 0127: Breached passwords are refused through Have I Been Pwned, on by default

- **What:** Better Auth's `haveIBeenPwned` plugin on `/sign-up/email`, `/change-password` and `/reset-password` (`BREACHED_PASSWORD_PATHS`). `setMyPassword` (a Google user adding a password) calls `isPasswordCompromised` itself, because Better Auth's set-password endpoint is server-only with no path, so the plugin can't see it. The `PASSWORD_COMPROMISED` code shows a localized message.
- **Choices:** on by default (`AUTH_BREACHED_PASSWORD_CHECK`): only the first 5 characters of the SHA-1 hash leave the server (k-anonymity, with response padding), and existing users only notice when they pick a breached password. If the API is down, the plugin fails closed (sign-up answers an error) rather than letting a breached password through; turn the check off with the variable during an outage. The e2e harness turns it off so the suite makes no outside calls; `tests/server/auth-hardening.test.ts` runs the plugin on a real Better Auth instance against a stubbed range API.
- **Why:** password reuse from other breaches is the most common way accounts are taken over.
- **Alternatives considered:** a local list of common passwords (stale and large); zxcvbn-style strength scoring only (a strong-looking password can still be in a breach; the forms already show strength hints).

## 0128: Turnstile on the endpoints that send email or create accounts, plus a honeypot

- **What:** Better Auth's `captcha` plugin with Cloudflare Turnstile on `/sign-up/email`, `/request-password-reset` and `/email-otp/send-verification-otp` (`CAPTCHA_PATHS`), when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are both set. The site key reaches the forms through `getAuthFeatures`; `useTurnstile` (`src/features/auth/components/bot-check.tsx`) loads the script, renders the widget (65 px reserved, so no layout shift) and sends the token as `x-captcha-response`. Every auth form also has a honeypot field: hidden from people and assistive tech; when it's filled the form shows its success state and sends nothing.
- **Choices:**
  - **Off unless configured.** No keys, no widget, no CSP change. With keys, the CSP adds `frame-src https://challenges.cloudflare.com` (and the same host to `script-src` for browsers without `'strict-dynamic'`); the script itself is allowed because our nonced code adds it.
  - **Not on password sign-in:** it's rate limited (5 a minute per IP) and a captcha there costs every user on every visit. The three endpoints above are the ones that let anyone make the app send email to any address, or create rows.
  - **Server env, not `VITE_`:** the site key is public, but serving it from the server means turning the captcha on or off doesn't need a rebuild.
  - A refused token shows "complete the security check"; forgot-password and sign-in-code otherwise keep showing the same "sent" message whether or not the account exists.
- **Why:** sign-up and reset forms are where bots send email in bulk on someone else's behalf.
- **Alternatives considered:** hCaptcha or reCAPTCHA (heavier, tracking concerns); Vercel BotID (ties the template to Vercel); the honeypot alone (only stops bots that fill forms in a browser).

## 0129: Account deletion always takes an emailed link; the export is a JSON download

*Extended by 0186: guests are deleted by a daily cleanup, with their uploads.*

- **What:** Better Auth's `deleteUser` with `sendDeleteAccountVerification`. "Email me a deletion link" on the account page sends a `delete-account` email whose link opens `/account/delete?token=…` (signed-in only), where one more click sends the token back (`authClient.deleteUser({ token })`). `beforeDelete` runs `prepareAccountDeletion` (`src/server/account/service.ts`): it refuses the last active admin (`LAST_ADMIN`, the same lock as the RBAC rules) and marks the user's unsaved uploads removed so the cleanup job deletes them from Cloudinary. Sessions, sign-in methods, two-factor rows and role assignments go with the user row (foreign keys cascade); records they created stay, with no author. `afterDelete` sends an `account-deleted` email. `GET /api/account/export` returns the user's data as a JSON download (profile, sign-in methods, sessions, roles, uploads, items they created; never password hashes, tokens or 2FA secrets).
- **Choices:**
  - **Email always, password never enough:** a stolen session (or an unlocked laptop) can't delete the account. The link opens our page, not Better Auth's GET callback, so a mail scanner opening it deletes nothing.
  - **Linked images stay:** an image saved with a record belongs to that record (other editors use it); only uploads nobody saved are queued.
  - **The last-admin check isn't in the same transaction as Better Auth's delete** (it can't be: Better Auth runs its own queries). Two last admins deleting themselves in the same instant is the remaining race; it's documented rather than worked around.
  - **Export as a server route**, so it's a plain link that works before hydration; a cross-site page can make the browser request it but can't read the answer.
- **Why:** users must be able to leave and take their data with them (and in many places the law says so).
- **Alternatives considered:** deleting with the password (no proof of inbox control, and Google users have no password); soft delete (a recipe in Task 33; a deleted account should be gone); an emailed export (a file with personal data sitting in an inbox).

## 0130: Linked accounts: add a password, link and unlink Google, never the last way in

- **What:** the account page's "Ways to sign in" section. A user without a password (signed up with Google) can set one (`setMyPassword` → Better Auth's server-only `setPassword`). Google can be linked (`authClient.linkSocial`, only when its verified address matches) and unlinked (`authClient.unlinkAccount`) while a password remains; Better Auth refuses to remove the last account (`allowUnlinkingAll: false`), and the button is disabled in that case. Adding a password or linking Google (also Better Auth's automatic linking when a Google sign-in matches an existing address) and unlinking send a `security-notice` email. The change-password section shows only when there's a password.
- **Why:** a Google-only user had no way to stop using Google, and nothing told a user that a new way into their account had appeared.
- **Alternatives considered:** allowing different addresses on linked accounts (an account takeover path when an attacker controls a Google account with another address); counting email-code sign-in as a way in, so Google could be unlinked without a password (it would leave the inbox as the only factor; Better Auth's rule is simpler and stricter).

## 0131: Last login method and passkeys are recipes

- **What:** `docs/guides/security.md` ("Recipes: last login method, passkeys") shows how to add Better Auth's `lastLoginMethod` plugin (a "last used" hint on the login page) and `@better-auth/passkey` (WebAuthn sign-in, with its own table and two-factor interplay).
- **Why a recipe:** last login method is a convenience with a cookie or an extra column; passkeys need a new dependency, a table, a migration and per-browser testing that not every project wants on day one. Both are a guide section only, with the exact code: a dev example would need the dependency and schema in every project, which is what the recipe avoids.
- **Alternatives considered:** shipping passkeys in the base (most templates built on this won't use them, and they change the sign-in UI's shape).

## 0132: Admin actions are audited in the same transaction as the change

*Its scope is widened by 0173: creates and edits of content are audited too, through `withAudit`. Extended by 0186: showcase-app data is never audited.*

- **What:** an `audit_event` table (migration `0008_audit_log`): actor, the admin behind an impersonated session, action, target type, id and label, a `before`/`after` summary of the changed fields, request id, client IP and time. Services write it with `recordAudit(tx, actor, entry)` (`src/server/audit/record.ts`) inside the transaction that makes the change: role create, rename, delete and permission edits; a user's roles, ban, unban, sign-out-everywhere and invitation; impersonation start and stop; Test CRUD publish, unpublish and delete. `/admin/audit` lists it through the list contract (search by target or request id, actor, action, target type, day range), guarded by a new `audit:read` permission (page and function).
- **Choices:**
  - **Same transaction, not an event bus or an after-commit hook:** a change without its row (or a row without its change) can't happen, and the service is the one place that knows what changed. A refused or failed action leaves no row.
  - **Who and where from:** server functions build the actor with `auditActorFrom(context)` (`src/server/audit/actor.ts`): the user, `impersonatedBy`, the request id from AsyncLocalStorage (0123) and the client IP from the same trusted source as the rate limits. Services take the plain `AuditActor`, so tests pass `{ id }`.
  - **Summaries, not snapshots:** `before`/`after` hold the few fields the action touched (names, permission lists, status, role names, counts), never secrets or whole rows. Unchanged saves (granting a permission the role has, publishing a published item) write nothing.
  - **History outlives accounts:** `actor_id` is set null when the account is deleted and `actor_label` keeps the email from the time. That is personal data kept after deletion on purpose (an audit trail that forgets who acted is no trail); projects with stricter rules can blank `actor_label` in `prepareAccountDeletion`.
  - **Append-only in the app:** nothing updates or deletes rows. Retention (e.g. delete after a year) is a cron job a project adds if it needs one.
  - **Not audited:** edits and creates of Test CRUD items (high volume, and the item itself has `updatedAt`); sign-ins and account changes (Better Auth's own events, a Task 33 recipe if wanted).
- **Why:** "who removed this permission?" needs an answer that doesn't depend on someone's memory, and the request id ties it to the logs and Sentry.
- **Alternatives considered:** database triggers (they don't know the actor or request id without session variables on every connection); writing after the transaction (a crash between the two loses the row); a generic diff of whole rows (noisy, and it would copy fields that shouldn't be kept).

## 0133: Inviting a user creates the account and emails a long-lived reset token

- **What:** `inviteUser` (`users:invite`, a new permission) takes a name, email and the invitation's language. The service creates the account (the `user` baseline, address unverified, no password) and its audit row in one transaction, then `sendInvitation` (`src/server/auth/invite.ts`) stores a Better Auth `reset-password:<token>` verification valid for 3 days and emails an `invite` template linking to `/reset-password?token=…&invite=1`. That page, worded as "Accept your invitation", calls Better Auth's normal reset, which creates the password account. `onPasswordReset` marks the address verified (only its owner could open the link), so the invitee signs in at once.
- **Choices:**
  - **Reuse the reset flow** instead of a new token type: the endpoint, its rate limit, the breached-password check and the page already exist and are tested. Only the lifetime (3 days, set when the token is stored) and the copy differ.
  - **No roles in the invitation:** an invitee starts with the baseline, and roles are given from the list like for anyone else, through the same escalation rules. The invite form stays three fields.
  - **An expired invitation needs no resend button:** "Forgot password" with the same address sends a fresh reset link and works for an account without a password.
  - **The email is sent in the background** (like every auth email), so a mail outage doesn't fail the invitation; the address is the admin's to re-check.
- **Why:** admins needed to add people without asking them to sign up and then finding their row.
- **Alternatives considered:** Better Auth's admin `createUser` (its endpoint is disabled, 0112, and it wants a password the admin would then have to pass on); the `organization` plugin's invitations (multi-tenancy, a non-goal); an admin-chosen password (it travels outside the app).

## 0134: Impersonation is admin-only, audited, and can't change the account

- **What:** "View as this user" on `/admin/users` calls `impersonateUser`, which runs Better Auth's server-side `impersonateUser` (its HTTP endpoint stays disabled, 0112) after writing the `user.impersonate` audit row, which is deleted again if the call fails. (Not one transaction: Better Auth writes the session through its own pooled connection, which waits for an open transaction; on the e2e harness, one PGlite backend, it waited forever. Stopping works the same way.) The session is the user's, with `impersonatedBy` set, for at most an hour. Every page then shows a banner (`ImpersonationBanner`, rendered in `__root.tsx` from the session, so no layout shift) with "Back to my account", which calls `stopImpersonating` (`src/functions/auth.ts`): Better Auth restores the admin's session from its signed `admin_session` cookie, and a `user.impersonate-stop` row names the admin. Rows written while impersonating carry the admin as `impersonator_id`.
- **Choices:**
  - **Admins only (the superuser flag), not a permission:** the session acts with all of the target's permissions, so a custom role holding "impersonate" could reach anything any user can. The function is guarded with `users:update` (every protected function names a permission) and the service refuses non-admins; Better Auth's own check agrees. Never another admin, never a banned user, never from an impersonated session.
  - **The account stays the owner's:** an impersonated session can't change the password, email, two-factor, linked accounts, other sessions or delete the account. Better Auth's endpoints are refused by a `before` hook (`refuseOwnerOnlyWhileImpersonating`, `OWNER_ONLY_PATHS` in `src/server/auth/policy.ts`); the app's own (`setMyPassword`, `revokeMySession`) use `requireAccountOwnerMiddleware`. Reading (including the data export) is allowed: it's what the admin came to see.
  - **A recipe in the base:** it ships because the guards are the hard part, but nothing else depends on it; a project that doesn't want it deletes the row action, `impersonateUser` and the banner.
- **Why:** support ("what does this user see?") without asking for their password, with a record of every use.
- **Alternatives considered:** a "view as role" preview (doesn't reproduce a user's data); our own session cookie handling (Better Auth already signs and restores the admin's session); allowing it for any `users:update` holder (escalation by impersonating someone with more permissions).

## 0135: Better Auth's `role = "admin"` stays the superuser flag

- **What:** `user.role === "admin"` (Better Auth's admin plugin field) means "every permission, and the rules only an admin may break" (making admins, acting on admins, impersonating). Everything else lives in the RBAC tables: the `user` baseline role, custom roles and their permissions. The `admin` row in `role` exists for display and holds no permission rows. `docs/guides/rbac.md` states the model.
- **Why:** the flag is read on every request by Better Auth itself (sign-in checks, impersonation, `adminRoles`), so moving it into `user_role` would mean keeping two sources in sync. A single boolean is also what the lockout rules (always one active admin) lock on.
- **Alternatives considered:** an `admin` assignment in `user_role` with Better Auth's `role` derived from it (two writes per change, and a window where they disagree); dropping the admin plugin (it also provides bans and the impersonation sessions used by 0134).

## 0136: The React Compiler runs on client builds, through Babel

- **What:** `babel({ presets: [reactCompilerPreset()] })` (`@rolldown/plugin-babel` + `babel-plugin-react-compiler`, as `@vitejs/plugin-react` 6 documents) in `vite.config.ts` and `.storybook/vite.config.ts`. The preset applies to the client environment only, so SSR output is unchanged. `babel-plugin-react-compiler` is pinned exactly (0119: its output is what ships, and React's docs advise pinning it). The `useCallback`s in `FilterBar`, `useBotCheck` and `useCloseOverlay` were removed (the compiler memoizes them; no caller uses them as an effect dependency). The `useMemo`s that create a resource (TanStack DB collections in the admin Test CRUD list and the optimistic example) stay: the compiler's memoization is a performance hint, not a guarantee of identity. shadcn's own `useMemo`s in `ui/` stay as generated.
- **Numbers** (`pnpm build`, same machine, before → after; client assets):

  | | Before | After | Change |
  | --- | --- | --- | --- |
  | Build time | 10–14 s | 19–20 s | about +7 s |
  | Client JS, raw | 2,815 kB | 2,963 kB | +5.2% |
  | Client JS, gzip -9 | 919 kB | 980 kB | +6.7% |
  | Entry chunk, gzip | 133.4 kB | 137.9 kB | +4.6 kB |
  | Forms chunk, gzip | 64.0 kB | 72.1 kB | +8.1 kB |

  Over `src/` (server code excluded) the compiler compiled 348 components and hooks and skipped 21, which stay as written. Most skips are "Cannot access refs during render" in form field components and Babel constructs it doesn't lower yet (`try`/`finally`, tagged templates in `ui/calendar.tsx`). The compiler's `logger` option lists them again when those files change.
- **Why:** lists, filters and forms re-render on every keystroke and URL change; the compiler removes that work without hand-written memoization, and the template stops teaching `useCallback` where it isn't needed. The cost is about 61 kB gzip, mostly in the lazy forms and editor chunks, and ~7 s of build time.
- **Alternatives considered:** the Rust compiler (`react({ compiler: true })` with `oxc-transform-react`): faster builds, but the plugin marks it experimental; revisit when it's stable. `compilationMode: "annotation"` (only `"use memo"` files): smaller bundle, but every new component has to opt in. No compiler: smallest bundle, and memoization stays a code-review topic.

## 0137: A skip link on every page; reduced motion finishes animations at once

- **What:** `SkipLink` (`src/components/layout/skip-link.tsx`) is the root layout's first element and jumps to `#main-content`; every page's `<main>` spreads `MAIN_CONTENT` (`id` + `tabIndex={-1}`; the shared `Page` does it). Sections with their own chrome (`chrome: "bare"`, the portfolio) bring their own link, and the root one is hidden there. The browser review checks on every page that the first tab stop is a skip link whose target is a `<main>`; `e2e/flows/frontend.spec.ts` follows it with the keyboard (in the admin area it also skips the sidebar). Under `prefers-reduced-motion: reduce`, `app.css` sets every animation and transition to 0.01 ms and removes view-transition animations. The text is the shared `skip_to_content` message (the portfolio's own key was merged into it).
- **Why:** WCAG 2.4.1 (bypass blocks) and 2.3.3 (animation from interactions). Shortening instead of `animation: none` keeps `animationend`/`transitionend` firing, which Radix Presence and sonner wait for before unmounting. `!important` is needed to beat component and inline styles, so the block carries a Biome suppression with that reason.
- **Alternatives considered:** a skip link per layout (four copies, each needing its own target); targeting the root's content wrapper (no per-page change, but in the admin area focus lands on the sidebar); `motion-reduce:` variants on each animated element (opt-in per component, easy to forget, and third-party CSS isn't covered).

## 0138: Real-user Web Vitals go to PostHog, after consent

- **What:** `src/lib/observability/web-vitals.ts` loads `web-vitals` once analytics runs (consent granted) and sends CLS, LCP and INP as a `web_vital` PostHog event with `metric`, `value` (CLS to 4 decimals, the others in ms), `rating`, `navigation_type` and `path` (no query or hash). Events go out with `send_instantly`, so the CLS/INP report made as the page is hidden uses `sendBeacon`. Without consent or a PostHog key, the library isn't downloaded.
- **Why:** the CLS ≤ 0.01 rule was only checked on a lab build (the e2e review). Visitors have slower devices, other fonts and real data; the 75th percentile of `web_vital` where `metric = CLS`, per `path`, is the production check (`docs/guides/observability.md`). PostHog is already the consented analytics tool, so vitals need no new processor or banner text.
- **Alternatives considered:** PostHog's built-in capture (`capture_performance`): loads its extension from PostHog's asset host at runtime, changing the network behaviour verified for 0074/0119. Sentry's browser tracing: records vitals too, but only for sampled page loads (10%) and adds the tracing bundle to every page. Sending without consent: vitals alone aren't personal data, but the PostHog request carries its device id.

## 0139: CSP violations are reported to /api/csp-report and forwarded to Sentry

- **What:** in production the CSP ends with `report-uri <origin>/api/csp-report; report-to csp`, and HTML responses carry `Reporting-Endpoints: csp="<origin>/api/csp-report"`. The endpoint (`src/routes/api/csp-report.ts`, logic in `src/server/http/csp-report.ts`) accepts both formats (Reporting API batches and the older `application/csp-report`), keeps only the origin and path of URLs, drops reports caused by browser extensions, and takes 10 reports a minute per client IP and 100 in total per server instance (429 beyond). Each report becomes a `warn` log line and a Sentry warning fingerprinted by directive and blocked resource, so a recurring violation is one issue with a count.
- **Why:** a CSP block in production is otherwise invisible: the page just misses a script or an image. The limits stop a misbehaving client or a flood from spending the Sentry quota. The limiter lives in memory because it guards a quota, not the app; exact limits across instances aren't needed.
- **Checking it:** `e2e/flows/frontend.spec.ts` checks the headers and the endpoint, `tests/server/csp-report.test.ts` the parsing, the limits and the Sentry call. Browsers deliver Reporting API reports out of band (Playwright can't see them), so watching one arrive in Sentry is a manual step on a preview deploy (`docs/guides/deployment.md`).
- **Alternatives considered:** `report-uri` straight to Sentry's security endpoint (no filtering or limits, and the DSN key in every page's header); `Content-Security-Policy-Report-Only` first (the policy has been enforced since 0081, so there is nothing to trial); a database-backed limiter (the Task 33 recipe; more than a quota guard needs).

## 0140: The admin command palette and view transitions are a recipe

- **What:** `/dev/examples/command-palette` shows a `cmdk` palette (`ui/command.tsx`) opened with Ctrl/⌘ K. It lists the admin sections the user holds the permission for (the sidebar's filter) and navigates with `viewTransition: true`. `docs/guides/conventions.md` explains mounting it in `AdminLayout` and the router's `defaultViewTransition`. Reduced motion turns the transition's animation off (0137).
- **Why:** both are product choices (a shortcut can clash with an app's own; a cross-fade on every admin navigation is a matter of taste), so the base stays plain and the recipe is ready to copy.
- **Alternatives considered:** shipping both in the admin layout (every project would carry the shortcut and the transition, wanted or not).

*Superseded by 0165: the palette is part of the admin shell; view transitions stay opt-in.*

## 0141: `pnpm new:feature` generates an admin CRUD section from templates and marker lines

*Superseded by 0175 (v2: the CRUD standard's shape, `--public`, `--localized`, a clean tree and rollback).*

- **What:** `scripts/new-feature.mjs <name> [--title] [--title-ne] [--no-build]` copies `scripts/templates/feature/` (paths and contents use `__name__`, `__snake__`, `__camel__`, `__Pascal__`, `__UPPER__`, `__Title__`; `.tpl` files, so Biome, TypeScript and knip ignore them) and inserts entries above `// @new-feature:<slot>` lines in the shared lists: the schema index, the permission catalog and its labels, audit actions, targets and labels, `ADMIN_SECTIONS`, the guarded-functions test and the e2e page lists. It appends messages to both locales, runs `drizzle-kit generate --name <snake>`, Biome on what it touched (and `drizzle/`), the Paraglide compiler and a build (which regenerates the route tree). The generated feature is the admin half of Test CRUD: title and notes, search, sort, pagination, create, edit with the version check (0122), delete and bulk delete with an audit row each (0132), thin routes, a PGlite service test and stories with their server-function mocks. `AdminSection["to"]` is now derived from the route tree (every `/admin/…` path without a param), so a new section needs no type edit.
- **Checked:** on a copy of the repo, `pnpm strip-demo` then `pnpm new:feature projects --title-ne "परियोजनाहरू"`, then typecheck, check, knip, test (564 tests), test:storybook, build-storybook and test:e2e, with no edits in between.
- **Why:** adding a feature touched about 25 files in a fixed order; most mistakes were a missing list entry (guard test, labels, e2e pages), which the gates catch only after the fact. Templates are plain files, so changing a convention is a reviewable diff of them. Marker lines are explicit and survive formatting, unlike anchoring on surrounding code.
- **Limits:** the edit page (`/admin/<name>/$id`) goes in `NOT_REVIEWED` until a seeded row exists (the review needs a real id). Without `--title-ne`, the Nepali name is the English one plus "(अनुवाद गर्नुहोस्)", which passes the parity test but is visibly untranslated. Public pages, filters beyond search, optimistic collections and attachments are left to copy from Test CRUD.
- **Alternatives considered:** a generator framework (Plop, Hygen): another dependency and template language for one command. Codemods over the TypeScript AST: robust to formatting but much more code than markers. Generating the whole Test CRUD feature: most projects would delete half of it.

## 0142: `pnpm strip-demo` removes the demo by file list, markers and unused messages

- **What:** `scripts/strip-demo.mjs` deletes the portfolio, `/stack` and their tests and guide (a file list), removes the lines between `demo:start` and `demo:end` comments and every line ending in `// @demo` (or holding `<!-- @demo -->` in Markdown) in tracked files, replaces the site description and home intro with neutral copy, drops every message no longer used in `src/` or `.storybook/` (the message-usage test's rule), removes the demo fonts (`pnpm remove`), its own `package.json` script and itself, then formats, compiles messages and builds. The home page keeps the feature-flag call to action (it links to Test CRUD) and loses the Intl card; Test CRUD and `/dev/examples` stay. `docs/guides/new-project.md` is the checklist around it.
- **Why:** a new project shouldn't start by hunting down a design system, two fonts and a dozen tests by hand. Trailing `// @demo` markers exist because Biome's import sorting moves a comment line onto the next import but keeps a trailing comment on its own line.
- **Alternatives considered:** a separate "bare" branch (drifts from `main`, and fixes need porting); keeping the demo in a package (the portfolio uses app internals throughout); deleting by regex on content (fragile across edits).

*Superseded by 0163: layers, data lists and stricter markers.*

## 0143: Routes stay thin; CLAUDE.md keeps only the pitfalls that apply everywhere

- **What:** `_authed/account.tsx` and `_admin/admin/test-crud/index.tsx` now hold only loader, search, head and a component that renders `AccountPage` (`features/auth/components/account-page.tsx`) or `TestCrudAdminList` (`features/test-crud/components/admin-list.tsx`), with what came from the URL as props. CLAUDE.md's pitfalls are split into "Always relevant" (kept) and "Per area": 23 moved to a "Pitfalls already solved" section at the end of their guide, with a one-line index per guide in CLAUDE.md. Grouping `src/lib` by area is a recipe in `conventions.md`, not done here.
- **Why:** the reference feature taught "UI in `features/<name>/components`" while its own biggest routes broke the rule. CLAUDE.md is read at the start of every session; per-area details there cost every reader for the benefit of a few. Moving `src/lib` would change ~150 imports and many doc paths for a modest gain, so it waits for a project that needs it.
- **Alternatives considered:** a component per account section in its own file (more files, no clearer); keeping all pitfalls in CLAUDE.md (it was past 150 lines and growing with every task).

## 0144: Two Part 3 bugs found by the e2e suite

- **What:** (1) `/reset-password` declared `invite: z.literal("1")`, but the router parses `invite=1` as the number 1, so invitations showed the plain reset page; it now uses `z.literal(1)` like `/account`'s `emailChanged`. (2) Starting and stopping impersonation called Better Auth inside the audit row's transaction. Better Auth writes through its own pooled connection, which waits for that transaction; the e2e harness's PGlite (one backend) then waited forever and every later test timed out. The row is now written first and deleted if the call fails (`withAuditRow` in `src/server/rbac/service.ts`), keeping 0134's guarantee; `recordAudit` returns the row ids for that.
- **Why:** both made `pnpm test:e2e` fail; (2) would also hold two connections per impersonation on Neon and could deadlock under row locks.
- **Alternatives considered:** for (2), running Better Auth's adapter on the transaction (it has no per-call connection option).

## 0145: Background jobs and cursor pagination are recipes

- **What:** `docs/guides/recipes.md` recommends Workflow DevKit for Vercel-only apps and Inngest or Trigger.dev otherwise; all three run named steps with retries, persisted between runs. `/dev/examples/background-jobs` shows that model in process (`runSteps()` in `src/server/examples/jobs.ts`: per-step retries with exponential backoff, giving up after the last one), with the rules for steps and for moving bulk email off the request. `cursorPaginate()`, `cursorOrder()`, `encodeCursor()` and `decodeCursor()` sit next to `paginate()` in `src/server/db/list.ts`, tested on PGlite with tied timestamps.
- **Why:** no job service fits every deployment, and each brings an account, a webhook route and a secret, so none is in the base. Cursor pagination is generic code, so it ships as a tested helper; admin lists keep offsets because they show totals and page numbers.
- **Alternatives considered:** a Postgres-backed queue (pg-boss): needs a long-running worker, which Vercel doesn't have. Cursor pagination by default: loses "page N of M", which admin tables use.

## 0146: Server-function rate limits are stored in Better Auth's `rate_limit` table

- **What:** `consumeRateLimit` / `enforceRateLimit` (`src/server/http/rate-limit.ts`) count fixed windows with one upsert into `rate_limit`, keys prefixed `fn:`. The contact example uses it; nothing in the base does.
- **Why:** the table already exists for Better Auth's database storage, so no migration, and all instances share it. Prefixed keys can't clash with Better Auth's (paths).
- **Alternatives considered:** a table of its own (a migration for the same three columns); Redis or Upstash (another service); in memory (per instance, so ineffective on serverless).

## 0147: Public-page caching is a header helper, not a default

- **What:** `publicCache({ sMaxAge, staleWhileRevalidate })` (`src/lib/http/cache-control.ts`) builds the Cache-Control value for a route's `headers`; `/dev/examples/caching` sets and reads it back. The guide lists which pages qualify and why.
- **Why:** every page today depends on the session or preference cookies through the root layout, and a wrongly cached page leaks one visitor's view to others. Caching has to be chosen per page, after checking the HTML is the same for everyone.
- **Alternatives considered:** caching `/portfolio` in the base (it is demo content that strip-demo removes); prerendering by default (content changes need a deploy).

## 0148: Contact form, avatar upload and list extras are examples to copy

- **What:** `/dev/examples/contact` (honeypot, Turnstile via `verifyTurnstile`, the rate limit), `/dev/examples/list-extras` (CSV export with `src/lib/csv.ts`, delete with an undo toast, saved views in `localStorage`), and the avatar steps in the guide on top of the attachments example.
- **Why:** each is a small product decision (where contact mail goes, whether undo is client-side or a soft delete, where views are stored), so the template shows a working version and the trade-offs instead of picking for every project. CSV escaping and formula-injection are easy to get wrong, so that part is a tested helper.
- **Alternatives considered:** soft delete in Test CRUD (every list and the sitemap would need the filter); saved views in a table (a migration for a feature most projects won't use).

## 0149: `pnpm dev:offline` runs on in-memory PGlite with every outside service off

- **What:** `scripts/dev-offline.ts` serves an in-memory PGlite over TCP (the e2e harness's server and seed), starts `vite dev` with it, the console email provider, and Sentry, PostHog, Cloudinary, Turnstile, Google and Resend keys set but empty.
- **Why:** each service was already optional, but the database wasn't, so a first run needed a Neon project. Reusing the harness keeps one PGlite server and one seed.
- **Alternatives considered:** mock HTTP servers for each service (more code than the "off" paths that already exist); a persistent PGlite directory (the seed isn't idempotent, and a real Neon branch suits data you keep).

## 0150: Preview branches, changelog checks, organizations and billing are documented, not wired

- **What:** `docs/recipes/preview-neon.yml` (a Neon branch per PR, migrated before a Vercel preview, deleted on close), `scripts/check-commit-msg.mjs` (Conventional Commits, tested, an opt-in `commit-msg` hook), and a guide section for Better Auth's `organization()` and `@better-auth/stripe` plugins.
- **Why:** the workflow needs project secrets, a commit convention is a team choice, and multi-tenancy changes every table, so none can be on by default. Organizations and billing stay guide-only: a working example would mean the plugins' tables, Stripe keys and per-tenant filters in every project, which is what "non-goal of the base" rules out.
- **Alternatives considered:** Changesets instead of a commit check (the guide describes both); enabling the hook (it would reject this repo's existing style of commit messages).

## 0151: Every page's JavaScript has a budget, and route options stay light

- **What:**
  - **Budget:** `scripts/check-bundle.ts` runs in CI after `pnpm build`. It sums the gzip size of the root route's preloads (the JavaScript every page loads) and fails above 240 kB, to become 200 kB when the site header leaves the root layout (Part 4, Task 35). TanStack DB has its own 105 kB line until Task 41 decides where it loads. A route may add at most 250 kB. A font that a `fonts.ts` module preloads must be 150 kB or less; the old portfolio's 709 kB Devanagari face is exempt until Task 40 replaces it, and an exemption that no longer matches a preloaded font fails the check.
  - **Code splitting:** `tanstackStart({ router: { codeSplittingOptions } })` splits `pendingComponent` too. The router plugin's default (component, errorComponent, notFoundComponent) kept Test CRUD's skeleton, and everything it imports (forms, Tiptap, libphonenumber), in the entry chunk. Route options must stay inline object properties: the splitter skips spreads and helper return values.
  - **Light route options:** `validateSearch`, `params`, `loader` and `head` stay in the entry chunk, so route files import a feature's URL contract from `search.ts`, never `schema.ts` (form schemas pull in rich-text and phone validation). `phone()` moved to `src/lib/phone.ts`, so only schemas with a phone field load libphonenumber.
  - **Results (gzip, every page):** 399.4 kB before. Splitting `pendingComponent` → 338.3. Sentry off the critical path (0152) → 286.3. Phone and search split → 258.7. Toaster and auth client on demand → 244.6. Impersonation banner's toast on demand → 235.5 (−41%). TanStack DB adds 100.6 kB on top.
- **Why:** the 300-plus kB were the same for a visitor reading one portfolio page and for an admin, and nothing stopped them growing back. A number in CI does.
- **Alternatives considered:** Rolldown's `treeshake.manualPureFunctions` for Zod calls (it covers direct calls only, not chains like `z.string().trim()` or the app's helpers); a 200 kB budget now (the site header's Radix menus stay in the root until Task 35).

## 0152: Browser Sentry loads after the entry chunk

- **What:** `src/lib/observability/sentry-client.ts` imports and initialises the browser SDK when `src/client.tsx` starts, in parallel with hydration; errors thrown before it's ready are buffered by two listeners and sent once it is. `captureException`, `setSentryUser` and `traceNavigation` (used by the error page, ObservabilitySync and the router) queue on it. Code that also runs in the browser never imports `@sentry/tanstackstart-react` statically: `src/middleware/sentry.ts` re-implements Sentry's global request middleware (a try/catch around `next()`) with the SDK imported inside `.server()`, and `normalizeServerError` imports it when it captures. Development sends no traces unless `VITE_SENTRY_DEV_TRACING=true`; production still samples 10%. Supersedes the loading part of 0073.
- **Why:** the SDK was about 45 kB gzip of every page's entry chunk, and one static import anywhere in the client graph (start.ts, through the request middleware's browser stub) was enough to keep all of it, because a module that is both imported and dynamically imported isn't split. Tracing every dev request and navigation slowed `pnpm dev` noticeably with a DSN in `.env`.
- **Alternatives considered:** Sentry's loader script (a third-party script the CSP would have to allow); `lazyLoadIntegration` (the core SDK stays in the entry); dropping capture of errors before load (hydration errors are the ones most worth seeing).

## 0153: The session is resolved once per request

- **What:** the request-id store (0123) is now a request scope: `src/server/http/request-scope.ts` holds the id and a memo, and `requestMemo(key, compute)` shares one promise per request. `getServerSession` uses it, so the root `beforeLoad`, the admin gate and every server function called while rendering a page share one Better Auth lookup and one permissions query. Failures aren't kept; `forgetSession()` clears it after stopping an impersonation. Outside a request (scripts, Nitro routes, tests) it computes every time. The session stays in the root `beforeLoad` (0043, 0090) and the cookie cache stays off (0040).
- **Why:** an admin page looked the session up three times per request (root, `ensureAdminAccess`, each loader's `requirePermission`), each a database round trip, which is about 300 ms each from Kathmandu to Neon's us-east-2.
- **Alternatives considered:** Better Auth's cookie cache (rejected in 0040: revoked sessions and permission changes would lag); passing the session down through context (server functions are separate entry points and must check for themselves).

## 0154: Feature flags never wait more than 300 ms

- **What:** with `POSTHOG_SECRET_KEY` (a Project Secret or Personal API key), posthog-node polls flag definitions every 30 s and evaluates flags in memory. Without it, a flag request times out after 300 ms (was 1.5 s) and answers are cached per flag and visitor for 30 s, at most 1,000 entries. Off on any failure, as before. Extends 0075.
- **Why:** `/` waited up to 1.5 s on PostHog for every server render, for a flag that rarely changes.
- **Alternatives considered:** evaluating flags in the browser after hydration (the UI would flicker, which 0075 avoids); no flags on SSR pages.

## 0155: Dev speed: one message module per locale, Babel only on our code, a local database

- **What:**
  - **Paraglide:** `paraglide.config.ts` uses `outputStructure: "locale-modules"`, so the CLI, Vitest and `pnpm dev` produce the same files (the CLI needs the flag too: 0198). Only production builds override it to `message-modules` (in `vite.config.ts`), which tree-shakes messages per page. Supersedes 0020's "the same options everywhere".
  - **React Compiler:** Babel runs on `src/**` only, excluding `src/paraglide` (the plugin's default ran it on all 1,064 compiled message modules).
  - **Vite:** `server.warmup` transforms the client entry, the layouts and the server entry at startup.
  - **Database:** `pnpm dev:local` serves PGlite stored in `.data/pglite` (gitignored) over TCP; every start applies new migrations and the first one seeds an admin and the demo data. The dev pool keeps idle connections for 5 minutes (production: 10 s).
  - **Fonts:** each section's layout preloads its own fonts; the root no longer preloads Inter on portfolio pages.
  - **Measured on this machine (Windows, Kathmandu):** Neon answers in about 300 ms per query (`pnpm diagnose`), so every page waited for several of those; on `dev:local`, Vite is ready in 3–5 s, a new page renders in 0.3–0.4 s and a repeat in about 50 ms. The first page after a cold start takes 5–12 s (server-side transforms, noisy on Windows).
- **Why:** dev was slow for three stacked reasons: a thousand message modules (each a request and a Babel pass), a remote database far away, and Sentry tracing (0152).
- **Alternatives considered:** keeping `message-modules` in dev with only the Babel filter (still a thousand requests per first page; Paraglide's docs recommend `locale-modules` for dev); a Docker Postgres for `dev:local` (another tool to install; PGlite is already a dependency). 0149 rejected a persistent PGlite because the seed isn't idempotent; `dev:local` seeds only a new directory.

## 0156: `pnpm setup:local` and `pnpm diagnose`

- **What:** `pnpm setup:local` takes a fresh clone to a runnable app: it checks Node, creates `.env` from `.env.example` if missing and fills an empty `BETTER_AUTH_SECRET`, compiles the messages and creates the local database. `pnpm diagnose` checks Node and pnpm against the pins, `.env` against both env schemas, which optional services are on, database reachability and per-query latency, pending migrations, compiled messages, and ports 3000 and 3100 (a running e2e server is reused as is), and prints the fix for each problem. Both are TypeScript run by Node directly.
- **Why:** a first run needed a Neon project and reading three guides; most "it doesn't start" problems are one of the things `diagnose` checks.
- **Alternatives considered:** the names `pnpm setup` and `pnpm doctor` (both are pnpm's own commands, so the scripts would never run); a postinstall hook (installs run in CI and on Vercel too).

## 0157: inlang CLI for machine translation and checks; plugins load from node_modules

- **What:** `project.inlang/settings.json` loads the message-format and m-function-matcher plugins from pinned devDependencies (`./node_modules/...`) instead of an unpinned jsdelivr URL. `pnpm i18n:translate` runs `inlang machine translate` from English into Nepali and fills only messages that have no Nepali yet (existing translations are skipped). `pnpm i18n:check` runs `inlang check` (missing or empty translations, variables, markup, plural forms) and runs in CI; the message-usage test still covers unused keys, because inlang can't follow re-exports.
- **Why:** every compile (dev start, typecheck, CI) fetched the plugins first and needed the network, from an unpinned major version. Machine translation was the Paraglide feature the project didn't use, and adding a message meant typing Nepali by hand.
- **Caveat recorded:** without a key the CLI uses a community-run service (translate.demosjarco.dev). A test produced fluent but wrong Nepali (it added sentences that weren't in the English). Set `INLANG_GOOGLE_TRANSLATE_API_KEY` for quality, and always review the diff; DeepL has no Nepali.
- **Alternatives considered:** a script calling an LLM or Google directly (more code for what the CLI does); committing the CDN cache (the cache is keyed by URL and still needs the first fetch).

## 0158: `src/lib` is grouped by area, and Biome enforces the import boundaries

- **What:**
  - **Layout:** `lib/list/` (`params.ts` URL param schemas, `paging.ts` `Paged` and page maths, `url.ts` search serialization; was `list.ts` + `search.ts`, split by what each export is rather than at random), `lib/env/`, `lib/i18n/` (intl, Nepali digits, calendar days), `lib/http/` (CSP, cache-control, redirects), `lib/observability/`, `lib/start/` (modules that need the Start runtime: `http-status`, `read-preferences`), `lib/tanstack-db.ts` (was `db.ts`, easily confused with the database). Hooks moved to `src/hooks/` (where `components.json` expects them); the server-function validator to `src/functions/_lib/validator.ts`; the locale function middleware to `src/middleware/locale.ts`; `zodFieldErrors` to `lib/errors.ts`.
  - **Biome:** `noRestrictedImports` refuses `zod/v4` and `zod/mini` everywhere but the alias target, and in `src/components/**`, `src/features/**/components/**` and `src/hooks/**` refuses `@/server/**` and `@/lib/start/**`. The React, test and Playwright rule domains are on.
  - **Scripts:** the seed, coverage and commit-check scripts are TypeScript, type-checked with the app and run by Node directly; `engines` is `>=22.18` (type stripping), which the `.ts` scripts already needed.
- **Why:** a flat folder of 40 files with names like `db.ts` and `cache.ts` didn't say what was safe to import where; the rules that did (CLAUDE.md pitfalls, tests scanning imports) caught mistakes late.
- **Alternatives considered:** Biome's `useSortedClasses` (a nursery rule, and it doesn't know the Tailwind 4 custom utilities); converting `new-feature` and `strip-demo` now (both are rewritten in Part 4, Tasks 35 and 38); converting `install-hooks` (it runs during `pnpm install`, on whatever Node is installed).

## 0159: Tests start from one migrated PGlite database per run

- **What:** the unit project's global setup (`tests/setup/pglite.ts`) migrates one PGlite database and dumps its data directory to `node_modules/.cache/vitest-pglite/`, keyed by a hash of `drizzle/`. `createTestDb()` loads it (`loadDataDir`) instead of running initdb and the migrations, takes an optional `seed` for a file's own fixtures, and `reset()` truncates every table and adds the admin and the seed back. Testing Library loads only under jsdom. Both Storybook passes run in one `vitest run`. The e2e harness deletes saved sign-ins (`e2e/.auth`) when it starts a new database.
- **Why:** starting PGlite costs about 1.5 s (initdb) against 0.4 s to load a snapshot, and `reset()` only cleared two tables, so tests could depend on each other's users and roles. Measured: `pnpm test` 43–50 s → 29 s; `pnpm test:storybook` two sequential runs → one 69 s run.
- **Alternatives considered:** PGlite `clone()` (needs a live instance in the same worker; files run isolated); one shared database for all files (tests would interfere).

## 0160: Postgres image storage from Part 1 is dropped

- **What:** migration `0009_drop_legacy_test_crud_image` drops `test_crud.image` and the `test_crud_image` table, and `pnpm attachments:import-legacy` is removed. The migration is hand-ordered (foreign key, column, table): drizzle-kit generated `DROP TABLE … CASCADE` first, which removes the foreign key, so its own next statement would have failed.
- **Why:** nothing in the app has read them since attachments moved to Cloudinary (0098), and every new project inherited a `bytea` table it would never use.
- **Before migrating a database that may still hold Part 1 images:** run `attachments:import-legacy` from the commit before this one first.
- **Alternatives considered:** keeping them until each project drops them (every project would have to know to).

## 0161: The portfolio is the site at `/`; each layout renders its own header; sections can skip the session

- **What:**
  - **Routes:** the portfolio moved from `/portfolio` to a pathless `_site` layout (`/`, `/work`, `/about`, `/journal`, `/contact`). The old demo home, `/stack`, the public Test CRUD pages, `/dev/forms` and `/dev/examples` moved under `src/routes/dev/` (0162). `_public` keeps health, verify-email and reset-password, and is where new public pages go.
  - **Headers:** the root renders no header, only the skip link, the impersonation banner, the consent banner and toasts. `SiteHeader` takes `links`. `_public`, `_auth`, `_authed` and `_admin` render it with none (the brand to `/`, Admin when permitted, account or sign-in, language, theme); `dev` passes the demo's four links and adds `SiteFooter`; the portfolio renders its own. `src/lib/chrome.ts` (`chrome: "bare"`) is gone. Supersedes 0105.
  - **One skip link:** the root's `SkipLink` is the only one. The portfolio's `<main>` spreads `MAIN_CONTENT` instead of having its own link to `#pf-main`.
  - **Session opt-out:** `staticData: { session: "skip" }` (`src/lib/session-scope.ts`). The root `beforeLoad` returns `{ session: null }` without a lookup when any match sets it (router-core 1.171 passes `matches` to `beforeLoad`). `ImpersonationBanner` and `ObservabilitySync` read the session with `enabled: !useSessionSkipped()`; otherwise the browser would fetch it after hydration. Only `_site` sets it; navigating to any other section runs the root `beforeLoad` again and looks it up.
  - **Impersonation (0134):** the portfolio shows no impersonation banner (it never knows the session), so "View as this user" now lands on `/account` instead of `/`. Every other section still shows the banner.
  - **Types:** reading `matches` in the root `beforeLoad` made the route tree's types circular (`match.routeId` became `unknown` in `session-expiry.ts`). An explicit return type, `Promise<{ session: Session | null }>`, breaks the cycle.
  - **JSON-LD:** the portfolio home emits `WebSite` (its publisher is the owner's `Person`, whose `@id` is now `/#person`) with the `Person`. The old home's `Organization` and Test CRUD's `Product` (0102) went private with their pages, so `organizationJsonLd` and `productJsonLd` were removed; `websiteJsonLd` takes an optional publisher.
- **Why:**
  - It is the finished product's URL layout: the owner's portfolio is the site, and the demo is a developer reference.
  - Once most sections have their own frame (Task 36 turns these headers into shells), a header per layout is simpler than a global header with opt-outs.
  - The portfolio reads no user state. A session lookup on each of its pages was a database round trip (about 300 ms against Neon from Kathmandu, section 10.4) for nothing, and fetching it in the browser instead would only move the cost.
- **0046 restated:** `verify-email` and `reset-password` stay under `_public`, not `_auth`: `_auth` sends signed-in users away, and `autoSignInAfterVerification` arrives signed in.
- **Alternatives considered:** keeping 0105's opt-out with the portfolio at `/` (every new section would have to opt out); a path check for the session (breaks with the `/ne` prefix and spreads section knowledge into the root; `matches` exists, so it isn't needed); fetching the session lazily in the browser on the portfolio (moves the cost, doesn't remove it).

## 0162: `/dev` pages exist in dev and in e2e builds (`DEV_ROUTES`); a production deploy refuses the flag

- **What:**
  - **The flag:** `src/lib/dev-routes.ts` exports `DEV_ROUTES = import.meta.env.DEV || import.meta.env.VITE_DEV_ROUTES === "true"`. It reads `import.meta.env` directly, so Vite inlines both values and a plain build folds it to `false` (checked: the `/dev` layout's `beforeLoad` compiles to an unconditional `throw notFound()`).
  - **Every dev check uses it:** the `/dev` layout, `devOnlyMiddleware` and `assertDev`, `/dev/forms`'s component, and `functions/dev.ts` (which now uses the middleware instead of its own check). Supersedes the `import.meta.env.DEV` guard of 0061 and 0103.
  - **Env and guards:** `VITE_DEV_ROUTES` (`"true" | "false"`, optional) is in the client env schema. `vite.config.ts` throws at build, and `src/server/plugins/validate-env.ts` at boot, when it is `"true"` and `VERCEL_ENV` is `"production"` (Nitro inlines the flag in the plugin too).
  - **Reviewed:** the e2e harness builds with it, so the browser review covers every `/dev` page (`/dev/forms`, `/dev/examples` and its 21 pages are new to it, 12 combinations each). CI's e2e job runs on 5 shards instead of 3.
  - **Public Test CRUD is a dev reference:** `/dev/test-crud` and its detail pages use `privateHead()`, and `test-crud-public.ts` and `stack.ts` run `devOnlyMiddleware`. The old home (`/dev`) and `/dev/stack` are private too.
  - **Sitemap (updates 0101):** only the home page and the portfolio's pages. The `/stack` and `/test-crud` entries and their published-items query are gone. `robots.txt` is unchanged, since `/dev` is a 404 in production.
  - **`listSeo()`** has no caller now. It stays as the list-page recipe's head, tagged `@public` so knip keeps it.
- **Why:** the dev pages are references that should be checked like any other page, but must never ship. A build flag lets the review use a real production build. The double guard (build and boot) makes a mis-set flag on Vercel fail loudly instead of publishing them.
- **Alternatives considered:**
  - Reviewing `/dev` against `vite dev`: not a production build (different chunks, no font preloads, layout-shift numbers meaningless).
  - `clientEnv.VITE_DEV_ROUTES`: not folded, so dev-only code would stay in every bundle.
  - A runtime server variable: the client code would still ship.

## 0163: `pnpm strip-demo` removes layers (portfolio, apps) by data lists and markers; the core stays

- **What:**
  - **Script:** `scripts/strip-demo.ts` replaces `strip-demo.mjs`, with flags `--keep-portfolio`, `--keep-apps` and `--no-build`. The layers are `portfolio` and `apps` (empty until Task 41). Each layer's files, package scripts, `vercel.json` crons, `knip.json` entries and schema files are lists at the top of the script, so later tasks append to them.
  - **Core, never removed:** auth, admin, RBAC, audit, attachments, i18n, SEO, Test CRUD and all of `/dev`. `/dev/stack` and the Intl showcase now stay (dev-only references), so their old `demo` markers are gone.
  - **Markers** (`scripts/lib/strip-markers.ts`):
    - Blocks: `<layer>:start` / `<layer>:end` comment lines (`//`, `/*`, `{/*`, `<!--`, `#`).
    - Lines: a line ending in `// @<layer>`, or holding an HTML comment `@<layer>` outside backticks.
    - Never touched: mentions in prose, and the records (PLAN.md, decisions.md, docs/history). 0142 matched `demo:start` anywhere, so it would have cut lines from those.
    - `tests/unit/strip-markers.test.ts` checks every tracked text file for balanced blocks and for leftover `demo` markers.
  - **When the portfolio goes**, the script writes:
    - a neutral landing page, `src/routes/_public/index.tsx`, from `scripts/templates/landing/index.tsx.tpl` (`seo()` with `WebSite` JSON-LD);
    - its `landing_*` messages, which the script holds: unused keys would fail the message-usage test while the portfolio exists;
    - the route test's indexable home entry, at a `// @strip-demo:indexable` line;
    - a neutral `site_description` and `home_intro`.
  - **Then:** it drops messages nothing uses, runs `knip --fix --fix-type dependencies` and `pnpm install` (removing the portfolio's three fonts), formats, compiles the messages, runs `drizzle-kit generate --name strip_<layers>` when a layer had tables, and builds.
  - **Once no layer is left,** it deletes itself, its marker library, its landing template, its test, and CI's template job (a `# strip-demo:start` block). With a layer kept, it stays, so the rest can go later.
  - **CI:** the template job is a matrix: all layers stripped, `--keep-apps`, and `--keep-portfolio`. Each runs `new:feature`, typecheck, check, knip, test and the migration check.
- **Found while running that matrix locally (fixed here):**
  - The scaffolder's templates still imported the `src/lib` paths from before 0158, so `pnpm new:feature` failed to build.
  - knip's vite plugin loads `vite.config.ts` in serve mode, which validates the server env, so `pnpm knip` exited 2 without a `.env` (as in CI). knip now has `"vite": false`, with `vite.config.ts` as a plain entry.
  - `tests/setup/env.ts` only defaulted its values, so CI's `VITE_APP_TITLE` changed what the tests expected. It now sets them.
- **Why:** later tasks add the database-driven portfolio and six apps, which a new project may or may not want, so one all-or-nothing demo no longer fits.
- **Alternatives considered:** one script per layer (the shared steps would be duplicated); an AST-based remover (markers are simpler, and they work in CSS, Markdown and YAML); deleting by directory only (shared files like the sitemap and the route test need edits). Supersedes 0142.

## 0164: "Graphite": layered oklch tokens, accent, radius and density presets on `<html>`, contrast tested

- **What:**
  - **Tokens** (`src/styles/app.css`): cool graphite neutrals (hue 265) with three layers (`--background`, `--surface-1` for the sidebar and muted panels, `--surface-2` for cards and popovers); a near-black dark mode (`oklch(0.165 0.005 265)`); hairline borders; an elevation scale (`--elevation-*`, mapped to `shadow-*`, darker with a faint top highlight in dark mode); status tokens `success`, `warning`, `info` and `danger` (= `destructive`), each with `-foreground` (text on the fill) and `-subtle` (a tint); a type scale (`text-display`, `text-title`, `text-heading`, `text-body`, `text-caption`, registered in the app's `cn`); Inter's `cv11` and `ss01`; tabular figures in tables and `[data-figures]`.
  - **Presets**, each an attribute on `<html>` rendered by the server from a cookie (`preferenceHtmlProps`), so nothing flashes: `data-accent` (indigo, violet, emerald, amber, rose: `--primary`, `--primary-foreground`, `--accent-subtle`, `--chart-2…5` per theme), `data-radius` (sharp 4 px, default 8 px, round 14 px; `rounded-sm…xl` scale from `--radius` by multiplication, so the sharp preset never goes negative) and `data-density` (`--control-height` 36/32 px and `--row-padding`, used by Button, Input, InputGroup, Select, NativeSelect, the filter bar and table cells). `Preferences` gained `accent`, `radius` and `density`, with cookies, parsing and store actions; the appearance page (`/admin/settings/appearance`) sets them.
  - **Dark accents are light, with dark text on them** (as shadcn's dark primary): an indigo fill with white text would leave `text-primary` under 4.5:1 on the dark background.
  - **Accent selectors match any element** (`[data-accent="rose"]`, `.dark[data-accent="rose"], .dark [data-accent="rose"]`), so a swatch can show another accent; indigo repeats the `:root` defaults for that.
  - **`tests/unit/design-tokens.test.ts`** parses `app.css`, applies its rules as `<html>` would match them per accent × theme, resolves `var()`, converts oklch to sRGB (clipped) and checks 4.5:1 for every text pair. The browser review only sees the default preset.
  - **Shells** (`components/admin-shell`, `auth-shell`, `app-header`, `brand`): the admin frame on shadcn's `Sidebar` (icon collapse, a sheet on phones chosen by CSS rather than an `isMobile` state, which broke hydration of 403 pages on phones; the `sidebar` preference cookie instead of shadcn's own; a sticky container instead of a fixed one so the impersonation banner pushes it down; a `<div>` inset because pages own `<main>`), a split-screen sign-in frame with server-rendered contour art, and a compact header for the account page. Breadcrumbs moved out of `PageHeader`: the admin topbar shows them, other pages render `<Breadcrumbs />` above the header.
- **Checked:** Tailwind 4's `--text-<name>--line-height`, `--letter-spacing` and `--font-weight` sub-properties compile into the `text-<name>` utility (built CSS). shadcn's CLI (`shadcn@latest add`) still writes `from "cn"` and adds the unrelated `cn` package (reverted, 0118); every overwrite prompt was answered "no". Its sidebar writes a `sidebar_state` cookie, renders `<main>` and hard-codes English screen-reader text; its `BreadcrumbPage` is `role="link" aria-disabled`. All changed in our copies (design-system.md, pitfalls).
- **Why:** the owner chose a Linear-style admin with switchable presets (PLAN 10.2). Attributes on `<html>` keep the presets in CSS (no JavaScript per component, no runtime theme object) and SSR-safe; the test makes ten combinations as safe as the one the browser review sees.
- **Alternatives considered:** CSS variables set inline from JavaScript (flashes before hydration); generating the accent ramps at runtime with relative `oklch(from …)` colours (contrast can't be tested statically); one fixed accent (the owner asked for presets).
- **Entry JS:** +1.4 kB gzip (234.8 → 236.2): the root needs the preset state and `useAppearance` to render `<html>`'s attributes, plus the new route's options. The shell itself is in the `_admin` route chunk (35 kB).

## 0165: The command palette is part of the admin shell

- **What:** `components/admin-shell/command-menu.tsx` (cmdk) opens with Ctrl/⌘ K anywhere in the admin area, or with the topbar's search button. Groups: recent pages (the last five admin pages opened, in `localStorage`, every access in try/catch), every section the user may open (`permittedSections`, matching labels and each section's localized `keywords`), feature actions (`AdminCommand`s from `features/<name>/commands.ts`, collected in `ADMIN_COMMANDS`; Test CRUD's "New Test CRUD item"), theme, language (a full load, like the switcher) and sign out. It navigates with `viewTransition: true`. The `/dev/examples/command-palette` recipe and its messages are gone.
- **Why:** the owner chose a keyboard-first admin (PLAN 10.2); a palette that only exists as a recipe isn't keyboard-first. Actions registered per feature keep the palette free of feature imports beyond one list.
- **Known quirk:** after typing, cmdk's `aria-activedescendant` can briefly name an item the filter just removed, which axe flags while the dialog is open. The e2e review never opens it; the story closes it before its a11y check.
- **Alternatives considered:** keeping the recipe (0140); a palette that searches records too (needs a search endpoint per feature; later, when a feature wants it). Supersedes 0140.

## 0166: The admin dashboard reads one server function, filtered by permission

- **What:** `getDashboard` (`src/functions/admin.ts`, `requireAdminAccessMiddleware`, listed in the guarded-functions test with its reason) calls `src/server/admin/dashboard.ts`, which runs these reads in parallel, each only when the actor holds that section's read permission: Test CRUD totals by status plus items created in the last 7 days (one scan with `count(*) filter (where …)`), users (total, banned, new in 7 days), the role count, and the last 10 audit events (the audit list query). Parts the user may not read are `null`, so the browser never gets numbers it couldn't open. It also returns `generatedAt`, the "now" for relative times, so the server and the browser render the same words. The page (`features/admin/components/dashboard.tsx`) shows `StatCard`s, the activity list and quick actions (the `ADMIN_COMMANDS` the user may run, plus Appearance).
- **Why:** one round trip for the whole page (the database is about 300 ms away from the owner), and the permission rule lives on the server like every other read.
- **Alternatives considered:** one query per card through each section's list function (four round trips, and list functions return pages, not totals); counting on the client from cached lists (wrong once a list is filtered or paged).

## 0168: The admin component kit: heavy fields aren't registered, dialogs load on click, confirms are a promise

- **What:** Task 37's kit in `src/components`: page layouts (`PageTabs`, `DetailLayout`, `SettingsLayout`, `FormSection`, `FormCard`, `StickyFormBar`, `EmptyState` v2), data display (`DescriptionList`, `StatusOf` with `defineStatuses`, `UserCell`, `RelativeTime`, `CopyButton`, `Timeline`/`ActivityFeed`, `StatCard` with a sparkline), charts (0171), dialogs, DataTable v2 (0169), composite fields, hooks (`useHotkeys`, `useDebouncedValue`, `useMediaQuery`) and 13 shadcn primitives. Three rules shape it:
  - **Composite fields aren't registered on `useAppForm`.** `createFormHook`'s `fieldComponents` are imported by every page with a form, the login page included. The new fields (sortable lists, blocks, relations, slug, localized, the image gallery) bring dnd-kit, Query searches or Tiptap, so they are imported where they're used and rendered inside `form.AppField`; they read the field from context like the registered ones. `LocalizedField` is a `withFieldGroup` group (exported from `components/forms`).
  - **Dialogs that open on click are lazy.** The users and roles pages imported their form dialogs at module level, so every field on `useAppForm` came with the page (Task 34 measured 90–104 kB). They now `React.lazy` the dialogs: users 100.3 → 50.5 kB, roles 86.9 → 37.7 kB gzip on top of the root. The RBAC dialogs are `FormDialog`s.
  - **Confirms are `await confirm({ … })`.** `ConfirmProvider` is mounted once per shell (`AdminShell`, the `/dev` layout, Storybook's providers) and `useConfirm()` returns a promise of `true`/`false`. The per-page confirm state (`DeleteRequest`, `Confirming`, `Dialog`) and `ConfirmDialog` are gone; asking again while one is open answers the first with `false`.
- **Also:** `RelativeTime` renders from a `now` the server also used (`useSyncExternalStore` with that as the server snapshot), then one shared minute clock. `slugify` and `SLUG_PATTERN` moved to `src/lib/slug.ts` (Task 38 replaces the portfolio and RBAC copies). `/dev/examples` gained `components` and `fields`; its frame uses `FormCard` and `DescriptionList` (`Facts` is gone), list-extras uses the table's own CSV and views.
- **Why:** the plan's goal (features supply data, columns, fields and actions), without making every page pay for every component.
- **Trade-offs:** two ways to render a field (`field.TextField` vs `<SlugField />` inside `AppField`); the forms guide says which is which. Entry JS grew 1.7 kB gzip (236.3 → 238.0): two new routes in the route tree and longer preload lists of shared chunks, not kit code.
- **Alternatives considered:** registering everything (simplest call sites, heaviest pages); a second form hook for heavy fields (two `useAppForm`s to choose from); keeping `ConfirmDialog` controlled (every page re-implements the pending-request state).

## 0169: DataTable v2 runs on TanStack Table v9, in manual mode

- **What:** `DataTable` (same props: `DataTableColumn<Row>`, `tableId`, `rows`, `sort`, `bulkActions`) is built on `@tanstack/react-table` 9.3 (`useTable`, `tableFeatures`): column visibility (controlled from the preferences cookie), row selection (this page's rows only), column pinning (the first column and the checkboxes stay put on phones, by CSS `sticky`) and sorting state in manual mode (it only drives `aria-sort`; the header is still a `SearchLink`). New: `toolbar`/`activeFilters` slots and a button group with saved views (`savedViews`, localStorage per table), CSV (`exportName`, columns with `csv`) and the Columns menu (`DataTableColumnsMenu` merged in); `rowActions` returns `RowAction` data (`permission`, `destructive`, `separated`, `hidden`, `onSelect` or `render`), shown in the "…" menu and a non-modal right-click menu, the column omitted when no row has one; past 15 rows the table scrolls in a focusable frame under a sticky header (a bare `<table>`: `ui/table`'s own scroll wrapper would capture the sticky header).
- **Why v9:** it is the current major (9.3.1), its state is TanStack Store 0.11, the version the app already uses, and it works under the React Compiler (v8's `useReactTable` needed `"use no memo"`). Manual mode keeps the URL contract (0116) and server rendering: the table never sorts or pages in the browser.
- **Deviation from the plan:** pagination isn't registered with the table (`rowPaginationFeature`): rows are one server page and `Pagination` renders URL links, so the feature would hold state nothing reads.
- **Alternatives considered:** v8 (an older major and Compiler workarounds); keeping the hand-written table (selection, pinning and visibility logic duplicated, and no path to resizing or expansion: those are now a recipe, recipes.md).

## 0170: Sortable lists use `@dnd-kit/react`, pinned exactly, plus Alt + arrows

- **What:** `SortableList` (`components/forms/fields/sortable-list.tsx`) on `@dnd-kit/react` 0.5.1 and `@dnd-kit/dom` 0.5.1 (exact versions: pre-1.0, minors break, per 0119). Pointer and keyboard dragging come from its default sensors; the `Accessibility` plugin's announcements and instructions are Paraglide messages. Each handle also takes Alt + ↑/↓ to move one place, announced in a live region. `SortableListField`, `BlocksField`, `KeyValueField` and `ImageGalleryField` (which replaced the attachments field's native drag and drop and move buttons) use it.
- **Why:** `@dnd-kit/core` 6.3 and `@dnd-kit/sortable` 10 haven't had a release since December 2024; `@dnd-kit/react` is where development happens (0.5.1, October 2026), supports React 19, and its multi-list sortable is what the Kanban app (Task 41) needs. Alt + arrows is a one-key-press path that needs no drag mode, and it is deterministic in jsdom (the image gallery and list tests use it; Storybook covers the real browser).
- **Alternatives considered:** `@dnd-kit/core` + `sortable` (stable API, but unmaintained); move up/down buttons per item (two more buttons per row; the gallery had them); native HTML drag and drop (no keyboard, no touch).

## 0171: Charts: Recharts 3 loaded on demand into a fixed-size frame, with a data table for screen readers

- **What:** `components/charts`: `AreaChart`, `BarChart`, `DonutChart` render a `ChartFrame` (a fixed aspect ratio) that shows a skeleton on the server and until `React.lazy` has loaded the Recharts chunk (`ClientOnly` + `Suspense`), then the chart in the same box. The drawing is `aria-hidden` (`accessibilityLayer={false}`, the pie's `rootTabIndex={-1}`); a visually hidden `<table>` with the same numbers, captioned by `label`, is server-rendered. Values print with `formatNumber` (Devanagari digits in Nepali). `ui/chart.tsx` is shadcn's v3 chart without its injected `<style>` (colours are inline `--color-<key>` variables, `var(--chart-n)` by default) and with locale-aware numbers. `Sparkline` is plain SVG.
- **Why:** Recharts is about 150 kB gzip; no page should load it before it shows a chart, and a chart that sizes itself would shift the page (the review's CLS limit is 0.01). A table is the accessible form of a chart's numbers. A sparkline doesn't need a chart library.
- **Deviation from the plan:** `Sparkline` isn't a lazy Recharts wrapper (the plan listed it with the others): it renders on the server at its final size for nothing.
- **Trade-offs:** charts appear after hydration and a chunk load. Storybook's chart story preloads the chunk in a loader (under a full parallel run the first import outlasted the play function) and checks the mounted container, not Recharts' SVG (it needs a measured size, which a background test iframe may not have).

## 0172: Slugs are linked to their source, checked as you type, and a submit waits for async validation

- **What:** `SlugField` follows its source field (`from`, a dotted path) while linked: new records start linked, typing in the slug unlinks it, the link button re-links it. `slugValidators({ from, isAvailable })` puts a debounced async check on the AppField (`onChangeAsync`, re-run when the source changes through `onChangeListenTo`); Test CRUD's form uses it with a new `isTestCrudSlugFree` server function (`test-crud:read`, in the guard test; `isSlugFree` in the repository, tested on PGlite). The save still maps the unique violation to a field error. The shared `Form` now waits for validation to settle before calling `handleSubmit`.
- **Why the wait:** TanStack Form's `handleSubmit` returns without submitting on a first attempt while `canSubmit` is false, and `canSubmit` is false while any field validates (`isFieldsValidating` is true already during the debounce). A user who typed a title and pressed Create within the slug check's 400 ms got nothing: Storybook's Test CRUD story caught it under load, a jsdom test now covers it.
- **Alternatives considered:** checking on blur (the slug is usually never focused, as it follows the title); disabling Save while validating (the submit button stays enabled on purpose, so pressing it reveals every error; `SubmitButton`); `canSubmitWhenInvalid` (would submit invalid forms too).

## 0173: The CRUD standard: one shape, shared helpers on both sides, every section on it

- **What:** one way to build a feature, written once in `docs/guides/crud.md` and used by Test CRUD, users, roles, the permission matrix and the audit log (Task 38).
  - **Shape:** `features/<name>/` holds `search.ts` (URL contract), `schema.ts` (strict inputs, DTO schemas), `keys.ts`, `queries.ts` (queryOptions and mutationOptions), `columns.tsx`, `filters.tsx`, `labels.ts`, `commands.ts` and `components/` (list, form, detail, pending). Functions are `createServerFn → requirePermission, withServices → validator → one service call`; `server/<name>/` has the repository and the service. Routes are literal `createFileRoute` objects whose components come from the feature and read the URL with `getRouteApi`.
  - **Client helpers** (`src/lib/crud/`, `src/components/crud/`): `createCrudKeys`, `listSchema` (search, strict input, defaults, filter keys), `idSchema`, `isoDateTime()` (a `z.codec`: a row's Date to the wire's ISO string), `listSearch`, `listLoader`, `loadDetailOr404`, `titleHead`, `defineFilters` with chip specs (`textChip`, `choiceChip`, `eachChip`, `rangeChip`, `flagChip`), `CrudListPage`/`CrudListPending`, `useCrudMutation`, `useCrudForm` + `CrudForm` + `crudFormKey`, `NewButton`, `RecordLink`; also `QueryDialog` (a dialog that loads its record) and `availabilityValidators` (a debounced "is it free?" check).
  - **Server helpers** (`src/server/db/crud.ts`): `listPage`, `findOrThrow`/`notFound`, `updateVersioned` (the version in the UPDATE's WHERE, no separate lock), `uniqueViolation` (insert, then map the constraint to a field error), `isValueFree`, `uniqueSlug`, `withAudit` (the transaction and the audit rows the change reports). `withServices` (`src/middleware/services.ts`, server modules imported inside `.server()`) adds `context.db`, `context.actor` and `context.imageStore`; services take them as their first argument (`Services`, `src/server/services.ts`), so tests pass their own.
  - **RBAC:** one isomorphic `Actor` (`features/rbac/types.ts`) replaces the four copies; `canGrant` is the self-escalation rule on both sides; `useCan`/`<Can>` are the only UI checks; the matrix groups resources under the sidebar's groups; functions are named `listX`/`getX`/`createX`/`updateX`/`deleteX`/`setXStatus` with explicit return types.
  - **Behaviour that changed:** creates and edits of Test CRUD items are audited (supersedes 0132's scope: every change of admin data and content is), recording only the fields that changed (`changes()`); role names are unique by a case-insensitive index (`role_name_lower_unique`, migration `0010`) and emails by Better Auth's constraint, both mapped to field errors instead of checked first; a user's roles are saved against their version (`updatedAt`), so the roles dialog has a stale check and "Reload"; the invite form checks the address as you type; the delete confirm and the save, delete and failure toasts use shared messages (`crud_*`, `common_toast_failed`); the router has `defaultStructuralSharing`; the sidebar's sections are `linkOptions`.
  - **Removed duplicates:** the four `Actor` types, four `notFound`s, the role-key and portfolio slug copies (now `slugify(name, 40)` + `uniqueSlug`, `SLUG_PATTERN`), the two `day()` chip formatters (`dayValue`), `testCrudIdSchema`/`testCrudIdParamSchema` (`idSchema`), the hard-coded skeleton widths (from the columns), `refreshRbac` and the invalidation helpers (keys), the double row lock of a publish, the services the functions skipped.
- **Numbers (wc -l):**
  - Test CRUD's admin code (features, functions, server, admin routes; the public reads included both times): 1,895 → 1,462 lines (−23%). The shared code it now uses is 1,191 lines (`src/lib/crud`, `src/components/crud`, `server/db/crud.ts`, the services middleware and module, `QueryDialog`, `availabilityValidators`, `localizedValue`), written once for every section.
  - The roles, users and audit routes: 495 → 91 lines (their UI moved to `features/*/components`).
  - Every page's JavaScript: 238.0 → 232.5 kB gzip (the admin pages no longer pull Test CRUD's TanStack DB collection).
- **Deviation:** the plan asked for about 40% less Test CRUD code. It came out at 23%: the reference keeps its public pages, image gallery, masked dialog and analytics events, its filters and columns are its own, and creates and edits gained audit rows. The repetitive half (list page wiring, filter chips, mutations, form plumbing, routes, server boilerplate) is what shrank; the rest is the feature.
- **Choices:**
  - **Client helpers are split by what they need:** pure ones in `src/lib/crud/`, React ones in `src/components/crud/` (the plan put both in `lib`), and the route helpers in `src/lib/crud/route.ts`, kept out of components by Biome (it needs the Start runtime for the 404 status).
  - **`listLoader(route, options)`, not `loader: listLoader(options)`:** a non-inline loader is typed before the route's loader deps are, and its deps came out as `{}`.
  - **DTO schemas over types:** `dto.parse(row)` checks what leaves the server and picks the fields; a few parses per page cost nothing measurable.
  - **Reload by key:** "Reload" refetches the record's query, and its new `updatedAt` re-keys the form (`crudFormKey`); dialogs read their record from the list's cache by id. One way instead of Test CRUD's remount and roles' `form.reset()`.
- **Alternatives considered:** a generic `<ResourcePage resource={…}>` that renders everything from a config (hides too much: every feature differs in actions, dialogs and fields); keeping the four write styles and documenting them (the next six features would copy whichever they found first).

## 0174: Admin CRUD writes use Query mutations; TanStack DB is for client-first apps

*Supersedes 0068 and 0064's "edit with instant feedback" row.*

- **What:** admin writes go through `useCrudMutation` (Query's `useMutation` over the feature's `mutationOptions`): optimistic updates patch every cached page of the list (`queryClient.getQueriesData({ queryKey: keys.lists() })`) and roll back from the snapshot; after the write, the feature's keys are invalidated. Test CRUD's per-page TanStack DB collections and their LRU (`features/test-crud/collection.ts`) are gone. TanStack DB stays for `/dev/examples/optimistic` and the apps (Kanban, Habits, Notes; Task 41), where live queries over client state and optimistic transactions are the point.
- **Why:** an admin list is a server-paginated, server-sorted window: the collection held one page, needed a descriptor per search (and a cap on how many), and every feature would have repeated it. Query's cache already holds every page, so one helper patches them all and rolls back. The permission matrix's hand-written `onMutate` became the same helper.
- **Trade-offs:** no live queries in the admin (nothing there needs them); the DB runtime's 100.6 kB still loads with every page until Task 41 moves its provider (0066).
- **Alternatives considered:** keeping collections for admin lists (one per page and search, rebuilt as the URL changes); optimistic updates by hand per feature (what roles and the matrix did).

## 0175: `pnpm new:feature` v2: the standard's shape, `--public` and `--localized`, and a clean tree

*Supersedes 0141.*

- **What:** `scripts/new-feature.ts` (TypeScript, run by Node) writes a feature in 0173's shape from `scripts/templates/feature/` (28 templates): the table and migration, search/schema/keys/queries/columns/filters/commands, list, form, detail and pending components, functions on `withServices`, an audited repository and service, thin routes, messages, stories and mocks, a PGlite test. Shared lists get entries at their `// @new-feature:<slot>` lines (new slots: `commands`, `sitemap`, `indexable`, `content-titled`, `unguarded-functions`); imports go at the top of the file and Biome sorts them.
  - `--public`: a slug (with the as-you-type check) and a "published" switch; public list and detail pages under `_public` with `listSeo()`/`seo()`, unguarded read functions on `withPublicServices` (declared in the guard test), sitemap entries from the database (`SITEMAP_SOURCES`), route-SEO test entries.
  - `--localized`: the title and notes are `{ en, ne }` jsonb columns, `LocalizedField` in the form, searched in both languages and shown with `localizedValue()`.
  - Templates use `{{#flag}}…{{/flag}}` and `{{^flag}}…{{/flag}}` sections; `*.public.tpl` files exist only with `--public`.
- **Safety:** it refuses to run with uncommitted changes to tracked files; any failure runs `git checkout -- .` and `git clean` on the files it created (and drizzle's new migration), so a half-generated feature never stays.
- **Checked:** in a scratch worktree, `pnpm new:feature ci-pages --public --localized` then typecheck, check, knip, test (664 tests), test:storybook (364), i18n:check, the migration check and the full e2e review (735 passed, the generated admin and public pages included). CI's template job generates a plain feature and a `--public --localized` one after `strip-demo`, committing in between.
- **Why:** the generator now emits the standard, so the six apps and every new project start from it; the flags cover the two variants the portfolio needs (public pages, bilingual content). The clean-tree rule is what makes the rollback safe.
- **Alternatives considered:** separate templates per flag combination (four copies to keep in step); a template engine dependency (sections are a 15-line function).

## 0176: The portfolio's content lives in the database, edited in the admin, read through public server functions

*Supersedes 0106.*

- **What:** Task 39 moves the portfolio from typed fixtures to tables (`src/server/db/schema/portfolio.ts`, migration `0011_portfolio`): `portfolio_profile` (one row, id `profile`), `portfolio_project`, `portfolio_post`, `portfolio_experience`, `portfolio_skill`, `portfolio_process_step`, `portfolio_testimonial` and `portfolio_contact_message`.
  - **Columns:** localized fields are `{ en, ne }` jsonb (`localizedText()` in `schema/columns.ts`: one column per field, so a third language needs no migration); structured content (case-study blocks, metrics, links, principles) is jsonb written only after the same Zod schema the admin form uses (`features/portfolio/schema.ts`). Blocks carry an `id` and a `type` (what `BlocksField` needs); architecture edges are `{ from, to }`. Journal bodies are rich-text HTML per language, sanitized on the way in and out.
  - **Admin** (`/admin/portfolio/*`, sidebar group "Portfolio"): the profile (one form in a `SettingsLayout`), projects and journal on the CRUD standard (0173: list, form, publish, preview), projects reordered in a dialog, the four ordered sections on one `OrderedSection` page with a sheet each, the contact inbox. Permissions `portfolio:read|write|publish`, `messages:read|manage`, `media:read|write`; a save may change a status only with `portfolio:publish` (the services check it; a new record must then be a draft). Reordering keeps `updatedAt`, so it never makes an open edit stale. Every change is audited.
  - **Public reads:** `src/functions/portfolio-public.ts` (unguarded, declared in the guard test) calls `src/server/portfolio/public.ts`: published rows only, one call per page (`getHome` returns the whole story), the locale as an input. `?preview=1` asks for drafts; the handler grants it only when the session holds `portfolio:read` (the pages never look the session up otherwise, 0161), and such pages are noindex. The sitemap reads the published slugs.
  - **Seeding:** the fixtures moved to `scripts/lib/portfolio-data/`; `scripts/lib/portfolio-seed.ts` (plain SQL, idempotent and never destructive: it writes nothing once a profile exists) runs from `pnpm db:seed-portfolio`, `db:seed-demo`, the e2e harness and `dev:local`/`setup:local` (on every start, so a database that predates the tables gets content), so `/` is never empty.
  - **Contact form:** honeypot, Turnstile when configured, a database rate limit keyed by a keyed hash of the IP (3 per 10 minutes); the message is saved for the inbox, then emailed to the profile's address (`contact-message` template, in the site's base locale); a failed email is logged, not shown.
- **Why:** the owner edits the portfolio without a deploy, in both languages, with the same kit, permissions, audit and tests as every other section; publishing shows on `/` at once (no server cache: on Vercel a cache cleared on write would reach one instance only).
- **Notes:** the locale is an explicit input although server functions already receive the page's locale in a header (0022): it is part of the Query key anyway, and a read can't silently use another language. Only projects are reordered by hand; posts are chronological. The projects list has no year filter (there is no single-number filter control, and the list is short).
- **Alternatives considered:** keeping the `PortfolioSource` port with a database adapter (an extra layer once there is one source); one column per language (a migration per language, twice the columns); a CMS (another service to run, and the content would leave the template's audit and permissions).

## 0177: A media library: items reference library attachments by id; alt text in both languages

- **What:** `/admin/media` holds the portfolio's images and PDFs. Uploads use the existing direct-to-Cloudinary flow (0098) with the `media` scope, whose rules (`UPLOAD_RULES` in `features/attachments/constants.ts`) add PDFs, need `media:write` on top of `attachments:upload`, and record the verified upload straight into the library (entity type `media`: never pending, never cleaned up after a day). Portfolio records reference library items by id (`cover_id`, `portrait_id`… as foreign keys with `on delete restrict`; the project gallery as a `uuid[]`); a save locks them `FOR SHARE` and refuses an unknown or removed id on its form field. An item can be deleted only while nothing uses it: the delete locks it `FOR UPDATE`, checks every reference, and otherwise refuses with the first user's name.
  - **Alt text** moved to `{ en, ne }` jsonb (the migration keeps the old text as English). `CloudImage` shows the reader's language and marks an English fallback `lang="en"`; `ImageGalleryField` edits both. In the library the alt text belongs to the item and shows wherever it is used.
  - **Picking:** `MediaField` (features/media) is the form field for library items: "Choose from the library" opens a lazily loaded picker that searches, selects and uploads. `ImageGalleryField` stays for item-owned images (Test CRUD).
  - `ImageAsset` gained `format` and `url` (the original file: a PDF to open).
- **Why:** one image can serve several records (a portrait as the social image too) and be described once; a project's images outlive its edits; "used by" is what the owner needs to see before deleting.
- **Deviation from the plan:** the plan said `ImageGalleryField` picks from the library. Owned and shared images behave differently (who edits the alt text, whether removing deletes the file), so the library got its own field instead of a mode switch in the owned one.
- **Alternatives considered:** a usage join table for every attachment (a rewrite of Test CRUD's owned images for no gain there); copying a library image into each record (the alt text would drift); letting a delete orphan references (pages with broken images).

## 0178: Missing Nepali falls back to English, marked `lang="en"` on the record or block

- **What:** `resolveLocalized(value, locale)` (now in `src/lib/i18n/localized.ts`) shows English where a Nepali text is empty, and adds `lang: "en"` to an object none of whose own localized texts is in the page's language (a record or a block not translated yet). Components put it on the element that renders that object (`<article lang={project.lang}>`, a chapter, a testimonial). A partly translated object stays unmarked. `localized(schema)` is the Zod shape (Nepali may be empty); `isFallback` tells it for one value.
- **Why:** screen readers choose their voice and pronunciation by `lang`, and hyphenation follows it. A whole untranslated record is the common case (a new project typed in English first), and marking it needs no change to every string-rendering component.
- **Alternatives considered:** marking each string (a branded string type, or objects instead of strings, would touch every component); marking an object as soon as any text fell back (its translated texts would then be read with the English voice).

## 0179: The portfolio is "Himal": the Himalaya from Kathmandu, printed in altitude layers, in fields of colour

*Supersedes 0110 (Dhaka) and the look of 0108; 0108's scoping rule stands, renamed.*

- **What:**
  - **Idea:** the Himalaya seen from Kathmandu is the site's one picture. The hero is a range of generated mountains printed as stacked sheets, one per altitude, like a multi-block woodblock print (0180). Its sky follows the hour in Kathmandu (0182). The owner's name runs margin to margin under it.
  - **Tokens:** `src/styles/himal.css`, scoped under `.himal` with `hm-` utilities (the `_site` layout sets the class).
    - Semantic tokens: `--hm-ground`, `--hm-ground-2`, `--hm-ink`, `--hm-muted`, `--hm-accent`, `--hm-action`, `--hm-on-action`, `--hm-focus`.
    - Fields (`hm-field-snow-2`, `ridge`, `pine`, `night`, `rhodo`) reassign them for a section. Neighbouring sections never share a field.
    - The altitude ramp (`--hm-alt-0` … `8`) runs pine → rock blue → snow, like a relief map's tints and Nepal's own belts.
    - Rhododendron red marks what can be acted on (the primary button, a link's hover underline, focus, form errors) and the contact field, which the owner chose. Active states, selection, quote marks and the reading line use ink: the finish review found red spread onto them, and a serif with red everywhere is the look this direction refuses.
    - Dark mode is night on the ridge.
  - **Contrast:** `tests/unit/himal-tokens.test.ts` checks ink, muted and accent on every field's ground and surface step, the buttons, and the text set on the art (strata, sky labels), in both themes.
  - **Composition:** taste-skill's direction "The name as a monument" (seed 426837719) and its section layouts, adapted:
    - big project names beside a sticky preview;
    - name columns for skills;
    - switchback lines for the process;
    - quiet figure lines;
    - a lead quote with corner quotes;
    - a journal line-up;
    - the email as display type;
    - the name at full width in the footer.
  - **House rules:** taste-skill's (no eyebrows, rules, cards, shadows, gradients or index numbers), applied site-wide.
  - **Social image:** a page without its own image (a project's Cloudinary cover, the profile's social image) shares `public/himal/og.png` (`himalOgImage`, `lib/og-image.ts`): the range at dawn with the name, rendered once at 1200 × 630 from the art. The app's `public/og-default.png` stays the template's, outside the portfolio layer.
  - **Process:** impeccable's (`PRODUCT.md`, the surface brief's direction contract with roll `seed:b3d9cd8a084181f1`, the finish review, `DESIGN.md`).
- **Why:**
  - **The first written plan failed its own history:** a Fraunces serif on cream "snow paper" with a red accent, and prayer-flag markers. 0110 had already rejected the serif as house style and the flags as religious symbols, and that combination is the most common look of generated pages.
  - **Where Himal comes from:** the owner chose Himalayan topography; this keeps it but draws it in filled layers, not contour hairlines (0110's "common on developer portfolios").
  - **Fields of colour instead of cards** give each section its own place without dividers.
- **Alternatives considered:**
  - A lokta-paper woodblock world: impeccable's roll assigned it. The owner chose Himal, and the roll's layered print and print-on-load ritual were kept.
  - Kathmandu's bilingual painted signboards.
  - A plain conventional portfolio.

## 0180: The generated mountains: seeded peaks, marching squares, stacked sheets, the same markup everywhere

- **What:**
  - **Pipeline** (`features/portfolio/lib/terrain/`):
    1. A height field of seeded peaks: rounded pyramids with concave slopes, domain-warped and roughened by ridged simplex noise, with saddles and a foothill band. Each cover motif is a landform.
    2. Marching squares at 7–9 levels on a grid framed by "sea", so every contour closes into a ring.
    3. Each level's region is drawn as one even-odd path, smoothed through its midpoints and rounded to whole units.
    4. Each level is lifted a step above the one below and filled flat in its altitude colour. Above a snow line (the top 38% of the levels) the colours are the ramp's two snows, so every summit that clears it carries snow.
    5. The hero's plan is drawn wider than its frame (`bleed`), so the low land closes out of view and runs off both edges. Sides longer than 64 units are split before smoothing, or a straight edge's corner rounded across half the drawing.
  - **Rendering:**
    - `Relief` renders inline SVG, `aria-hidden`, coloured by tokens.
    - The hero splits its sheets into three stacked SVGs so motion can move bands of altitude on the compositor.
    - `PanoramaBoard` draws `/work`'s board with the same engine (`reliefOf` over a field of its own): a crest with one summit per project and a leader line from each name to the highest sheet drawn there.
    - `cachedRelief` keeps the last 64 reliefs.
- **Why:**
  - **No hydration mismatch:** noise and heights use only +, −, ×, ÷, floor and sqrt, exact in every engine, and the output is rounded, so the server and every browser print the same `d`.
  - **Bounded markup:** tests hold the hero under 35 kB and a cover under 8 kB, and check that every ring closes.
  - **No layout shift:** frames have fixed sizes or aspect ratios.
- **Alternatives considered:**
  - Hairline contour lines: the cliché 0110 named.
  - Side-view silhouettes only: they lose the map that rises.
  - Canvas or WebGL: no server render, more JavaScript.

## 0181: Portfolio motion stays CSS, plus a 1 kB pointer drift (no Motion library)

*Extends 0109.*

- **What:**
  - The map rises on load: each of the hero's three bands of altitude starts lowered to the flat map and lifts into relief (`hm-lift`, transform only, the low land first). The first version clipped and moved each sheet inside the SVG, which repaints the drawing every frame: 720 ms of blocking time on the home page under Lighthouse's applied mobile throttling, against 180 ms on `/login`.
  - Scrolling past the hero spreads the three bands of altitude apart (`animation-timeline: scroll(root)`).
  - `art/drift.ts`, loaded after hydration on fine pointers only, sets `--hm-px`/`--hm-py` so the bands move by depth with the cursor. It pauses while the hero is offscreen.
  - Section parts rise into view with `clip-path` and transform (`hm-reveal`, staggered by `--hm-i`). Archival pictures settle from a slight zoom.
  - The work index's preview swaps on hover and focus. Mountains morph from the index to the case study (`viewTransition`, `view-transition-class: hm-frame`). Articles draw a reading line.
  - Everything sits under `prefers-reduced-motion: no-preference` and `@supports`. Only transform, translate, clip-path and colour move.
- **Why:** the plan allowed the Motion library, but CSS covers every effect here, and Lighthouse mobile ≥ 95 leaves no room for tens of kB of animation code. Opacity fades stay out (0109: axe measured half-faded text).

## 0182: "Kathmandu at this hour": the sky from the sun's real position, hydrated from the server's read time

- **What:**
  - **Sky:** `lib/daylight.ts` (place constant `HOME`: Asia/Kathmandu, 27.7172° N 85.324° E) computes the sun's elevation and azimuth with NOAA's algorithm, and sunrise and sunset (within 2 minutes of the published times, tested).
    - Its phases: night, dawn, day, dusk. Dawn and dusk give the summits alpenglow.
    - The sun shows near the edge it rises or sets on, the view facing north. At noon it is behind the viewer.
  - **Server render:** the public profile read carries `generatedAt`. The server draws that moment, and hydration uses it.
  - **Browser:** `useMinuteClock` (`src/hooks/use-minute-clock.ts`, extracted from `RelativeTime`) takes over.
  - **Time line:** `HomeTime` writes the Kathmandu time. Only in the browser does it add the gap to the visitor's clock ("4 h 45 min ahead of you"), in a line reserved for it.
- **Why:** the one live thing taste-skill asks for, made from the subject: a remote client learns when the owner is awake. It works without JavaScript, can't mismatch on hydration, and never moves the layout.

## 0183: Archival pictures: public domain, credited, printed in the page's two inks

- **What:** five public-domain pictures from Wikimedia Commons, found with taste-skill's assets tool:
  - Vittorio Sella's Kangchen Glacier panorama (1899);
  - Sella's "Below the Jonsong La" (1899);
  - Kangchenjunga at first light (Round Kangchenjunga, 1903);
  - Kathmandu and the Tundikhel (about 1920);
  - Perceval Landon's Map of the Valley (1928).
  - **Preparation:** the books' printed captions were cropped off, the pictures greyed and saved as WebP at two widths in `public/himal/` (33–245 kB; the large map is the heaviest).
  - **Registry:** `lib/archive.ts` holds them, with alt text and captions in both languages, and the credits print in the footer.
  - **Display:** `ArchivalFigure` frames them at a fixed shape, lazy, in a CSS duotone. The field sets the inks: the map is printed in rhododendron on the contact field.
  - **Provenance:** each file's origin (creator, date, licence, Commons page) is also written beside it (`<file>.webp.json`, impeccable's `embed-prompt`), and `og.png` carries how it was made; `embed-prompt --scan public/himal` lists any picture without one.
  - **Left out:** a 1921 Everest plate (its photographer may still be in copyright in the UK) and a plate of people.
- **Why:** pages with real pictures read as finished (taste-skill's study), and these show the world the site is about. Captions say what each one is, and none is presented as the owner's work.

## 0184: Eczar for display in both scripts, preloaded, with measured fallbacks per weight

*Replaces 0110's type.*

- **What:**
  - **Faces:** Eczar Variable (wght 400–800) sets display type in Latin and Devanagari; the app's Inter and Noto Sans Devanagari set the text.
  - **Preloads:** the `_site` layout preloads Eczar Latin (25.8 kB) and Inter, and on Nepali pages both Devanagari files (Eczar 85.8 kB). All are under the 150 kB budget, so `scripts/check-bundle.ts` has no font exemption left. The Anek packages are removed.
  - **Fallbacks:** "Eczar Fallback" (Times New Roman, or Liberation Serif on Linux with the same metrics) and "Eczar Devanagari Fallback" (Nirmala UI), one face per weight range, with `size-adjust` and ascent/descent measured in Chrome.
  - **Fitting the name:** the hero name and the contact email are sized to their container from their length (`lib/fit.ts`), with no measuring script. Latin sums Eczar 700's advance widths, measured in Chrome (kerning only narrows, so a name fills 97–99% and never overflows). Devanagari, whose conjuncts make per-letter widths meaningless, counts letters, half forms and spacing signs by Unicode category, times a measured factor.
  - **Nepali display:** no negative tracking (it breaks conjuncts) and leading ≥ 1.2.
  - **Metric overrides:** the Eczar faces are declared in `himal.css` (Fontsource's files, its unicode ranges) with `ascent-override` and `descent-override` of 0.88/0.24 em (Latin) and 1.0/0.36 em (Devanagari). Eczar ships 1.14/0.63 em, and at display sizes the text's hit box reached half an em past the line, so a big mailto link caught clicks on the sentence above it; the taste inspector reported it as covered text.
- **Why:** one family for both scripts, as 0110 argued, in a face built for display in both. Impeccable flags Fraunces as a default every generated page uses.

## 0185: Guest sessions: Better Auth's anonymous plugin, no permissions, refused everywhere an account is needed

*Extends 0112 (one more endpoint off over HTTP) and 0045 (a stricter rate limit).*

- **What:**
  - Visitors try the showcase apps without an account: "Try it" calls `signIn.anonymous()` (the `anonymous` plugin, after `twoFactor` in the plugin list). A guest is a user row with `is_anonymous` true, the name "Guest" and a placeholder address (`…@anonymous.placeholder.invalid`); `pnpm auth:schema` added only that column (migration `0012_guests_kanban`).
  - `Session.isAnonymous` is set by `getServerSession`. `permissionsForUser` returns nothing for a guest, so the baseline `user` role never reaches one and `canEnterAdmin` is false.
  - **Refused, server side:** `requireUserMiddleware` answers UNAUTHORIZED to a guest, so every account function (sessions, password, two-factor, the dashboard, every `requirePermission`) refuses them; the apps use `requireAppUser` (`src/middleware/apps.ts`), which lets them in. `/api/account/export` answers 401. A Better Auth `hooks.before` (`refuseGuestPaths`) refuses a guest on the account-changing endpoints (`GUEST_REFUSED_PATHS`: the owner-only list of 0134 plus `/send-verification-email`, with two-factor's sign-in steps left open), and refuses `/sign-in/anonymous` to someone already signed in (it would replace their session). `/delete-anonymous-user` is in `disabledPaths`.
  - **Pages:** `_authed` sends a guest to `/upgrade` (sign up or sign in to keep the data); `_auth` treats a guest as signed out, so `/register` and `/login` open for them.
  - **Elsewhere:** `sendEmail` refuses any `.invalid` address; `ObservabilitySync` never identifies a guest to PostHog or Sentry; `/admin/users`, the role counts and the dashboard leave guests out (`isAccount`).
  - **Rate limit:** `/sign-in/anonymous` allows 5 per hour per client IP (each one is a user row). Turnstile isn't wired on it: the button would need a widget on every landing, and the limit plus the weekly cleanup bound the cost.
- **Why core, not the apps layer:** the plugin's column lives in the Better Auth–generated schema, and the guards sit in the auth middleware and the session type. With the apps stripped nothing starts a guest session; the endpoint stays, rate limited and cleaned up, and removing the plugin is one line (docs/guides/apps.md).
- **Alternatives considered:** a demo account shared by every visitor (everyone sees everyone's boards); data in localStorage (no server rendering, nothing to keep on sign-up); a guest role with an empty permission set (one role assignment away from holding something).

## 0186: Guest data: sample rows on start, moved to the account on sign-up or sign-in, deleted after 7 days

*Extends 0129 (deletion) and 0132 (what is audited).*

- **What:**
  - **Start:** an after hook on `/sign-in/anonymous` (`startGuest`) seeds every app's sample rows in the guest's language (`GUEST_DATA`, `src/server/guests/data.ts`, filled from the server apps registry) and sets the `guest_claim` cookie: the guest's id with an HMAC-SHA256 of it under `BETTER_AUTH_SECRET`, httpOnly, SameSite Lax, 7 days.
  - **Claim:** `claimGuest(db, guestId, userId)` moves every owner's rows and the guest's uploads to the account and deletes the guest, in one transaction; it does nothing unless `guestId` is still a guest and `userId` an account, so it is idempotent. It runs from the plugin's `onLinkAccount` (a sign-up verified in the same browser, any sign-in that sets a session in one step, Google) with `disableDeleteAnonymousUser` (the claim deletes the guest itself, after moving the rows), and from `claimGuestData` (`src/functions/guests.ts`), which reads the cookie. That fallback runs after every sign-in (`useAuthNavigation.afterSignIn`, two-factor included) and on the verify-email landing, because a password sign-in that stops for two-factor deletes the guest's session cookie before the plugin's hook looks, and `/two-factor/verify-totp` isn't one of the paths the hook matches.
  - Quotas don't apply to a claim: nothing a guest made is lost, though the account may have to delete some before adding more.
  - **No publishing by guests:** an app's service checks `user.isGuest` before anything public (short links, published forms, shared notes: Tasks 42 and 44), so the owner's domain can't serve a stranger's phishing page.
  - **Never audited:** app rows are users' own data, not admin actions; 0132's log stays the admin's.
  - **Cleanup:** `GET /api/cron/guests` (a Nitro route, daily in `vercel.json`, bearer `CRON_SECRET`) deletes guests created more than 7 days ago in batches of 200. Their app rows go by cascade (every app table's `owner_id`); their uploads are marked removed in the same transaction, then deleted from Cloudinary through the attachments service, and what Cloudinary refuses stays queued for the attachments cleanup. The plugin's own delete would skip both, which is why it is off (0185).
- **Why:** trying an app should cost nothing, and keeping what you made should cost one form. The cookie fallback is what makes the two-factor and verify-later paths keep the data.
- **Verified:** e2e `apps.spec.ts`: a guest moves a card with the keyboard, signs up, verifies and finds the board; another signs in to an account with two-factor and finds it; a guest can't enter the admin area or change an account. PGlite tests cover the claim, its idempotency and rollback, and the cleanup.
- **Alternatives considered:** claiming in `databaseHooks.session.create` (it fires for the guest's own session too, and has no cookie to read); a claim token in the verification URL (Better Auth builds that URL; the cookie needs no change to it).

## 0187: The showcase apps: a registry in two halves, an `_apps` frame, every row owned

- **What:**
  - **Registry:** `src/features/apps/registry.ts` (slug, name, tagline, description, icon, usage labels; it drives `/apps`, the app switcher, the sitemap and `/admin/apps`) and `src/server/apps/registry.ts` (each app's `seedGuestData`, `claim` and `usage`). The plan's single registry would have put server code in the browser's.
  - **Frame:** the pathless `_apps` layout (`AppsLayout`): the app header (brand, app switcher, a link to the app's case study, language, theme, the user menu or "Log in"), the guest banner, `ConfirmProvider` and `DbScope` (0189). Pages are private unless they say otherwise; `/apps` and each app's landing (`/apps/<slug>`) are indexable and in the sitemap. A landing explains the app with "Try it" for a visitor and becomes the app for anyone with a session.
  - **Case study link:** a published portfolio project whose "App" field names the app (Task 39's `appSlug`); the case study page links to the live app the same way. The plan's `projectSlug` in the registry would have been a second source of truth.
  - **Ownership:** every app table has `owner_id text not null references user(id) on delete cascade`; repositories take the owner and add `ownedBy(table, userId)` to every query, so another user's row is "not found", never "forbidden". App functions run `requireAppUser` then `withAppServices` (`context.db` and `context.user: { id, isGuest }`); no permission is involved, and the guard test checks that order for every file in `src/functions/apps/`.
  - **Admin:** `/admin/apps` (group "Apps", permission `apps:read`): guests alive now, the accounts and guests with data in each app (a stacked bar chart), rows per app. Counts only.
  - **strip-demo:** the `apps` layer is its routes, features, functions, server code, middleware, the Kanban schema, `src/lib/fractional-index.ts` and their tests, plus marked lines elsewhere (sections, permissions, labels, sitemap, schema index, guard test, e2e pages and harness, the case study's link). Guest sessions stay with the core (0185).
- **Why:** the apps hold real people's data on a portfolio's domain; scoping by owner in one helper is what lets "user A can't read or move user B's cards" be tested once per repository.

## 0188: Kanban: fractional positions, moves by pointer or keyboard, optimistic in TanStack DB

- **What:**
  - **Tables:** `kanban_board`, `kanban_column` (board, name, position), `kanban_card` (board, column, title, description, labels `text[]`, `due_on` date, checklist jsonb, position), each with `owner_id` and timestamps.
  - **Order:** positions are fractional order keys (`src/lib/fractional-index.ts`, rocicorp's algorithm, CC0, unit-tested with 2,000 random inserts), so a move writes one row. Keys compare by code unit: `collate "C"` in SQL, plain `<` in JavaScript (`boardLayout` sorts; a DB `orderBy` would need `stringSort: "lexical"`). The browser computes the key (`moves.ts`, the same code for pointer and keys) and the server checks its form (`isOrderKey`).
  - **Board:** dnd-kit (0170's pinned packages): cards are sortables grouped by column, columns are sortables that also accept cards (so an empty column takes one), committed on drop. From a handle: Space, arrows, Space (dnd-kit's keyboard sensor), or Alt + arrows at once (a card up or down its column or into the next column, a column left or right). Every move is announced in the page's language. On narrow screens the board scrolls sideways in a focusable, labelled region.
  - **Writes:** columns and cards are TanStack DB query collections over the board query (`select`), so they start from the server-rendered rows; a change shows at once, the handler saves it, then refetches the board explicitly and returns `{ refetch: false }` (the automatic refetch is deprecated and logs a warning). A refused save rolls the row back, with a toast. Ids are made in the browser, so the optimistic row and the saved one share a key. The board list and board names use Query mutations.
  - **Quotas:** 20 boards and 500 cards per user, 12 columns per board, checked by the service (CONFLICT, with a localized message).
  - **Guest seed:** "Getting started": To do, Doing, Done, and five cards that explain the board (labels, a checklist, the keyboard).
- **Why:** one-row moves keep a drag cheap and never renumber a column; computing the key where the move happens lets the optimistic row and the saved row agree.
- **Alternatives considered:** integer positions with renumbering (a move writes a column's worth of rows); `@dnd-kit/helpers`' `move()` in `onDragOver` (state changes mid-drag; optimistic sorting already shows the drag); the server computing keys from neighbours (the optimistic position would differ from the saved one).

## 0189: TanStack DB loads only with the pages that use it

*Supersedes 0066.*

- **What:** `routerWithDbClient` and `@tanstack/react-router-with-db` are gone. `dbClientFor(queryClient)` (`src/lib/tanstack-db.ts`) makes one DbClient per QueryClient (so per request on the server), and `<DbScope>` (`src/components/layout/db-scope.tsx`) provides it to the pages below it: the `_apps` layout and `/dev/examples/optimistic`. On the server it turns on DB's cleanup and runs it once the router has finished rendering, as the official integration does.
- **How the first paint is server-rendered without DB's stream:** the loader fills the Query cache (`ensureQuery`), the collections read that query (`select`), and the page uses `useLiveSuspenseQuery`. On the server the live query resolves from the cache inside the render (measured: 37 ms, no fetch); in the browser the same rows come from the dehydrated Query cache, and the suspended boundary keeps the server's HTML until they do. Nothing DB-specific is streamed.
- **Numbers:** every page's JavaScript went from 338.5 kB gzip (237.9 entry + 100.6 DB) to 245.6 kB. The entry line itself grew because TanStack Query's core, which the old `tanstack-db` chunk group had absorbed, is back in it; that group is removed, the entry budget is 250 kB, and `scripts/check-bundle.ts` fails if DB's code is ever preloaded by every page (`NOT_IN_ENTRY`). The Kanban board page adds 157.8 kB on top of the root (DB, dnd-kit, the board).
- **Found on the way:** the optimistic example's loader imported `OPTIMISTIC_SEARCH` from its collection module, which put DB in every page's JavaScript as soon as the router stopped doing so; the constant moved to `queries.ts`.
- **Alternatives considered:** keeping the router integration (100.6 kB on every page for two pages that use it); dehydrating DB state into loader data with `HydrationBoundary` (more moving parts for the same first paint).

## 0190: Notes: full-text search with the `simple` configuration, app uploads, revocable share links

- **What:**
  - **Table:** `note` (title, sanitized rich-text `body`, its visible text `body_text`, `tags text[]`, `pinned`, `archived`, `share_token` unique and nullable, timestamps, `owner_id`). Images are attachments with `entity_type` "note" (at most 8; the first is the card's cover).
  - **Search:** a stored generated column `search tsvector` holds the title (weight A) and body text (B) with the `simple` configuration, behind a GIN index, queried with `websearch_to_tsquery('simple', q)` and ranked by `ts_rank` (quoted phrases, `-word`, `or`; any text is valid input). `simple` doesn't stem, so English and Nepali words match as written: Postgres has no Nepali stemmer, and an English one would mangle Devanagari. Checked in PGlite: Devanagari words with vowel signs stay whole tokens. `body_text` comes from `richTextToText` (one line per block, entities decoded) and is also the list's excerpt.
  - **List:** a TanStack DB collection over the list query (0189): new notes, pin, archive and delete are optimistic and roll back with a toast. Search runs on the server and returns ranked ids; the page shows those rows of the collection, so a search never refetches the notes. The search box is the shared `FilterBar` (search as you type, a GET form without JavaScript); the archive and a tag are links.
  - **Editor:** `useCrudForm` with the stale-version check (two tabs can't silently overwrite each other), `RichTextField`, tags, `ImageGalleryField`.
  - **Uploads for app users:** guests hold no `attachments:upload`, so `ImageGalleryField` and `uploadImage` take an `UploadTransport` (sign, confirm, discard, settings, and the permission to check, `null` for none). Notes passes its own functions, behind `requireAppUser`, on the new `notes` upload scope, with 30 signed uploads per user per hour. The admin's transport is the default, so nothing else changed. `withAppServices` adds `context.imageStore`.
  - **Sharing:** accounts only (a guest's note can't become public, 0186). The token is 144 random bits in base64url. Sharing while already shared returns the same token, revoking clears it, and sharing after a revoke makes a new one, so an old link never comes back. `/apps/notes/s/$token` (the unguarded `getSharedNote`, declared in the guard test) shows the title, body and images, never the owner or the tags. It is `noindex` in the head and in an `X-Robots-Tag` header, set by a route request middleware (`src/middleware/robots.ts`).
  - **Quotas:** 500 notes per user.
- **Why:** search in the database keeps one source of truth and works the same for both of the site's languages; a random token instead of the note's id keeps "stop sharing" meaningful.
- **Alternatives considered:** client-side search over the collection (no ranking, and every body in the browser); an `english` configuration (stems English, breaks Nepali); `pg_trgm` similarity (fuzzy, but no phrases or exclusions, and an extension to install); a permission for app uploads (guests would need a role, which 0185 rules out).

## 0191: Links: a redirect route with request middleware, clicks without IPs, moderation

- **What:**
  - **Tables:** `link` (slug unique across everyone, target, title, `active` (the owner's switch), `expires_at`, `blocked_at` (a moderator's), timestamps, `owner_id`) and `link_click` (link, `at`, `referrer_host`, `country`, `device`, `owner_id`). No IP and no user agent are stored: only the referrer's host without `www.`, Vercel's `x-vercel-ip-country` when it is two letters, and a device class (desktop, mobile, tablet, bot) derived from the User-Agent.
  - **Rules:** slugs are `[a-z0-9-]{3,32}` and not in a reserved list (words that read like this site's pages or an official notice); left empty, the slug is 7 random characters without look-alikes. Targets are http(s), without credentials, at most 2,048 characters, and never this site's host (`VITE_SITE_URL`). A slug can't change after creation, so a printed QR code keeps working. Creates are limited to 30 per user per hour, and links to 200 per user.
  - **Redirect:** `src/routes/l/$slug.ts`. Its request middleware (`src/middleware/short-links.ts`, server code imported inside `.server()`) looks the link up and puts the answer in the context; the GET/HEAD handler returns it or calls `next()`. A link redirects only when it is active, not blocked, not expired and owned by an account (a guest's links never redirect, 0186). The answer is a 302 with `cache-control: private, no-store` (pausing takes effect at once) and `x-robots-tag: noindex, nofollow`. A GET records the click with `waitUntil`, so the redirect never waits for the insert and a failed insert is only logged; HEAD (link checkers) isn't counted. Anything else falls through to the router, where the route's `beforeLoad` throws `notFound()`: the localized 404, in both languages.
  - **Statistics:** the last 30 days by calendar day in Nepal time (days without clicks included), and the top 8 referrers, countries and devices. Country names are English in both languages, marked `lang="en"` in Nepali: browsers don't ship Nepali region names, and the server and the browser must print the same text. The QR code is `uqr`'s SVG (black on white whatever the theme); "PNG image" draws it on a canvas at 1024 px in the browser.
  - **Moderation:** `/admin/links` (group "Apps", permission `links:moderate`, held only by admins by default) follows the CRUD standard: every link with its owner (guests shown as "Guest"), search and a state filter, block or unblock (with a confirm before blocking), delete (one or many). Each change is audited (`link.block`, `link.unblock`, `link.delete`, target `link`). A blocked link stays off even if its owner turns it on. Unlike `/admin/apps`, this page shows what people wrote in an app, because short links are public by nature.
- **Found on the way:**
  - Start falls through from a server handler (`next()`) only to a route with a component, so the route has an empty one that never renders. With a component the route is a page, which may not import server code (the import-boundary test), hence the middleware.
  - Grouping by `to_char(at at time zone $1)` fails in Postgres when the zone is a bound parameter: the SELECT and GROUP BY expressions get different parameters. The query groups by position.
  - The link's click total was always 0: inside a subquery Drizzle printed `link.id` unqualified, which resolved to the click's own id. It now names `"link"."id"`.
- **Why:** a server handler keeps the redirect off the React render path; storing no IP keeps the statistics useful without collecting personal data; moderation exists because a short link on this domain can hide where it leads.
- **Alternatives considered:** a redirect in a global request middleware (it would run on every request); redirecting from the 404 page's loader (it renders HTML first); counting the click before redirecting (the visitor waits for a database write); hashed IPs for unique visitors (still personal data, and the app doesn't need uniques).

## 0192: Expenses: minor units per currency, budgets per month, a CSV import that runs once

- **What:**
  - **Tables** (singular, like the rest of the schema): `expense_category` (name unique per owner in any case, a palette colour, an icon), `expense_transaction` (`amount_minor` bigint, `currency` NPR or USD, `occurred_on` date, note, the category or null, the import's key), `expense_budget` (category, the month's first day, currency, `amount_minor`; unique per category, month and currency), `expense_import` (the idempotency key, owner, a SHA-256 of the rows, the result). All with `owner_id`. Migration `0014_expenses_habits`.
  - **Money:** integers in minor units (paisa, cents) everywhere: the database, the wire and the sums; forms take major units and convert with `toMinor` (`Math.round(x * 100)`). Totals, charts and budgets are per currency and never converted (no exchange rates to keep); the dashboard has an NPR/USD switch in the URL. Formatting goes through `formatCurrency`, so Nepali shows Devanagari digits and "नेरू".
  - **Dashboard** (`/apps/expenses?month=YYYY-MM&currency=…`; no month is the current one in Kathmandu): spent, budgeted and count tiles (`StatCard` takes a `format`); spending by category (a donut in the categories' own colours: `DonutChart` takes `colors`); six months of spending (bars); budget progress (spent of budget, "left" or "over"); the month's expenses with edit and delete. Writes are Query mutations that invalidate the user's keys.
  - **CSV import** (`/apps/expenses/import`): `parseCsv` in `src/lib/csv.ts` (RFC 4180: quoted delimiters, doubled quotes and line breaks, CRLF/LF/CR, a BOM, an unclosed quote reported by line). The page maps columns (guessed from the header, the export's own names in both languages), a date order (Y-M-D, D/M/Y, M/D/Y) and a default currency, then previews every line through `previewImport` (`features/apps/expenses/import.ts`), which checks each row with `importRowSchema`, the schema the server checks again. Only valid rows are sent, at most 1,000. The server claims the key (`insert … on conflict do nothing`) in the same transaction as the rows: a repeat waits for the first and gets its result, and the same key with other rows or from another owner is a CONFLICT (the routing guide's recipe, kept in Postgres). A refused import rolls the key back with the rows, so a retry runs. Categories are matched without case and made when missing (spelled as first seen). Ten imports an hour per user.
  - **CSV export:** every expense, oldest first, with localized headers, through `toCsv`/`downloadCsv` (formula cells neutralized). The import reads it back.
  - **Claim:** category names are unique per owner, so a guest's "Food" joins an account's "Food": its expenses move over, its budgets too unless the account has one for that month and currency.
  - **Quotas:** 5,000 expenses and 30 categories per user. **Guest seed:** five categories, six months of spending (and one dollar expense), three budgets for this month.
- **Why:** floats lose paisa; converting currencies needs rates nobody maintains; a bank CSV is the realistic way in, and a double click on "Import" must not double a month.
- **Alternatives considered:** a `numeric` column (fine in SQL, but JavaScript would still need care at every step); a server-side upload and parse (the preview would need a round trip per mapping change, and the browser already has the file); idempotency in memory (`/dev/examples/idempotency`; lost on a restart and per instance).

## 0193: Habits: streaks on calendar days in Kathmandu, a server-drawn heatmap, optimistic check-ins

- **What:**
  - **Tables:** `habit` (name, palette colour, `days` a weekday bitmask with bit 0 Sunday, `target` check-ins a day from 1 to 20, `archived`) and `habit_checkin` (habit, `day` date, `count` > 0; primary key habit and day; no row is zero).
  - **Streaks and rates** (`src/features/apps/habits/streaks.ts`) work on "YYYY-MM-DD" strings only, with "today" passed in as Kathmandu has it (`todayInZone(APP_TIME_ZONE)`). Days a habit isn't meant for neither count nor break a streak; today doesn't break it until it is over; a day is done at its target. History starts at the habit's creation day or an earlier back-filled check-in. The completion rate covers the last 30 days since the start, today only once done, and is null before any scheduled day. Unit-tested across month, year and leap-day boundaries and at 00:05 on 1 January in Kathmandu (still 31 December in UTC).
  - **Server-computed stats:** the overview loads every check-in of the user (bounded by 20 habits) and computes streak, best and rate with the same module; the list's strip shows the last 7 days.
  - **Check-ins** are a TanStack DB collection over the overview query (0189): a tap adds one, back to none after the target, shown at once and rolled back with a toast if refused; the handler saves the day's count and refetches, which brings the new streak. Check-ins are accepted for today and the 366 days before, in Kathmandu time, never ahead.
  - **Heatmap:** plain SVG, 53 weeks by 7 days from a Sunday, rendered on the server (no chart library), four levels of the habit's colour by share of the target, days the habit isn't meant for outlined; `role="img"` with a summary title, and a title per cell for hover.
  - **Accessibility:** a strip button's name is its visible text (weekday, date or count) followed by a visually hidden sentence ("Water, Tuesday 27 October 2026: 5 of 8"), as WCAG 2.5.3 asks (axe's label-content-name-mismatch caught an `aria-label` that didn't hold the visible text); done cells are a tint of the colour behind body text, not white on the colour.
  - **Colours** for categories and habits are one palette (`src/features/apps/colors.ts`), stored by name, each a middle lightness that shows on both themes.
  - **Deleting from the habit's own page** invalidates the overview only and drops the page's query after navigating away: invalidating it while still on screen would refetch a 404.
  - **Guest seed:** three habits begun 60 days ago (a 9-day reading streak, weekday walks, eight glasses of water part-done today).
- **Not done (stretch goals, each would need its own decision):** a Bikram Sambat calendar view and a daily reminder digest.
- **Why:** a streak is a calendar notion; computing it on instants would move days for anyone not on UTC, and Nepal is UTC+5:45. Server-side SVG keeps the year view out of the JavaScript and on the first paint.
- **Alternatives considered:** streaks in SQL (gaps-and-islands can't skip unscheduled weekdays simply); recomputing streaks in the browser from the strip (it would need the whole history on every page); a chart library heatmap (about 100 kB of JavaScript for 371 rectangles).

## 0194: A route's loader imports its queries on demand

- **What:** the apps' routes (`src/routes/_apps/apps/**`) load their query options inside the loader with `await import("@/features/apps/<app>/queries")` instead of a static import. A loader is in every page's JavaScript (0151), and a static import put the queries module there with the server-function stubs of every function in the app's functions file (a module lands in one chunk, whole). Now the queries load with the route: on the server while rendering, in the browser on navigation or on preload (intent), next to the component chunk that needs them anyway.
- **Numbers:** with Expenses and Habits added (five routes), the entry was 251.4 kB gzip, over the 250 kB budget. Loading the new routes' queries on demand gave 250.5 kB; doing the same for Kanban's, Notes' and Links' routes gave 248.5 kB, below Task 42's 248.9 kB.
- **Why:** the plan says new pages must not grow the entry chunk; this keeps an app's data layer out of pages that never show it.
- **Alternatives considered:** splitting each functions file into reads and writes (the loader's reads would still be in the entry, and the guard test's layout would change); raising the budget again. Task 45 can apply the same to the admin and portfolio routes.

## 0195: Forms: field definitions as data, one schema for both sides, a public page outside the sections

- **What:**
  - **Tables** (singular, like the rest of the schema): `form` (`slug` unique, random and never changed; title, description, `fields` jsonb, `status` draft or published, `published_at`) and `form_response` (the form, `data` jsonb, `submitted_at`, `ip_hash`). A response carries its form's owner as `owner_id`, so `ownedBy`, the claim and the guests' cleanup treat it like every other app row. Migration `0015_forms`.
  - **Field definitions** (`src/features/apps/forms/fields.ts`): a Zod discriminated union of nine types (short text, long text, email, number, one choice, several choices, rating 1–5, date, consent), each with `id`, `label`, `help`, `required` and its own settings (a length limit, a range and whole numbers, options with a radio or dropdown display, the most choices, the rating's end labels, date bounds). Fields and options have ids made in the browser (`f` + 8, `o` + 6 characters): answers are keyed by field id and choices stored as option ids, so renaming a question or an option keeps its answers. `fields` is written only after this schema.
  - **`toZodSchema(fields)`** turns a definition into the schema a response must pass: a strict object (no answers to questions the form doesn't have), optional fields taking their empty value, "Required" for an empty required number or rating (the fields store `undefined`), choices limited to the form's option ids. The public form's TanStack Form validators and the server's submission check use the same function; `tests/unit/forms-fields.test.ts` covers every type. The server stores the parsed answers without the empty ones.
  - **Builder** (`/apps/forms/$formId`): a draft held in the page, not a TanStack Form: the definition is a list of differently shaped items edited from three places (palette, list, settings panel), and a save validates the whole of it. Save checks the draft with `saveFormInput` first, then sends it against the version the builder loaded (a stale CONFLICT shows `StaleVersionAlert`); problems come back keyed like the input (`fields.2.label`) and show under their settings, the question marked in the list. Publishing doesn't change the version (it isn't an edit of the questions), as reordering projects doesn't (0176). The preview tab renders the draft with the public page's renderer.
  - **Drag and drop:** one dnd-kit provider holds the palette (draggables) and the questions (sortables that also accept palette items, plus a drop zone at the end), so a type dropped on a question goes in at its place. From the keyboard: each palette entry has an "add" button (after the selected question), its grip is a keyboard drag too, and questions move with Space/arrows/Space or Alt + ↑/↓, all announced. Options are a `SortableList` in the settings panel, outside that provider.
  - **Publishing:** accounts only (a guest's form is never public, 0186); a form needs a question. Editing a published form changes it live on save, which the builder says.
  - **Public page `/f/$slug`:** a root-level route (a short link to share), outside every section, so it renders its own small frame (brand, language, theme) and reads no session (`staticData.session: "skip"`). Only an account's published form; a draft, a guest's form or an unknown slug is the localized 404. `noindex` in the head and in `X-Robots-Tag`. The submission (`submitFormResponse`, unguarded and declared in the guard test) passes a honeypot (same "sent" answer, nothing stored), Turnstile when configured, a rate limit of 5 an hour per sender and form (a keyed hash of the IP, `clientIpHash`, now shared with the contact form), the form's schema, and a cap of 1,000 responses per form.
  - **Results** (`/apps/forms/$formId/results?page=`): computed from every response by `summarize` (`results.ts`): bars per option, the average and the 1–5 spread of ratings, average and range of numbers, agreement for consent, the newest text answers; answers that no longer fit their field (a removed option) are left out. Responses in a `DataTable`, 25 a page, a column per question; the CSV export has every response with the questions as headers and option labels as text.
  - **Quotas:** 20 forms per user. **Guest seed:** "Café feedback" in the guest's language, five questions and twelve responses, a draft.
  - **Not audited** (app data, 0186) and **not moderated:** a published form needs an account, the field types collect no passwords or files, and the owner can take it down; a moderation page like `/admin/links` (0191) can follow if forms are abused.
  - `NameDialog` moved from Kanban to `src/features/apps/components/` (Forms names a new form with it).
  - **Found on the way, in the form kit:** after a failed submit, a field fixed by typing kept its submit error until it lost focus; the message leaving moved the page between the press and the release of the next click, so pressing Send did nothing (the public form's e2e flow caught it). `clearServerErrorOnChange` now clears the server's, the submit's and the blur's errors of the changed field (the change validator has just checked it), so the message goes while typing. It is the listener `useCrudForm` already sets; forms without it keep the old behaviour (forms guide, pitfalls).
- **Why:** a definition that is data can be stored, previewed and validated by one schema on both sides, so the browser's errors are the server's. Option ids keep results meaningful when the owner fixes a typo after answers came in.
- **Alternatives considered:** a schema stored as JSON Schema (another validator, and Zod's localized messages would be lost); TanStack Form for the builder (nested arrays of unions with per-type settings; the draft-and-validate model is simpler and the errors map the same way); answers keyed by position (reordering would scramble them); versioned form definitions per response (more than a showcase needs; removed questions simply leave the results).

## 0196: Every form clears a field's stale errors when it changes

*Extends 0195's fix to every form.*

- **What:** `useAppForm` (`src/components/forms/index.ts`) wraps the hook `createFormHook` makes: every form gets `clearServerErrorOnChange` as its `listeners.onChange`, run before the form's own listener when it has one. Editing a field clears the errors the edit made stale (the server's, the last submit's and blur's); the change validator has just checked the field, so what it found is what shows. `useCrudForm`, the public form's renderer and `/dev/examples/forms` no longer pass the listener, and the forms barrel no longer exports it.
- **Why:** Task 44 found that without it a field fixed after a failed submit kept its message until it lost focus, and the message leaving moved the page between the press and the release of the next click, so the click on Send was lost. Only forms that remembered the listener were safe; the Expenses, Habits, Kanban, Links and media dialogs and the portfolio's section pages weren't.
- **Alternatives considered:** adding the listener to each form (easy to forget, which is how those forms missed it); a lint rule (no AST rule for "an options object without a key").

## 0197: Every route loader imports its queries on demand

*Extends 0194 from the apps to every section.*

- **What:** the admin, portfolio, `/dev` and `_apps` layout loaders load their feature's `queries.ts` with `await import(…)` inside the loader, as the apps' routes have since 0194; `/dev/examples/errors` and `/dev/examples/streaming` do the same for the functions module they call. Where a route's own component reads the same query options, the file also keeps the static import: the router's code splitter moves the component into its own chunk, and the reference file (loader, head, search) drops imports only the component uses. The auth routes keep their static import: `features/auth/queries` is in the root (the session) anyway.
- **Numbers (gzip, every page):** 249.8 kB → 246.3 kB; the server-function stubs in the entry chunk went from 94 to 11 (one stub pulls its whole functions file, and stubs are 64-character hashes that don't compress). The rest of the entry is the router (about 60 kB raw of `router-core` and `react-router`), React (66 kB gzip, its own chunk), Zod's core, and the route tree with every route's options and the messages their heads and crumbs use.
- **Trade-off:** a client-side navigation to a route whose chunk isn't loaded yet fetches the queries chunk before the loader can start its request. Links preload on intent (hover, focus, touch), which fetches the chunk and runs the loader before the click; on the server the import is a module already in memory. TanStack Router's docs advise against splitting the whole loader (`codeSplittingOptions` `['loader']`) for this reason; this moves only the import, route by route.
- **Not done:** the theme toggle's dropdown (Radix menu and floating-ui, about 45 kB raw) is in the entry because `theme.tsx` also holds what the root needs. Moving it to its own file would lower the entry line, but every section's header renders the toggle, so every page would still load it: the number would move, not the cost.
- **Alternatives considered:** splitting every loader with the router's option (an extra round trip even for routes whose loader needs nothing); raising the budget.

## 0198: Paraglide's CLI is told the output structure

*Corrects 0155.*

- **What:** `pnpm i18n:compile` (and so `pnpm typecheck`), `scripts/setup-local.ts`, `scripts/new-feature.ts` and `scripts/strip-demo.ts` pass `--output-structure locale-modules` to `paraglide-js compile`.
- **Why:** 0155 assumed the CLI reads `outputStructure` from `project.inlang/paraglide.config.ts`. It reads the config's other options, but this one is always the command-line value or the CLI's default, message-modules (Paraglide 2.25, `cli/commands/compile/command.js`). So `pnpm typecheck` replaced a running dev server's two message modules with 4,600 files, and a fresh clone's first `pnpm dev:local` (after `setup:local`) failed to load a message module while the Vite plugin rewrote them (Task 45's fresh-clone check).
- **Alternatives considered:** letting the CLI default stand and the plugin rewrite (the race above, and a thousand modules in dev, which 0155 removed).

## 0199: App quotas are checked under a transaction-scoped advisory lock

- **What:** `lockQuota(tx, scope)` (`src/server/apps/ownership.ts`) runs `pg_advisory_xact_lock(hashtextextended(scope, 0))`. Every app create that counts before it inserts (Kanban boards and cards, Notes, Links, Expenses' expenses, categories and imports, Habits, Forms) takes it first with `<app>:<user id>`, and a form's submission takes `forms-responses:<form id>` around the cap's count and the insert, now in one transaction.
- **Why:** under READ COMMITTED two requests could both count `quota − 1` and both insert, so a script could pass any per-user quota (the review of Part 4 found it). Kanban's columns were already safe because `createColumn` locks the board row; most quotas have no row to lock.
- **Also from the review:** an Expenses import's retry with a finished key is answered before the hourly import limit counts it (the key exists for retries); the short-link middleware no longer throws `URIError` on malformed percent-encoding (`/l/%E0`), though such a URL doesn't reach it yet: Nitro's h3 (2.0.1-rc.22) decodes every path with `decodeURI` while creating the request event, so any malformed path (`/work/%E0` too) is an uncaught exception and a request left without an answer on the Node server. h3 2.0.8 no longer decodes there; it comes with a Nitro upgrade; a short link can't target this site in another spelling (port, trailing dot, `www.`); a public form whose questions changed since the page loaded asks the respondent to reload (a CONFLICT with that message) instead of failing on questions the page doesn't show.
- **Alternatives considered:** `SERIALIZABLE` transactions (retries on every conflict for every create); a counter row per owner (another table and its upkeep in the claim and the cleanup).

## 0200: Part 4 measured (Task 45)

Measured on the owner's Windows machine (Node 24.11), 2026-10-30.

- **Every page's JavaScript:** 246.4 kB gzip (budget 250; 235.5 after Task 34, 338.5 with TanStack DB before Task 41). The heaviest routes on top of the root: the Kanban board 160.3 kB (TanStack DB, dnd-kit), the form builder 132.7, the notes list 127.6, the habits list 124.2, the `/dev/examples` pages 107–113, the admin profile editor 78.0. Preloaded fonts within budget, no exemptions.
- **`pnpm dev:local` on a fresh clone:** `pnpm install` 23 s, `pnpm setup:local` 10 s. Vite ready in 2.8–3.7 s once messages are compiled (15.9 s on the very first start, with the compile and the dependency scan); the first page 5.5–8.5 s; a page not seen yet 0.1–0.4 s, except the first app page (`/apps/kanban`: 18 s, the dependency optimizer bundling dnd-kit and TanStack DB); a repeat 0.1–0.4 s. A request in the first seconds after Vite prints its address can get a 503 ("Vite environment nitro is unavailable", Nitro 3 beta); a reload a moment later works.
- **Lighthouse 13.6, mobile, simulated throttling, behind a brotli proxy** (the harness server doesn't compress, portfolio guide): `/` 89, 97 and 94 in three runs (FCP and LCP 0.9 s, TBT 210–440 ms, CLS 0); `/login` 100, 99, 99. Task 40's 64 (home) and 69 (`/login`) were measured with TanStack DB still on every page (338.5 kB, removed in Task 41) and with an earlier Lighthouse, so the two aren't directly comparable. The home page's blocking time (hydrating the long page) is what still separates it from `/login`; the plan's ≥ 95 is met by one run in three.
- **Gates:** `pnpm test` 79 s (104 files, 905 tests); `pnpm test:storybook` 181 s (406 story tests, both passes); `pnpm build` 80 s; `pnpm build-storybook` 349 s; `pnpm test:e2e` 1,194 checks, all passed, none flaky, 14.8 min (Task 44: 1,194 in 14.4 min).
- **Review:** `/code-review` (high) over the Part 4 diff (`c129243..HEAD`, about 1,000 files) plus this task's changes. Fixed: the findings in 0199, the forms barrel's dead export and the missing decision (0196). Kept, with the reason: the loaders' on-demand import (0197's trade-off); the results page reading every response of a form (at most 1,000, and the summaries need them all).

## 0201: Loading states in every section, guest sign-ins per address, and the home page's first layout

*After Part 4, from the owner's review.*

- **Loading:**
  - **A navigation line** (`NavigationProgress`): a line across the top while a client-side navigation loads, after 150 ms (quick loads never show it), growing toward the end and filling when the page is ready. Decorative, transform only. Every section's frame mounts it (0161): the accent in Graphite, 4px of ink in the portfolio, like its reading line.
  - **The pending page** shows a spinner and "Loading…" in an `<output>`, and a layout can fit it to its frame with `<SectionPending>`: `insideMain` (the sign-in pages render `<main>` themselves; the old pending page nested a second one) or its own view.
  - **The portfolio's view** (`PortfolioPending`): a panorama drawn by the hero's engine and proportions from its own seed, printed over and over. Its three bands of altitude rise out of the ground low land first, hold, and sink snow first, each on its own keyframes (`hm-print-0…2`), so no band ever stands above the land under it (with one timeline shifted by delays, the snow floated like islands). Transform only, still under reduced motion.
  - **"Try it now"** shows the spinner while the guest session and its sample rows are made.
- **Guest sign-ins:** 30 an hour per address (`GUEST_SIGN_INS_PER_HOUR`), not 5, and none in dev builds. The owner hit "Too many attempts" trying the apps on `pnpm dev`: every attempt there comes from 127.0.0.1, and the count lives in the database across restarts (the row was `127.0.0.1|/sign-in/anonymous`, count 5). In production, mobile carriers put many visitors behind one address. The button says what the limit is ("Too many guest sessions from your network in the last hour…") instead of "wait a moment". The 7-day cleanup still bounds the rows.
- **The home page's hydration:** each section below the hero is a `Slice`, a Suspense boundary that never shows its empty fallback: React hydrates each boundary as its own task, so the long page hydrates in slices of 60–140 ms instead of one task (Lighthouse's long tasks). Lighthouse 13.6 mobile on `/` stays 87–97 run to run on this machine (TBT 210–510 ms, CLS 0); ≥ 95 is met by about half the runs.
- **Tried and dropped: `content-visibility: auto`.** On the sections below the hero it gave 98–99 in five runs (the first layout of the whole page, 0.9 s of Style & Layout, was the longest task), but axe then measured light text on the dark fields (pine, ridge) against the page's snow: hit testing doesn't reach a skipped section's contents, so checkers find the wrong background. The browser review failed `/` in the light theme, and any audit tool would report the same. On the section, on a wrapper and on its inner container alike; on the drawings alone (no text) it was safe but saved nothing.
- **Alternatives considered:** a progress bar in the root (it can't take each design system's colour); lazy-loading the pending view (it would suspend while the page it stands for is loading); removing the guest limit (each guest is a user row).

## 0202: Nitro 3.0.261029-rc (h3 2.0.8), and dev servers start on per-locale messages

*Fixes the two problems Task 45 left upstream (0200).*

- **Nitro:** from 3.0.260610-beta to 3.0.261029-rc, which brings h3 2.0.8. h3 2.0.1-rc.22 ran `decodeURI` on every path while creating the request event, so a malformed path (`/work/%E0`) was an uncaught `URIError` and a request that never got an answer on the Node server. Now it's an immediate 400 (`e2e/flows/health.spec.ts`). The dev server's 503 in the first seconds after start ("Vite environment nitro is unavailable") is gone too: the first request waits for the environment. TanStack Start keeps its own h3 (2.0.1-rc.20) for its helpers; nothing else changed in the lockfile, and every page's JavaScript is 238.8 kB gzip (was 246.4) with Nitro's new client chunking.
- **Dev messages:** `pnpm build` writes one module per message into `src/paraglide`; a dev server started on those loaded them while the Vite plugin rewrote them ("Failed to load url /src/paraglide/messages/<key>.js"). `pnpm dev`, `dev:local` and `dev:offline` now run `scripts/lib/dev-messages.ts` first, which compiles per locale only when `messages/en.js` is missing, so a normal start pays nothing (a compile on every start cost 7 s).
- **Alternatives considered:** a pnpm override for h3 alone (Nitro's beta was written against rc.22); a separate output folder for production messages (the app imports one path).

## 0203: Taskline: one team workspace and a sandbox per user, in a layer of its own

*Part 5, Task 46 (docs/guides/taskline.md).*

- **What:** Taskline's tenancy is `tl_workspace` with `kind` `team` (exactly one: a partial unique index, inserted by migration `0016_taskline` with `{}` settings) or `sandbox` (one per user: `owner_id` unique, cascading on delete; a check ties "has an owner" to "is a sandbox"). URLs carry the workspace as `$ws`: the team's slug, or the literal `sandbox`, which always resolves to the caller's own. Guests get a seeded sandbox through `GUEST_DATA` (0186), and an account can start one. On claim, the guest's sandbox becomes the account's, or merges into the one it has (a taken project key gets a suffix, `WEB` → `WEB2`).
- **Settings are jsonb with defaults in code** (`workspaceSettings`, `projectSettings` in `features/taskline/settings.ts`): the row holds only what changed, so the migration's `{}` is "every default" and a new setting needs no migration.
- **A layer, `taskline`,** independent of `apps` (`--keep-taskline`; CI's template job gains the matrix entry). `src/lib/fractional-index.ts` is used by both until Kanban goes (Task 48), so strip-demo gained `SHARED`: paths removed only when every layer that uses them is.
- **Why:** the owner's choices (PLAN 11.2): one admin-run team, and visitors who can still try everything without touching it. A sandbox is a workspace like the team's, so every module works the same in both, and a guest's work survives sign-up.
- **Alternatives considered:** sandbox rows in the team workspace marked by owner (every query would need a second filter, and one mistake shows a guest's tasks to the team); one workspace per guest without placeholders (an empty sandbox can't show assignment, workload or mentions); many teams (not asked for; the slug in the URL leaves room).

## 0204: Taskline's access: one resolver, not found for what you can't see, forbidden for what you can

*Part 5, Task 46.*

- **What:** every app function runs `requireTasklineUser` (signed in, guests included) → `withTasklineServices`, and its service calls `resolveWorkspace` or `resolveProject` (`src/server/taskline/access.ts`) before anything else. The resolver computes the caller's level in a project as the highest of their project role (lead → manage, member → edit, viewer → comment), their team role on a team-visible project (member → edit, viewer → comment), `taskline:manage` (manage) and `taskline:read` (read), and turns it into `can: { view, comment, edit, manage, logTime }`; an archived project drops edit and logTime. A caller with no level gets NOT_FOUND. `assertCan` refuses a caller who can see the project but not do the thing with FORBIDDEN and a localized reason. RBAC adds `taskline: [read, manage, configure, time]`; the team role stays Taskline data, not a permission.
- **Deviation from PLAN 11.5,** which said "a refusal reads as a 404, never a 403": that holds for anything the caller can't see. A viewer who has the board open and presses "move" already knows the task exists, and "not found" would read as a bug; "You can see this project but not change it" tells them why. Updated 11.5.
- **Tested by a matrix,** `tests/server/taskline-access.test.ts`: every operation (23 so far) by every kind of caller (lead, member, viewer, deactivated, outsider, guest, `taskline:read`, `taskline:manage`) against a team-visible project, a private one and a guest's sandbox, with the expected outcome computed from the table. A new function adds one line.
- **Why one resolver:** access has seven kinds of caller and two visibilities. Spread over services, one forgotten check leaks a private project; in one function, the matrix covers every service at once.
- **Alternatives considered:** checks in middleware (a function's workspace and project come from its input, which middleware would have to parse twice); NOT_FOUND for everything (above); Postgres row-level security (Neon supports it, but PGlite tests and the pooled connection make the session variable fragile, and the app's rules, e.g. archived projects, aren't row filters).

## 0205: Taskline's history is its own activity log; `rev` for freshness, `version` for forms

*Part 5, Task 46.*

- **What:** every app write records `tl_activity` rows (kind, actor member, `{ field, from, to }` and the like) in its transaction and bumps the project's `rev`. App data stays out of the admin audit log (0186); admin-area writes (Task 49 on) go through `withAudit` as well. An admin acting through `taskline:manage` without a member row is recorded with no actor and `via: "admin"`.
- **Two counters:** `rev` (on the project) moves with every change and is what open pages poll (Task 48). `version` (an integer on the workspace, the project and the task) moves only when a form saves (a task's title and description, the project form, the settings), checked in the UPDATE's WHERE (`saveVersioned`). Status, position, assignee, priority, dates, labels, parent and the checklist are last-write-wins patches with an activity entry. Bookkeeping updates (`bumpRev`, `nextTaskNumber`) set `updated_at` to itself so Drizzle's `$onUpdate` leaves it.
- **Why:** members need a readable history of their tasks; the audit log is an admin's record of admin actions, with retention and filters of its own. The CRUD standard's version is `updated_at` (0122), but here a card moved by a teammate would make every open description edit stale.
- **Alternatives considered:** the audit log for everything (0186 keeps app data out; it would flood the admin's log); `updated_at` as the version (above); a version per field (more columns for little: only two fields are long edits).

## 0206: `lockQuota` moves to core

*Part 5, Task 46.*

- **What:** `lockQuota(tx, scope)` (a transaction-scoped advisory lock before a count, 0199) moves from `src/server/apps/ownership.ts` (the `apps` layer) to `src/server/db/quota.ts`. The apps import it from there; Taskline locks `taskline:<workspace id>` for projects and tasks and `taskline:statuses:<project id>` for statuses.
- **Why:** Taskline is its own layer and needs it with the apps stripped; it was never about ownership.
- **Alternatives considered:** a copy in Taskline (two places to fix).

## 0207: Taskline's members are the identity for assignment and history

*Part 5, Task 46.*

- **What:** assignees, reporters, project members, stars, watchers and activity actors point at `tl_member`, not at `user`. `tl_member.user_id` is nullable (`on delete set null`) and `display_name` snapshots the account's name: a deleted account's history keeps its name, and a sandbox's placeholder teammates are members with no account. Unique (workspace, user); a deactivated member (`deactivated_at`) keeps their history and loses all access.
- **Why:** history must outlive accounts, and the sandbox needs teammates who don't exist; one identity per workspace also holds what is per workspace (role, title, capacity, notification modes).
- **Alternatives considered:** `user` ids with a soft delete of accounts (Better Auth deletes users, and guests are deleted after 7 days); fake user rows for placeholders (they would sign in, count as users and appear in the admin's user list).

## 0208: Taskline is a standalone section: its own frame, brand, auth pages and manifest, in the same app

*Part 5, Task 47 (docs/guides/taskline.md, "The shell").*

- **What:** Taskline lives at `/app/taskline` in a pathless `_taskline` layout with nothing of the site's, the apps' or the admin's chrome. Visitors get a public frame (the landing, `TasklineAuthFrame` for sign-in and sign-up); signed-in people (guests too) get `TasklineShell` under `_shell`: a shadcn sidebar like the admin's (wordmark, workspace switcher, Home, Projects, Search, starred and recent projects, the user), a topbar (breadcrumbs, search, language, theme), a command palette, a shortcuts dialog (`?`), the guest banner, `ConfirmProvider` and `DbScope`. Its 404s and errors render inside its frames and send people to Taskline's Home or landing, not to `/`.
- **The brand is the document's, not a wrapper's:** a route's `staticData.brand` (`src/lib/section-brand.ts`) makes the root put the section's accent on `<html data-accent>` and link its icons and manifest instead of the app's. A `data-accent` on the shell's root element (the plan's first idea) would have missed menus and dialogs, which portal to `<body>`, and tokens derived from `--primary` on `:root` (`--ring`, the sidebar's). The manifest is a Nitro route per locale (`/app/taskline/manifest.webmanifest`, `scope` and `id` `/app/taskline`, `start_url` Home), like the app's. Titles end in `· Taskline`; `seo()` gained `siteName` for the landing, its one indexable page (JSON-LD `SoftwareApplication`, in the sitemap).
- **Shared pieces it reuses, made section-aware:** the login form, a `RegisterForm` taken out of `/register`, the account page's sections (`signedOutTo`), sign-out (`useAuthNavigation({ signedOutTo })`), `/verify-email?redirect=` (Taskline's sign-up continues into Taskline), and the error and 404 pages' home link (`SectionHome`).
- **Breadcrumbs from the URL in a layout whose child can 404:** during SSR a child's `notFound()` leaves the parent's loader data out of what the browser hydrates, so the `$ws` layout's crumb, first taken from its loader, rendered "Team" on the server and nothing in the browser (React #418, found by the e2e guard). Breadcrumb sources now get `params` too, and the workspace crumb reads `params.ws`.
- **Cross-workspace reads:** the shell's navigation and Home's tasks span the team and the sandbox, so two app functions (`getTasklineNav`, `listMyTasklineTasks`, `src/server/taskline/home/`) resolve each workspace the caller has and keep only projects they may see. "Recent" is the projects the caller last recorded activity in, topped up with recently changed ones.
- **Why:** the owner's choice (PLAN 11.2, "Feel"): Taskline must not feel hosted inside another app. One app keeps one deployment, one database, one session (a visitor's guest session tries the apps and Taskline alike) and the template's gates.
- **Cost:** every page's JavaScript gained 3.2 kB gzip (238.9 → 242.1 kB, budget 250): eleven route definitions and the landing's head strings (route options are in the entry, 0151). Components, queries and DB stay in route chunks.
- **Alternatives considered:** a separate app or subdomain (two deployments, sessions across origins, the gates twice); keeping the apps' header with a Taskline entry (the owner asked for standalone); a scoped `data-accent` (above); a project page only in Task 48 (the sidebar, palette and directory would link nowhere, so a first overview ships now).

## 0209: Open Taskline pages poll the project's `rev`; no websockets

*Part 5, Task 48 (docs/guides/taskline.md, "Freshness").*

- **What:** every change to a project or its tasks bumps `tl_project.rev` in its transaction (0205). An open project page (the layout, the task page) polls `getTasklineProjectRev` (a GET resolved like any read) every 10 s while the tab is visible, and again on focus; when the rev is past the one the page's data was read at, `useProjectFreshness` invalidates everything under the project's query key except the rev itself, and the board's DB collection follows its query. The caller's own writes refresh at once (every mutation invalidates the user's Taskline keys).
- **Why:** the app runs on Vercel functions with Neon. A function can't hold a connection open for long (and each open one is a billed, running instance), Neon's pooled connections don't carry `LISTEN/NOTIFY`, and the template has no SSE or websocket code to build on. A team of one company edits a project at human speed: a change shows on someone else's screen within 10 s, and immediately on focus. One poll is one indexed read of one row, skipped in background tabs.
- **Alternatives considered:** server-sent events (a long-lived function per open tab, and a way to fan out changes across instances); a websocket service (Pusher, Ably, Supabase Realtime: another vendor, keys and a privacy review for one feature); refetching the whole project on an interval (the same freshness for ten times the bytes).

## 0210: Kanban's boards became Taskline projects by migration, with the same ids, and its addresses redirect

*Part 5, Task 48 (docs/guides/taskline.md, "Kanban, moved in").*

- **What:** `0017_kanban_to_taskline` is a custom migration (one PL/pgSQL block, `drizzle-kit generate --custom`). For each Kanban owner, guests included: their sandbox (created, or the one they had) and their member row; each board a project with the board's id, keyed `KB1`, `KB2`… in creation order (skipping keys the sandbox has), led and watched by the owner; each column a status with the column's id and order (the first "not started", the last "completed", the rest "started", their colours the default workflow's); each card a task with the card's id, numbered by creation, its plain-text description as escaped HTML (paragraphs at blank lines, `<br>` within one), its colour labels as project labels named after the colour, checklist and due date kept, closed when in the completed status (at the card's last change); a `project.created` and a `task.created` entry each; `task_seq` set. Portfolio projects pointing at `kanban` point at `taskline`. `0018_drop_kanban` drops the three tables, and Kanban's code, messages, tests, stories, registry entries and guide section went with them.
- **Redirects:** `/apps/kanban` is a 301 to Taskline's landing. `/apps/kanban/$boardId` calls `locateTasklineProject` (the project by id, resolved for the caller: someone else's sandbox is NOT_FOUND) and answers a 301 to that project's board; a visitor, or an id that isn't theirs, gets a temporary redirect to Taskline, so a later sign-in isn't stuck with a cached answer. The routes sit in the `taskline` layer (`src/routes/_taskline/apps/kanban/`), so they live as long as Taskline does, apps or not.
- **Why the same ids:** an old link, a browser's history or a bookmark finds its project without a mapping table, and nothing else stores Kanban ids. **Why a migration, not a script:** every database (Neon, each developer's, PGlite in tests) gets it once, in order, before the drop; `tests/server/taskline-kanban-migration.test.ts` runs it on fixture rows over the migrations before it.
- **Labels in English:** the colour names (`Red`, `Blue`…) are written in English: a migration has no request and so no language, and the owner renames labels in the project's settings.
- **Alternatives considered:** keeping Kanban beside Taskline (two boards to maintain; the owner chose to replace it); a mapping table for redirects (the same ids make it unnecessary); moving the data in application code at first sign-in (every guest's data would need the app running, and the tables couldn't be dropped).

## 0211: Taskline's views: one project query, a board over a DB collection, a list on the list contract, the task as a masked sheet

*Part 5, Task 48 (docs/guides/taskline.md, "The project's views", "The lead's settings").*

- **One query per project:** the project layout (`$ws/p/$key/route.tsx`) loads the project with its statuses, labels, members and tasks (`listTasklineTasks`) and the header, the overview, the board, the filters, the task sheet and the settings read it. The layout owns the page's `<main>` and the view tabs (in the project's header, not the topbar: the topbar keeps the breadcrumbs, and a project's tabs belong with its name). A view's error then renders inside that `<main>`: `Page` provides `InsideMain` (`components/layout/skip-link.tsx`) and `ErrorPage` below one is a section with an `h2`, not a second `<main>`.
- **Board:** Kanban's board, moves and collection (0188, 0189) on statuses and tasks. Columns are dnd-kit droppables, not sortables (their order is the workflow's, set in the settings); a drop on a column puts the task at its end. Swimlanes are separate layouts over each lane's tasks, so a keyboard or pointer move stays in its lane, and a key computed between two lane neighbours is between them in the whole column too. Filters apply in the browser, where the tasks already are.
- **List:** the CRUD list contract (`listSchema`, `listPage`-style paging, sort links, `useListPage`), so filters, sort, page and grouping are in the URL and work without JavaScript; it isn't `CrudListPage` because the project layout owns the page. Grouping is the server's (it sorts by the group first) and `DataTable` gained `groupOf`, which draws a heading row per run of rows of one group, each in its own `<tbody>`. Bulk changes are one server function taking one change at a time (a status, an assignee, a priority, a label added or removed, or the trash): one transaction, an entry per task, one rev.
- **The task:** one panel in two places: a sheet over the board and the list (`?task=WEB-12`, masked as `/$ws/t/WEB-12` with `unmaskOnReload`) and its own page. Fields save at once with an optimistic update of the task's query; the title and description are a form saved against `version` (0205).
- **The lead's settings** are pages under the project (`settings/{general,members,workflow,labels,trash}`), refused with the FORBIDDEN page to those who can see the project but not run it. Statuses reorder with up and down buttons (fractional keys), which the keyboard and screen readers need anyway, rather than a second drag surface.
- **Functions added:** `listTasklineTaskPage`, `bulkUpdateTasklineTasks`, `purgeTasklineTask` (the lead's; trashed tasks only, their history replaced by one `task.deleted` project entry), `listTasklineProjectActivity`, `getTasklineProjectRev` (0209), `locateTasklineProject` (0210). Two wrappers no page needed (`getTasklineProject`, `listTasklineWorkspaces`) were removed; their services stay.
- **Cost:** every page's JavaScript, as `check-bundle.ts` counts it (the root's direct preloads), 242.1 → 244.8 kB gzip: thirteen route definitions. Rolldown had first moved clsx into tailwind-merge's chunk, which the entry then imported directly, adding 8.7 kB to the count while every page already loaded tailwind-merge through `cn`; a `clsx` code-splitting group in `vite.config.ts` keeps the earlier layout. Counted with the chunks those preloads import, every page loads 258.0 kB before this task and 260.6 kB after: the budget's number is below what pages load (noted for the owner in PLAN 11).
- **Alternatives considered:** the list's grouping in the browser (wrong across pages); a board column reorder by drag (the workflow page has it, keyboard first); a separate route per task open from a view without masking (the board would unmount, losing scroll and filters).

## 0212: Taskline's team is its own list; invitations join on the first verified sign-in

*Part 5, Task 49 (docs/guides/taskline.md, "The admin").*

- **What:** who is on the team is `tl_member`, managed from `/admin/taskline/members` (`taskline:manage`), not an RBAC role. An admin adds existing accounts (guests never) or invites an address. An invitation (`tl_invitation`, now with `project_id` and `revoked_at`, one open per address) is accepted by Better Auth's `session.create.after` hook (`acceptOnSignIn`, `src/server/taskline/admin/invitations.ts`): the first session of a verified, non-guest account with that address makes it a member with the invitation's role (a deactivated member is reactivated) and puts it on the named project. Expired and revoked invitations do nothing; an impersonated session accepts nothing. The email (`taskline-invite`, signed "Taskline") links to Taskline's sign-up with `?redirect=` the project, so the verification link's "Continue" lands in it.
- **Why:** RBAC permissions say what someone may do in the admin; the team says who works in Taskline, with a role, a title, a capacity and a history that outlives the account (0207). Accepting at session start covers every way in (password after verification, Google, an email code, a sign-in on another day) without a token to keep or a page to build, and only the address's verified owner can get there.
- **Deactivating** sets `deactivated_at`: access ends everywhere (a 404, 0204) and the name stays in the history. Their open tasks go to another active member or are left unassigned, each with a `task.updated` entry marked `via: "admin"` when the admin isn't on the team, and the projects' `rev` moves.
- **Alternatives considered:** a token in the email accepted on a page (another page, another expiry, and a forwarded email would let someone else in); accepting in the user-create hook (unverified addresses, and existing accounts would never accept); team membership as an RBAC role (the admin's permissions and the team's people are different questions).

## 0213: The admin acts through the app's services; deleted keys are retired; workflows and task types are workspace settings

*Part 5, Task 49.*

- **What:** `/admin/taskline` (overview, projects, members, invitations, workflows, settings, activity) has functions in `src/functions/taskline-admin/` (`requirePermission("taskline:…")` → `withServices`) and services in `src/server/taskline/admin/`. A change to a project runs the app's own service inside `withAudit`'s transaction, as the admin seen as a Taskline caller holding `taskline:manage` (lead-equivalent, 0204; the nested transaction is a savepoint), so the rules, the activity and `rev` are the app's and the audit row is in the same transaction.
- **Deleting a project** takes its key typed again and inserts the key into `tl_retired_key`; `insertProjectWithWorkflow` refuses a retired key for every creator (refs like `WEB-12` live on in emails and comments). Archiving stays the reversible way out.
- **Workflows:** `workspaceSettings` gains `defaultStatuses` (null: the built-in five, named in the creator's language) and `taskTypes` (all four by default). New projects start with the defaults; the tasks service refuses a type turned off (a task keeps one it already has; an unnamed type is `task`, or the first offered). Workspace labels (`project_id` null) are created, renamed and deleted by the admin and appear in every project; their changes move every open project's `rev`.
- **A project's own workflow and labels** are shown in the admin and edited in Taskline (its settings, which `taskline:manage` opens): one editor for each thing.
- **Settings** save against the workspace's `version` (the forms' `updatedAt` carries it as a string). The slug can't be one of the reserved segments, the time zone must be one the server knows, and the quotas can't go below what exists; each refusal is on its field. Notification defaults stay as they are until Task 50 sends notifications.
- **Alternatives considered:** admin services with their own SQL (two sets of rules to keep in step); soft-deleted projects to keep keys (the table of keys is smaller, and a deleted project is meant to be gone); a project's workflow editor in the admin too (a second copy of the lead's page).

## 0214: Taskline's notifications: written in the change's transaction, emailed at once (coalesced) or in a daily digest

*Part 5, Task 50.*

- **What:** every app write that should tell someone calls `produce(tx, scope, actor, events)` (`src/server/taskline/notify/produce.ts`) in its own transaction: a refused change tells nobody. The service decides who hears, never the caller's list alone: a member with an account, active, who may see the project (the access resolver's own `projectLevel`), not the actor, once per change (the first event naming them wins, so a mentioned watcher gets "mentioned", not also "comment"). Task 50 sends assigned, mentioned, comment and status (on a watched task), due tomorrow, overdue and added to a project; the other kinds come with their modules.
- **Modes:** per kind, the member's choice (`tl_member.notify`, saved on every member row of the account from "My settings") over the workspace's default (`workspaceSettings.notify`, on the admin's settings form): `off` writes nothing, `instant` and `digest` write the inbox row. `tl_notification.email` fixes, when the row is made, whether it's emailed at once, in the digest, or never (guests: their address can't receive mail; placeholders have no account and get no row). A choice equal to the default isn't stored, so it follows later changes of the default.
- **Instant email:** the write returns the ids of `instant` rows and the service hands them to `services.deliver` after the commit; the middleware's deliverer runs `deliverInstant` with `waitUntil`. One email per recipient and task, holding everything that change told them. **Coalescing:** when the same person got an email about the same task less than five minutes ago, the new rows go to the digest instead of a second email (they're in the inbox at once either way); a serverless function can't wait five minutes to merge them. Rows are claimed (`emailed_at`) before sending, so two senders never send one twice; a failed send hands them to the digest. Services called without a deliverer (tests, the admin's services inside `withAudit`, whose transaction commits after the inner service returns) send nothing at once: those rows reach the digest.
- **The daily job** (`GET /api/cron/taskline`, 01:15 UTC: 07:00 in Kathmandu; daily is all Vercel's free plan allows): due and overdue notices to assignees (one per task and due date; overdue ones catch up three days of missed runs, not the whole backlog), the digests (each recipient's unread rows not yet emailed, plus instant rows whose email never went after ten minutes; rows they already read are claimed without an email), purging the trash past retention (subtasks and files too) and revoking invitations a month past their date. Each step is idempotent and runs on its own. The workspace's `digestHour` stays a setting; with one run a day, the schedule in `vercel.json` is the hour.
- **Mentions:** `@tiptap/extension-mention` in the shared rich text editor (a `mentions` prop on `RichTextField`); the sanitizer keeps a `<span>` only as a mention node with a UUID `data-id`, and the server reads the ids from the sanitized HTML (`mentionedIds`) and keeps those of members who may see the task. The browser never sends a list.
- **Files** on tasks and comments are the attachments service's rows (`entity_type` `tl_task` and `tl_comment`), uploaded through Taskline's own functions (as Notes', 0190), rate limited per member; images and PDFs only (the upload flow verifies Cloudinary image assets; a PDF is one). Deleting a task for good, by hand or by the cron, marks its and its comments' files removed; the attachments cron deletes the assets.
- **Alternatives considered:** a queue table with a worker (no worker on the free plan; the cron and `waitUntil` cover it); producing notifications from `tl_activity` afterwards (who may see what is known in the transaction, and a second pass would read it again); delaying instant email to merge bursts (needs a scheduler that runs more than daily); any file type (raw Cloudinary uploads need their own signing and verification: left for later).

## 0215: Finding things in Taskline: a calendar over the board's collection, saved views per member, prefix search, the CSV import

*Part 5, Task 51 (docs/guides/taskline.md, "Finding things").*

- **Calendar** (`/$ws/p/$key/calendar`): a month or a week of the project's tasks by due date or start date, over the board's TanStack DB collection of the layout's query (0211), so a reschedule shows at once and is put back if the save fails; it saves through `patchTask` (last write wins). Weeks start on the workspace's week start and its days off are shaded; the grid is pure (`calendar/grid.ts`, unit-tested with Sunday-first weeks) and reads no clock: without `?date=` it shows the server's `today`. A task's handle moves it with a pointer, with dnd-kit's keyboard drag, or at once with Alt + arrows (a day sideways, a week up and down; an undated task is scheduled on the day shown), announced, the focus following the task to its new day. Open tasks without the date are listed beside it; dropping a task there clears its date.
- **My work** (Home): the open tasks assigned to the caller *or watched by them*, in every workspace, each flagged, shown as `?show=assigned|watching|both` and grouped overdue, today, the rest of this week, later, no date. "This week" ends on the last day of the week by the first workspace's week start (the team's when they're on it).
- **Saved views** are `tl_saved_view` rows: a search string for one of a project's views (list, board, calendar), kept per member; saving a name again replaces it (unique by project, member, view and the name in any case), at most 50 per member and project. Anyone with a member row who may see the project saves their own; an editor may share one with the project; the author deletes theirs and the project's lead a shared one (someone else's personal view is not found, 0204). They aren't project data: no activity, no `rev`. `DataTable`'s `savedViews` now takes a store (`SavedViewsStore`) as well as `true` (this browser's localStorage), and the menu shows who shared a view and offers "Share" when the store allows it; the board and the calendar show the same menu beside their filters. The menu's list loads after hydration: it's inside a closed popover, so no loader (and no route-definition bytes) waits for it.
- **Search**: the tasks' generated `search` tsvector (`simple`, title A, description B, GIN) against a *prefix* query built from the words (`desig hom` → `desig:* & hom:*`): only letters, marks and digits reach `to_tsquery`, so nothing typed is tsquery syntax, Devanagari included. Ranked by `ts_rank`, open tasks before closed, never the trash, only in projects the caller may see (archived ones too). `/$ws/search` is a plain GET form that searches when submitted (typing `WEB-1` on the way to `WEB-12` goes nowhere), and an exact reference the caller may see redirects to the task from the loader. The palette searches the caller's every workspace as they type (debounced, two characters at least), exact references first, and offers "Search every task for …".
- **CSV import** (the list's "Import CSV", a lazily loaded dialog): Expenses' pattern (0192): parse, a mapping guessed from the header (the list's export in either language, and common names), a preview through the server's own row schema, an idempotency key per preview (`tl_import`, claimed in the import's transaction; a retry replays, other rows or another account are a CONFLICT), at most 1,000 rows, 10 imports an hour. Statuses, active members and labels are matched by name without case; a name that matches nothing is left blank (the first open status, nobody, no label) and both the preview and the result say which. One transaction: the quota under `lockQuota`, consecutive numbers reserved with one update of `task_seq`, batched inserts, a `task.created` entry per task (`imported: true`), one `rev`. **Nobody is notified:** an import of a hundred assigned rows isn't a hundred assignments. The CSV picker (file or paste, size and quote errors) is now shared (`components/forms/csv-source.tsx`), with `parseCsvDay` in `lib/csv.ts`; Expenses uses both, and its picker's messages became `csv_*`.
- **Core date helpers:** `todayInZone`, `addDays`, `weekdayOf`, `addMonths` and `monthDays` were inside `apps` strip markers though Taskline uses them, so `strip-demo --keep-taskline` would have removed them. They are core now.
- **Deviation from PLAN 11.5:** `tl_saved_view.project_id` is required (every view belongs to a project's view); a workspace-wide view can relax it when one exists.
- **Alternatives considered:** a calendar of its own state (a second copy of the tasks to keep in step with the board); saved views in localStorage (they wouldn't follow a member or be shareable); `websearch_to_tsquery` (no prefixes, so the palette would find nothing until a word was complete); ILIKE (no ranking, no index); an import page of its own (one more route definition in every page's JavaScript, 0151); notifications for imported assignments (a flood with no news in it).

## 0216: Taskline's sprints: one active per project, a rank across the project, daily snapshots for the burndown

*Part 5, Task 52 (docs/guides/taskline.md, "Sprints and backlog").*

- **Sprints** are `tl_sprint` rows of a project: `planned` → `active` → `completed`. A partial unique index keeps one active sprint per project (two starts at once: the index lets one through, the other is a CONFLICT). A sprint planned to start later starts today. Starting stores the commitment (`committed_points`, `committed_tasks`: the scope then); completing stores what was done (`completed_points`, `completed_tasks`) and moves the unfinished tasks (open, outside the trash) to a planned sprint, a new one (starting tomorrow, as long as this one was) or the backlog. Done tasks stay with their sprint, so the report lists them. A completed sprint doesn't change, and nothing moves into it. Only planned sprints are deleted (their tasks go back to the backlog through `set null`).
- **Scope and done:** a sprint's scope is its tasks outside the trash except those in a `canceled` status; done is those in a `completed` status. Points of an unestimated task count 0; the task counts are kept beside the points, so a project estimating in time (Task 53 adds minutes) counts tasks until then.
- **Who plans:** anyone who may edit the project (planning is a team activity, as in Linear's cycles), not only its lead. The project's `sprints` setting shows or hides the backlog, the task's sprint and points, and the sprint filter; the server doesn't refuse sprint operations when it's off, so turning it off hides the sprints without losing them.
- **The backlog's order** is `tl_task.rank`, one fractional order across the whole project (not per sprint), so a task keeps its place relative to others when it moves between sections, and a key between two neighbours in a section is also between them in the project. Migration `0022_taskline_sprints` backfills every task with `c` and three base-62 digits in number order (valid keys, 238,328 per project); new tasks, imports and seeds go to the end. A move is one row (`rankTasklineTask`: the sprint and the rank), applied at once through the board's collection; a sprint change is in the task's history, a reorder isn't (as on the board).
- **Daily snapshots** (`tl_sprint_snapshot`, keyed by sprint and day): the burndown and burnup read a row per day rather than replaying the activity log. The daily job runs at 07:00 in Kathmandu, so it records each active sprint's state as **the close of yesterday**, and never overwrites a day (a second run changes nothing). Starting writes the day before the first day (the starting state); completing writes today's close (replacing). The report adds today's live totals while the sprint is active; a missed day carries the last known one. The ideal line falls from the starting remaining work to zero over the sprint's working days (flat over days off). The series is pure (`features/taskline/sprints/burndown.ts`).
- **Velocity** is the average completed work of the last three completed sprints; the backlog compares each sprint's plan with it and the report draws the last six.
- **Notifications:** the `sprint` kind goes to the project's members when a sprint starts or completes (daily digest by default).
- **Alternatives considered:** the burndown from the activity log (every past day would replay every change; scope changes and canceled tasks make it fragile); a position per sprint (moving between sections would renumber); a nullable rank with ranks assigned on first move (keys between unranked neighbours don't exist); planning restricted to the lead (more friction than the small team needs).

## 0217: The bundle budget counts what every page loads, not only what it preloads

*Part 5, Task 52 (the owner's choice, 2026-11-01; amends 0151).*

- **What changed:** `scripts/check-bundle.ts` counted the root route's direct preloads; the chunks those import statically were missed (Task 48's note: 260.7 kB loaded while the count said 258.0). It now follows every static import (`import "./x.js"`, `… from "./x.js"`, not `import("./x.js")`) from the preloads, recursively, for every page and for each route's extra.
- **The numbers at Task 52:** every page loads 265.7 kB gzip (249.9 by the old count, 0.1 under the old budget of 250). The heaviest route, the portfolio's project editor, adds 266.5 kB (its editor kit), Taskline's backlog 149.2 kB by the old count.
- **The budgets:** every page 275 kB (room for Tasks 53–57's route definitions, about 0.3 kB each, 0151), any one route 300 kB. They are measured differently from 0151's 250, so the raise isn't growth: the closure was always loaded.
- **Alternatives considered:** keeping 250 and trimming first (route definitions are in every page by Start's design, and the trimming would be open-ended); raising the direct count's budget to 260 (it keeps measuring less than the browser loads).

## 0218: Taskline's time: entries per member, one timer per person stamped by the server, cells that rewrite the fewest entries, a lock date nobody passes

*Part 5, Task 53 (docs/guides/taskline.md, "Time").*

- **Entries** are `tl_time_entry` rows: a member, a project, a task (nullable: `on delete set null`, so purging a task leaves its time on the project and timesheets and exports keep adding up), a day in the workspace's time zone, minutes (a day at most), a note and billable. Time is a member's, so logging needs a member row and `can.logTime` (edit; an archived project refuses). Every write moves the project's `rev`; new time leaves `time.logged` in the task's history (edits and deletes don't: time isn't a task field). The quota (sandbox 500, the team's `quotas.timeEntries`) is counted under the workspace's quota lock, and the admin's settings refuse a quota below what exists.
- **The timer** is an entry with `started_at` and no `ended_at`, stamped by the server's clock, so a reload, another tab or another device shows the same time (the page only counts from the start; the first render counts to the nav's `readAt`, so both renders agree). A partial unique index keeps one running per member; starting stops the caller's running timer in any workspace first (one per person), and two starts at once leave one. Stopping makes it whole minutes; under a minute it's dropped (a start pressed by mistake). A timer counts **12 hours at most**: stopping later logs 12 hours, and the daily job stops any running that long, logs 12 hours (`auto: true`) and sends its owner the `timer` notification, before the digests so they carry it. Stopping is the caller's bookkeeping on their own rows, so it skips the resolver (a member deactivated meanwhile can still stop theirs).
- **Whose time:** an entry is changed or deleted by its member while they may log in the project; in the team, `taskline:time` changes anyone's (in the app where they may edit, and in the admin, audited). A running timer isn't edited, only stopped or discarded (deleting it).
- **The lock date** (`workspaceSettings.timesheetLockOn`, set on the admin's timesheets page with `taskline:time`): nothing on or before it is logged, changed, moved onto or deleted, by anyone, the admin included (they move the date instead). It is saved on its own, without the settings form's `version`, so a settings page open meanwhile still saves (the form merges what it doesn't edit). Days after today are refused too. A timer started before the lock still stops.
- **A timesheet cell** is the sum of the member's stopped entries on a task and day. Typing a total there (`setCell`) changes the fewest entries (`planCell`, pure): more is a new entry for the difference; less is cut from the newest entries first, removing those it empties. So notes and billable flags of older entries survive a correction. **Copy last week** copies each task's day of the week before onto the same weekday, for tasks with no time yet this week, on open days, keeping billable; the rest is counted as skipped.
- **Estimates** are `tl_task.estimate_minutes`. A sprint of a project estimating in time counts them: totals, snapshots (`scope_minutes`, `done_minutes`), commitment and completion (`committed_minutes`, `completed_minutes`) and velocity gain minutes, and the charts and totals measure **hours** (`?by=hours`), as Task 52 left for this task. The project's `time` setting shows or hides the Time view, the task's estimate, timer and time; as with sprints, the server doesn't refuse time when it's off, and nothing logged is lost.
- **The admin's timesheets** (`/admin/taskline/timesheets`, `taskline:time`, besides the `taskline:read` every Taskline admin page needs): every team entry on the list contract with totals of all that match, edits and deletes (audited), the lock, utilization (logged against capacity, the weekly capacity spread over the team's working days in the range, at most 92 days) and a CSV of all that match (10,000 at most) built on the server, not the page's rows.
- **Alternatives considered:** a timer kept in the browser (lost on a reload, wrong across devices); one entry per cell, rewritten on every edit (a correction would erase notes and billable flags); a lock per member or per project (one date for the team is what payroll and invoicing close on); letting `taskline:time` pass the lock (then the lock protects nothing from the people most likely to change old time); deleting a purged task's time with it (the hours were worked).

## 0219: Taskline's timeline: dependencies across a workspace's projects without loops, a blocker counts while open, the completion rule refuses completing only, the Gantt as SVG with buttons for bars

*Part 5, Task 54 (docs/guides/taskline.md, "Timeline, milestones and dependencies").*

- **Milestones** are `tl_milestone` rows of a project (a name, a description, a day, a completion stamp, an order key compared with `COLLATE "C"`), at most 50 per project (counted under a lock). Tasks join one through `tl_task.milestone_id` (`set null`: deleting a milestone keeps its tasks); a task may only join a milestone of its own project. A milestone's progress is computed from the project's tasks the pages already have (done is the `completed` category, `canceled` doesn't count), so there's no stored counter to keep right. Anyone who may edit the project plans them (as sprints, 0216); reordering leaves no history, the rest does (`milestone.*`).
- **Dependencies** are `tl_task_dependency` (blocker, blocked; a check refuses a task on itself). Both tasks are in one workspace, possibly in two projects; adding or removing one needs **edit on both** projects, because a dependency changes what the other task may do (the completion rule). A task the caller can't see is NOT_FOUND, as everywhere (0204). Adding one that exists changes nothing. Each side gets a history entry naming the other task (`dependency.added`, `removed`, with the relation as that task sees it), and both projects' `rev` move. At most 50 on each side of a task.
- **No loops:** before inserting blocker → blocked, a recursive CTE walks what `blocked` already blocks (`union` stops at tasks reached); finding `blocker` there refuses it (a field error on `other`). The walk counts trashed tasks (they come back when restored). Two opposite adds at once would each pass a check made before the other's insert, so the check and insert run under a transaction-scoped advisory lock per workspace (`lockQuota`'s, 0199): the second waits, then sees the first.
- **"Blocked"** means an open blocker: outside the trash and not closed (`completed_at` null: neither completed nor canceled), in any project. It's computed when summaries are read (`TaskSummary.blocked`, one query for the page's tasks), filtered in SQL for the list (`?blocked=yes|no`), and shown as a badge on the board, the list and the timeline. A blocker in a project the caller can't see still blocks: its task's page counts it ("1 more in projects you can't see") without naming it, since hiding the block would make the badge and the rule unexplainable; only its existence shows.
- **The completion rule** (`projectSettings.blockCompletionWhileBlocked`, off by default; the lead's General settings): moving a task into a `completed` status (the board, the task's status, the list's bulk change) is a CONFLICT while an open task blocks it; the message names the blockers the caller may see and counts the rest. Canceling isn't completing, so it's allowed; a status whose category is changed to completed in the workflow settings closes its tasks without the rule (the lead's deliberate act on many tasks at once).
- **The timeline** (`$ws/p/$key/timeline`) reads the board's collection, so a reschedule shows at once and is put back if refused. Its geometry is pure (`timeline/layout.ts`, unit tested): a range per zoom (six weeks of days, half a year of weeks, a year of months), bars from start to due (either standing for both; cut at the edges or marked before and after), rows earliest first, grouped by epic, milestone or assignee, arrows from a blocker's end to the blocked task's start (around the row when it starts first), and a conflict when an open blocker ends on or after the day the blocked task starts. The grid, days off, today's line and the arrows are one `aria-hidden` SVG behind the rows; the **bars are buttons** positioned over it, so they take focus, show a focus ring, carry their name and take Alt + ← → (move a day) and Alt + Shift + ← → (change the last day), with a pointer drag doing the same. A visually hidden table carries the same facts (as the charts', 0171). Closed tasks without dates are left out; an open undated task's bar is a placeholder on the day shown, where a keyboard step schedules it.
- **Alternatives considered:** dependencies within a project only (cross-team launches are the common case); edit on the task being changed only (it would let a viewer of a project block its tasks); the cycle check in the browser (it can't see tasks in projects the caller can't see, and two people can race); "blocked" stored on the task (every close, reopen, trash and restore of a blocker would have to update its dependents); bars drawn as SVG `<g role="button">` (focus rings and names inside SVG are unreliable across browsers); a milestone's progress stored on the row.

## 0220: Taskline's custom fields: definitions per scope, values in jsonb checked against them, options by id, required means "before it's completed"

*Part 5, Task 55 (docs/guides/taskline.md, "Custom fields").*

- **Definitions** are `tl_field` rows: the workspace's (`project_id` null, the admin's at `/admin/taskline/fields`, `taskline:configure`, audited) or a project's (its lead's, in the project's settings). A task has the workspace's fields and its project's, in that order. Eight types: text, number, single and multiple choice, date, person, checkbox, link. The definition is a Zod discriminated union over the type (`fieldDefinition` in `features/taskline/fields.ts`, Forms' pattern, 0195): a choice comes with its options, the other types have none. **A type never changes** (it isn't in the update input): values of one type don't become another's. Names are unique per scope in any case (two partial unique indexes, as labels); 30 fields per scope, counted under a lock; 50 options per field.
- **Values** are `tl_task.fields`, jsonb keyed by field id (a GIN index). An empty value isn't stored: no key, so "has a value" is `fields ? id`. `toTaskFieldsSchema(fields)` builds the strict object a change must pass, in the browser and on the server alike: only fields offered on the task (archived and other projects' fields are refused), each its type's value, `null` to clear. The server also checks a person is an active member of the workspace. A change merges in SQL (`(fields || set) - removed`), so two people changing two fields of a task at once both keep theirs: each field is last-write-wins, like the task's other single fields; each changed field leaves a `task.updated` entry `{ field: "custom", fieldId, name, from, to }` (the name kept, so a deleted field's history still reads).
- **Options have ids** made in the browser (`o` + six characters, as Forms'), and values hold the ids: renaming or recolouring an option keeps every value; taking an option out of a field takes it off every task in the same transaction (a single choice goes, a multiple choice keeps its other options).
- **Archiving** keeps every value but offers the field nowhere (panel, columns, filters, import) and refuses new values; restoring brings it back as it was. **Deleting** removes the field and every value of it, after a confirm that says how many tasks have one.
- **Required** means a task can't be **completed** while the field is empty: moving tasks into a `completed` status (the board, the task's status, the list's bulk change) is a CONFLICT naming the task and the fields, as the dependency rule (0219). Creating a task, quick adds, imports and canceling aren't held back, and a field made required later doesn't touch tasks already done. The panel marks a required field and says it's needed while it's empty.
- **Filters** are one repeated URL param, `?cf=<field id>:<value>`, one per field, so they work without JavaScript like the others: a select per field, all named `cf`, which `formSearchPatch` now collects into a list (several controls of one name) and `FilterBar` re-syncs (a select shows the list's entry among its options). Values by type: an option (a multiple choice matches when it holds it), a person or `me`, `yes`/`no` for a box, `past`/`future` for a day, and `any`/`none` for every type. The list's SQL uses `?` and `@>` (the GIN index); the board, calendar and timeline apply the same rule in the browser (`matchesFieldFilters`). The pattern lives in `search.ts` because route files import it.
- **Columns:** a list column per field, hidden until shown from the Columns menu (`DataTable`'s new `defaultHidden`; the preference cookie remembers shown ones in `shownColumns`), and in the list's CSV when shown. The admin's project export (JSON and CSV) carries every value as words. The CSV import maps a column per field and types the cells in the dialog (`parseFieldCell`: option and person names in any case, several options split on `,` `;` `|`, days in the import's format, yes/✓/हो ticked), so the preview names a cell that can't be one; the server checks the typed values again.
- **Alternatives considered:** a values table (`tl_task_field_value`, a row per value: joins on every list page and harder filters, for no query a jsonb key can't answer); values keyed by field name (a rename would rewrite every task); required on creation (the board's quick add and the import would need every required field); changing a field's type with a conversion (rarely meant, easily lossy: archive it and make another); a param per field (`?cf_<id>=`: unknown keys fall out of the route's search schema); sorting by a field (the list's sort is an enum; left for later).

## 0221: Taskline's automations: in the change's transaction, a savepoint per rule, no chaining; recurring tasks move their rule from task to task

*Part 5, Task 56 (docs/guides/taskline.md, "Automations and recurring tasks").*

- **Rules** are `tl_automation` rows: the workspace's (`project_id` null, the admin's at `/admin/taskline/automations`, `taskline:configure`, audited) or a project's (its lead's, in the project's settings, with `automation.*` history entries). A trigger, conditions and actions as jsonb, checked by one Zod definition in the builder and on the server (`automationDefinition`, `features/taskline/automation-rules.ts`; plain TypeScript types in `types.ts` because the schema reads them). Ten triggers (created; status into a status or a category; assignee, priority (to one), label (one) changed; comment added; all subtasks done; the sprint started; due within N days and overdue from the daily job), six kinds of condition (type, priority, category, label has or lacks, assignee, a custom field's `cf` value), ten kinds of action (status, assign, priority, label on and off, sprint, due in N days, a comment, notify, subtasks); at most 10 conditions and 10 actions, 50 rules per scope. Saving checks what a rule names against its scope: a project rule its statuses, labels (its own and the workspace's), sprints, fields and the workspace's active members; a **workspace rule only what every team project shares** (categories, workspace labels and fields, members), so "into Done" is "into a completed status" there. What a rule names may be deleted later: its run then fails and says so.
- **Where they run:** the services hand the engine (`automations/engine.ts`) what happened (`AutomationEvent`s) at the end of the change's own transaction, after its activity and notifications: `createTask`, `patchTask` (assignee, priority, labels added), `moveTask` and the list's bulk changes (status, and through `afterStatusChanges` the parents whose subtasks are now all closed), `addComment`, `startSprint`; the daily job fires the time triggers. The admin's changes reach them too, through the app's services (0213). For each enabled rule whose trigger fires, the task **as it is after the change** is checked against the conditions (`matchesConditions`, pure, so the builder's preview and the unit tests use the same rule).
- **A savepoint per rule, one deep:** each rule's actions run in `tx.transaction()`, a savepoint of the change's transaction. A refused action (the completion rule, a required field, a quota, a deleted label) rolls back that rule's actions alone; the run is logged `failed` with the refusal's message and **the member's change stands**. Anything else that isn't a refusal is also caught, logged with `log()` and recorded as failed. **No chaining:** the engine writes through the repositories, never the services, so nothing an automation does fires another automation; savepoints are never deeper than one (a project change from the admin is a savepoint inside `withAudit`'s transaction already, so two there).
- **Rights:** a rule acts with its own authority, not the caller's: a viewer's comment may fire a rule that assigns the task. What it does is in the history as `{ via: "automation", automation: <name> }` with no actor (`recordSystemActivity`), its comments have no author and carry its name (`tl_comment.automation`), and its notifications name it (`data.automation`, the sentence in the recipient's language); the "notify" action is the `automation` kind (digest by default), and goes first among a rule's notices, since one person hears once per change. The member who caused the change isn't told what the rule then did for them.
- **The run log** (`tl_automation_run`): every time a trigger fires on a task: `ok` (how many actions changed something), `skipped` (didn't match, nothing to change, or past 100 tasks of one change: a sprint's start fires once per task), `failed` (why). The daily job's triggers claim a keyed run first (`due_soon:<task>:<due date>`, a partial unique index), so a second run of the job, or a date moved back, does nothing twice; a new due date is a new occasion. Runs older than 30 days go (the keyed ones are past their window by then).
- **The preview** ("would match N open tasks now") counts the scope's open tasks (outside the trash, not closed, active projects) that match the conditions, reading at most 5,000 ("at least N" past that), with the same pure rule; it runs as the builder's conditions change, debounced.
- **Recurring tasks** (`tl_task.recurrence`, set from the task's Repeat field through `patchTask`): every N days, weeks (on chosen weekdays, weeks from the workspace's week start), months (on the anchor's day, the last day of a shorter month) or years, ending on a day or after a number of tasks. The server stores the rule with its `anchor` (the due day, else today) and `n` (this task's place in the series). **Closing** the task (completed or canceled: canceling skips an occurrence; trashing or stopping the repeat ends the series) creates the next one in a savepoint, due on the first occurrence after its due day that isn't before today (a late task doesn't make a late next one), its start as far before as the last one's: a copy with its labels, field values, estimate and points, the checklist unticked, in the project's first open status, outside any sprint; **the rule moves to it** (the closed one keeps none, so reopening and closing it again doesn't repeat). The **daily job** catches up a series whose task is still open when the next occurrence comes: it creates the latest occurrence up to today, skipping the missed ones, and the rule moves on, so a second run finds nothing. Days are the workspace's (`todayInZone`); the dates are pure (`features/taskline/recurrence.ts`).
- **Alternatives considered:** running rules after the commit (a failed rule couldn't be told apart from a lost one, and the page would read the task before the rule changed it); a queue or a second pass for chaining (loops, and nobody can tell what caused what); one transaction for every rule (one failing rule would undo the others); rules as code or a rule language (the builder must be able to read every rule back); per-occurrence task copies made ahead of time (a schedule nobody closes fills the board); keeping the rule on every task of a series (two tasks of one series could each make a next one).

## 0222: The typecheck runs tsc with a 4 GB heap

*Part 5, Task 56.*

- `pnpm typecheck` runs `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit` instead of `tsc --noEmit`. On a 12 GB Windows machine Node's default heap is about 2 GB, and `tsc` over this repository needs about that: Task 56's two routes (each route widens TanStack Router's path unions, which `seo.ts`, `links.ts` and every typed link check) took it from just under the limit to "JavaScript heap out of memory" on every run, while its own new files cost under 90 ms of checking each. CI's runners have a larger default; the flag makes the gate the same everywhere.
- **Alternatives considered:** `NODE_OPTIONS` in the script (not portable to Windows' shell); fewer route definitions (the routes are the product's pages); project references to split the program (a larger change than the problem).

## 0223: CLAUDE.md holds only what most tasks need

*Extends 0143.*

- `CLAUDE.md` went from 186 lines and 30.7 KB to about 100 lines and 14 KB. It keeps the golden rules, the commands, the definition of done, a short guide table and the pitfalls most tasks can hit. The stack's versions moved to `architecture.md`, the file map to `conventions.md`, the seed commands to `deployment.md`, and the other pitfalls to their area's guide. A new pitfall goes in its area's guide; it goes in `CLAUDE.md` only if most tasks would hit it. `docs/PLAN.md` is never read whole: search it, or read only the lines you need.
- **Why:** `CLAUDE.md` loads in every session, whatever the task, so every byte there costs every reader. A guide costs only the sessions that open it.
- **Kept despite being per-area:** the Taskline bullet, while Part 5 is in progress and its tasks keep adding to those services.
- **Later plan tasks** still say to update `CLAUDE.md`'s layout and pitfalls. The plan is a record and isn't edited for this; this decision and golden rule 10 take priority.
- **Alternatives considered:** `@` imports of the guides (they load at startup, which saves nothing); leaving every pitfall in `CLAUDE.md` (the cost grows with every task).

## 0224: Taskline's templates: one definition with local ids, built-ins in code, edited as JSON

*Task 57.*

- **One definition** (`features/taskline/template-definition.ts`, Zod): statuses, labels, fields, automations, settings, milestones and sample tasks with days relative to the start. The built-ins, `tl_template` and a template's file all hold it, and it's checked on the way in and read through the schema on the way out (`templates/repository.ts`), so one holding only part of itself still has every list and default.
- **Local ids:** statuses, labels, fields and milestones carry a uuid of the template's own; the rest of the definition refers to those, and creating a project gives each a new id. Automations are the same `automationDefinition` a project stores, so the builder's rules, the engine and `checkDefinition` need no second shape: `ruleWithIds` replaces the uuids in the rule's text. A select's option ids are kept, since they only mean something within their field.
- **What a rule can't name:** a member or a sprint (neither exists yet). The definition refuses them. "Save project as template" leaves such a rule out, with one naming a workspace label or field, and says how many it left.
- **Built-ins are code, their words messages,** so a project starts in its creator's language and they need no rows, seed or migration. They read only; "Copy" opens the form with one's JSON.
- **The admin edits JSON** in a form, checked as it's typed with the server's schema; "Import" reads a file into the same form, so it can be read before it's saved.
- **Applying is the import's rules:** inside the project's transaction, through repositories, so nobody is notified and no automation fires; each sample task gets `task.created` with `imported: true`. Sample tasks have no assignee. A label named like a workspace label uses that one rather than a second. Quotas are checked first and refuse the whole project.
- **Sandboxes have only the built-ins:** saved templates are the team's, and an id from elsewhere is a field error.
- **Alternatives considered:** names as references (more readable by hand, but rules would need a second schema and a translation in both directions); a visual builder for every part of a definition (most of the existing editors would be needed again, for an admin task done rarely); copying a project directly instead of keeping templates (it wouldn't survive the project, or travel as a file).

## 0225: Taskline's reports: computed from live tasks and the activity log; updates set the health

*Task 57.*

- **Where the numbers come from:** the service reads the project's live tasks (the columns it needs, the same rows the board reads) and computes in `features/taskline/reports/metrics.ts`, pure and unit tested, rather than in SQL, so the calendar rules are in one place. Only the admin's cross-project reports aggregate in SQL.
- **Lead time** runs from created to completed; **cycle time** from the first move into a `started` status (from `task.moved` in `tl_activity`), or from creation if its first move was out of one, to completed. Reopening restarts neither clock. A task never started has no cycle time. Canceled tasks aren't "completed" anywhere; progress leaves them out of the total. At most the newest 1,000 completed tasks are read in the range.
- **Overdue over time** uses today's due dates, since tasks don't keep earlier ones; the report says so. Keeping a history of due dates for one chart wasn't worth a table.
- **`taskline:read` sees time totals** on `/admin/taskline/reports`, by project and member, as PLAN 11.5 sets; the entries behind them stay `taskline:time`'s. The app's time page already shows members the same totals.
- **Workload against capacity:** the estimates of open tasks due within a week or overdue, against the member's weekly capacity. Unestimated tasks count as nothing, and the page says so.
- **A milestone is at risk** when it's past its day, or due within a week with tasks open.
- **CSV:** each report saves what it shows, from the data the page already has.
- **Project updates** are written once by whoever may run the project; posting sets the project's health, and deleting leaves it. They notify nobody: the plan's notification kinds don't include them, and the overview and the feed carry them.
- **Alternatives considered:** daily snapshots of each project (as sprints have; a job and a table for numbers the tasks already give, except the overdue trend); charts only, without CSV per report (the plan asks for each).

## 0226: Part 5 reviewed: what changed and what stayed

*Task 58. Supersedes part of 0221 (when a time rule claims its run).*

- **The review:** `/code-review` (high) over `062f35e..HEAD` (15 commits, 522 files). Ten findings: nine fixed, each with a test in `tests/server/taskline-wrap-up.test.ts`, and one kept.
- **Fixed, access:**
  - An invitation naming a project joined it as `member` whatever the invitation's role, so an invited viewer could edit there. The project role now follows the invitation.
  - Archived projects read only, as the guide always said, but `manage` and `comment` still passed: a lead could purge tasks and change settings, and a viewer's comment could fire a rule. `assertCan` now refuses every action on an archived project. `can.manage` stays true so its lead reaches the settings, and `assertCanArchive` is the one change it allows: restoring. The settings forms answer "This project is archived"; they aren't made read-only.
  - The emails went to whoever a notification was made for, even after they lost access. A recipient deactivated, or taken off a private project, gets no email and the row becomes `none`. An admin who sees a private project through `taskline:read` or `manage` without being on it counts as taken off: they keep the inbox row and lose the email, because permissions aren't readable in that query.
- **Fixed, automations:**
  - A time rule claimed its keyed run before checking its conditions, so a task that didn't match yet used up its one run for that due date. A match now claims it; a miss writes nothing, not even `skipped`, because a rule that looks again every day would fill the log. This is the part of 0221 it replaces; a second run of the job, or a date moved back, still does nothing twice.
  - "Assign to the lead" or "to the reporter" with neither cleared the assignee and logged success. It now fails, and the run says why.
- **Fixed, the rest:**
  - The daily job threw away the instant ids its steps got back, so a `due` notice set to instant was emailed a day late, by the next run's digest. They now go out in the same run, in a new `instant` step before the digests.
  - Deleting a project left its tasks' and comments' files live for good, since attachments have no foreign key. It now marks them removed, as purging a task does.
  - "Copy last week" summed a cell and called all of it billable if any of it was. It now copies billable and non-billable time as separate entries.
  - `suggestKey` split on `/s+/`, a lost backslash, so "Website relaunch" suggested `WEB` and "A b" an invalid key.
- **Kept:** a task created or imported straight into a completed status with a required field empty. The review reported it; 0220 chose it ("creating a task, quick adds, imports and canceling aren't held back"), so it stands.
- **The template matrix** (CI's template job, by hand in scratch clones) failed on the first run. Nothing is pushed during a part, so the job hadn't run since Task 46:
  - stripping every layer broke `vite.config.ts`: a route spread over three lines was marked only on its last, so it now uses `taskline:start` and `taskline:end`;
  - `--keep-taskline` lost `richTextToText`, inside the `apps` markers though Taskline uses it too: it's core now, tagged `@public`, as `mentionedIds`;
  - `csv-source.tsx` and `db/quota.ts` are in strip-demo's `SHARED` list (apps and Taskline), and `scroll-region.tsx` in Taskline's;
  - Taskline's emails moved from `emails.tsx` to their own `taskline-emails.tsx`, because Biome merges two imports from one module and carries a line's marker onto the merged line, which would have removed the whole import;
  - eight date, CSV and section helpers only the two layers use are tagged `@public`, as `clientIpHash` (0200): a project without either keeps them as core helpers.
- **Stories:** three waits for a lazy dialog went from 10 to 25 s, under the 30 s test timeout. On a busy run a dialog's first dynamic import took longer, and a different story failed each time; alone they pass.
- **The sandbox:** the guest's name is `guest_label` in their language, and the two done tasks have a past (made, started, completed on earlier days, with their moves), so the reports have cycle and lead times. Until now they read "–" and "0 d".
- **Left as it is:** the `pg` deprecation warning in the dev server's log ("Calling client.query() when the client is already executing a query"), which `Promise.all` on one connection causes. It's a warning until `pg@9`.
- **Alternatives considered:** `can.manage` false on an archived project with a new `can.restore` (a change to every caller and story, for one button); keeping the time rule's `skipped` row (a row a day per rule and task); making a second, unstripped import of `react-email` work with comment lines (Biome moves those too).

## 0227: Part 5 measured (Task 58)

Measured on the owner's Windows machine (Node 24.11), 2026-11-04.

- **Queries, on a 10,000-task seed:** PGlite (Postgres in WebAssembly, one connection, in process), so these are CPU and plans, not Neon's network. Three projects of 8,000, 1,000 and 1,000 tasks, six members, labels on half the tasks, a watcher per assigned task, 397 dependencies and an activity row per task. `EXPLAIN ANALYZE` of what the real services run, captured at the driver; the median of three warm runs.

  | Page | Time | Queries | JSON |
  | --- | --- | --- | --- |
  | Board, 8,000-task project | 907 ms | 18 | 4,467 KB |
  | Board, 1,000-task project | 153 ms | 18 | 558 KB |
  | List, default sort | 98 ms | 8 | 11 KB |
  | List, by due date, page 100 | 47 ms | 8 | 11 KB |
  | List, grouped by status | 85 ms | 8 | 11 KB |
  | List, `q=design` | 60 ms | 8 | 11 KB |
  | List, mine, due this week | 22 ms | 8 | 11 KB |
  | List, blocked | 52 ms | 8 | 11 KB |
  | My work | 48 ms | 9 | 74 KB |
  | Search, `q=design` | 40 ms | 10 | 9 KB |
  | Search, `q=de` | 38 ms | 10 | 9 KB |
  | Palette, `q=design` | 35 ms | 10 | 3 KB |

- **What the plans say:** no new index. The list's sorts read the project and sort it (a top-N heapsort, 78 ms at 8,000 rows): an index would serve one sort of eleven. My work starts from the project's rows through `tl_task_number_unique`. Search scans the table and doesn't use the GIN index, since one query in twenty matches and every project is searched: 7 ms at this size. The planner may change its mind on a larger table, and the index is there.
- **The one real limit: the board reads the whole project** (`listTasks`, every task outside the trash, shared by the board, backlog, calendar and timeline). 4.5 MB at 8,000 tasks, and that goes into the page's HTML too. It's fine at the sizes a team of this kind reaches, and it's left alone: paging it by status is a change to all four views and their TanStack DB collections, not a wrap-up's. The guide's pitfalls say so.
- **Every page's JavaScript:** 270.5 kB gzip (budget 275; 246.4 at the end of Part 4). Taskline's routes on top of it: the task page 219.9, board 206.9, backlog 197.4, calendar 194.2, timeline 158.1, list 102.9, home 60.4, timesheet 59.2, reports 58.1, overview 55.3, inbox 25.7, landing 24.1. Preloaded fonts within budget.
- **Lighthouse 13.6, mobile, simulated throttling, behind a brotli proxy** (the harness server doesn't compress, portfolio guide): the landing 90, 96 and 97 in three runs (FCP and LCP 0.9–1.0 s, TBT 200–420 ms, CLS 0), accessibility, best practices and SEO 100. Sign-in 97; its SEO of 63 is its `noindex`.
- **`pnpm dev:local`:** Vite ready in 3.6–4.8 s (5.3 s with the database, 20 s just after `vite.config.ts` changed, when it optimizes dependencies again). First page 12.8–15.5 s, 36 s after such a change (Part 4: 5.5–8.5 s, with about half as many routes). A new page 0.15–0.5 s, a repeat 0.02–0.09 s.
- **The template matrix:** all four rows of CI's job (all layers, `--keep-taskline`, `--keep-apps`, `--keep-portfolio`) in a scratch clone with both `new:feature` runs: typecheck, check, knip, test, the migration check, all green after the fixes in 0226. Each takes 3–7 minutes.
- **Gates:** `pnpm test` 133 files, 1,231 tests, 119 s; `pnpm test:storybook` 104 files, 498 tests, 123 s, twice; `pnpm build` 47 s; `pnpm build-storybook` 499 s; `pnpm test:e2e` 1,945 checks, all passed, none flaky, 24.9 min (Part 4: 1,194 in 14.8 min).
- **Guests:** the sandbox checked in a browser in both languages, on 15 pages: every module has something to show, no console errors, no untranslated text but the project key, shortcuts' key names and "CSV".

## 0228: Parda is a layer; its playback starts as a placeholder

**What:** Parda is a removable layer like Taskline (`"parda"` in `LAYERS`, `SPECS.parda`, `// @parda` markers, a row in CI's strip matrix) at `/app/parda`, run from `/admin/parda`. Task 59 ships no third-party player. The sources are Servers 1 to 4, which the owner named: `/parda/api/{1-4}/movie/:id` and `/parda/api/{1-4}/tv/:id/:season/:episode`, served by a placeholder that plays no video. The owner will connect a real provider later.

**Why:** PLAN 12.4 measured embed players (Vidy, Viduki, XPass, VidRock and others) whose streams are, in the plan's own words, "aggregated, not licensed". The AI session building this declined to wire them in, even temporarily, because the result is a public site streaming unlicensed films. The owner then chose placeholder routes, with a paid provider to follow. Everything around a player can be built against the placeholder, so nothing is lost by waiting. The seed, the adapters and the lab carry none of those hosts, and 12.4 and 12.5 say so.

**Controls kept from 12.2:** the kill switch and the takedown list (`pd_settings.playback_enabled`, `pd_blocked_title`) exist from this task. TMDB stays non-commercial only, with its attribution due in Task 61. Scoped guests (12.5) are built in Task 64, when a viewer first needs one.

**Alternatives considered:** an empty sources table (nothing to test the player against); seeding the measured hosts disabled (the code and data would still be an integration with them).

## 0229: TMDB behind one client, one cache and one service

**What:** `createTmdb` (timeout, one retry on 5xx, one `Retry-After` wait on 429), an in-process LRU with a TTL per class and stale-while-revalidate, lean Zod DTOs, and `catalog/service.ts` as the only way in. Cache keys carry `{path, params, locale, region, cap, epoch}`. Takedowns, settings and sources come from Postgres at most every 30 s per process (`controls.ts`).

**Why:** the dehydrated state is in every page's HTML, so DTOs stay lean. Rails can serve stale answers through a TMDB outage. One service means a takedown can't be skipped by a new page. Takedowns filter after the cache, so one takes effect within 30 s without purging; bumping the epoch purges without touching the map.

**Fixtures:** recorded by `pnpm tmdb:record` from the real API. Tests read their ids from the popular lists, so a new recording changes no test. They're excluded from Biome: they're generated, and 512 KB of formatting would be noise.

**Alternatives considered:** a shared cache such as Redis (another service for data that is cheap to refetch); CDN page caching (0147).

## 0230: Sources as data, adapters as code, a frame-only CSP

**What:** `pd_source` holds URL templates and origins, so a source changes without a deploy. An adapter is the only code per provider, and it turns messages into one event stream. A message counts only from the source's own frame and origin, through the adapter's parser. `buildCsp` gains `embedOrigins`, which reach `frame-src` only. `security-headers.ts` adds them only on Parda's pages (the enabled sources, or all rows on the lab), so every other page keeps the strict policy. A failed read of the sources frames only trailers rather than failing the page.

**The `parda` protocol** is our own (`parda.player` messages, `parda.command` commands). The placeholder speaks it, and a real player may too. Relative templates count as this app (`'self'`), or as `PARDA_PLAYER_BASE` when set.

**The placeholder** is a Nitro route, not a page: a whole document with its own nonce and CSP (`frame-ancestors 'self'`) and a route rule that turns the global `x-frame-options: DENY` into `SAMEORIGIN`. It doubles as e2e's fake player, so the harness only stands in for TMDB. `?cue=` rehearses a failure, a stall and silence.

**Deviations from 12.5:** the adapter list is `parda` and `none`. `PARDA_PROBE_SECRET` and `PARDA_REALTIME_KEY` arrive with Tasks 65a and 69a, which use them.

**Alternatives considered:** `frameOrigins` (it also goes into `script-src`, for Turnstile); one adapter per server (they all speak the same protocol).

## 0231: No sandbox decision is taken yet

**What:** PLAN 12.2 and its Task 59 decision record iframes without a `sandbox`, because the measured players refuse one. With none of those players here, the question doesn't arise. `pd_source.sandbox` still defaults to `none`.

**Why:** the choice depends on the provider. Decide it in the player lab when one is connected, and prefer a sandbox if it plays under one.

## 0232: Parda's look is "Masking", dark by default, and a section can resolve its own theme

**What:** the owner picked Masking from three comped worlds: two masks hold the interface and fit each picture's shape, and subtitle yellow is the one colour. `SectionBrand` gains `id` (`<html data-section>`), `defaultScheme` and `themeColors`. `sectionTheme()` turns "system" into the section's scheme in the root, and that value feeds `preferenceHtmlProps`, `ThemeSync`, `ThemeColor` and `<Toaster>`. An explicit Light or Dark wins.

**Why:**
- **Masking keeps text off the picture,** apart from the subtitle over its scrim, so contrast doesn't depend on the image. Pictures keep their real shape, which suits posters on phones and backdrops on laptops equally.
- **Resolving in the root, not in a script:** the section is known on the server, so the first byte is already dark. `SystemThemeScript` only acts on `data-theme="system"`, so it stays out of the way with no change.
- **`ThemeSync` takes a prop** because the store holds the preference, which stays "system" so the toggle shows the viewer's real choice. Only the document uses the resolved value.

**Fonts:** Anek Devanagari sets display type, because it covers both scripts and its width axis gives the wide Latin the owner chose. Its variable Devanagari files are 258 and 726 kB, over the 150 kB preload budget, so Latin uses the variable width file (114 kB) and Devanagari the static 700 cut (95 kB). That means two Fontsource packages. Nepali display type is therefore one weight at one width.

**The scrim:** a test proves subtitle text at 4.5:1 on a pure white picture under 72% black, so no backdrop can make it unreadable.

**Changed in the plan:** Task 61's header is a solid top mask, not transparent over the billboard.

**Rejected:** The Listings (bars as long as a title's runtime, starting from now), which the design roll assigned, and Cyclorama (a stage wall lit from below), both the owner's call after seeing the comps. A `.dark` class set by a script for the section, which would flash.

## 0233: Parda's frame and media kit

**What:** Task 61's shell, brand and kit.
- **One frame on every page.** The `_parda` layout renders `PardaFrame` (the solid 60 px top mask, the footer, the phone's tab bar) around every page, sign-in and sign-up included. Taskline gives its auth pages a frame of their own; Parda's pages are a frame plus one `<main>`, so they don't need one.
- **Parda's own 404:** `/app/parda/$` throws `notFound()`, so the layout's `notFoundComponent` answers in Parda's frame. Without it nothing under `/app/parda` matches and the site's 404 answers.
- **The home is a private placeholder until Task 62:** a header link needs a route, but its billboard and rails come with their data. It's `noindex` until then. The notice page `/app/parda/about` is indexable and in the sitemap.
- **The brand:** the mark is a lit screen at 2.4:1 between two masks (`public/parda/icon.svg`); the PNGs are rendered from it with Playwright. The accent (`amber`) is never seen, because `parda.css` redefines `--primary`. The manifest takes the dark ground and mask.
- **TMDB's logo is TMDB's own file** (`public/parda/tmdb.svg`, its "blue short" logo from themoviedb.org), smaller than Parda's mark, as its terms ask. Its notice is a message: English word for word, translated in Nepali.
- **The kit takes server-built images** (`PardaImage`, the type `tmdb/images.ts` now returns, with `still` and `profile` sizes added) and links typed `LinkOptions`, so a rail of cards needs no generics. A missing picture is a piece of mask holding the title in display type.
- **The billboard** keeps only the current, previous and next pictures in the page (a slow connection loads three, not all). The lower mask has one height whatever the title: two lines on phones, one from `md`, where a title over 22 characters is set at half size in two lines. It moves every 8 s and stops for the pause button, a resting mouse, focus inside it and a hidden tab. Under reduced motion it never moves: the JavaScript checks the media query and CSS hides the button, so nothing shifts on hydration.
- **The Top 10** puts the rank in the mask under each poster, beside the title, not over or beside the picture: big numerals next to posters are a known service's signature (PLAN 12.6).
- **`Rail`** is core (`src/components/data-display/rail.tsx`), but only Parda uses it so far, so strip-demo removes it with Parda (`SHARED`). Its buttons show for fine pointers and measure the list only once the rail is touched. The list is `relative`, or sr-only text inside it widens the page.
- **The poster preview** is Radix's `HoverCard`, which ignores touch, so a tap always follows the link.

**Why:** PLAN Task 61 and the direction contract (decision 0232).

**Alternatives considered:** a full home in this task (it would need the catalogue functions and middleware Task 62 builds); an auth frame with a picture panel like Taskline's (Masking keeps the picture for titles); rendering every billboard slide (bandwidth on slow connections); a fixed 2-line title box on every width (a void under short titles on laptops).

## 0234: Parda's home and hubs, the catalogue gate, and a title page stub

**What:** Task 62's home (`/app/parda`) and hubs (`/app/parda/$hub`: movies, series, anime).
- **Rails are a config in code** (`src/server/parda/catalog/rails.ts`): per page, an ordered list of rails, each an id, a kind (`top10` or `poster`), a label and the TMDB request behind it, plus the rail whose first titles with a backdrop fill the billboard (5). Task 69 replaces it with `pd_rail`. The module imports nothing at runtime, so `pnpm tmdb:record` records exactly the requests the pages make.
- **Rails per page:** the home has Top 10 today (`trending/all/day`), trending this week, popular movies, series and anime, top rated movies and series, coming soon and three genre rails; movies and series have Top 10 today, trending, popular, top rated, coming soon (movies) or on the air this week (series) and five genres; anime has aired today, new this season, popular, top rated, anime films and four keyword rails (isekai, shounen, mecha, slice of life; TMDB keyword ids checked 2026-11-04). Anime's "today" and "season" are Tokyo's dates, because anime airs on Japanese dates. Genre rails ask for 100 votes and top rated anime for 200, so nothing three people rated leads a rail.
- **Loading:** `getPardaHub` returns the billboard (with each title's details, for tagline, runtime and certificate) and the first two rails; every later rail has only its head, and the loader starts `getPardaRail` for each without waiting, so it streams into the same response behind a skeleton of its size. A rail TMDB can't answer is `null` and renders "couldn't load" in place; only `UPSTREAM_UNAVAILABLE` degrades, anything else is a bug and throws. An empty rail (a takedown, a quiet day) isn't shown.
- **Lean answers:** pictures travel as TMDB paths with one `imageBase` per answer, and the client builds the srcsets (`tmdbImage` moved from `src/server/parda/tmdb/images.ts` to `src/features/parda/kit/image.ts`); overviews are cut to 280 characters (the preview shows four lines); genres are ids named by our messages; rail labels are structured (`{ key }`, `{ genre, of }`, `{ keyword }`) and rendered by the client in the page's language.
- **Trending lists** mix movies, series and people, and TMDB's `include_adult=false` doesn't reach them: the mapper keeps movies and series and drops `adult` and `softcore` items. A mixed list's Nepali fill-in matches by media type and id.
- **`withPardaCatalog`** (`src/middleware/parda.ts`): the session is optional, the region comes from `pd_settings`, the cap is null until profiles exist (Task 64), and the context is null without `TMDB_READ_TOKEN` (the page says the catalogue isn't connected). Anonymous **server-function calls over HTTP** are limited to 300 per 5 minutes per IP; a page load reads the catalogue inside its own request, so SSR isn't counted (it's bounded by the cache), and the e2e review isn't throttled.
- **A title page stub** at `/app/parda/$type/$id` (`movie` or `series`), chosen by the owner: every card and the billboard's *Details* need a target, and the full page is Task 63. It shows the backdrop between the masks (16:9, narrowed so the title stays on a laptop's first screen), the tagline, the title and facts in the lower mask and the overview. It's private until Task 63 makes it indexable; a blocked or unknown title is Parda's 404, TMDB failing a 503.
- **SEO:** home and hubs use `seo()` with JSON-LD (`WebSite` on the home, `CollectionPage` on hubs), are in `INDEXABLE` and the sitemap (`PARDA_SITEMAP`), and preload the first billboard picture in the shape each width shows (the poster below `md`, the backdrop from it).
- **Nav:** Movies, Series and Anime in the top mask and the tab bar. `/app/parda/<anything>` now reaches `$hub`, which answers Parda's 404 for anything but a hub.
- **Fixtures:** a recording's name now carries the parameters that pick the answer (`fixtureName` in `e2e/harness/tmdb.ts`, shared by the recorder, the stand-in and the tests), with date values left out so "aired today" keeps answering. Details answers are trimmed (12 cast and crew, 4 of each image kind, 6 videos, 8 recommendations and similar, certificates for US, IN and GB) and every file is one line: 96 files, 1.5 MB (3.5 MB untrimmed and indented).

**Why:** PLAN Task 62 and 12.5 (lean DTOs, rails degrade, catalogue reads through `catalog/service.ts`). Sending paths instead of srcsets keeps a home of eleven rails from carrying about 200 kB of image URLs in its HTML.

**Alternatives considered:** labels as server-rendered strings (a client-side change of language would read another locale's labels); one call returning every rail (it can't stream); counting SSR reads against the per-IP limit (the review's 18 passes of each page would trip it, and page loads are already bounded by the cache); links to a title route that doesn't exist yet (typed links refuse it) or posters without links until Task 63 (the owner chose the stub); untrimmed details fixtures (3.5 MB in the repo).

## 0235: Parda's title, credits, person and collection pages

**What:** Task 63's pages, replacing Task 62's stub.
- **Addresses:** `/app/parda/{movie|series}/{id}-{slug}`, `…/credits`, `/app/parda/person/{id}`, `/app/parda/collection/{id}` and `/app/parda/surprise`. The slug is made from the **English** title in both languages (`features/parda/slug.ts`), so a page has one address; the Nepali answer takes English's (`fillIn`). The id finds the title; a missing or wrong slug is a 301 to the canonical one, keeping the search. A title with no Latin name has no slug (`/movie/123`). Every list item carries its slug, so cards link straight to the canonical address. People and collections have no slug (PLAN 12.5's route list).
- **One details call** still holds the title page (PLAN 12.4): `append_to_response` gains `aggregate_credits` (a series' cast across seasons, with episode counts), `watch/providers`, `alternative_titles` and `reviews`, and `include_image_language=en,null` brings the logo and stills. The shared requests live in `catalog/requests.ts`, which imports nothing, so `pnpm tmdb:record` asks for what pages read. The full credits, a season, a person (`combined_credits,external_ids`) and a collection are their own cached reads ("details" class).
- **Lean answers, names on the server:** the cache keeps ISO codes (one answer per language); the page builder (`catalog/title-page.ts`) names countries and languages with `Intl.DisplayNames` in the page's language, so the browser's ICU data can't change them on hydration (Chrome's Nepali data differs, 0234). Lists are cut to what the page shows: 20 cast, 8 key crew, 12 videos, 12 of each picture kind, 12 recommendations and similar (overviews cut like the hubs'), 5 reviews of 1,200 characters, 300 per credits list, 200 per filmography department.
- **Nepali fill-in** adds the videos and reviews (TMDB filters both by language and has almost no Nepali ones), season and episode names (and replaces "एपिसोड 3"-style placeholders), the collection's name and a person's biography. Never the tagline (0232).
- **Seasons a page at a time:** a long-running series has over a thousand episodes in one season (recorded: 1,464), so the page shows 30 (`?page`). `?season` picks the season (specials last) and `?episode` opens an episode's sheet, so all three are links and work in the URL. A season TMDB can't answer stays inside its block ("couldn't load"); the page doesn't fail. "Upcoming" and "New episode" (aired within 7 days) compare with the server's date, sent in the answer, so the HTML and the browser agree.
- **Play until Task 64:** the hero is a poster facade (PLAN 12.5): Play swaps the backdrop for the player in the same box, on the first enabled source that fills its template (a series on its first episode). Nothing when the kill switch is off. No server choice, fallback or resume yet: those are the watch page's.
- **Trailers and clips** open YouTube's privacy-enhanced embed in a dialog; the iframe exists only while it's open, so a title page loads nothing from YouTube until asked. It sends `strict-origin-when-cross-origin`, because YouTube refuses an embed without a referrer.
- **The logo** is drawn for a dark ground, so it shows in the dark theme only; the light theme sets the name, and screen readers read the name either way.
- **Key crew:** a series' creators, then Director, the writing jobs, music, photography, editing and producers, merged per person. Departments, jobs, statuses and video kinds TMDB sends in English are named by our messages where we know them, and shown as sent otherwise.
- **"Surprise me"** is a route whose loader redirects to a random title from the page's popular and top rated lists (cached for an hour), minus takedowns and titles without a picture, so it works as a plain link without JavaScript. The billboard's link to it is never preloaded, or hovering would pick one.
- **SEO:** the four pages use `seo()`, titled by their content (`CONTENT_TITLED`), with `Movie`/`TVSeries`, `WebPage`, `Person` and `CollectionPage` JSON-LD, the 1280 backdrop as the preview image, and the hero preloaded. The loader (`title/load.ts`, imported lazily) builds the head; the route's `head` only renders it (`title/head.ts`). The sitemap lists the top 250 of each media type from `pd_title`, minus takedowns, with their slugs (`catalog/sitemap.ts` in `SITEMAP_SOURCES`).
- **The bundle budget is 280 kB:** every route definition is in the entry (0151), and these five routes with their search schemas took it from 274.3 to 276.0 kB. Task 70 measures the rest of Part 6.
- **Fixtures:** the recorder also writes each recorded title's full credits and first season (60 episodes, guest stars and crew cut), the first actor of the review's and the popular titles, and every recorded movie's collection; key crew and trailers are kept first when a list is cut. 160 files, 3.4 MB (1.5 before).

**Deviations from PLAN Task 63:**
- **My List, ♥, Like and Mark watched aren't on the page:** their tables come with Tasks 64 and 67, and a control that does nothing isn't shown (12.3: links and actions arrive with their data). The same goes for each season's "your progress" and the episodes' watched bars (Task 64).
- **Keywords aren't links yet:** Discover is Task 66, which adds them (as with the genre rails, 0234).
- **The sitemap has no billboard or collection titles of their own:** the billboard's are popular titles already listed, and curated collections are Task 69's tables.

**Alternatives considered:** a slug from the title in the page's language (two addresses per title, and Devanagari slugs); the full season in one answer (a thousand episodes in the HTML); the episode sheet as local state (it couldn't be linked); "Surprise me" as a server function behind a button (nothing without JavaScript); raising the budget further now (the rest of Part 6 should be measured, not assumed).

## 0236: Parda's player, progress and Continue watching

**What:** Task 64's watch page, the viewer's library tables and guests scoped to Parda.
- **The watch page** `/app/parda/watch/{movie|series}/{id}-{slug}` (`?s=&e=`), noindex. Its loader returns every enabled source filled for the title **except `{start}`** (`fillTemplate`'s `keep`), in two orders: `ok` (pinned first, then the seed position, until Task 65a ranks them) and `slow` (adaptive first). The page measures the connection on mount (`navigator.connection`, absent outside Chromium: `ok`), takes the viewer's stored pick (`pd_server`), and only then sets the iframe's `src`, so SSR renders the picture in the same box and nothing shifts. A series without `?s=&e=` plays where the viewer is (resume or next), else its first episode; an episode the series doesn't have is a 404.
- **The rules are pure** (`player/machine.ts`, `library/progress.ts`, both isomorphic and unit-tested): the order, falling back to another CDN group first, the start position (30 s earlier on another source), stuttering (2 stalls or 6 s in the first 2 minutes: a toast offers a switch, Parda never switches by itself), Up next (the last 30 s, a 10 s countdown when the profile autoplays), and Continue watching (started after 60 s or 2%, finished at 92% or 5 and 2 minutes left, next unwatched across seasons skipping specials and finished episodes, unaired goes to Schedule, complete leaves the rail).
- **Deadlines:** 15 s before Task 65a measures a source (`deadlineFor`: later p90 + 5 s, kept between 12 and 30). A needs-click source's deadline starts at the first click in the player (a window `blur` while the iframe has focus); no click is never a failure. A `none` source or one with auto-fallback off never falls back. A picked source that fails clears the pick ("back to Auto").
- **The click shield** covers the iframe once a commanding player is `ready`; Parda's bar plays, pauses, seeks and goes full screen on our wrapper, and *Player menu* lifts the shield with a warning. The bar's controls are rendered from the server (disabled until ready) when the first source obeys commands, so the bar never grows on mount (the review's CLS).
- **The redirect guard:** a click in the player arms `beforeunload` for 5 s; at any other time leaving doesn't ask.
- **uBlock Origin Lite:** the hint is the page's last block, so hiding it moves nothing below; SSR links to the notice page's `#ad-blocker`, and on mount `blockerStore(userAgent)` swaps in the store's page in a new tab with the same visible text. Phones, tablets and in-app browsers keep the notice-page link. `BLOCKER_STORES` moved to `player/blocker.ts`.
- **Progress:** the player's report is saved when its position first moves, then at most every 15 s, on pause, on the end, when switching, and on `pagehide` (a server function with a `fetch` that sets `keepalive`). The upsert throttles inside the statement (a row written under 10 s ago keeps its values unless the report finishes it or names another source), and the latest report decides `finished`, so replaying a finished episode from the start is a resume again. One row per episode: a unique constraint `NULLS NOT DISTINCT` over profile, title, season and episode (a movie has neither).
- **Without a session**, progress is kept in the browser (`pd_progress`, 50 entries) with what its card needs (title, slug, backdrop, the next episode), and a `pd_local` cookie tells the server to keep the Continue watching rail's space while the browser fills it in. **Watching never starts a guest:** a library action does (a mark, *Remove* on the server's rail, *Rewatch*), with `guest_scope=parda`, and the browser's progress is imported once a session exists, however it started (the frame's hook).
- **Marks, *Remove*, *Rewatch*:** marks are rows (`marked`, finished); unmarking deletes them; a season or series marks every aired episode. *Remove* sets `hidden_at`, so the title is back with its next save. *Rewatch* sets `rewatch_at`: older rows no longer count but stay for History (Task 67), and the player's own memory is untouched.
- **`pd_play`:** the page makes the playback id; counters only grow in the upsert and the title and source can't change under an id. Plays and *Report a problem* are public writes on `withPardaCatalog` (POSTs), rate limited per user or IP (`player/limits.ts`): 120 plays and 5 reports per 10 minutes.
- **Profiles:** `requirePardaViewer` makes the default profile `on conflict do nothing` (a partial unique index, one per owner) and honours a `pd_profile` cookie only when it names the caller's own profile. `withPardaCatalog` caps a kids' profile from the cookie; with no cookie there's no query (the default profile is never a kids' one). Picking profiles is Task 67.
- **Guests:** `GuestData` gains `section`; a `guest_scope` cookie set just before `signIn.anonymous()` seeds only that section's owners, and without one, every owner without a section (as before, since Parda's seed is a no-op). The claim merges the guest's default profile into the account's (the later row wins, like `claimSandbox`'s labels), hands other profiles over whole, and moves the guest's reports. The banner under the top mask names the deletion day, read by the layout's loader for guests only.
- **The title page:** Play is a link to the watch page with the profile's action (*Resume · 23 min left*, *Next: S2 E6*, *Rewatch*, or a caught-up note); a movie's bar sits under the picture; episodes have bars, Play and a watched mark; seasons a bar and a mark. The data's `player` became `playable`.
- **The placeholder servers** are grouped in two CDN groups (1–2, 3–4, in migration `0029`), so falling back across groups is rehearsed.

**Deviations from PLAN Task 64:**
- **`library/progress.ts` is in `src/features/parda/`,** not `src/server/parda/`: the browser applies the same rules to its own progress.
- **Volume isn't in Parda's controls:** the `parda` protocol has no volume command; the real provider's adapter adds one if it has it.
- **"A needs-click source with no click → no fallback"** is a unit test, not an e2e flow: no seeded source needs a click, and changing a row reaches the server only after the controls' 30 s cache.
- **The click shield, the redirect guard and resume are checked against the placeholder only** (0228): a real player's behaviour waits for the provider.

**Alternatives considered:** starting a guest on the first progress save (a user row for every visitor who watches a minute); a Nitro route with `sendBeacon` for `pagehide` (a second write path beside the server function); deleting rows on *Rewatch* (History would lose them); the controls row appearing on `ready` (the bar grew and shifted the page).

## 0237: Parda's admin I: sources, takedowns, reports and settings

**What:** Task 65's control pages under `/admin/parda`, each route checking its permission, each server function `requirePermission` → `withServices`, every write audited (`parda.*` actions on `parda-source`, `parda-title`, `parda-report`, `parda-settings`).
- **Sources** (`/sources`, `/sources/new`, `/sources/$id`): every field of `pd_source`. The list is the whole table (a short list read whole), in the order the watch page starts from, with each row's open reports and how many are about ads (linking to the reports filtered by that source). Enable, disable, pin and unpin are row actions; "Reorder" is the shared dnd-kit dialog and saves the whole order at once (every source once, or BAD_REQUEST). A new source starts disabled, so it's tried in the player lab first ("Test in the player lab" opens the lab on that row, `?source=`). A sandbox shows a warning, because most players refuse one (0231).
- **Templates are checked on the server** with `sourceFieldProblems` (beside `sourceProblems` in `player/templates.ts`), and each problem comes back on its own field: `movieTemplate`, `tvTemplate`, `origins`. Because a template is checked against the origins, changing the origins clears the templates' server errors.
- **Versions:** forms save from the row's integer `version` (sent as `updatedAt`, as every admin form), through Parda's own `saveVersioned` (`server/parda/admin/context.ts`; Taskline's is in its layer, 0215). Single-field changes (enable, pin, the kill switch, the purge) are last-write-wins and leave the version alone, so they never make an open form stale.
- **The controls' cache is cleared on every write** (`controls.invalidate()`, given to the services as `PardaAdminServices`): the server that took the write sees it on its next read; others within the 30 s TTL (0229). Without it the e2e flows (and an admin checking their change) would wait 30 s.
- **Takedowns** (`/titles`, `/titles/new`): media, TMDB id and a reason, named from the `pd_title` snapshot where Parda has it. A unique index (`pd_blocked_title_unique`, migration `0030_parda_admin`) makes a title blocked once; the insert is `on conflict do nothing`, and no row back is the field error on the id. Unblocking deletes the row ("Delete" in the shared list).
- **Reports** (`/reports`): open ones by default, filtered by status, kind, source and a search over the note, the title and the id; resolve, dismiss or reopen one, or resolve and dismiss the selected ones (`CrudListPage` gained `bulkActions`, beside "Delete selected", and `notice`, a block between the header and the table). A report already in the asked status records nothing.
- **Settings** (`/settings`): region (two letters), the kids' cap (TMDB's US ladder: G, PG, PG-13, R), the players' languages, the banner, the kill switch (asks before turning off) and the purge (bumps `cache_epoch`, showing how many times it has run). The kill switch is also above the sources.
- **The settings now do something:** the banner (empty English hides it) renders under Parda's top mask on every page, read by the layout's loader (`getPardaBanner`, a catalogue function that needs no TMDB); `languages` decides `{lang}`: the page's language when listed, else the first listed (`playerLanguage`).
- **Permissions:** reading any of these pages is `parda:read`; sources and settings are changed with `parda:configure`, takedowns and reports with `parda:moderate`.

**Why:** PLAN Task 65 and 12.5 ("Admin"), the CRUD standard (0173) and the legal controls of 12.2.

**Deviations from PLAN Task 65:**
- **No seeded disabled rows:** the seed is Servers 1 to 4, enabled (0228); the measured players were never seeded.
- **"Its old `pd_play` rows remain with a null source"** is a PGlite test, not an e2e step: the flow's source is an https origin that doesn't exist (so its frame-src entry can be checked), and nothing plays from it.
- **Takedowns leave rails, title pages and the sitemap** today; search and discover arrive with Task 66, through the same `catalog/service.ts`.
- **`source_order` (auto or manual) is Task 65a's,** with the measurement columns.

**Found on the way:** a unique violation inside a transaction crashed the e2e harness's PGlite socket server ("Received unexpected commandComplete message from backend"); the takedown insert avoids the failed statement altogether.

**Alternatives considered:** clearing the cache only by waiting for the TTL (an admin's change would look ignored for 30 s); a dialog for blocking a title (a page is the CRUD standard, and the palette's "Block a title" can open it); a separate kill-switch page (it belongs with the sources it stops, and the settings).

## 0238: Parda ranks its sources from viewers and a daily probe

**What:** Task 65a. Each play starts on the source most likely to play well for that viewer and title, and the admin can still pin a source or take the order into their own hands.
- **The daily rollup** (`player/stats.ts`, the second step of `GET /api/cron/parda`) reads the last 7 days of `pd_play` per source, per connection band and in all (`grouping sets`), leaving party plays out, plus the probe's runs, and writes the day's `pd_source_stat` rows with each source's score. Running it again the same day replaces the day; rollups, probes and spent failures older than 35 days are pruned. A rollup failure doesn't stop the title refresh, or the other way round.
- **The score** (`player/ranking.ts`, pure) is the plan's, with its weights unchanged: `availability × (0.4 × quality + 0.4 × smoothness + 0.2 × speed) − ads`. Quality is height ÷ 1080 capped at 1 (the plan's 0.67 and 0.44 for 720p and 480p are that ratio), unknown 0.5. With 20 plays or more, availability, smoothness and speed are the viewers'; under 20, availability is the probe's alive rate and smoothness and speed are neutral (0.5), because the runners aren't where the viewers are. With neither, no score. A `none` source is never scored. The 12.4 table, as measures, ranks Vidy first (a unit test).
- **The orders are made at each play** from the latest day's scores and the rows as they are now, not stored: pins, enabling, the admin's adaptive flag and the mode apply at once, while the scores (so the automatic order) still change only once a day. Pinned rows lead in both modes. In automatic order an unscored row keeps its seed slot and the scored rows fill the others by score (ties by seed). `slow` keeps pins first, then adaptive sources, each part in the `ok` order.
- **Exploration:** in automatic order, with no pin, and only once some source has 20 plays, 5% of plays start on a measurable source with fewer. Without the last condition every play would roll the dice on a fresh install, where no source has data, and the e2e flows (and a new site's first viewers) would start on random servers.
- **Per-title failures** (`pd_source_title_fail`): a playback that turns failed (the transaction compares the row before and after, so a repeat counts once) counts against its source on that title. A failure from someone other than the first reporter within 24 h skips the source for that title for 24 h. Who reported is a hash of the rate limiter's key (the user, or the hashed IP), kept at most 48 h; the same client failing again changes nothing, so one client can't hide a source. These failures have their own limit (10 an hour per client); past it a failure still counts in the rollup. A skipped source goes last, not away: it stays in the server menu and is tried when the rest have failed.
- **Deadlines and labels:** with 20 plays, a source's failure deadline is its p90 start + 5 s (12–30 s), else 15 s. The server menu's quality ("Server 2 · 1080p") is the admin's quality, else the probe's.
- **The admin's word wins over the probe's:** `pd_source.adaptive` is now nullable (null: the probe's) and `pd_source.quality` (a height) is new. Migration `0031_parda_ranking` turns every existing `false` into null, because `false` was the column's default, not anyone's choice; `true` stays.
- **The probe:** `GET /api/parda/probe` names each enabled source's absolute addresses for the most popular movie, series and anime in `pd_title` (anime: TV with TMDB's Animation genre, because the snapshot doesn't keep the original language), past takedowns, and nothing while playback is off. `POST` takes up to 200 strict results and drops unknown sources. Both need `Bearer PARDA_PROBE_SECRET`; without it the route is a 404. `scripts/probe-sources.ts` (`pnpm parda:probe`) plays each in real Chrome on a page it serves itself at the app's origin (so a player framed only by this app, like the placeholder, still plays), reads the longest `<video>` in every frame or else the player's position messages, takes the ladder from `#EXTM3U` responses, clicks the centre when nothing plays, and closes and counts popups. `.github/workflows/parda-probe.yml` runs it daily at 01:40 UTC, before the rollup, when the repo has the `PARDA_PROBE_URL` variable.
- **The admin:** the sources page shows each row's rank today, score (and whether it's the probe's), plays, failure rate, median start, stall seconds per minute, quality (set or probed), popups per click and last probe; CDN group and player flags moved behind the Columns menu to make room. The order's mode is a switch beside the kill switch (`setPardaSourceOrder`, audited `parda.source.order`, its own write like the kill switch). The form's adaptive flag and quality are selects whose first choice is "From the probe".

**Why:** PLAN 12.2 ("Order", "Quality") and 12.5 ("Source ranking").

**Deviations from PLAN Task 65a:**
- **Orders aren't stored,** only scores: see above. The plan's "computes the score and the `ok` and `slow` orders" is met at read time from the stored scores.
- **One client can't hide a source:** the plan asked for a rate limit; a limit alone still lets one client fail a title twice. The second failure must come from someone else.
- **Skipped sources go last** rather than leaving the order.
- **The probe hasn't run against a real provider:** Servers 1 to 4 play no video, so it measures start time and nothing else (0228). Its quality, ladder, popups and hosts wait for the provider, as the player lab's questions do. Its Actions minutes can't be checked from here: the owner checks them after the first runs.
- **The e2e flows set standings through the harness** rather than running the rollup on seeded plays (the cron would also refresh `pd_title` from fixtures that don't cover it); the rollup itself is covered on PGlite.

**Alternatives considered:** racing hidden iframes and a speed test from the browser (rejected in 12.5); storing the orders with the scores (an admin's pin or mode would wait for the next run); a per-title skip from any two failures (one client could hide a source for everyone); requiring the original language for anime in the probe (the snapshot would need a new column for one probe title).

## 0239: Parda searches and discovers through the catalogue service

**What:** Task 66. Search (an overlay and a page) and Discover, both reading TMDB through `catalog/service.ts`, so takedowns apply to them like every other list.
- **The overlay** (`features/parda/search/search-overlay.tsx`, cmdk with its own filtering off) opens from the top mask's Search, Ctrl/⌘ K or `/`. It's a `lazy()` chunk loaded on first use; the button is a link to the search page, so it works without JavaScript. Empty, it lists this browser's recent searches and recently viewed titles and people (`search/recent.ts`, localStorage, try/catch, never sent) and the home's trending rail (the same query, no new function). Typed, it asks `getPardaSuggest` after a 250 ms pause, from two letters, and lists "See all results" first, so Enter opens the page; the arrow keys move through the rest.
- **The search page** (`/app/parda/search?q=&tab=&page=`, noindex) has four tabs (all, movies, series, people: `search/multi`, `search/movie`, `search/tv`, `search/person`), 20 a page up to TMDB's 500, and for no query or nothing found, tips, a link to Discover and the trending titles. Its box is a GET form inside `<search>`; it searches on submit, not while typing, so the statistics hold what people meant to search.
- **`pd_search_stat`** (migration `0032_parda_search`): one row per UTC day and normalized query (NFKC, lower case, single spaces, 100 characters) with a count and whether the latest search found nothing. No user, profile or IP. Only the search page writes it, and only for a search really shown: its first page of all kinds, from the loader when it isn't a preload (`notePardaSearch`, which reads the answer the page just cached).
- **Discover** (`/app/parda/discover`, indexable, canonical without its filters) is a `FilterBar`: type, genres (TMDB's per type), years, a minimum score, a runtime band, original language (named on the server, 0234), a series' status, a network for series or a studio for movies (a fixed list of TMDB ids checked against its API on 2026-11-05) and sort. `?keyword=` comes from a title's keywords, named from `keyword/{id}`. The server keeps only what applies to the type (`applicableFilters`), so a stale field after switching type does nothing.
- **Sorting by score or date has a vote floor** (score 200, newest 10, oldest and title 50; a minimum score 50), and newest stops at today, or each list would open on titles nobody has seen or that aren't out.
- **Rails link to Discover:** `discoverOfRail` turns a rail's discover request into Discover's filters when it can (genre, language and keyword rails); rails with dates or other lists (trending, airing this week) have no "See all".
- **Limits:** a search without a session (the page with a query, the overlay; not the statistics' note) counts against its own per-IP limit, 150 per 5 minutes, page loads included, beside the catalogue's 300 for direct calls. Over it, the page says so in place of results (`limited`), rather than failing, and the overlay shows the same line.
- **Requests are pure** (`catalog/discover-requests.ts`, like `rails.ts`), so `pnpm tmdb:record` records exactly what the pages ask: Discover's samples, the two search samples in every tab, the first search hit's title, and the popular movie's first keyword.

**Why:** PLAN Task 66 and 12.5 ("Catalogue": takedowns in one place; "Routes": `/discover`, `/search`; "SEO": Discover indexable, search not).

**Deviations from PLAN Task 66:**
- **The kids' cap doesn't filter search or Discover yet:** no screen makes a kids' profile until Task 67, which applies the cap to every list at once.
- **About left the phone's tab bar** for Discover (the footer links it on every page), and the top mask shows About and the language only from `lg`: at 768 px seven links and the controls overflowed.
- **No 90-day prune of `pd_search_stat` yet:** Task 69 reads it and prunes it with `pd_play`.

**Found on the way:** the billboard test failed after re-recording, because a takedown brings in the sixth title and a Nepali answer can lack a backdrop the English one has; the recorder now keeps two spare billboard titles.

**Numbers:** entry 279.9 of 280 kB (278.7 before): two routes and Discover's URL contract. The next task with a route must trim route options or raise the budget, with a decision.

**Alternatives considered:** counting searches inside the page's server function (a hover preload would count, and the query cache would hide repeats unevenly); `FilterBar` for the search box (it applies after each pause in typing, which would count "sta", "star", "star w"); free-text network and studio ids (TMDB has no Nepali names for them, and a select works without JavaScript); TMDB's `with_genres` as "any of" (a pipe): "all of" is what a viewer narrowing a list expects.

## 0240: Parda's library, profiles and the kids' cap

**What:** Task 67. The library at `/app/parda/library/{list,favourites,continue,history}`, profiles at `/app/parda/profiles` (both noindex), the save buttons, the home's personal rails, and the kids' cap applied to every catalogue read.
- **Tables** (migration `0033_parda_library`): `pd_list_item` (My List is `watchlist`, ♥ is `favourite`, unique per profile, kind and title), `pd_favourite_person` (the name and portrait as TMDB gave them: people have no snapshot table), `pd_rating` (`like` or `dislike`; taking it back deletes the row), `pd_account` (the email digest, per user, never for a guest), and `pd_title.certification_checked_at`.
- **Saving a title reads it through the catalogue** (so a takedown or a kids' cap refuses it, a 404) and writes its snapshot to `pd_title` (titles in both languages, pictures, year, genres, its US certificate). My List and ♥ are named and sorted from `pd_title` with no TMDB call; the daily refresh keeps the rank and never deletes a row (0229). History names its titles through the catalogue, as Continue watching does, because watching writes no snapshot.
- **The buttons:** the `_parda` layout loads, for a session, the profile and its saved keys (`getPardaSaved`, the latest 2,000 of each kind), so every + My List, ♥ and Like renders pressed or not from the server. A press changes the keys at once, writes, then reads the library again; without a session it starts a Parda guest first (`useEnsureViewer`, as marks do). Cards take the button through a new `action` slot on `PosterCard`, a sibling of the link over the poster's corner (like Continue watching's *Remove*): shown on hover or focus for a fine pointer, always on touch and when listed.
- **History** is the progress rows by day in `APP_TIME_ZONE`, each title once a day with its episodes, 60 rows a page. Taking a day out deletes those rows, so Continue watching forgets them too; *Clear history* (confirmed) deletes every row and every `pd_continue_state`.
- **Personal rails** on the home, awaited by its loader for a session: "Because you liked …" (TMDB's recommendations for the latest liked title, else the latest ♥, minus Not for me and My List) and "New from people you love" (the eight newest favourite people's titles from the last two years and those to come, newest first, talk shows out).
- **Profiles:** at most five per owner; the default is the account's own and never a kids' one (dropping the cookie must never lift a cap). Pictures are eight drawn icons, not uploads. A kids' profile can only switch: adding, changing, deleting and locking are FORBIDDEN from it. Region is a TMDB watch region or Automatic; the players' language is one the admin lists or Automatic; autoplay is the Up next switch.
- **PIN locks:** any profile can have a four-digit PIN (scrypt, a random salt). Choosing a locked profile from another asks for it, five tries per profile in 15 minutes; a wrong PIN is a field error. The `pd_profile` cookie for a locked profile carries `id.HMAC(secret, id, pin hash)`, so knowing an id opens nothing and a new PIN ends every old cookie. Without a usable cookie a browser is on the default profile, or on the oldest unlocked one when the default is locked (so a kid who clears cookies lands on their own profile); when every profile is locked, the default. A locked profile is changed only from inside it, so another adult profile can't lift its lock.
- **Switching** sets the cookie and reloads Parda at its home: every cached list may differ for another profile (a cap, a region).
- **The kids' cap** (the profile's, else `pd_settings.kids_cap`) in `catalog/service.ts`, the one module every read goes through:
  - lists TMDB can filter are asked as discover queries with the cap's exact US certificates (`certification_country=US&certification=G|PG`; TV gets TV-Y…TV-PG for PG): discover rails, and a type's popular, trending and top rated lists (`cappedRequest`, pure, beside `rails.ts`). `certification.lte` isn't used: TMDB counts NR as below every rating, so it let unrated titles in (checked 2026-11-05);
  - everything else (trending of both types, upcoming, on the air, search, recommendations, similar, filmographies, collections) keeps only titles whose US certificate `pd_title` knows to be within the cap. An unknown certificate is out (fail closed);
  - a title over the cap, or with no US certificate, is a 404, and so are its season and credits.
- **Certificates:** the daily job's new step asks `movie/{id}/release_dates` and `tv/{id}/content_ratings` for the ranked titles never asked, then those asked over 30 days ago, 400 a run, four at a time; a failure is tried again next run. The controls cache the known certificates for 10 minutes. Saving a title writes its certificate too.
- **The cap left the cache key:** it decides which requests are made and what passes, never TMDB's answer to one, so a kids' page shares the cache with everyone's.
- **Region:** the profile's, else `x-vercel-ip-country` when TMDB has watch data for that country (`TMDB_REGIONS`, 139 on 2026-11-05, no NP), else the admin's. The catalogue now reads the default profile when there's no cookie (one query) so its region counts.
- **Players' language** (`{lang}`): the profile's when the admin lists it, else the page's rule (0237).
- **Guests:** the claim merges the guest's My List, ♥, favourite people and likes into the account's default profile (the account's row wins, a later like wins).
- **Fixtures:** the recorder also records a kids' home (each capped rail at PG); `pnpm tmdb:record --kids` adds only those files, which is what this task did (16 files) instead of re-recording all 224.

**Why:** PLAN Task 67 and 12.5 ("Kids", "Data model", "Guests").

**Deviations from PLAN Task 67:**
- **The PIN locks a profile** rather than being a kids' profile's own: a PIN on the kids' profile would keep others out of it, not the kid in it. Locking the parents' profiles is what keeps a kid in theirs.
- **No automatic "Who's watching?" on arrival:** the picker is a page linked from the account menu ("Switch profile" from two profiles); redirecting every page load to it would cost a query and a hop for everyone.
- **Without a session the library says how it starts** rather than listing the browser's own progress (Continue watching stays on the home's rail): that progress needs the catalogue's image base, which only the catalogue's pages carry.
- **The kids' home has no billboard and no Top 10 in the e2e build:** both come from the mixed trending list, filtered through `pd_title`'s certificates, which the harness never fills.
- **The digest is only the opt-in;** Task 68 sends it.

**Found on the way:** the four flows that start a guest with the first click (Task 64's "marking a season watched" among them, flaky since Task 66) clicked before hydration; they wait for the network to settle first now. The title hero's actions, four buttons longer, crushed its facts at 768 px: they sit under the title until `xl`. Seven top-mask links overflowed at 1024 px: About shows there from `xl` (the footer has it), and the links don't wrap.

**Numbers:** entry 280.8 kB (279.9 before): two routes. The budget is 285 kB (was 280): Tasks 68 to 69a add four routes, and Task 70 measures and trims.

**Alternatives considered:** a title snapshot on each list row (a second copy of `pd_title`); filtering every list through `pd_title` (the kids' rails would be nearly empty until the certificates fill in); a details call per title to check its certificate (hundreds of TMDB calls for a kids' home); `certification.lte` (lets NR in); a plain profile id in the cookie for a locked profile (anyone who saw the id could open it).

## 0241: Parda's schedule and new-episode alerts

**What:** Task 68. A daily new-episode check with alerts per profile, the bell, the home's New episodes rail, the email digest, and the schedule at `/app/parda/schedule` (noindex).
- **Following:** a profile follows a series it has in My List or ♥, or played or marked in the last six months (Continue watching's window). No Follow button: what a viewer already does says what they care about.
- **Tables** (migration `0034_parda_alerts`): `pd_follow_state`, one row per series for all profiles (the latest aired episode the check saw, the next air date, `ended`, `checked_at`), and `pd_notification` per profile (a range of one season, `episode` to `last_episode`, with the series' names, poster and backdrop as data, `read_at`, `emailed_at`; unique per profile, series, season and last episode). `pd_account.locale` holds the digest's language, the page's when it was chosen.
- **The check** (`notify/check.ts`, the daily job's fourth step): every followed series not taken down is asked `tv/{id}` in English with no appends, once a day (20 h since the last check), or once a week when TMDB says it ended or no longer has it; at most 1,500 a run, the longest unchecked first. Seven at a time, each batch at least 200 ms, so under 35 requests a second (TMDB allows about 40, PLAN 12.4). Ten failures in a row is TMDB down: the run stops and the rest wait a day.
- **What's new** (`notify/rules.ts`, pure): the first check only records where a series is, so following a long-running series alerts nothing. After that, when the latest aired episode is past what the check saw, the range is the rest of that season, or a new season from its first episode, so a whole season dropped at once is one alert. Specials (season 0) and episodes that aired over 14 days ago (a gap in checking, or TMDB filling in old data) aren't news.
- **Who's told:** every profile following the series at that moment, in the transaction that moves the state, minus a profile that already finished the range's last episode and a kids' profile whose cap `pd_title`'s certificate doesn't allow (unknown is out, as everywhere, 0240). Takedowns stop the check asking at all; the bell and the rail hide a blocked series' alerts.
- **The digest** runs after the check's transactions committed (as 0214): one email per account that chose it (`pd_account.digest`, never a guest), with the unread alerts of all its profiles from the last week, a series once, in the account's language. Rows are claimed (`emailed_at`) before the send, a failed send hands them back for tomorrow, and read alerts are claimed without a line. The email links each series' first new episode on the watch page, the schedule, and the profiles page to stop it. Template `parda-digest` in `parda-emails.tsx`, a layer file.
- **The bell** sits in the top mask for a session, between the theme and the account; the layout loads its alerts (the latest 30 and the unread count) beside the profile and its saved keys, so the count renders with the page. Opening it marks every alert read and keeps the dots on what was new until it closes. An alert opens the watch page at its first new episode; the bell's footer leads to the schedule.
- **New episodes** on the home: each series once, from its latest alert of the last 30 days, until the profile finishes that alert's last episode. It's part of `getPardaForYou`, which the home's loader already awaits for a session, so it costs no new function.
- **The schedule:** the profile's followed series (the 60 most recently active) for the 14 days from today, from each series' details (its next episode) and that season's dates (both cached a day, through the catalogue service), plus anime airing in the 7 days from today: TMDB's discover list of anime with an air date in the week (20 most popular), each placed by its details' latest or next episode. By day, followed series first by title, then anime; an episode in both shows once. Days with nothing on are left out.
- **Today is the viewer's:** Vercel's `x-vercel-ip-timezone`, when it names a real zone, else `APP_TIME_ZONE`. Air dates are the airing country's dates as TMDB gives them; without a time there's nothing to convert.
- **Links:** the schedule is in the account menu, the bell's footer and Parda's footer (a visitor reaches it too: anime is for everyone), not the top mask, which is full (0240).

**Why:** PLAN Task 68 and 12.5 ("Data model": `pd_follow_state`, `pd_notification`).

**Deviations from PLAN Task 68:**
- **"Followed" is defined here** (the plan didn't): My List, ♥ or recent watching, with no Follow button.
- **The state is per series, not per profile:** one TMDB call per series however many follow it, and the first check's baseline is the series', so a profile that follows later is told from then on.
- **The schedule reads TMDB through the cache at page load** rather than from `pd_follow_state`: a series followed today shows today, and takedowns and caps apply as on every page.
- **The schedule's anime list shares its recording** with the anime hub's "Airing today" (fixture names drop date values); the details of the week's titles aren't recorded, so the e2e schedule has no anime. The PGlite tests patch the airing data they need.

**Numbers:** see PLAN Task 68.

**Alternatives considered:** a state per profile and series (a TMDB call per follower, and a first-check baseline per profile); TMDB's `tv/on_the_air` for anime (every country's series, and no day); TMDB's changes feed (it says a series changed, not that an episode aired, and still needs the details); a browser time-zone cookie (the first page would still need a zone, and a reload once it's set); an instant email per alert (the daily check makes them all at once anyway, so the digest is the instant email).

## 0242: Parda's admin II: overview, curation and layout

**What:** Task 69. `/admin/parda` (the overview), `/billboard`, `/collections` and `/layout`, each server function `requirePermission` → `withServices`, read with `parda:read`, changed with `parda:curate`, every write audited (`parda.billboard.*`, `parda.collection.*`, `parda.layout.update`). Curated collections at `/app/parda/c/$slug`. Tables `pd_billboard`, `pd_collection`, `pd_collection_item`, `pd_rail`, `pd_daily_stat` and the column `pd_play.viewer_key` (migration `0035_parda_curation`).
- **Read through the controls:** slots, collections and rails are one more entry in the controls' 30 s cache (`controls.curation`, `src/server/parda/curation.ts`), cleared by every write, so a page's read adds no query. That module holds the pure rules and imports nothing from the catalogue, which would be a cycle.
- **Curated titles go through `titleDetails`:** takedowns and kids' caps apply with no code of their own, and a blocked title drops out of a slot, a rail and a page by itself.
- **A title is read when it's chosen,** on the server, and its snapshot kept in `pd_title`: a forged or blocked ref is refused on its field, and admin lists name their titles without TMDB. It happens before the audited transaction, so a TMDB call never holds one open.
- **Overview's sources:** finished days from `pd_daily_stat`, today live from `pd_play` (a morning rollup of today would be stale all day), and the range's lists from their rows, which the 90-day prune bounds and the `created_at` index serves.
- **The rollup fills in:** it recomputes every day since the last stored one, so a missed cron run loses nothing, and a repeat replaces the same rows.

**Why:** PLAN Task 69 and 12.5.

**Deviations from PLAN Task 69:**
- **Unique viewers are per day.** `pd_play` deliberately holds no user or IP (12.5, 0236), so "unique viewers" had nothing to count. `viewer_key` is an HMAC of the user or hashed IP with the UTC day: a day's viewers can be counted, and nobody can be followed from one day to the next. Different days' keys can't be compared, so 7 and 30 days show the average per day, labelled as such, not a true unique count over the period. A stable key would give that number, at the price of tracking viewers across 90 days; the owner can ask for it.
- **`pd_rail` isn't seeded.** The config is the starting state: no rows means its order, and rows that don't name a rail leave it on, last. A seed would copy the config into a migration, and a rail added in code later would stay invisible until someone added a row. A row is written only when the admin saves.
- **"Curation" is two pages,** `/billboard` and `/collections`, because each is a list with the shared `CrudListPage` (delete, export, row actions), which takes a whole page.
- **Collections also have a description,** optional and in both languages, because a page without any text gives search engines only a generated line.
- **A collection placed as a rail reads each title's details,** at most 50, cached for 24 h, because `pd_title` has no overview or score for the poster's preview.
- **Slots also belong to a page** (the home or a hub), since each has a billboard.
- **Server failure rate is a table with meters, not a chart.** The only other chart here is the daily plays. With few servers, a bar chart drew a page-wide block, and a rate means little without its plays beside it.

**Alternatives considered:** a stable hashed viewer id (see above); a client-made id in the browser (a persistent tracker needing consent, and easy to reset); a jsonb of top titles per day in `pd_daily_stat` (daily top lists can't be added up into a true 30-day top); seeding `pd_rail` in the migration (see above).

**Numbers:** see PLAN Task 69.

## 0243: Parda's watch party: Ably, and sync through commands

**What:** Task 69a. A shared link plays one title together, on a hosted realtime service, with `pd_party` and `pd_party_member` behind it (docs/guides/parda.md, "Watch party").

- **Ably, not Pusher.** Checked 2026-11-05: Ably's docs give its free package 200 concurrent connections, 200 channels, 6 million messages a month and 50 messages a second per channel; Pusher's sandbox has 100 connections and 200,000 messages a day. Pusher's client is smaller (17.6 kB gzipped against 38.2 kB for `ably/modular` as built here), but it loads only on the party's page, so that decides nothing. A room sends few messages: presence, and what people press.
- **Sync through commands only.** No player reports buffering or takes a speed, and a page can't reach inside another origin's frame. Full sync is for sources that obey commands. Every other source starts together and runs on its own, with no pause on buffering, and the page says so and offers a source that can.
- **An Ably JWT, no server SDK.** Ably documents the format, an HMAC is a few lines, and the SDK would be a large server dependency for one signature. The e2e relay checks the same token, so the path from the function to the channel is real there.
- **A member's id in the channel is `pd_party_member.id`,** never a user id, so nobody in a room learns anyone's account.
- **The reducer is pure** (`party/sync.ts`): the rules are the hard part, and each has a unit test with no browser, clock or channel.
- **The server keeps what clients can't be trusted with:** seats, the host, ending. The channel carries everything else, and anyone in it can publish anything, so messages are parsed, the host's count only from the host, and a source is named by id from the page's own list. Pausing a room is open to everyone by design, so a member can annoy a room but can't send it anywhere.
- **Ending reaches a room through its pulse,** at most 30 s later, plus the controls' 30 s cache. It needs no server-side publish and still works with the channel down, and a 404 on the next token or pulse closes the door to a modified client too. Its player keeps running until then, as any open page does after a takedown.

**Why:** PLAN 12.2 and Task 69a.

**Deviations from PLAN Task 69a and 12.5:**
- **`pd_party_member`:** the limit of 10, the longest-present rule and an id that isn't a user id need a row per member; a seat is free once its member left or hasn't pulsed for 90 s.
- **`PARDA_REALTIME_URL`:** the plan's relay needs an address. It's for e2e only, and with it `connect-src` gains the relay instead of Ably.
- **A room starts by itself only with two or more people.** With the plan's "once all are", a host alone would start at their own *Ready*, before anyone arrived.
- **A party starts where the host is** on the watch page.
- **`pardaHead`, not `privateHead()`,** as the watch page: the layout already makes it noindex.

**Not tested against the real service:** no key exists yet, so `connectAbly` and the CSP's Ably hosts haven't run. All the flows use the relay.

**Alternatives considered:** Pusher (above); a server-side publish on the kill switch (a server SDK or REST call, and it reaches only those still connected); a WebSocket server of our own (Vercel functions can't host one); user ids as client ids (they'd reach everyone in the room); a host-only control scheme (the plan has anyone control play, pause and seek).

**Numbers:** see PLAN Task 69a.

## 0244: Part 6 reviewed: what changed and what stayed

*Task 70. Supersedes 0240's "when every profile is locked, the default" (PIN locks).*

- **The security review** covered `6c5c4e5..HEAD` (Tasks 59 to 69a). `/security-review` couldn't run as written, because this clone has no `origin/HEAD` and the skill would have pasted a 125,000-line diff into one context. An agent ran the same brief instead: high-confidence, exploitable findings only.
  - **One finding, MEDIUM, fixed.** With every profile locked and no proof in the `pd_profile` cookie, the fallback handed over the locked default. Someone with the browser (a child on a shared laptop) could delete the cookie and get the adult's library and history. They could then lift the PIN: `switchProfile` and `setPin` treated "the profile you're in" as proof.
  - **The fix:**
    - **An account keeps one profile without a PIN.** `setPin` refuses to lock the last open profile, and `deleteProfile` refuses to delete it, with "One profile stays without a PIN: it's the one Parda opens when no PIN has been entered." So the fallback always has an unlocked profile to land on. A single profile with a PIN guarded nothing anyway, because the fallback opened it.
    - **`PardaViewer.opened`:** true when the profile has no PIN or the cookie proved it. Only an opened profile counts as "inside it" for `switchProfile`, `setPin`, `updateProfile` and `deleteProfile`.
    - **`browsingProfile` is null** when every profile is locked and none is proved, so the catalogue browses as a visitor's would.
  - **What's left:** rows locked before this rule, or two locks racing, can still leave every profile locked. Library reads then still land on the locked default, but its lock can't be lifted and nothing can switch into it without the PIN. Parda isn't deployed yet (its migrations haven't run on Neon), so no such rows exist.
  - **Found sound** (the agent's list): every function's guard and its order; profile and owner scoping (no client-sent profile or owner id anywhere); PIN hashing, rate limit and cookie proof; the kids' cap and takedowns from every entry point; the party's token (one channel, 30 min, renewed only with a seat), seats under a row lock, host-only actions; the probe's bearer check (constant time, 404 without it); the cron secret; source origins and templates (no way into the CSP header or `script-src`); `postMessage` origin and source checks; the placeholder player's escaping and its own CSP; TMDB paths (no SSRF) and JSON-LD escaping; redirects; the guest claim; server-only secrets and dehydrated data; the digest email.
- **The finish review** (the `impeccable-finish-reviewer` agent, against the contract, the Masking comp and 97 screenshots of the production build): "ship after fixes", eight items.
  - **Fixed:**
    - **The phone billboard's actions were under the tab bar** at 390×844, found by a viewport-only capture before the agent ran. The 2:3 screen now narrows to the height left between the top mask, the lower mask (15rem) and the tab bar, and the masks close in at the sides. At 390×844 that's a 325 px poster.
    - **The billboard offers Play and My list,** as the comp and the first viewport have it. Play goes to the watch page when a source can start the title (`isPlayable`, now in `catalog/playable.ts` and shared with the title page), and *Details* takes its place when none can. *Surprise me* stays (0235), as its icon alone on phones.
    - **The scrim:** solid only where two subtitle lines and their padding sit (4.5rem on phones, 5.5rem from `md`), then gone 2.5rem higher instead of at 10rem. The 4.5:1 test still holds.
    - **Nepali titles in a third language.** Without a Nepali translation, TMDB answers a title in its original language (モブサイコ100, Socias por accidente), not blank, so the blank check never fell back. A Nepali title (or a collection's name) now counts only when it's written in Devanagari; otherwise it's the English one (`nepaliName`).
    - **Yellow's three jobs:** rating stars, Top 10 numbers and avatar letters are ink now. On-states (a checked My list, a filled ♥, the current tab's bar, the slide indicator) keep the action colour, which is ink in light.
    - **Square corners:** the library's tabs, the poster's quick ♥ and the profile's lock badge were round.
    - **The 404's heading** is in Anek. The shared page gains `NotFound({ titleClassName })`; `NotFoundPage` stays the router's.
    - **The display title** reaches 64 px at 1280, as the contract says (it reached 58 px).
    - **"My list"** in sentence case in English.
    - **The placeholder player fits a phone's 219 px frame,** and its button is square.
  - **Kept:**
    - **The logo in the dark theme** (0235): the reviewer saw a grey box because the fixtures' pictures are placeholders. TMDB's logos are the titles' own lettering.
    - **The poster column and the actions on the title page,** and *Surprise me* (0235).
    - **Empty states** use the shared `EmptyState`, and the seek bar is the shared slider with its round thumb: shared kit, not Parda's own.
  - **Left for later (the owner's call):** the watch page's lower mask as the comp draws it, with the title at its left, the servers as plain buttons, one ad-blocker button and a full-width progress line. Today it's the Task 64 layout (0236): a server menu, the ad-blocker note under the description, and the title below the mask. That's a redesign of the player chrome and its e2e flows, not a wrap-up fix.
  - **Also left, found by the design record:** the contract's signature interaction, the masks gliding to the next picture's shape on navigation, was never built. Only the billboard's pictures cross-fade. It would need view transitions across Parda's routes.
- **The design record** is `docs/design/parda.md` (the `impeccable-documenter` agent, from the shipped code), stripped with the layer.
- **The template matrix** (CI's template job by hand, in short scratch clones with CI's env, plus `--keep-parda --keep-taskline`) failed in two rows at first. Nothing is pushed during a part, so the job hadn't run since Task 59:
  - **Stripping every layer broke `e2e/review.spec.ts`.** Biome had moved the `// @parda` marker off the line that opens `if (… "parda-curated") {` onto a line of its own, so stripping left an open brace. The block now uses `parda:start` and `parda:end`, as 0226 did for `vite.config.ts`.
  - **`--keep-parda` lost `ChartColumnIcon`,** marked `@taskline` in `admin/sections.ts`, though Parda's overview used it too. Parda's overview now has its own `ChartNoAxesColumnIcon`, marked `@parda`.
  - **`setGuestScope`** is tagged `@public`: only Parda calls it, and a project without Parda keeps it as core, like 0226's helpers.
  - Then every row passed: all layers, each `--keep-…` and `--keep-parda --keep-taskline`, with both `new:feature` runs.

**Why:** PLAN Task 70.

**Alternatives considered:** a "door" state (a viewer with no profile until a PIN is entered) instead of the one-open-profile rule. It would mean a refusal in every library function and a picker that works without a profile, so it's a larger change for a case the rule removes. Also considered: keeping *Details* on the billboard (the comp and the first viewport both have Play), and a 45% gradient for the scrim, which fails the 4.5:1 test on a white picture.

## 0245: Part 6 measured (Task 70)

Measured on the owner's Windows machine (Node 24.11, 12 threads, 11.7 GB), 2026-11-05.

- **The library's queries, on a heavy seed:** PGlite, so these are CPU and plans, not Neon's network. One profile has 400 movies and 80 series of 36 episodes over a year (3,280 rows), 1,000 titles on My list, 300 ♥ and 300 ratings. 200 other profiles hold 44,400 rows, for 47,680 progress rows and 11,300 list rows in all; `pd_title` has 4,000 titles. Each query is the repository's own SQL, captured at the driver, with `EXPLAIN ANALYZE`, best of three warm runs.

  | Read | Queries | Execution |
  | --- | --- | --- |
  | Continue watching (`recentTitles`) | 2 | 3.6 + 1.4 ms |
  | A series' rows (title and watch pages) | 2 | 0.0 + 0.1 ms |
  | My list by added, page 1 | 2 | 0.2 + 2.3 ms |
  | My list by title, page 20 | 2 | 3.3 + 2.1 ms |
  | My list, series by year | 2 | 0.4 + 0.4 ms |
  | History, page 1 / page 20 | 1 | 0.1 / 0.7 ms |
  | Saved keys (the badges), 500 | 1 | 0.3 ms |
  | Likes | 1 | 0.3 ms |

- **What the plans say:** no new index.
  - Continue watching and History start from `pd_progress_recent_idx` (profile, `updated_at`).
  - A series' rows come from `pd_progress_episode_unique`, and My list's pages from `pd_list_item_recent_idx`.
  - The list's count and its title sort read `pd_title` whole (a seq scan of 4,000 rows, under 1 ms), because a hash join is cheaper than looking up 1,000 keys at that size. On a much larger snapshot the planner moves to the primary key, which is there.
  - Ratings scan the profile's 300 rows.
- **Every page's JavaScript:** 283.5 kB gzip (budget 285; 270.5 at the end of Part 5). Parda's pages add on top of it:
  - viewer pages: profiles 196.9 kB (the form and its dialogs), Discover 85.6, the library 84.5, search 78.1, watch 72.6, a title 70.6, the schedule 64.5, a party 64.2, a person 62.8, credits and collections 61, home and hubs 60.7, sign-in 26.6, about 4.4;
  - the layout adds 51.4 kB;
  - the admin's heaviest are the collection and billboard forms, about 204 kB.
- **Lighthouse 13.6, mobile, simulated throttling,** behind a local HTTP/2 proxy with brotli, as Vercel serves pages. The harness server compresses nothing, and over HTTP/1.1 Lantern queues its 150 early requests six at a time.
  - **Scores in three runs:** the home 73, 73 and 80; a title 85, 85 and 80. Accessibility 100 on both, best practices 100 on the home and 96 on the title, SEO 100. CLS 0, FCP 1.1–1.2 s, TBT 170–430 ms.
  - **LCP 3.8–4.6 s simulated, 375 ms observed.** The billboard's or title's picture is the LCP element. For an image LCP, Lantern counts every request started before the paint: 150 of them, with 285 KB of JavaScript, 159 KB of fonts (Anek's variable width file alone is 112 KB), 54 KB of HTML and 31 KB of CSS. Taskline's landing has a text LCP and scores 968 ms on the same JavaScript.
  - **The plan's ≥ 95 isn't met.** Getting there means fewer bytes before the first paint: no Anek preload on phones (its no-shift fallback is measured, 0232), a subset of Anek, or a smaller entry. That's the owner's call.
  - **One change made here:** the hero picture is preloaded from where it renders (`preloadHero` calls `ReactDOM.preload` with `fetchPriority: "high"`). React puts it first in `<head>`, where the route `head()` link sat 78th, after 65 modulepreloads and both fonts. A browser fetches it first. Lantern's number barely moved, because it counts the same 150 requests either way.
- **`pnpm test:e2e`,** the full suite, with 0244's fixes and before the preload change: 2,598 passed and 1 flaky in 37.1 min. The flaky one was `/admin/audit` in Nepali, dark, at 1280: a CLS of 0.0224 from its table's rows on a loaded machine. It passed on retry and isn't Parda's code. After the preload change, Parda's flows passed 66 of 66 and the review of Parda's pages 396 of 396.
- **The rest:** `pnpm test` 157 files and 1,653 tests; Storybook 116 files and 552 tests. On one full run, one story (search's overlay, `ne`/dark) didn't render under load; it passes alone, as in Tasks 58 and 59. After `preloadHero`, 30 stories failed on one run: Vite found `react-dom` itself only mid-run, optimized it and reloaded the browser. `vitest.config.ts` now pre-bundles it (`STORY_DEPS`), and a run from a cleared cache passed all 552.
- **Template matrix:** see 0244.

## 0246: `PARDA_PLAYER_BASE` holds the whole prefix

**What:** The owner set `PARDA_PLAYER_BASE="https://www.parda.net/parda/api"`, and the seeded templates also began with `/parda/api`, so the player's URL repeated it. The prefix now lives only in the base. Migration 0037 turns `/parda/api/1/movie/{id}` into `/1/movie/{id}` on each row. `playerUrl` puts every relative template after the base, or after this app's `/parda/api` when the variable is unset.

**Why:** The owner wants the address in the environment and not repeated in code. The local fallback stays because `pnpm dev:offline`, the tests and a deployment without a provider still play the placeholder at that route.

**Alternatives considered:**

- A base with no path (`https://www.parda.net`): refused by the owner, and it would tie every provider to our route names.
- Removing a repeated prefix when building the URL: it hides the mismatch and keeps the prefix in every row.

## 0247: Parda switches servers only on a crash, and only in Auto

**What:** The watch page moves to the next source only when the adapter reports `failed`, the viewer is in Auto, and the row allows falling back (`autoFallback`). A source that hasn't moved by its deadline is no longer treated as failed: the viewer gets a toast that offers the next source ("Taking a while to start"). If the viewer picked the server that crashed, the pick stays: the viewer is offered the next source, and the pick is not cleared. Stuttering still only offers a switch, as before.

**Why:** The owner found the player switching servers too quickly to watch, even on a server picked by hand. A real embed often waits for a click, a pre-roll or a slow CDN without reporting a position. The deadline read that as a failure and moved on. The viewer's own choice should win over Parda's guess.

**Alternatives considered:**

- A longer deadline: it still switches away from a stream that is only slow, just later.
- Recording the deadline as a failed play for ranking: a slow start already counts through `startMs`, and calling it a failure would punish sources for pre-rolls.

## 0248: Servers 1 to 4 follow the Viduki embed contract

**What:** The owner's player API follows Viduki.net's embed contract, so a new adapter, `viduki`, reads it. The adapter takes two messages. `MEDIA_DATA` reports progress for every title the player remembers: keyed by TMDB id, and for a series by `s{season}e{episode}`. It takes the watched position and duration of the title on screen. `viduki:all-servers-failed` becomes `failed`, with `stage:status` as its reason. The adapter sends no commands and resumes from the player's own memory (`self`). It sets `infersStalls: false`: progress arrives too seldom to infer buffering from, so it records no stalls and makes no stutter offers. Migration 0038 moves Servers 1 to 4 to it, with templates `/{n}/movie/{id}?color={color}` and `/{n}/tv/{id}/{season}/{episode}?color={color}`. It changes only rows the admin hasn't edited. `{color}` defaults to Parda's action yellow (`f6d743`). Because the player obeys no commands, the watch page shows no click shield, play button or seek bar for it. The bar keeps full screen and theater mode and gains picture-in-picture. The K shortcut is listed only for a player that obeys commands. A watch party on it runs in "together" mode.

**Picture-in-picture:** a page can't put a cross-origin frame's `<video>` in picture-in-picture, so the button opens a Document Picture-in-Picture window and renders the frame there. This works in Chromium on a computer. Elsewhere the button stays, disabled, so the bar never changes size. Moving a frame between documents reloads it. A `param` player gets the current position as `{start}`. A Viduki player resumes from its own memory, as on any reload.

**The placeholder** now speaks the Viduki contract by default and the `parda` protocol on `?protocol=parda`. The e2e harness switches its Servers 1 to 4 to `parda`, so the flows still test the shield, commands, resume by `{start}` and a party that pauses together. It adds a disabled "Viduki" row that the player lab flow loads.

**Why:** The owner asked for working controls only. Viduki documents no resume parameter, language parameter or command. The `parda` protocol stays: any provider that obeys commands still gets Parda's controls.

**Alternatives considered:**

- Keeping the seek bar and play button: they would do nothing on this player.
- A `<video>` picture-in-picture call: a page can't reach a cross-origin frame's video.
- Removing the `parda` protocol, the shield and party sync: a provider that does obey commands would need them all again.

## 0249: Parda's billboard fills the first screen, names no provider, and has its own account page

**What:**

- **The billboard from `lg`** is exactly the first screen under the top mask: the frame is `100svh - 3.75rem` (at least 32rem), the lower mask keeps its height, and the picture takes the rest, cover-fit. Phones keep the poster and `md` keeps 2.39:1. The title, facts and actions stay in the lower mask, under the picture.
- **Slides move faster:** every 6 s (was 8 s), and every 4 s on phones. The pause button, the hold on a resting mouse or focus, and reduced motion are unchanged (WCAG 2.2.2).
- **No catalogue provider is named:** TMDB's logo (`public/parda/tmdb.svg`, deleted) and notice left the footer and the notice page, the title and person pages lost their TMDB link, and every message that said "TMDB" now says Parda or "the catalogue". The footer shows Parda's wordmark. Code, env names (`TMDB_READ_TOKEN`) and the server's `tmdb/` modules keep their names.
- **`/app/parda/account`:** the shared account page's sections in Parda's frame. `AccountPage` now composes `AccountSections`, which a product can reuse; `AccountSection` draws a card unless `AccountSectionFrameProvider` gives it another frame. Parda's frame has no card: a rule, and from `lg` the title beside the form. The heading sits in the mask like a title's. A visitor goes to Parda's sign-in, a guest to its sign-up, the email-change link returns here, and the account menu links here.
- Native checkboxes, radios and ranges take Parda's action colour (`accent-color`).

**Why:** The owner asked for all four (2026-11-07). The billboard left the rails below the fold at 1440 × 900 with a band of page under it; one screen exactly reads as one picture. The owner first asked for the text on the picture, then chose this instead, because text on a picture breaks Masking's thesis (decision 0232). Parda is for the owner's own use, so the attribution TMDB's terms ask of a public product isn't shown: re-add it before Parda is offered to anyone else.

**Alternatives considered:**

- Text over the picture from `lg` (a shade and on-picture tokens): built, then dropped for the reason above.
- Copying the account forms into Parda: two copies to keep in step; the frame context reuses them.
- Linking the account menu to `/account` (as before): the visitor left Parda's look for the admin's.

## 0250: A resting mouse holds the billboard only over its lower mask

**What:** The billboard's hold on a resting mouse (`onPointerEnter`/`onPointerLeave`, mouse only) moved from the whole section to its lower mask: the title, facts, actions and dots. Focus inside the billboard still holds it, and the pause button, the hidden tab and reduced motion are unchanged.

**Why:** From `lg` the billboard is the whole first screen under the top mask (0249), so wherever a visitor left the cursor it was over the billboard, and the slides never moved: the owner reported them "not playing" (2026-11-07). WCAG 2.2.2 asks for a way to pause, which the visible button gives; a hover hold is a courtesy for someone reaching for the controls, and the lower mask is where they are.

**Alternatives considered:**

- Dropping the hover hold: a visitor moving to Play or the dots could see the slide change under the cursor.
- Holding only from `md` down, or over the picture's centre: harder to explain, and the screen's size still decides where the cursor rests.

## 0251: The database pool listens for dropped idle connections

**What:** `src/server/db/client.ts` adds an `error` listener to the `pg` `Pool` when it creates it, logging `warn` "db idle connection dropped" with the error's message. Nothing else changes: the pool has already removed the broken client, and the next query opens a new connection.

**Why:** `pnpm dev` showed `read ECONNRESET at TCP.onStreamRead` in the Vite overlay (2026-11-07). Reproduced with the same pool settings against the dev Neon database: a connection left idle was reset by the server after 402 s (`ECONNRESET`), and a query afterwards succeeded. Dev keeps idle connections up to 5 min (`idleTimeoutMillis: 300_000`), as long as Neon's compute stays awake after the last query, so a suspend can drop them first. A pool emits `error` for an idle client that fails; with no listener, Node treats that as an uncaught exception. The listener is added inside `createPool`, so the pool reused across hot reloads gets exactly one.

**Alternatives considered:**

- A shorter dev idle timeout: fewer resets, not none (network blips still drop connections), and every request after a pause pays a new TLS handshake.
- Neon's pooled (`-pooler`) host in dev: 0015 assumes it; worth doing, but it changes where connections end, not whether one can drop.

## 0252: The Vercel deployment opens on Parda

**What:** On a Vercel build (`VERCEL=1`, set by Vercel at build time), Nitro `routeRules` in `vite.config.ts` redirect `/` to `/app/parda` and `/ne` to `/ne/app/parda` with a 307. Nitro compiles them into `.vercel/output/config.json`, so Vercel answers before the function runs. The rest of the site keeps its URLs. `vercel.json` keeps only the framework and the crons.

**Why:** The owner uses Parda as the deployed app for now (2026-11-07). A `rewrites` entry in `vercel.json` (host `portfolio-ak-lime.vercel.app`, `/` to `/app/parda`) did nothing visible: Nitro writes the deployment's routing itself, and a rewrite keeps `/` in the address bar, so the router hydrates the portfolio's page even if the server rendered Parda. A redirect changes the URL, so server and client agree. 307 because it is temporary: browsers don't cache it for good.

**Alternatives considered:**

- A redirect in the portfolio's route (`beforeLoad`): it would apply in dev and e2e too, or need an env check in app code.
- Matching only the production host: every preview deployment would show the portfolio, which isn't the deployed app now.
- An env variable to turn it on: one more setting to remember; `VERCEL` already says where the build runs.

## 0253: Vercel Web Analytics renders only in Vercel builds

**What:** The root layout renders `<Analytics />` from `@vercel/analytics/react` when `import.meta.env.VITE_VERCEL_ANALYTICS === "true"`. `vite.config.ts` defines that value from `VERCEL`, which Vercel sets at build time. It needs no consent and no CSP change (observability.md, "Vercel Web Analytics").

**Why:** The component injects `/_vercel/insights/script.js`, which only Vercel serves. In dev, local production builds and e2e the request 404s, and the browser review fails any page with a console error. The `next` entry point the Vercel docs show is for Next.js; this app uses the framework-neutral React one.

**Alternatives considered:**

- Always render it: every page in the browser review would log the 404.
- A `VITE_` variable set in the Vercel dashboard: one more setting to remember; `VERCEL` already says where the build runs (as in 0252).
- Its `mode` prop: `"development"` swaps the script for a debug one from Vercel's CDN (`va.vercel-scripts.com`) that logs every event; it still loads a script.

## 0254: Chaal is a layer that connects Lichess to a session

**What:** Chaal (Part 7, PLAN 13) is a removable layer like Taskline and Parda (`"chaal"` in `LAYERS`, `SPECS.chaal`, `// @chaal` markers, a row in CI's strip matrix) at `/app/chaal`, run from `/admin/chaal`. Its permissions are `chaal:read`, `chaal:configure`, `chaal:moderate` and `chaal:curate`. Task 71 builds the foundation and one admin page, the lab (`/admin/chaal/lab`, `chaal:configure`); Chaal's own pages start with Task 73.

- **Identity:** public features need nothing. Connecting attaches one Lichess account to the session's user, a guest or a member (`ch_connection`, keyed by the user). A Lichess account belongs to one site user: connecting it from another is refused ("taken") and the new token is revoked.
- **Guests:** `CHAAL_GUEST_DATA` (section `chaal`) seeds nothing. Its claim moves the guest's connection to the account, unless the account already has one: then the account's stays, and the guest's token is revoked outside the claim's transaction (not awaited, so a network call never holds it open).
- **Feature switches:** `ch_settings.features` is a JSON object of `false` entries; a feature missing from it is on (`featureOn`). A feature added later needs no migration, and the admin's UI for them arrives with Task 79. The scopes connecting asks for are the enabled features' (`FEATURE_SCOPES`) plus `extra_scopes`.
- **Gates:** public functions start with `withChaalPublic` (an optional session, a per-IP limit for anonymous calls as Parda's); personal ones with `requireChaalUser` (a session, guests included; a blocked user is refused) then `withChaalServices`. The guard test holds `CHAAL_PUBLIC_FUNCTIONS` and `CHAAL_FUNCTIONS`, and `tests/server/chaal-access.test.ts` the matrix.
- **Errors:** two reasons join `APP_ERROR_REASONS`: `lichess-wait` (a RATE_LIMITED while Lichess's cooldown runs) and `lichess-reconnect` (a FORBIDDEN when the token is missing, revoked, expired or lacks a scope), each with its own message in `errorMessage`.

**Why:** the owner's choices (PLAN 13.2). Keying the connection by the user makes "one per user" a primary key and gives the client a lane and cooldown key before a connection row exists (the token exchange runs on `user:<id>`). The switches default to on so a fresh install works with an empty settings table, as Parda's settings do.

**Alternatives considered:**
- A surrogate id on `ch_connection`: a second unique key for the same thing, and the connect flow would have no lane key until the row exists.
- A boolean column per feature: a migration for every feature Part 7's tasks add.
- Better Auth's `genericOAuth` plugin: Lichess would become a way to sign in, which the owner didn't ask for, and its tokens would live in Better Auth's `account` table in plain text.

## 0255: One Lichess client with lanes, cooldowns and a shared cache

**What:** `createLichess(config, fetcher, deps)` (`src/server/chaal/lichess/client.ts`) is the only way to Lichess.

- **Lanes:** JSON calls run one at a time per lane and instance: `public`, and per connection `user:<id>` and `play:<id>` (moves never wait behind reads). Streams take no lane.
- **Calls:** an 8 s timeout (on a stream, for its headers only), one retry of a GET after a 5xx, `redirect: "manual"`, and every answer through a Zod schema to a lean shape (`schemas.ts`). A changed shape is `UPSTREAM_UNAVAILABLE`, logged, never passed on.
- **429:** a cooldown for the lane's key (a connection's two lanes share one): 60 s, doubled when a 429 comes within ten minutes of the last cooldown ending, at most an hour. It's stored in `ch_settings.public_cooldown_until`/`_ms` or the connection's `cooldown_until`/`_ms`, read with a 5 s TTL (`cooldown.ts`), so every instance sees it. Until it ends, calls on that key fail fast with `lichess-wait`.
- **401:** with a user's token, `LichessAuthError`; `withToken` marks the connection revoked and the UI says "Reconnect". Without a token, a plain FORBIDDEN (the explorer saying it needs one).
- **Logging and counters:** `log()` on every call with the endpoint class, status, time and lane kind, never the token; per-endpoint counters (`counters.ts`) for the lab now and `ch_api_stat` in Task 79.
- **Cache:** Parda's LRU was generic but for its key, so its core moved to `src/server/cache/lru.ts` (core, in strip-demo's `SHARED` for `parda` and `chaal`), with a `peek` for whatever it still holds. Parda's `createTmdbCache` keeps its API on top. Chaal's `createChaalCache` keys reads by endpoint, path, parameters, `cache_epoch` and, for a personal read, the user; during a cooldown or an outage a read serves the stale entry before failing. Each TTL arrives with its feature; the daily puzzle's runs to midnight UTC.
- **Fixtures:** `pnpm lichess:record` writes `tests/fixtures/lichess/` (one line per file, excluded from Biome like TMDB's), named by `lichessFixtureName` (a short hash of the parameters: a FEN is long and Windows paths aren't). `events.ndjson` is written by hand from the API's examples, with one unknown event type to prove it's dropped. `e2e/harness/lichess.ts` is a fake Lichess: the approval page, PKCE-checked token exchange, revocation, the account, the event stream, recorded reads, and test controls. Later tasks add the game stream, seeks and the rest to it.

**Why:** Lichess asks for one request at a time and a minute's pause after a 429 (PLAN 13.4). A per-instance lane is the most a serverless app can promise without a lock service; the cooldown is shared because it's the part that matters to Lichess. Keeping the token out of the client's own state (it's a request field, opened by the service) keeps "tokens exist only inside services" checkable.

**Alternatives considered:**
- A global queue in Postgres for every call: a database write per Lichess call, for a rule Lichess states per client, not per IP across instances.
- Retrying a 429 after a wait: a page would hang for a minute; failing fast and serving stale is better.
- Chaal's own cache beside Parda's: the same 60 lines twice (0215 says a pattern used twice becomes shared).

## 0256: Lichess tokens are sealed and never leave the server

**What:**
- **The vault** (`connect/vault.ts`): AES-256-GCM through WebCrypto. A sealed value is `v1.<key id>.<iv>.<ciphertext>`, the key id the first 8 characters of the key's SHA-256. `CHAAL_TOKEN_KEY` holds one key, or several separated by commas: the first seals, every one opens, so a new key goes first and the old one stays until its tokens are replaced. Each value is bound to its purpose with GCM's additional data (`chaal:token`, `chaal:oauth-state`). A token that no configured key opens marks its connection revoked.
- **OAuth** (`connect/oauth.ts`, the Nitro route `chaal-oauth.ts`): PKCE `S256` with a 43-character verifier. `GET /api/chaal/oauth/start?return=` needs a session; the state, verifier, user, return path and scopes go in a sealed `ch_oauth` cookie (HttpOnly, SameSite=Lax, `Secure` on https, `Path=/api/chaal/oauth`, 10 minutes). The callback checks the state and the user against the cookie, exchanges the code, reads `/api/account`, and saves the connection. Both routes end in a redirect to the return path with `?lichess=<result>` (`connected`, `denied`, `taken`, `blocked`, `off`, `expired`, `failed`, `no-session`). The return path must be under `/app/chaal` or `/admin/chaal` (the lab), optionally `/ne`, with no `//`, scheme, backslash or `..` (`safeReturnPath`).
- **Scopes** are stored as asked: Lichess grants all of a request or none, so `/api/token/test` isn't called.
- **Disconnect** revokes the token (`DELETE /api/token`, best effort), then deletes the row. A new connection (the same account reconnected, or another) revokes the user's earlier token.
- **The event stream** (`stream.ts`, the Nitro route `chaal-stream.ts`): our server opens `/api/stream/event` with the user's token and passes each line on as Chaal's lean event (unknown types dropped, keepalives kept, a first keepalive at once). It closes itself after `STREAM_WINDOW_MS` (270 s) with `{"type":"reconnect","afterMs":0}`, and with `afterMs: 1000` when Lichess ends it. A refusal is JSON with the status and reason.

**Why:** Lichess says tokens must never be shipped to users (PLAN 13.4), so every call with one, streams included, runs on the server. Vercel's Fluid compute stops a function after 300 s on Hobby (the default on every plan; Pro may set up to 800 s), and streamed time counts, so the route leaves 30 s spare; Lichess restates every current challenge and game when a stream opens, so a reconnect loses nothing. A sealed cookie keeps the verifier out of the URL and the database, and needs no table for half-finished flows.

**Alternatives considered:**
- Tokens in the browser (Lichess's CORS allows `Authorization`): against Lichess's rule, and any XSS would take every token.
- A table for pending OAuth flows: rows to clean up for something a cookie holds for 10 minutes.
- Server-sent events instead of ndjson: the same bytes with a different framing, and the client reads Lichess's ndjson anyway.

## 0257: What Task 71's spikes found

**What** (measured 2026-11-07 from Kathmandu; PLAN 13.4 is updated):
1. **Streams through Nitro:** in the e2e production build, the event stream's first byte arrives at once and an event pushed by the fake Lichess reaches the page while the stream stays open, so Nitro passes lines on unbuffered. On Vercel the limit is 300 s on Hobby (above); the lab's "Open the stream" times it on the deployment, which the owner runs once deployed.
2. **The engine:** `stockfish` 19.0.1 (GPL-3.0). The lite single-threaded build is `stockfish-19-lite-single.js` (28 KB) plus its `.wasm` (1.85 MB), not the 7 MB the plan guessed; the package unpacks to 205 MB, mostly the full builds, which `engine:copy` must not copy. In Chrome, a page whose CSP is ours (a nonce, `'strict-dynamic'`, `worker-src 'self'`, no `'wasm-unsafe-eval'`) ran the worker in all three set-ups: the worker's files with their own `script-src 'self' 'wasm-unsafe-eval'`, with no header at all, and with the page allowing wasm. A dedicated worker follows its own response's CSP, so **the page never needs `'wasm-unsafe-eval'`**; the worker's header is defence in depth. Depth 18 from the Ruy Lopez took about 1 s on this desktop. CDP's CPU throttling doesn't slow workers, so a mid-range phone's speed is left for Task 75 on a real phone.
3. **The explorer needs a token:** `explorer.lichess.org/masters`, `/lichess` and `/player` answer 401 without one; the spec says `OAuth2: []`, any token with no scope. Hence `LICHESS_APP_TOKEN` (a personal token with no scopes, server only) for visitors who haven't connected. The tablebase, cloud eval, the daily puzzle and the TV channels need none.
4. **Board API seeks, chat and endings:** not run. They need a real account and live opponents; Task 77 checks them through the lab against the owner's account.
5. **Public payloads:** `/api/tv/feed` and `/api/tv/{channel}/feed` send `{"t":"featured","d":{id, orientation, players[{color, user, rating, seconds}], fen}}` then `{"t":"fen","d":{fen, lm, wc, bc}}` per move. `/api/stream/game/{id}` sends the game (`id`, `variant`, `speed`, `players`…), then **every position so far** as `{fen, lm, wc, bc}` lines before the live ones. A broadcast round's stream is plain PGN (`application/x-chess-pgn`) with `[%eval]` and `[%clk]` comments. `/api/broadcast/top` has `active`, `upcoming` and `past`.
6. **CORS on public streams:** every one answers `access-control-allow-origin: *` (with `Vary: Origin`), and a preflight allows `GET` and the `Authorization` header. The browser can read TV, spectated games and broadcasts from lichess.org directly (Tasks 77 and 82 add `connect-src https://lichess.org` on Chaal's pages).

**Why recorded:** the plan left these for Task 71 to check (PLAN 13.4, "Not checked yet").

**Alternatives considered:** none; these are measurements.

## 0258: Chaal's look is "Diagram": a printed chess diagram, paper and ink, one vermilion

**What** (Task 72, 2026-11-08):
- **The direction:** the board is a printed chess diagram, with hatched dark squares in a heavy double frame and coordinates outside it. Everything around it uses the annotator's symbols (!, ?, !?, ±) in one spot colour, vermilion. Paper and ink: a warm paper ground with white plates in light; in dark, the same print reversed (an ink-black ground, not a tinted slate). **The board stays paper in both themes**, dimmed a step in dark. Rules are heavy (2px) at section heads and hairline between rows; corners are square; no cards, shadows or gradients. The contract is `.impeccable/surfaces/src-routes-chaal-route-tsx.md`; the approved comps are in `.impeccable/mocks/chaal/` (gitignored).
- **How it was chosen:** impeccable's direction round (seed `7b6902aa010a546e`) assigned "Airmail" (correspondence postcards). It dealt Bitmap specimen and Score staff as competitive challengers, plus four declined ones; our own top candidate, "Diagram", was the pick card. The owner chose Diagram from sketches of the live game screen, then approved full comps of Home, a live game, Analysis and a puzzle at 390 and 1280, in light and dark. Interview answers (owner, 2026-11-08): follow the device for light and dark, Nepal stays quiet (the name चाल and real Devanagari type only), phone and laptop weigh equally.
- **Vermilion has five jobs only:** the last move's ring, annotation symbols, the current move's underline, check, and engine arrows. The primary action is ink: ink fill with paper text in light, paper fill with ink text in dark.
- **Tokens:** `src/styles/chaal.css`, under `html[data-section="chaal"]` (`.dark` for the dark values). It redefines Graphite's tokens so the shared kit follows, squares the radius, and adds the `ch-*` utilities (`ch-display`, `ch-figures`, `ch-rule`, `ch-hairline`, `ch-sq-light`, `ch-sq-dark`, `ch-frame`) and the motion rules.
- **Board themes:** "diagram" (the default, hatched), "print" (flat greys) and "stone" (warm taupe), chosen by `data-ch-board` on the board's container (`src/features/chaal/look/board-themes.ts`). Vermilion falls under 3:1 on stone's dark square, so stone's marks are ink. A legal-move dot is ink with a paper halo, so it reads on hatching.
- **Pieces:** cburnett, the 12 original SVGs from Wikimedia Commons in `public/chaal/pieces/cburnett/`. The author offers them under GFDL 1.2+, CC BY-SA 3.0, GPL v2+ or the 3-clause BSD licence, "the license of your choice". **We use BSD 3-clause:** it is permissive and has no share-alike to carry into the app. Attribution and the licence text are in `LICENSE.txt` beside them, and the about page credits them (Task 73).
- **Sounds:** our own, synthesized by `scripts/chaal-sounds.ts` (`pnpm chaal:sounds`, deterministic): move, capture, check, start, end, low time, notify, correct, wrong. They are 22.05 kHz mono WAV, 3 to 22 kB each, in `public/chaal/sounds/`. They play only after the first interaction (Task 74).
- **Type:** Mukta 800 (Ek Type, OFL, `@fontsource/mukta`) for clocks, headings and the wordmark, in both scripts, as "Chaal Display". The Latin cut is 21 kB and the Devanagari cut 101 kB. Vertical metrics are overridden (92/28% Latin, 100/40% Devanagari; Mukta ships 1.13/0.53 em). Metric-matched fallbacks were measured in Chrome: size-adjust 91.09% on Arial Bold and 86.06% on Nirmala UI Bold. Text stays Inter and Noto Sans Devanagari. `chaalFontPreloads` preloads two files per locale in production.
- **Motion:** one ease, `cubic-bezier(0.2, 0, 0, 1)`. A piece slides in 150 ms and the interface answers in 120 ms. Only transform and opacity move, and nothing moves under reduced motion.

**Why:**
- Every chess player has learned from printed diagrams, so the board reads at once. The world lends type, palette, density and one signature move (the hatched plate and the symbols) without dressing the working screens as a book.
- Paper and ink keep the chrome quiet, so the board is the loudest thing on screen, which is the brief's "board first, quiet chrome".
- It shares nothing with Lichess's or chess.com's looks (their two-tone wood, green or blue boards on slate), as PLAN 13.6 requires.

**Alternatives considered:**
- **Airmail** (the roll): its chevron turn band was the strongest signature, but postal nostalgia reads slow on a blitz screen.
- **Score staff:** think time shown as block height is genuinely new, but its reading order is unfamiliar. It can come back as an analysis view.
- **Bitmap specimen:** no bitmap face covers Devanagari.
- **The category standard:** a dark slate app, indistinguishable from other chess sites by design.
- **Pieces under CC BY-SA 3.0,** as the plan assumed: possible, but its share-alike terms are a worse fit than BSD for files shipped inside the app.

## 0259: Chaal's shell: a frame of its own, preferences on the account or in the browser, connecting from any page

**What** (Task 73, 2026-11-08):
- **The layout:** `src/routes/_chaal/route.tsx` is a pathless layout with `CHAAL_BRAND` (`id: "chaal"`, which scopes `chaal.css`; no `defaultScheme`, so "system" follows the device; `themeColors` `#f3f2ee` and `#121211`; its own icons and manifest), `chaalFontPreloads`, noindex by default, and its own 404 (`$.tsx`). Its loader reads the status (switches, whether this visitor may connect, the admin's notice) and, for a session, the Lichess connection and the preferences, so the first paint is whole; none can fail the page.
- **The frame** (`src/features/chaal/shell/`): a 58 px top bar ruled off with a 2 px ink line (the wordmark Chaal चाल, the sections, search, language from `lg`, theme, the account), the admin's notice (`ch_settings.banner`, new; its form is Task 79's), the footer ("Powered by Lichess, not affiliated", the about page, the credits, Stockfish's source), and on phones a tab bar with "More" (a sheet: settings, about, search, language). The palette (⌘K) and the shortcuts dialog (`?`) are copied from Taskline's; layers don't import each other (0215).
- **Sections arrive with their routes** (PLAN 13.3): Home only in Task 73. Play, Analysis, Puzzles and Watch join the top bar and the tab bar with Tasks 75, 76, 80 and 82, and the home's entries grow the same way. Until then the tab bar is Home and More.
- **The account button** is a menu with a dot for the connection (PLAN 13.6, "Instant"): ink when connected, an open ring when not, a ring in the danger colour when Lichess needs a reconnect. Its label is the Lichess username, else the member's name, else "Account". The menu connects or disconnects Lichess, opens the settings, switches theme and language, and signs in or out.
- **Connecting from any page:** `useConnectLichess` starts a guest scoped to Chaal (`guest_scope=chaal`, which seeds nothing) when there is no session, then goes through `/api/chaal/oauth/start` back to the same page without its earlier `?lichess=` result. The settings page shows the result.
- **Preferences** (`ch_preference`, migration `0040_chaal_shell`): one row per user, guests included, written on the first change; no row means the defaults (`DEFAULT_CHAAL_PREFERENCES`). Board theme, pieces, sounds, volume, auto-queen, premove, confirm moves, coordinates, notation, zen. Without a session they live in `localStorage` under `chaal:preferences` (every Chaal key starts with `chaal:`, which "Delete this device's data" removes). When a session appears, the frame imports the browser's copy once (`importChaalPreferences`: a row already there wins) and forgets it. Stored values are read field by field (`readPreferences`), so a removed board theme falls back to the default without losing the rest. The guest claim moves a guest's row unless the account has its own.
- **The settings page** saves each change at once, to the account or the browser, with no Save button (one primary action per screen): board theme (three swatches drawn by `MiniBoard`), notation, coordinates, moves (auto-queen, premoves, confirm, zen), sound (on/off, volume, "Try it"), the Lichess connection (account, state, permissions, date; Connect, Reconnect, Disconnect; the result of a connect), and this device's data.
- **`MiniBoard`** (`src/features/chaal/board/`, the kit's first piece) draws a FEN's placement on the server: HTML squares rather than SVG, so the board theme's tokens (a CSS pattern for the hatching) apply as they will on the real board, the double frame, coordinates outside it, and vermilion rings on marked squares. The home's hero shows the Ruy Lopez after 3.♗b5 in the player's board theme.
- **The home, first version:** the heading, one primary action (Connect Lichess, else "Set up your board"), the diagram, and three entries (the connection, the board, about).

**Why:**
- A frame of its own, as Taskline's and Parda's, keeps Chaal removable and lets "Diagram" own the whole page.
- Preferences must work for visitors (everything public works without an account, PLAN 13.2) but follow members across devices; importing once, with the server's row winning, never overwrites another device's choices.
- Starting a guest only when someone connects keeps the guests table free of visitors who only look.

**Alternatives considered:**
- **A cookie for a visitor's board theme,** so the server draws it on the first paint: more machinery for one colour change after hydration, on a page whose layout doesn't move.
- **The four product tabs now, linking to "coming soon" pages:** dead ends; PLAN 13.3 says links arrive with their routes.
- **`MiniBoard` as SVG** (as PLAN 13.5 sketched): SVG can't take the CSS hatching pattern, so each theme would need a second drawing.

## 0260: The entry budget rises to 290 kB for Part 7's routes

**What** (Task 73): `ENTRY_BUDGET_KB` in `scripts/check-bundle.ts` goes from 285 to 290 kB. Chaal's layout and its six first routes add about 1.8 kB to every page's JavaScript (route definitions are in the entry, about 0.3 kB each, decision 0151), taking the entry built as CI builds it from 284.4 to 286.3 kB.

**Why:** PLAN 13.4 foresaw it: Part 7 adds about twenty routes. Their definitions (path, search schema, loader and head) are what's in the entry; the pages themselves are split out. The headroom covers Tasks 74–84, and Task 85 measures and trims, as Task 70 did for Part 6.

**Alternatives considered:**
- **Moving weight out of the entry now:** the only candidates are the route definitions themselves. Merging Chaal's pages into fewer routes with parameters would save a few hundred bytes and make the URLs worse.

## 0261: Chaal's game model: chess.js behind FEN functions, a flat tree, our own PGN

**What** (Task 74, 2026-11-08; `src/features/chaal/chess/`):
- **Rules** (`rules.ts`): chess.js 1.4.0 (BSD-2) for legality, SAN, FEN and the draw rules, behind functions that take and return FEN strings (`play`, `legalDests`, `isPromotion`, `checkSquare`, `gameState`, `materialBalance`, `premoveDests`, `checkFen`). Nothing outside this file holds a chess.js instance, so the tree, the board, the server and stored rows deal in plain strings.
- **A game's state** (`gameState(fen, history)`): checkmate first, then stalemate and dead material (chess.js's insufficient-material test), then FIDE 9.6's automatic draws (a position five times, 75 moves without a capture or pawn move), then the claims of 9.2 and 9.3 (three times, 50 moves) as `claim`, which the game goes on through until someone claims. Repetitions are counted over the FENs of the game's path (placement, turn, castling and en passant; chess.js names an en passant square only when a capture is legal), so a tree, not a chess.js history, is the record.
- **FEN checks** name why a FEN is refused: `kings` (not one a side), `check` (the side not to move is in check, which chess.js doesn't test), or `format`. A FEN of four fields gets "0 1".
- **The tree** (`tree.ts`): flat, nodes by id with `parent` and ordered `children` (the first is the main line), each with ply, UCI, SAN, FEN, comments, NAGs, an eval and a clock. Immutable functions: `addMove` (a move already there is reused), `playOn`, `pathTo`, `fensTo`, `lineFrom`, `mainline`, `stepFrom` (←, →, Home, End), `isMainline`, `promoteLine`, `deleteFrom`, `sizeOf`. Ids are counters, not paths.
- **PGN** (`pgn.ts`): our own reader and writer. It reads tags, the movetext with nested variations, `{}` and `;` comments, NAGs and the suffixes (`!?` → `$5`), move numbers in any spacing, `0-0`, figurines, and Lichess's `[%clk]` and `[%eval]` into the node; other commands (`[%cal]`, `[%csl]`) stay in the comment's text. It reads the first game only, refuses variants, a bad FEN, null moves and illegal moves (naming the move), and caps input at 500 KB and 2,000 moves including variations. Sticky regexes keep it linear in the text's size. The writer puts the seven tags first ("?" where unknown), numbers moves after a variation or a comment (`3... exd4`), writes NAGs as `$n`, and wraps at 80 characters; a read-write-read round trip gives the same tree and the same text.
- **Notation** (`notation.ts`): figurine SAN on screen, letters in PGN, the annotator's symbols for the NAGs Chaal shows, and the move input's reader: exact SAN first ("bxc5" is the pawn), then any case, then SAN with less in it ("ne5" for Nxe5, "nd2" when one knight can go), "ambiguous" when the text fits two moves.
- **Spoken moves** (`speech.ts`) are read from SAN alone, so a list, a stream or a PGN can be spoken without replaying: "Knight to f3, check", "घोडा f3 मा, चेक".
- **Clocks** (`clock.ts`): display (tenths under ten seconds), Lichess's speed names (start + 40 × increment), fractional controls ("½+0"), and two clocks on a monotonic time (`remaining`, `pressClock`, `flagged`).
- **Evals** (`eval.ts`): Lichess's published win-chance curve for bars and graphs, and "+0.35", "#−2".

**Why:**
- **chess.js** is the rules library PLAN 13.2 picked (BSD-2; chessops is GPL). Hiding it behind FEN functions keeps a later swap to one file and keeps class instances out of React state and query caches.
- **A flat tree** copies one or two nodes per change (React state stays cheap), is jsonb as it is (Task 75 stores analyses), and looks a node up by id without walking.
- **Our own PGN over `@mliebelt/pgn-parser`** (Apache-2.0, which PLAN 13.5 asked this task to check): its generated parser is about 600 KB unpacked and returns its own tree, which we would walk again to build ours and replay through chess.js anyway; writing PGN isn't part of it. chess.js's `loadPgn` drops variations. Ours is about 6 kB gzipped with the rest of the model, reads straight into our tree, and writes back what it reads.
- **Draws as FIDE has them:** the play tasks decide what to do with a claim (Lichess's own games are judged by Lichess); the model only says which rule applies.

**Alternatives considered:**
- **Keeping a chess.js instance per game:** its history is one line, so variations would need one instance per line, and repetition would be counted per instance.
- **Path ids** (each id the moves from the root, as Lichess's analysis has): stable without a counter, but a 2,000-move import would carry ids thousands of characters long.

## 0262: Chaal's board: our own pointer handling, a keyboard grid, HTML squares

**What** (Task 74; `src/features/chaal/board/`):
- **The board** (`board.tsx`) is controlled: it shows `fen`, and `onMove` gets a legal move already played (SAN, UCI, the FEN after). Squares are HTML on the diagram plate (`plate.tsx`, which `MiniBoard` now shares), pieces are the cburnett images positioned with transforms, and marks are layers: under the pieces the last move's ring, the selection, a dashed premove and a ring round a checked king; over them the targets (ink dots, rings on captures, each with a paper halo so it reads on hatching); then arrows and circles (SVG, vermilion for the engine and the annotator, ink for the player's own).
- **Pointer:** Pointer Events with pointer capture. A press on a movable piece selects it and shows its targets; moving 4 px starts a drag, and the piece follows the pointer; the square under the release is the target. A press elsewhere is a click: a target plays, another own piece is selected, anything else clears. The square comes from the cell pressed, or from the board's box while a drag holds the pointer. Right-drag draws an arrow and a right-click a circle when the page lets the player draw.
- **Keyboard and screen readers:** the board is one tab stop, an ARIA grid of rows and cells with `aria-activedescendant` on the cursor's square. Arrows move the cursor as the board is drawn, Enter or Space picks up and puts down, Escape puts back. Each cell names itself ("e2, White Pawn, picked up", "f3, can move here", "e8, Black King, in check"). One polite live region says what happened: a move as it arrives ("Black: Knight to f6"), a pick-up, a put-back, "Not a legal move". `MoveInput` takes typed moves, with `/` to focus it.
- **Promotion** opens a picker of four squares stacked from the promotion square, over a veil that cancels; focus starts on the queen. `autoQueen` skips it.
- **Premoves:** when only the other side may move now and the page passes `onPremove`, the player's pieces get targets by geometry (`premoveDests`); the premove shows dashed.
- **Motion:** a moved piece keeps its React key (`keyPieces` matches it to the nearest piece of its kind that left), so it slides on `ch-move`; both halves of castling slide; flipping remounts the layer so nothing slides across. Nothing moves under reduced motion.
- **Sound:** `sounds.ts` plays the move's sound when `lastMove` changes, at the page's volume, only after the visitor has interacted (`navigator.userActivation`). The settings page's "Try it" uses it too.
- **The rest of the kit:** `MoveList` (`table` for play, `strip` for a phone's live game, `tree` for analysis with comments and variations breaking into the main line's rows), `Clock` (counts down from a time taken at a monotonic moment; the side to move in ink, low time an ink block), `PlayerStrip`, `Material`, `EvalBar` (a meter; paper and ink, upright or a band), `EvalGraph` (a slider), `GameControls` with `useBoardKeys` (←/→, Home, End, `f`), `ResultBanner`, `PromotionPicker`. The shortcuts dialog lists the board's keys.

**Why:**
- **Our own pointer handling, not `@dnd-kit/react`** (PLAN 13.5 named it, copying Taskline's calendar): a board's target is pure geometry (which eighth of the box), so dnd-kit's collision detection and overlays add nothing; its keyboard sensor would duplicate the grid, and its accessibility announcements would compete with the board's live region. Pointer Events cover mouse, touch and pen in about 60 lines.
- **HTML squares, not one SVG** (PLAN 13.5 said SVG): the board themes are CSS (a pattern for the hatching, decision 0258), which SVG fills can't take; `MiniBoard` made the same choice (0259). Arrows and circles are SVG over the squares.
- **A grid with `aria-activedescendant`:** one tab stop for 64 squares; the grid keeps focus while the cursor moves, so the screen reader reads each square as it's reached.
- **`EvalGraph` is our own SVG, not Recharts** (PLAN 13.5 said Recharts, lazy): the comps draw one ink line, an even line and a vermilion mark; a chart library for that is weight with nothing to do.
- **Move buttons are named by what they show** (♘f3!), not in words: axe's label-in-name rule (WCAG 2.5.3) fails a name that doesn't contain the visible text, and speech-input users say what they see. The board speaks the move in words when it's shown.

**Alternatives considered:**
- **Roving tabindex over 64 focusable cells:** the same keyboard behaviour with 64 elements in the focus order's bookkeeping, and a focus ring that must follow drags.
- **A text input as the only keyboard path:** typing SAN is fast for players who know it, not for everyone; both are offered.
- **`OpeningName`** (PLAN 13.5's kit) waits for the explorer's names in Task 75; a skeleton for the board isn't needed, because the board renders on the server at its final size.

**Numbers** (esbuild, minified / gzipped): chess.js 36.2 / 12.8 kB; the game model 14.1 / 6.3 kB; the board kit 26.6 / 9.7 kB; the board with the model and chess.js 50.6 / 18.4 kB; everything 75.6 / 27.3 kB. None of it is in the entry or any page yet: the pages that show a board (Task 75 on) load it.

## 0263: Chaal's engine: a hashed copy of the lite build, a worker client with one search at a time, started on demand

**What** (Task 75, 2026-11-08; `src/features/chaal/engine/`, `scripts/engine-copy.ts`):
- **The files:** `stockfish` 19.0.1 (GPL-3.0) is a devDependency; `pnpm engine:copy` copies only `stockfish-19-lite-single.js` and `.wasm`, unmodified, plus `Copying.txt` as `COPYING.txt`, into `public/chaal/engine/` (gitignored). The copies are named with the first 12 hex characters of a SHA-256 over both files (`stockfish-19-lite-single.38f7c90e0576.js`), and `ENGINE_HASH` in `files.ts` must match: a different package version is refused until the constant changes. The worker finds its `.wasm` from its own name, so both share the hash.
- **When it runs:** a Vite plugin (`chaalEngine()`, `// @chaal` in `vite.config.ts`) runs the copy in its `config` hook, before `vite dev` and `vite build`, so a checkout, CI, e2e and Vercel need no extra step. It does nothing when the files are there.
- **Headers:** `/chaal/engine/**` is served `public, max-age=31536000, immutable`, with its own CSP `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'` (routeRules). Chaal's pages add `worker-src 'self'` (`buildCsp`'s new `workerOrigins`, set in the security-headers middleware for `/app/chaal`); no page gets `'wasm-unsafe-eval'` (decision 0257).
- **The client** (`engine.ts`): `createEngine({ createWorker, onProgress, hashMb })` speaks UCI over postMessage: the handshake (`uci`, `Hash`, `isready`, 30 s to answer), `analyse(fen, { multiPv, depth | movetime }, onInfo)` streaming each line's depth, multi-PV rank, score and line, `bestMove(fen, { level })` (levels 1–8 as Skill Level, a depth and a time per move, for Task 76), `stop` and `quit`. One search at a time: a new search stops the running one, waits for its `bestmove`, and replaces any waiting one, which ends `stopped`. Options are sent only when they change. Scores are turned to White's side (`uci.ts`), like every score in Chaal. The download's progress comes from stockfish.js's own `progressPort` (a `MessageChannel`).
- **On a page** (`use-engine.ts`): one engine per page, created on the first "on" (a lazy `import()`, so a page that never starts it never loads it), analysing the position shown to `ch_settings.engine.maxDepth` with its `multiPv`, flushing lines to React at most every 120 ms, paused while the tab is hidden, held back by `skip` (a cloud answer, fair play), and quit when the page goes.
- **Limits** (`limits.ts`): `ch_settings.engine` (`{ maxDepth: 22, multiPv: 3, hashMb: 16 }`, migration `0041_chaal_analysis`), sent with the status and clamped by `readEngineLimits` (depth 8–30, lines 1–5, hash 1–64 MB). Its admin form is Task 79's.

**Why:**
- **Hashed names, not the package's:** the files are served for a year without a version in the path; a name that changes with the bytes is the only safe immutable URL. Checking the hash also means an unexpected package (a compromised or bumped release) never ships silently.
- **A Vite plugin over a `prebuild` script:** `pnpm build`, `vite build` (the e2e harness), `pnpm dev` and Vercel all go through Vite's config, and `strip-demo` removes a marked line and the script without editing `package.json`'s `build`.
- **One search at a time in the client:** UCI engines answer one `go` at a time and the analysis board changes position faster than a search ends; queuing in the client keeps the page's code to "analyse this", and a replaced search can't paint its lines over the new position.
- **Download progress from the worker:** the worker fetches its own `.wasm`; prefetching it from the page to measure would download it twice when the HTTP cache misses.

**Alternatives considered:**
- **Committing the two files:** simplest, but 1.9 MB of a GPL binary in the history for every update, against PLAN 13.5's "copied, gitignored".
- **The multi-threaded build:** needs `SharedArrayBuffer`, so COOP and COEP on Chaal's pages, which would block Lichess's images and any embed. The lite single-threaded build reaches depth 18 in about a second on a desktop (0257).

**Numbers:** the client (`engine.ts` with `uci.ts` and `files.ts`, esbuild) is 3.6 kB minified, 1.7 kB gzipped, loaded only when the engine is first turned on; the worker's files are outside the bundle (28 KB and 1.85 MB, downloaded once, then cached for a year). The phone measurement PLAN 13.4 left for this task needs a real phone; it's left for the owner (PLAN Task 75, "Left for the owner").

## 0264: Chaal's analysis board: the URL is the line, Lichess's data through our server, a checked tree saved as jsonb

**What** (Task 75; `src/features/chaal/analysis/`, `src/server/chaal/analysis/`, `/app/chaal/analysis`):
- **The URL** (`url.ts`, `analysisSearch`): `fen` (only when not the usual start), `moves` (one line in UCI joined by `_`, no escaping needed), `ply` (only when not at the line's end), `orientation` (only when Black is at the bottom), or `id` (a saved analysis). The board follows into the URL with `replace` after 250 ms; a link opens the same board drawn on the server. Variations aren't in the URL: the PGN and saving keep them. A saved analysis's URL is its `id`; the share link is always the position form.
- **Lichess's data** (`server/chaal/analysis/lichess.ts`, public functions in `functions/chaal/analysis.ts`): cloud eval (`engine` switch; asked only while the engine is on and the position is 40 plies deep at most), the explorer (masters, Lichess with speeds and ratings, a player) and the tablebase (`explorer` switch), and importing a finished standard game (`analysis` switch). All go through the client's lanes and the cache with PLAN 13.5's TTLs; a position the cloud hasn't evaluated is kept an hour, a player still being indexed a minute (the shared LRU's TTL may now depend on the answer, `Ttl<T>`). The explorer needs a token: a connected user's own on their lane, else `LICHESS_APP_TOKEN` on the public lane; a token Lichess refuses falls back to the app's; with neither the answer is `{ ok: false, reason: "token" }`, never cached. A player's explorer is an ndjson stream read for at most 5 s inside the lane; its last line is the answer, marked `indexing` when it hadn't ended. Explorer games keep a valid game id only (each becomes a lichess.org link).
- **The opening's name** (`OpeningName`, the kit's last piece) is the explorer's: it's read for the position shown while the explorer's tab is open or for the first 30 plies, and the nearest named position on the path is shown.
- **The tablebase's results** are turned to the side that plays each move, with Syzygy's own kinds folded in (`syzygy-win` is a win), and DTZ and DTM shown as half-moves ("DTM 17").
- **Tree editing** (`tree.ts`): `annotate`, `toggleNag` (one move symbol of 1–6 and one position symbol of 10–19 at a time), `setComment`, `setShapes`, `promoteVariation` (one branch up; `promoteLine` makes it the main line), `deleteFrom` with an Undo toast. Arrows and circles are a node's `shapes`, read from and written to PGN's `[%cal]` and `[%csl]` (red is the vermilion "mark", the other colours ink; written back as R and G).
- **"My analyses"** (`ch_analysis`: owner, title, the tree as jsonb, start FEN, PGN tags, orientation, move count): a session is needed (saving starts a Chaal guest first, `useEnsureChaalSession`); each call acts on the caller's own rows, another's id is NOT_FOUND; 200 per player (CONFLICT beyond); the tree is checked by its Zod shape (`gameTreeSchema`: sizes, squares, NAGs) and then move by move (`verifyTree`: links, ids, each move legal with the FEN and SAN it claims, at most 2,000 moves) before it's written. The guest claim moves a guest's analyses to the account.
- **Fair play** (`live/fair-play.ts`): a store of the player's real-time games in progress (`setLiveGames`, fed by Task 77's event stream) and `useFairPlay()`. While locked, the engine is held (it resumes after), cloud eval, the explorer and the tablebase aren't asked, and `FairPlayBanner` in the frame says why on every page. Importing refuses a game still being played.

**Why:**
- **The line in the URL, not the tree:** a shared link must open the same position on the server (SEO and no-JS), and a line is short and readable; a tree with variations would need an encoding nobody reads, and saving already keeps it.
- **Lichess's data through our server, not from the browser:** the explorer needs a token (0257) that must never reach the browser, and the cache shares one answer between every visitor (masters for a week). Cloud eval and the tablebase follow for one path and one cache.
- **The user's own token for the explorer when connected:** their calls count against their own limits on their own lane, not the shared public one.
- **Checking the tree on the server:** a saved analysis must always open; a forged tree would crash the board on load, and replaying 2,000 moves costs a few milliseconds on a write.
- **The fair-play lock in the browser for now:** the event stream that knows a game is running arrives with Task 77; the store and the banner are its interface, so Task 77 only calls `setLiveGames`.

**Alternatives considered:**
- **Lichess's own opening names (lichess-org/chess-openings, CC0) bundled:** about 3,500 lines; in the page it's weight, on the server another lookup. The explorer already names the position it's asked about.
- **Path ids in the URL** (as Lichess's analysis has): see 0261; the URL carries UCI moves instead.
- **Autosaving:** quieter, but a guest session would be started by just looking at a position; saving stays an action, with "changes not saved yet" beside the board.

## 0265: Chaal's local games: played in the browser, kept where the player is, PGN checked on the server

**What** (Task 76, 2026-11-09; `src/features/chaal/local/`, `src/server/chaal/local/`, `/app/chaal/play` and `/app/chaal/local/$id`):
- **The model** (`game.ts`, pure): a `LocalGame` holds its settings (mode `engine` or `board`, the computer's level 1–8 and the player's side, or the board's layout `flip` or `tablet`; a time control or none), the moves as `{ uci, san, fen, clock }` and each side's time left. Positions and the game's state are computed (`stateOf`, the repetition rules over the whole history). Endings: the board's own (mate, stalemate, dead material, fivefold, 75 moves) end it as the move is added; resigning, a draw agreed (over the board only) or claimed (threefold, fifty moves, on the claimant's turn), and a flag. A flag is a win unless the other side can't mate (FIDE 6.9), read as most servers do: a lone king never mates, and a king with one minor piece mates only when the flagged side has more than its king. `GameEndReason` in `chess/rules.ts` names them all, and `ResultBanner` says each.
- **Takebacks:** over the board one move; against the computer back to the player's turn (the computer's first move as White can't be taken back). Each side's clock goes back to what it had after its last move left, from the moves' own clocks.
- **Clocks:** two clocks on `performance.now()` (Task 74's `ClockState`), from the first move (a side's increment is added after each of its moves, the first included), stopped by the end or "Pause". A game opened again with a clock starts paused, and "Continue" starts the side to move: offline, nobody loses time to a closed tab.
- **The computer:** Stockfish through Task 75's client, loaded when an engine game's page opens and quit when it goes, asked for `bestMove` at the game's level whenever it's its turn, with at least 350 ms before its move shows. It never shows a score or an arrow during the game; "Analyse" opens the finished game on the analysis board (`?moves=`). Fair play's lock holds it like the analysis engine.
- **Storage:** a `LocalGameRecord` is the game with its moves as PGN (seven tags, `TimeControl`, `Termination`, `[%clk]` per move) and the clocks left as a field. With a session, `ch_local_game` (migration `0042_chaal_local_game`), written 700 ms after the moves settle and at once when the game ends or the page is hidden; without one, this browser (`chaal:game:<id>`, one key per game, inside "Delete this device's data"). A failed account write falls back to the browser. The id is made in the browser (`crypto.randomUUID()`), so a game keeps it when it moves.
- **Moving to a session:** the frame imports this browser's games when a session appears (`useImportLocalGames`), and forgets the ones the server took; the guest claim moves a guest's games to the account. A player keeps the 100 most recently played games, in both places (`LOCAL_GAMES_MAX`); older ones go when a new one is written.
- **The server's checks:** every write's PGN is read move by move (`fromRecord`: one line, no variations, legal, not an unfinished game on a finished board) after its Zod shape (`localGameRecordSchema`, with the mode's fields, the result, reason and status, and the clocks agreeing). The upsert updates only the caller's own row that's still being played: another player's id is NOT_FOUND and never written over, and a finished game stays as it ended (a late write is ignored). Imports skip what doesn't read instead of failing the rest.
- **The switch:** a new feature, `local` ("games against the computer and over the board"), needs no scope; off, the hub says so and saving and importing are FORBIDDEN. It's separate from `play`, which is online play's (Lichess scopes).
- **Pages:** `/play` is indexable (the hub: the two setups and "Your games"); `/local/$id` is noindex. With a session its loader reads the game, so it renders on the server; without one the page holds a board-sized place until the browser's copy is read, and a missing game is said in that same place (the review's layout-shift check).

**Why:**
- **The browser first:** PLAN 13.2 has local games open to visitors, and starting a guest session to play the computer would create accounts for nothing. Saving moves without asking matches how a game is played (nobody presses Save between moves), unlike an analysis (0264).
- **PGN as the stored form:** it's the format every export and import already speaks, the clocks fit in `[%clk]`, and `readPgn` already checks every move; a list of UCI moves would need a second checker and a second writer.
- **The upsert's owner and status guard:** browser-made ids could collide with another player's on purpose; the guard turns that into NOT_FOUND without a read first. A finished game is history: a stale tab's write mustn't reopen it.
- **Paused on reopening:** a clock that ran while the page was closed would flag a player who only switched apps; offline there's nobody to be unfair to.
- **A switch of its own:** turning online play off (Lichess trouble, abuse) shouldn't take away the computer, which costs the server nothing.

**Alternatives considered:**
- **Keeping the game in the URL** like the analysis board: a clock and a result don't belong in a link, and a resumed game needs its clocks.
- **Saving every move at once:** a request per move on a fast game; 700 ms debounce plus a flush on hide and at the end loses nothing a player would notice.
- **Lichess's own `insufficientMaterial`-for-a-side rules in full** (bishops of one colour and the like): more code for positions that almost never meet a flag; the simple reading never calls a possible mate a draw.

**Numbers:** the hub's chunk is 18.5 kB (7.0 gzipped), the game page's 32.3 kB (12.0 gzipped) beside the board kit and chess.js it shares with the analysis board; the entry rose 0.8 kB to 287.7 kB (two route definitions and the frame's import hook, which needs neither chess.js nor the functions until a session has games to import).

## 0266: Chaal's online play: Lichess's streams through our server, one tab holding the event stream, challenges kept open by a stream

**What** (Task 77, 2026-11-09; `src/features/chaal/{live,play,game}/`, `src/server/chaal/{play,stream.ts,activity.ts}`, `/app/chaal/play` and `/app/chaal/game/$id`):
- **Three streams, one relay** (`server/chaal/stream.ts`): the event stream (Task 71), `GET /api/chaal/stream/game/{id}` (a Board API game) and `POST /api/chaal/stream/challenge` (a real-time challenge). Each maps Lichess's lines to Chaal's (`mapGameLine`, `mapChallengeLine`; unknown types and changed shapes are dropped), passes keepalives on, sends one at once, and closes before 270 s: the event and game streams with `reconnect` (at once after the window, 1 s when Lichess ended it, 2 s after a break), the challenge stream with `expired` after cancelling the challenge at Lichess, as it does when the page goes away. With the chat switch off, a game's chat lines never leave the server. The challenge route is a POST of JSON checked to come from our own pages (`Sec-Fetch-Site`, else `Origin`): Nitro routes don't run the server functions' CSRF check.
- **Reading them in the browser** (`live/reader.ts`): `keepStreaming` reconnects at once after a window, backs off from 1 s to 30 s while a stream keeps ending soon after it opened, waits a minute after a 429, stops on a refusal it can't fix (400, 401, 403, 404), and counts 20 s without a keepalive as a drop.
- **One tab holds the event stream** (`live/events-client.ts`): the tab holding the Web Lock `chaal-events` opens it and passes each event over the `chaal-events` BroadcastChannel; a later tab says hello and gets the state; when the leader closes, a waiting tab gets the lock and opens it (Lichess restates everything). Each tab's store (`live/store.ts`) marks what it holds stale on each open and drops what isn't restated by Lichess's first keepalive (or 8 s). The frame loads it with `await import()` only for a session connected for play while play is on. The store's real-time games (not correspondence) feed fair play's lock in every tab.
- **A game's first paint** (`getChaalLiveGame`): the Board API stream's first line (`gameFull`) read with the player's token, then the stream is closed. The player's side comes from the connection's Lichess id; a game they aren't in is NOT_FOUND.
- **The live game** (`game/live-game.ts`, pure): Lichess's UCI list replayed (Chess960-style castling read as standard); the player's move shown at once and kept pending until a `gameState` has it (also across an offer arriving meanwhile), rolled back when Lichess refuses it; clocks from `wtime`/`btime` at receipt, running from the second move, a pending move pressing the clock at once; one premove played when the turn comes if it's legal then; the stream stopped once the game is over. Lichess's statuses map to `GameEndReason`, which gains `left`, `cheat` and `no-start` (local games' `LocalEndReason` excludes them).
- **Challenges:** a real-time one to a player goes through the challenge stream (Lichess drops one nobody answers in 20 s unless `keepAliveStream` holds the request); a correspondence one through a function. An open link is created with the player's token and accepted at once with `?color=` as the player's side, so the link shown is the other side's. The AI's level is capped by the admin (`ch_settings.play.aiMaxLevel`), and a rated challenge is refused while rated play is off (`ch_settings.play.rated`). Only Board-legal paces: blitz or slower on Lichess's clock values, or 1/2/3/5/7/10/14 days. "Play again" starts the same AI game, or opens the hub's challenge form filled in through its URL: the Board API has no rematch.
- **Switches:** `play` refuses every function and stream route (`withToken`) and the pages say so calmly; a new feature, `chat` (no scope); `ch_settings.play` (`{ aiMaxLevel, rated }`). Their forms are Task 79's.
- **`ch_activity`** (migration `0043_chaal_play`, with `ch_settings.play`): user (`set null`), kind (`connect`, `game`, `analysis`, `puzzle`), mode (`ai`, `challenge`, `seek`, `lichess`, `local-engine`, `local-board`), `ref` (the game's or the analysis's id) and time, unique per player, kind and `ref`. Written for a connection, an AI game and an accepted challenge (by their functions), a challenge accepted on its stream, any game the event stream sees start fresh, a local game's first save and a new analysis; a failed write is logged and dropped. `/api/cron/chaal` (02:45 UTC) deletes rows older than 90 days.

**Why:**
- **Through our server:** Lichess's rule that tokens never reach users (0256) covers the game and challenge streams as much as the event stream.
- **A leader tab:** Lichess closes the previous event stream when another opens with the same token, so every tab opening its own would knock the others off every second. Web Locks and BroadcastChannel work in every current browser; a SharedWorker doesn't (Chrome on Android has none).
- **The challenge stream:** Lichess's spec says real-time challenges expire after 20 s unless `keepAliveStream` holds them, too short for a person to notice one. Re-creating it every window instead would show the opponent a new challenge every 4.5 minutes, so one that waits longer than a window ends as `expired`.
- **The first paint from the stream:** Lichess delays ongoing games' exports by 3–60 s against cheating, so the export can't give the position; the stream's first line is the game as it stands.
- **No fair-play check on the server:** Task 75 left one for this task, but cloud eval and the tablebase are public at Lichess, and the explorer takes any token, so refusing them on our proxy would protect nothing; the lock stays in the browser, fed by the event stream.
- **Activity by `ref`:** the event stream restates every game on each reconnect; a unique `ref` per player counts each once without reading first.

**Alternatives considered:**
- **Server-sent events or WebSockets:** as 0256, the same bytes framed differently; Vercel functions hold no sockets.
- **Polling `/api/account/playing` for fair play:** a call on the player's lane for each analysis request, for data that's public anyway.
- **Recording games only from the functions:** an open link's game and a correspondence challenge accepted later start without a call of ours; the event stream sees them all.
- **A Board API rematch:** there's none (the spike's question, 0257).

**Not checked against Lichess itself** (they need a real account and opponent; left for the owner): the kept-open challenge's first line (both a plain and a wrapped challenge are read), accepting one's own open challenge with `color`, and claiming a win or a draw after the opponent leaves. The fake Lichess (`e2e/harness/lichess-play.ts`) follows the spec.

**Numbers:** the entry rose 0.8 kB to 288.5 kB (a route definition and the frame's hook, which loads the tab leader, 2.0 kB, only for a player connected for play); the play hub's chunk grew to 47.9 kB (14.9 gzipped) with the online part; the game page's is 34.9 kB (12.8 gzipped) beside the board kit and chess.js.

## 0267: Chaal's quick pairing and notifications: seeks kept open by a stream, "your move" read from the games in progress, notices drawn from the event store

**What** (Task 78, 2026-11-09; `src/features/chaal/{play,live,shell}/`, `src/server/chaal/{play/service.ts,stream.ts}`, `/app/chaal/play`, the frame, `/app/chaal/game/$id` and `/app/chaal/local/$id`):
- **Quick pairing** (`play/quick-pair.tsx`, `play/use-seek.ts`): tiles for the paces the Board API may seek on (Rapid 10+0, 10+5, 15+10; Classical 30+0, 30+20; 1, 3, 7 and 14 days) and a custom clock (whole minutes 0–180, increment 0–180 s, rapid or slower: `seekLegal`), rated or casual (the admin's switch), and a rating range (any, ±100, ±200, ±400) read around the player's rating at the seek's speed from `/api/account` (`seekForm`). A seek on a clock goes through `POST /api/chaal/stream/seek`: Lichess keeps it while the request is open and closes it when someone accepts (the relay says `ended`); our window running out says `reconnect` and the page seeks again at once; Cancel or leaving closes it, which cancels it at Lichess. The game arrives on the event stream: the hook opens the first new game that hasn't moved. A correspondence seek is a function (`seekChaalCorrespondence`) that returns Lichess's id; it waits in the lobby. The tiles wait for the event stream (Lichess: open it first).
- **The games in progress** (`getChaalPlaying`, `GET /api/account/playing`, mapped like the event stream's games): the tab leader reads it once the stream settles, 1.5 s after a game starts or ends, and every minute while a correspondence game is going on, and shares it over the channel (`applyPlaying`; `readAt` per game, so time left counts down from when it was read). "My games" on the hub: the player's move first, then the least time left, with a small diagram.
- **Notices** (`live/notices.ts`, `shell/live-notices.tsx`): a bell in the top bar (challenges to answer and games on the player's move), a count on Play (top bar and tab bar), and a toast with the notify sound for a new challenge, the player's move in a correspondence game, or a correspondence game that started. They're computed from the event store before and after each change (`newNotices`): nothing while the stream restates, nor in the first state after it (a `settled` flag), and only in a visible tab.
- **Berserk** (`canBerserk`, the `berserk` action): an arena game with a clock, before the player's first move; the button goes once it's done.
- **Zen** (`shell/zen.ts`): the `zen` preference applies on a game's page (`PLAY_PAGE`, from the router's path, so it's on the first paint); `z` and a "Leave zen" button turn it on and off; the frame drops the bars, the notice and the footer, the page its controls, move lists and side column. A finished game gives the page back.
- **A phone on its side** (`land:` in `chaal.css`: landscape and at most 32rem tall; `shell/play-layout.tsx`): the board's column becomes two, the board sized by the height left under the top bar beside the strips and the controls; the tab bar hides, the top bar shows the sections, and on a game's page the notice and the fair-play banner give their height back.

**Why:**
- **A seek through a stream:** Lichess's spec keeps a real-time seek only while its request is open, and the token can't reach the browser (0256). Re-seeking after each window keeps the player in the lobby with a gap of a moment, which a seek (unlike a challenge, 0266) can afford: nobody sees it as a new invitation.
- **Reading the games in progress:** the event stream has only `gameStart`, `gameFinish` and the challenge events (spec checked 2026-11-09), so nothing says a correspondence opponent moved. One read a minute per player, only while a correspondence game is on and only from the leader, is gentle on Lichess; real-time games have their own page and stream.
- **Notices without storage:** what waits for the player is the event store's state; a bell with read and unread marks would need a table for something Lichess already holds.
- **Zen from the path, not a store set by the page:** a page's effect runs after hydration, so the bars would vanish after the first paint (layout shift); the path and a session's preference are known on the server.

**Alternatives considered:**
- **Lichess's pools or bulk pairing:** pools aren't open to the Board API; bulk pairing is for organisers.
- **A rating range in absolute numbers:** the player would need to know their rating per speed; reading it from the account takes one call per seek.
- **Polling the games list from every tab, or through React Query:** each tab would ask Lichess; the leader already shares the events.
- **A media query on width for the phone on its side:** a wide phone held sideways is 844 or 932 px wide, a tablet's width; height is what runs out.

**Not checked against Lichess itself** (left for the owner, as 0266): a seek accepted by a real opponent, the rating range's effect, `/api/account/playing` on a live account, and berserk in a real arena.

**Numbers:** the entry rose 0.1 kB to 288.6 kB (the frame's hooks; the bell and the notices are in the frame's chunk, 44.8 kB, 15.2 gzipped); the play hub's chunk grew to 65.2 kB (20.1 gzipped) with quick pairing and My games; the game page's is 36.9 kB (13.6 gzipped); the tab leader's 2.6 kB (1.2 gzipped).

## 0268: Chaal's admin: one versioned settings row with maintenance as its own switch, revoking keeps the row, call stats flushed after each call

**What** (Task 79, 2026-11-09; `src/server/chaal/admin/`, `src/features/chaal/admin/`, `src/functions/chaal-admin/`, `src/server/chaal/stats.ts`, `/admin/chaal/{settings,connections,blocks,health}`):
- **Settings:** one form over `ch_settings`, saved only from the `version` it opened at (a stale save is the form's "reload"): every feature switch with what it does and the scopes it adds, guests may connect, extra scopes, quick pairing's paces (`play.quickPair`: all, clocks, correspondence or off), the AI's highest level, rated play, players' defaults (new `defaults`: board, pieces, sound), the engine's limits, the banner and the maintenance message (both languages). The switches store only those that are off. The purge (the cache epoch) and maintenance are separate writes.
- **Maintenance** (new `maintenance`, `maintenance_message`): `withToken` refuses first (`requireNoMaintenance`), `connectRefusal` says `off`, and the status reports connect off, `play` and `chat` off, and the message, which the frame shows above the banner (a default sentence when it's empty). Public reads, analysis, the engine and local games go on.
- **Connections:** the CRUD list (site user, Lichess account, state, scopes, dates; filters, search, CSV). Revoke ends the token at Lichess (best effort, outside the transaction) and sets `revoked_at`; the row stays.
- **Blocks:** by Lichess username or by a site user's email, with a reason, in a dialog loaded on demand (from the blocks list, or a connection's "Block this account", filled in); blocking revokes the connection it names; deleting a block lets them connect again.
- **Health:** `ch_api_stat` (hourly counts per endpoint class) and `ch_api_error` (the last 500 failed calls: endpoint, status, time, lane kind), the cooldowns running now, and "Test Lichess" (the daily puzzle through the public lane, past the cache).
- **Also:** `/admin/chaal` redirects to the settings (not the lab) until the overview (Task 84): every admin can read the settings, only `chaal:configure` the lab. `SegmentNav` moved from Parda's admin to `src/components/navigation` (now used twice). The lab stays: connecting and timing the stream on a deployment has no other home.

**Why:**
- **Maintenance pauses the token, not the site:** Chaal's own pages, analysis and local games don't depend on Lichess's goodwill; what can go wrong during an incident (on Lichess's side or ours) is what acts for a player there. One check in `withToken` covers every function and stream, since all of them go through it.
- **Maintenance and the purge outside the form:** an admin flipping maintenance in an incident mustn't hit "changed since loaded" from a form someone else left open, nor save that form's other fields by accident (Parda's kill switch, 0237).
- **Only the switches that are off are stored:** the rule from 0254 (a feature added later starts on) holds after an admin saves.
- **Revoking keeps the row:** the player sees "Reconnect" (the state Lichess's own 401 leaves) instead of a connection that silently vanished; reconnecting replaces the row, and a block keeps them from it.
- **A block revokes:** blocks were checked only when connecting, so a player already connected kept playing.
- **Stats flushed after each call, one flush at a time:** Vercel's instances are short-lived and many, so in-memory counters alone (the lab's) see one instance; a write per call would double Chaal's database traffic under load. Coalescing turns a burst into a few upserts, and `waitUntil` keeps the answer from waiting. Losing a batch to a failed write costs a few counts on a health view, nothing more.
- **No user, token or URL in `ch_api_error`:** the endpoint class, status, time and lane kind are enough to see what fails; anything more would be personal data in a table that admins browse.

**Alternatives considered:**
- **Maintenance as a full-page notice:** it would take down what keeps working without Lichess.
- **Flushing from the daily job or on a timer:** the job runs on another instance, which never saw the counts; a timer keeps a function alive (and billed) for nothing.
- **Deleting a revoked connection:** the player would see "Connect" with no hint of why.
- **Blocks as a page of their own in the sidebar:** they're about the same people as connections; two tabs keep the admin's list short.
- **A route for the block form** (`/admin/chaal/blocks/new`, as Parda's takedowns): each route definition is in every page's JavaScript (0217), and Task 79's five took the entry to 290.1 kB, over the 290 kB budget (0260). The form is three fields; a dialog does it in place. For the same reason the blocks list has no layout route of its own, and the palette has no "Block a player" command (a command links to a page).

**Numbers:** see PLAN Task 79's summary.

## 0269: Chaal's puzzles: Lichess's puzzles replayed from their PGN, a trainer of our own, attempts kept where the player is and posted to Lichess in batches

**What** (Task 80, 2026-11-09; `src/features/chaal/puzzles/`, `src/server/chaal/puzzles/service.ts`, `src/functions/chaal/{puzzles,puzzle-attempts}.ts`, `/app/chaal/puzzles` and `/app/chaal/puzzles/$id`, the fake Lichess's `e2e/harness/lichess-puzzles.ts`):
- **The puzzle** (`puzzleAnswer` in `lichess/schemas.ts`): Lichess's game PGN ends where the puzzle starts, so the server replays it to get the position before the opponent's last move and that move, and checks that the solution plays out from there. A batch's puzzles carry no FEN (the daily one does, and they agree); one that doesn't replay is dropped, not the batch.
- **The trainer** (`trainer.ts`, pure; `use-trainer.ts` adds the timing): the board opens one move early and plays the opponent's move; the player's right moves bring the replies; a wrong move shows, then goes back for another try; any checkmate solves it (as on Lichess); a hint rings the piece to move; the solution plays a move at a time. The first miss, hint or solution makes the attempt a loss (recorded at once, so leaving doesn't lose it); a clean solve is a win. Afterwards: the puzzle's rating and plays, its themes (our own names, linking to training on them), the game it came from, Analyse (the line from before the opponent's move) and "Open on Lichess".
- **Choosing** (`?mode=train&theme=&difficulty=&color=`): Lichess's theme keys (`angles.ts`) with our own names in both languages (`themes.ts`: 72 themes in seven groups, PLAN 13.6), Lichess's five difficulties, and a side. Each choice is a URL.
- **Batches and the queue** (`use-queue.ts`): the page is drawn with the first batch (the admin's `ahead`, 15 by default); when fewer than five are left ahead, the next is asked for. Lichess picks colours itself for more than one puzzle, so a side asks for twice as many and keeps that side's. A visitor's batches are anyone's, on the public lane, cached by the page's `round` (ten minutes for the first, so first paints don't each ask Lichess; a minute after). A player connected with the puzzle scopes gets their own (unseen, at their rating, with their Lichess puzzle rating), never cached; the streak's are always anyone's.
- **The streak** (`?mode=streak`, our own): `mix` puzzles, easiest first and a difficulty harder every five solved, the next difficulty read two puzzles before it's needed; no hints; one miss ends it (the solution shows). The best streak is the highest `streak` among the player's attempts.
- **Attempts** (`ch_puzzle_attempt`, migration `0045_chaal_puzzles`): with a session (guests too) on the account, else in this browser (`chaal:puzzles`, the 200 latest), imported into a new session by the frame and moved by the guest claim; 1,000 per player. The id comes from the browser, so a retried write or an import is one attempt. A connected player's (not the streak's) are `pending` until posted to Lichess (`POST /api/puzzle/batch/{angle}`, under the theme they were trained on): with the next batch (one call answers both), at five waiting, or before the progress panel reads Lichess's dashboard; each gets its rating change back. Each puzzle counts once in `ch_activity`.
- **Progress** (the panel under the choices): the last 30 days from the attempts (`progress.ts`, the same for the server's rows and the browser's: solved, the first-try share, the best streak, themes to work on, the latest five), then, connected, Lichess's dashboard (`/api/puzzle/dashboard/30`, cached per player and keyed by how many attempts were posted) with "Replay misses" per theme (`?mode=replay&theme=`, `/api/puzzle/replay/30/{theme}`; the puzzles are then read by id, the next one ahead).
- **The admin's controls:** the `puzzles` switch (every function refuses), and `ch_settings.puzzles` (`ahead` 5 to 30, `streak` on or off) on /admin/chaal/settings.

**Why:**
- **Replaying the PGN on the server:** it's the only position a batch gives, and checking the solution there means the board never meets a move it can't play.
- **Our own trainer, not Lichess's page:** Lichess's training page can't be embedded (and mustn't be imitated, PLAN 13.2); the API gives the data, and its rules (any mate wins, a miss is a loss) are simple to keep.
- **A loss recorded at the first help:** Lichess counts a puzzle once, by its first try; recording at the end would lose the attempts of players who leave mid-puzzle.
- **Visitors' batches cached by round:** a crawler or a hundred visitors opening training would each ask Lichess for a batch ("not for mass download"); a round shared for a minute or ten keeps that to a few calls, while one visitor's next batch is still a new one. Server-function calls without a session are also limited per IP (0234's rule in `chaalPublic`).
- **Posting in batches, with the next batch:** "one request at a time", and the batch call takes solutions and returns puzzles together, so one call per fifteen puzzles is the usual cost.
- **The streak never posted:** its puzzles aren't chosen at the player's rating, and Lichess's own streak isn't rated either.
- **A visitor's attempts in the browser, not a guest:** starting a guest for every visitor who tries a puzzle would fill the users table with sessions that never come back; local games (0265) already work this way.

**Alternatives considered:**
- **`/api/puzzle/next` one at a time:** a call per puzzle, and no way to post results with it.
- **The streak at the player's rating:** the batch call's difficulty is relative to the player's rating, which a visitor doesn't have; anyone's (rated at 1500) makes the same streak for everyone.
- **A row per streak run:** the attempts already say how long each run got.
- **Hints that don't count:** a hint shows which piece moves, most of the answer in a short puzzle; it would make a clean record meaningless.

**Not checked against Lichess itself** (they need a live account; left for the owner): a connected player's batch (unseen puzzles, the glicko), posting solutions and the rating changes, the dashboard and replays. Built against the spec (v2.0.178) and the fake Lichess.

## 0270: The entry budget rises to 295 kB for Tasks 80–84's routes

**What** (Task 80): `ENTRY_BUDGET_KB` in `scripts/check-bundle.ts` goes from 290 to 295 kB. Tasks 74–79 used 0260's room (289.9 kB after Task 79); the puzzles' two routes took the entry to 290.9 kB, and sharing Chaal's four identical page heads (`src/features/chaal/head.ts`) and moving the puzzles' loaders into their queries module brought it to 290.5 kB.

**Why:** PLAN 13.5 lists about ten more routes for Tasks 81–84 (players, games, TV, broadcasts, tournaments, teams, studies, curation), each definition about 0.3 kB in every page's JavaScript (0151, 0217). Part 6 raised its budget the same way mid-part (0235, 0240), and its wrap-up measured and trimmed; Task 85 does that for Part 7.

**Alternatives considered:**
- **`/puzzles?id=` instead of `/puzzles/$id`** (PLAN 13.5 allows merging into params when the budget is tight): about 0.3 kB, and a puzzle's address would need a noindex that depends on its search; the next task would be over again.
- **Trimming other layers' routes now:** that's Task 85's whole-app pass, not a puzzles change.

## 0271: Chaal's players and games: Lichess's public reads through the cache, the viewer's token only for following, a replay that shares the analysis import's read

**What** (Task 81, 2026-11-09; `src/features/chaal/players/`, `src/features/chaal/game/{game-page,replay-page,replay,load}.ts(x)`, `src/server/chaal/players/service.ts`, `src/functions/chaal/{players,follows}.ts`, `/app/chaal/players`, `/app/chaal/players/$username` and `/app/chaal/game/$id`, the fake Lichess's `e2e/harness/lichess-players.ts`):
- **Leaderboards** (`/players?perf=`, indexable): `GET /api/player/top/50/{perf}` for one rating at a time (bullet, blitz, rapid, classical, UltraBullet; Lichess keeps none for correspondence), cached an hour. Beside them, a connected viewer with the social scopes sees whom they follow (`GET /api/rel/following`, their token, never cached).
- **A player's page** (`/players/$username`, noindex: a person's page): the profile (`/api/user/{name}`) and whether they're online or playing (`/api/users/status?withGameIds=true`), both a minute, render on the server; a name Lichess doesn't know is Chaal's 404. The rating with the most games opens (`?perf=` picks another); its history (`rating-history`, thinned to 120 points for the kit's `LineChart`), its details (`perf/{perf}`: rank, percentile, highest and lowest, record, streaks, best wins) and the activity (ten minutes each), and the latest games (the first page of the games tab, the game in progress first) stream in after the profile under sized, error-bounded places. A connected viewer gets their score against the player (`/api/crosstable/{you}/{them}`, public, a minute) and, with the social scopes, Follow (`following` from `/api/user/{name}` read with their token, never cached; `POST /api/rel/{follow,unfollow}/{name}`, shown at once and put back on a refusal). Challenge fills in the play hub's challenge. A closed account shows its name only. What the player wrote (bio, location, links) is text, clipped; links are web addresses only, `rel="nofollow ugc noopener"`.
- **The games tab** (`?tab=games`): the kit's FilterBar (works without JavaScript) over the rating, side, rated or casual (`mode`), result, opponent and dates; pages by time over the ndjson export (`/api/games/user/{name}`, standard ratings only unless one is chosen, the games in progress on the first page only): "Older" carries the oldest game's time as `before`, and any filter change starts again from the newest. Lichess can't filter by result, so a result filter reads three pages' worth and keeps the matches, the next page starting after the last one shown. A page is cached a minute.
- **A game** (`/game/$id`): for a session the loader first reads it as the player's own (Task 77's Board API first line); a game they play that's still going on is the live page. Everything else is the replay, from `/game/export/{id}` with clocks, evals and the opening: the board between the players with each side's clock as it stood after every move, Lichess's judgements as the annotator's symbols in the move list (?!, ?, ??), its eval graph and each side's summary (accuracy, inaccuracies, mistakes, blunders, ACPL) when the game was analysed, the result, PGN (copy, download), Analyse (the line on the analysis board) and lichess.org. A game still being played that isn't the player's says so (spectating is Task 82); a variant links to Lichess; a game Lichess doesn't have is an answer (`null`), not an error.
- **The palette** finds players by name (`/api/player/autocomplete`, three letters or more after a pause, cached a minute) and opens a typed name; its module loads with the first search. Players sit under More and in the footer: the contract's top bar has four sections.
- **The admin's controls:** the `players` switch (every players function refuses, the pages say so) and the `social` switch (following off, the button and the list go), both already on /admin/chaal/settings; their server checks arrive now. Purging the cache (the epoch) reaches every read here.
- **The client** gains `lines(request, schema)`: a finite ndjson answer (an export, the follows) read whole inside its lane, a line that doesn't map dropped and logged.

**Why:**
- **Public reads through our server and the cache, not the browser:** the pages render on the server (golden rule 1); a profile, a leaderboard or a game is the same for everyone, so one call serves many visitors, and "one request at a time" holds on the public lane.
- **The viewer's token only for what needs it:** `following` and the follow calls are personal; everything else on the page is public, so reading it with a token would split the cache by viewer for nothing.
- **The replay shares the analysis import's read:** the same export under the same key, so opening a game and then analysing it is one call; one schema (`gameExportAnswer`) gives both shapes, since a narrower one would put a different shape in the other's cache (the daily puzzle's pitfall, Task 80). A game still being played is kept half a minute instead of a day.
- **Streaming the details:** a profile needs up to six calls one after another on the public lane; drawing the header first and streaming the rest (Parda's rails, 0236) keeps the first paint to two.
- **Paging by time:** Lichess's export has no offsets, only `until`; a cursor in the URL keeps pages shareable and the back button honest.
- **A missing game as `null`:** an error isn't dehydrated, so the browser would ask again and log a 404; an answer renders on the server and stays.

**Alternatives considered:**
- **Every rating's details at once:** six calls per profile; the chosen one's is what's read.
- **The current game from `/api/user/{name}/current-game`:** another call; the first page of games already has it, with its last position (`lastFen`).
- **Our own result filter on every page of twenty:** pages of two or three games; reading three pages' worth fills most pages.
- **Players in the top bar:** the contract's first viewport has four sections (Play, Puzzles, Analysis, Watch); More, the footer and the palette reach it.
- **Spectating an ongoing game in the replay:** that's Task 82's (the browser reads Lichess's stream).

**Not checked against Lichess itself** (they need a live account; left for the owner): `following` on a profile read with a token, follow and unfollow, the following list. Built against the spec and the fake Lichess; the public reads are recorded from Lichess (`pnpm lichess:record players`).

## 0272: Chaal's watch: the first paint from our server, what's live read by the browser from Lichess, one PGN stream per round

**What** (Task 82, 2026-11-10; `src/features/chaal/watch/`, `src/server/chaal/watch/service.ts`, `src/functions/chaal/watch.ts`, `/app/chaal/watch`, `/app/chaal/watch/$channel`, `/app/chaal/broadcasts`, `/app/chaal/broadcasts/$id`, spectating on `/app/chaal/game/$id`, `ch_settings.watch` (migration `0046_chaal_watch`), the fake Lichess's `e2e/harness/lichess-watch.ts`):
- **The TV** (`/watch`, indexable): Lichess's standard channels (top rated, bullet, blitz, rapid, classical, UltraBullet, bots, the Lichess AI; never the variants') as a grid of diagrams. The server reads `/api/tv/channels` and then **one** `POST /api/games/export/_ids?moves=false&lastFen=true` for all their games (each game's players and last position, a few seconds behind), both cached 5 s, and draws the grid. Then each card reads its channel's feed (`/api/tv/{channel}/feed`) **from the browser**, only while the card is on screen and the tab is shown. `/watch/$channel` (noindex) is one channel on the big board with both clocks, live from the same feed, moving on by itself when Lichess does; "Follow this game" opens the game's page. A channel Chaal doesn't show is its 404.
- **Spectating** (`/game/$id`): a game still being played that isn't the viewer's own is followed live instead of being said: the first paint is the replay's export (Task 81), then the browser reads `/api/stream/game/{id}` (the description, every position so far, then each new one, three moves behind as Lichess shows spectators, and the description again at the end). Restated positions are checked against the moves already shown (`cursor`), so the export being a few moves ahead takes nothing back; a different line wins from where it differs; a position that doesn't follow starts again from it. Stepping back keeps the board there while moves come in. When the game ends the result shows and the page asks for the replay until the export has the ending.
- **Broadcasts** (`/broadcasts`, indexable): Lichess's top list (`/api/broadcast/top`: live now, coming up, the past a page at a time), the official ones (`?view=official`, `/api/broadcast?nb=20`, ndjson) and a search (`?q=`, `/api/broadcast/search`), each cached five minutes. `/broadcasts/$id` (noindex) is a tournament (`/api/broadcast/{id}`), its rounds as tabs (`?round=`, else Lichess's `defaultRoundId`), a round's boards as diagrams (`/api/broadcast/-/-/{round}`) and one board followed (`?board=`: the big board, the clocks and Lichess's evals from the PGN's `[%clk]` and `[%eval]`, the moves, the result, Analyse, the PGN, lichess.org), the board's PGN from `/api/study/{round}/{board}.pgn` for the first paint. While a round isn't finished the browser reads its PGN stream (`/api/stream/broadcast/round/{id}.pgn`): every board's PGN, then a board's whole PGN each time it moves. **One stream feeds both** the grid and the followed board; a board the round didn't have is added from its tags. A round is cached 20 s while it's played and five minutes after; a tournament a minute while a round is played; a board's PGN 20 s while its result is `*`.
- **Live streamers** beside the TV (`/api/streamer/live`, a minute): name, title, the stream's title as text, the service and language, linking out (`nofollow ugc noopener`, new tab).
- **The browser's side:** the status carries `live`, LICHESS_API_BASE without its slash (lichess.org in production), and Chaal's pages add its origin to `connect-src`. `usePublicStream` keeps a stream open through `keepStreaming` (Task 77) with two new reader options: `split` and `parse` (a PGN stream gives whole games, split at the two empty lines Lichess ends each with) and a five-minute silence (ten for a round), since Lichess's public streams send **no keepalives** (a TV game went 20 s without a line when measured). A closed round stream (`closed`, new) reads the round again.
- **The admin:** `ch_settings.watch` (`{ channels, streamers }`, read through `readWatchLimits`: at least one channel, in the grid's order; the streamers' list on or off) in a Watch section of /admin/chaal/settings, audited; the `watch` switch refuses every watch function (spectating falls back to "still being played").
- **The frame:** Watch is the fourth section (the contract's top bar: Play, Puzzles, Analysis, Watch), current on the broadcasts' pages too (`also`); the palette has Watch and Broadcasts.
- **The client** sends `accept-language: en` and gains `pgn(request, maxBytes)` (a board's PGN, 500 kB at most).

**Why:**
- **The first paint from our server, the rest from the browser** (PLAN 13.5, "Public live data"): server-rendered pages (golden rule 1) read through the cache, one call for many viewers; live data from lichess.org directly means viewers don't share our server's IP limits or hold a function open, and every public stream answers `access-control-allow-origin: *` (decision 0257).
- **One export for the TV's positions:** the channels answer names games, not positions; eight feeds opened by the server, or eight exports, would be eight calls on the public lane every 5 s. The export by ids is one, and the feeds correct it within a second.
- **Feeds only on screen:** a phone shows one or two channels; opening eight streams per viewer (Lichess allows at most eight game streams per IP) for boards nobody sees would be rude. A hidden tab closes them; each feed restates its game when it opens again.
- **One PGN stream per round:** Lichess says it's "the best way to get updates about an ongoing round"; one stream keeps every board and the followed one current without polling.
- **`accept-language: en`:** Lichess names a broadcast's rounds in the language it's asked in (a recording without the header came back in Russian); one cached answer serves both of Chaal's languages, and a round's name is the broadcaster's text anyway.
- **Spectating from the replay's export, then the stream:** the page renders on the server with the moves so far, and the stream's restatement is checked rather than trusted to start over, so nothing flickers back.
- **A silence of minutes:** the event stream's 20 s (Task 77) would drop a quiet TV feed every 20 s; a dropped feed restates its state anyway.

**Alternatives considered:**
- **Live data through our stream routes:** what Task 77 does for streams that need a token; for public ones it would hold a function per viewer and share one IP's limits. Kept only as the plan's fallback if CORS ever changed.
- **One feed for the whole grid** (`/api/tv/feed`, the featured game): the grid would show one live board and seven still ones.
- **Polling the round's JSON:** every few seconds per viewer, against "no polling" in Lichess's own words; the stream is cheaper and quicker.
- **The round's whole PGN export for the followed board's first paint:** a big open's round is over a megabyte; one chapter's PGN is a few kilobytes.
- **Our own round names in Nepali:** they're the broadcaster's names, often not "Round N".

**Not checked against Lichess itself:** a round's PGN stream while a round is played (none was when recorded; built against the spec and the fake, which plays the recorded tournament's first round live), and whether Lichess closes it when a round ends. The TV feed, a game's stream and the broadcasts' answers were read from Lichess while building it.

## 0273: Chaal's community: public reads through the cache, the player's own place read with their token, joining and saving behind the admin's controls

**What** (Task 83, 2026-11-10; `src/features/chaal/events/`, `teams/`, `studies/`, `community/`, `src/server/chaal/events/`, `teams/`, `studies/`, `viewer.ts`, `src/functions/chaal/{tournaments,tournament-entry,teams,team-membership,studies,my-studies}.ts`, `/app/chaal/tournaments`, `/tournaments/$id`, `/teams`, `/teams/$id`, `/studies`, `/studies/$id`, "Save to study" on the analysis board, `ch_settings.community` (migration `0047_chaal_community`), the fake Lichess's `e2e/harness/lichess-community.ts`):
- **Arenas** (`/tournaments`, indexable): Lichess's list (`/api/tournament`, a minute), standard chess only, coming up (the default), being played (`?view=started`), finished (`?view=finished`). `/tournaments/$id` (noindex) is an arena (`/api/tournament/{id}?page=`): what it is and when, the organiser's words as text, its conditions with Lichess's verdicts, the top game while it's played (a diagram that opens the game page, which follows it live: Task 82), the podium and numbers once it's over, and the standings ten a page (`?page=`, Lichess's own paging). Cached ten seconds while it's played, a minute before, ten minutes after; read again every 10 s while the page is open and it's played.
- **Swiss** (`/tournaments/$id?kind=swiss`): reached through teams (Lichess lists Swiss tournaments by team only). `/api/swiss/{id}` and its first hundred results (`/api/swiss/{id}/results?nb=100`), cached as an arena.
- **Teams** (`/teams`, noindex): popular ones (`/api/team/all`, ten minutes) and a search (`/api/team/search`, a minute), twenty pages at most; "My teams" (`/api/team/of/{username}`, which Lichess answers only with a token). `/teams/$id` (noindex): the team's words as text, its leaders, its newest thirty members (`/api/team/{id}/users`, read only that far), its arenas and Swiss tournaments (ten of each), joining (a message for a closed team's leaders, a password for a private one) and leaving.
- **Studies** (`/studies`, noindex): an account's public studies (`?by=`, else the account the admin chose: Lichess's own), the player's own with private ones (`?view=mine`), and opening any study by its address. `/studies/$id` (noindex): the chapters and the one shown (`?chapter=`) in a viewer: the board with the author's arrows and circles, the moves with variations and comments (`MoveList`'s tree), the keys as on every board, "Analyse" (the line to the node shown), the PGN. The server reads the study's PGN **once** (`/api/study/{id}.pgn`, four megabytes at most, five minutes), splits it into chapters by their `[Event` tags (`studies/chapters.ts`: `ChapterURL` names each) and sends a page the list and the one chapter shown.
- **"Save to study"** (the analysis board's menu): the board's PGN as a new chapter of one of the player's studies (`POST /api/study/{id}/import-pgn`, `study:write`); a toast opens it.
- **The viewer** (`server/chaal/viewer.ts`, shared with players): where the viewer stands in an arena (`me`), whether they're in a team (`joined`, `requested`) and a private study are read **with their token when it may be used** (connected, not revoked, the area on, its scopes granted, not in maintenance), never cached (a study's own read is cached a minute under `owner`), and fall back to the public read when it can't; never an error of its own. Players' `usable` moved there as `canUse`.
- **The client's `lines(request, schema, max)`:** reads the first `max` lines of an ndjson answer and leaves the rest (a team of 750,000 members, an account's 459 studies).
- **The admin:** the `tournaments`, `teams` and `studies` switches (Task 71) turn an area off whole and the pages say so; `ch_settings.community` (`{ joinTournaments, joinTeams, saveToStudy, studiesBy }`, read through `readCommunityLimits`) keeps the pages and stops what changes a player's Lichess account, and chooses whose studies open the page; a Community section of /admin/chaal/settings, audited.
- **The frame:** Tournaments, Teams and Studies under More and in the palette; the three pages share a heading with the areas as tabs.

**Why:**
- **The same rule as Task 81 for personal reads:** what only a player's token can see is theirs alone, so it's never in the shared cache; a refused token is the public page, not an error page.
- **Swiss through teams:** Lichess has no list of Swiss tournaments but a team's (PLAN 13.4); the team page is where players find them.
- **A study read once and split:** a chapter's page needs the chapters' list too; one PGN read gives both, and a page carries only the chapter shown (a study can be megabytes).
- **The admin's controls beside the switches:** turning tournaments off hides Lichess's arenas from visitors too; an admin who only wants nobody joining from here (a club's rules, a cheating wave) keeps the pages.
- **Lichess's studies as the default:** Lichess has no list of public studies in its API; its own account's studies are public, curated and in many languages, and the admin can name another account. The curated list is Task 84's.
- **Standard chess only in the arenas' list:** Chaal's boards don't play variants (as the TV's channels, 0272).

**Alternatives considered:**
- **A whole-study page's PGN in the HTML:** the Olympiad puzzle pack recorded is 112 kB in 64 chapters; one chapter is a few kB.
- **Reading a Swiss tournament's whole results to find the viewer:** big ones have thousands of players; the first hundred, and "unknown" past them, is enough to offer Join or Withdraw (Lichess refuses a second join harmlessly).
- **Creating studies and tournaments here:** Lichess makes studies on its own site only (no API), and creating tournaments is out of Part 7's scope.

**Not checked against Lichess itself** (left for the owner): an arena's `me` in the answer to a token (the website's JSON has it; the API's builder is the same), joining and withdrawing, joining a team and asking to, saving to a study, and whether Lichess's Board API plays a joined arena's faster games (bullet and blitz pairings may need lichess.org). Built against the API's spec and the fake; the lists, an arena of each state, a Swiss tournament, a team and a study were read from Lichess while building it.

## 0274: Chaal's admin II: the overview from a daily rollup, curation as one page, the home in the admin's order

**What** (Task 84, 2026-11-10; `src/server/chaal/daily.ts`, `src/server/chaal/admin/{overview,curation}.ts`, `src/server/chaal/home.ts`, `src/features/chaal/home/curation.ts`, `src/features/chaal/admin/{overview,curation}/`, `src/functions/chaal-admin/{overview,curation}.ts`, `src/functions/chaal/home.ts`, `/admin/chaal`, `/admin/chaal/curation`, migration `0048_chaal_curation`):
- **The rollup:** the daily job (`cron.ts`) first rolls `ch_activity` per UTC day into `ch_daily_stat` (players as distinct users, connections, games by mode as one `jsonb`, puzzles played, analyses) with the day's solved puzzles from `ch_puzzle_attempt`, from the last stored day again (a missed run fills in, a second run replaces the day), then prunes the activity (90 days) and the call counts (30). The rollup is kept.
- **The overview** `/admin/chaal` (`?range=today|7d|30d`, `chaal:read`; it was a redirect to the settings): Lichess connections in use, active players over 7 and 30 days, the range's games, puzzles solved (of played), analyses and new connections, players a day (a line) and games a day online and local (stacked bars) over 30 days, games by mode as meters, and the API's last 24 hours from the health page's figures with a link there.
- **Curation** `/admin/chaal/curation` (`?tab=`): a tab per featured section (broadcasts, tournaments as arena or Swiss, studies, puzzle themes) and a Home tab. An item is `ch_featured`: Lichess's id (read out of the address the admin pastes; a theme from Chaal's list), an en/ne title (empty Nepali shows the English), dates in Kathmandu as Parda's billboard (0242), its place in its section. Added and changed in a dialog, dragged into order and saved as a whole section, removed after a confirm; versioned, refused twice, audited (four actions, target `chaal-featured`), the controls cleared.
- **The home** reads `getChaalHome` (public, `withChaalPublic`) through the controls' 5 s cache (`controls.curation`): the sections under the hero in `ch_home_section`'s order with their switches (no rows: the default order; a section added in code joins at the end), each featured section's items showing today (six at most), and the announcement (`ch_settings.announcement`, its own audited write). A featured section with nothing showing, or the announcement without English, isn't drawn.

**Why:**
- **Players over 7 and 30 days from the activity itself:** a sum of daily distinct counts counts a player once a day; the activity is kept 90 days, so the windows the page shows are always there. The rollup holds what outlives the prune.
- **Today live, the rest stored:** as Parda's (0242), so the page is right between runs.
- **The announcement in `ch_settings`, not a section row:** it's one value, read with the settings the home already has; its own write never makes the settings form stale (as maintenance, 0268).
- **Titles typed, not read from Lichess:** the home then needs no Lichess call to draw its sections, and a broadcast's or study's name is often long or English only; the admin writes what the home should say in both languages.
- **One curation page with tabs, dialogs for items:** the entry was 294.0 of 295 kB; Parda's three routes per list (0242) would have cost about 1 kB. The dialog is the blocks' pattern (0268).

**Alternatives considered:**
- **Checking an id against Lichess on save:** a call per save for what the link itself shows at once; a wrong id opens Chaal's own not-found message.
- **A section's items in `ch_home_section`:** featured items have their own dates and order; the sections are only order and switches.

**Not checked:** the `dataviz` validator was not run; the charts use the shared kit's Graphite palette (`--chart-1…5`), validated for Parda's overview (0242).

## 0275: Part 7 reviewed: typed moves on every board, and what the template matrix found

*Task 85.*

- **The security review** covered `72fac89..HEAD` (Tasks 71–84), high-confidence exploitable findings only. An agent couldn't run it here (auto mode can't check an Agent call that a plugin's hook rewrites), so it was done in the main session with the same brief. **No findings.** Found sound:
  - the OAuth routes: state and PKCE in a sealed HttpOnly cookie spent on the callback, the state bound to the session's user, `safeReturnPath` (no `//`, `\`, `://` or `..`);
  - the stream routes: a session first, game ids by regex, the POSTed ones same-origin (`Sec-Fetch-Site`, else `Origin`) with a 2 KB body;
  - the cron route's constant-time bearer check (404 without `CRON_SECRET`);
  - every Lichess path built from input: ids, usernames, slugs and UCI checked by regex in `z.strictObject` inputs;
  - links from Lichess data: someone else's web address passes only as http(s) (`webAddress`), everything else is built from a checked id; no `dangerouslySetInnerHTML` in Chaal (the announcement and featured titles render as text);
  - owner scoping of analyses and local games (an upsert can't take over someone else's id);
  - tokens: sealed in `ch_connection`, never selected for the admin's lists or sent to the browser.
- **The accessibility pass** is kept as e2e flows ("Chaal by keyboard only"): a whole game to mate over the board, a puzzle, and an analysis with the engine, reaching every control with Tab and playing on the grid with the arrows and Enter.
  - **It found typed moves only on the analysis board.** PLAN 13.5 asks for a move input beside the board; local games, a game on Lichess and the puzzle trainer had none. Each now has `MoveInput` under its controls, from `sm` up as on the analysis board (a phone's board is its input), enabled only when the side to move is the player's (a puzzle: while it waits for a move).
  - **NVDA wasn't run:** a screen reader needs the owner at the machine. The board's spoken moves and its live region are as Task 74 left them (0261).
- **The template matrix** (CI's template job by hand, in scratch clones of the working tree with CI's env: all layers, each `--keep-…`, and every layer kept) failed in five rows at first:
  - **Stripping Chaal left `tests/server/chaal-curation.test.ts`** (Task 84's), failing the stripped project's typecheck. It's now in strip-demo's `chaal` list, and the guide's "Adding to Chaal" says a file outside Chaal's folders goes there.
  - **`src/components/navigation/segment-nav.tsx`** (Task 79's, core) is used only by Parda and Chaal, so knip called it unused once both went. It's now in strip-demo's `SHARED` list for `parda` and `chaal`.
- **Flaky checks fixed:**
  - three community flows clicked before the page hydrated (the full run's one flaky test); with an event stream open, `networkidle` never comes, so they wait for the stream's request, which only the hydrated page makes;
  - `message-usage.test.ts` built a regular expression per message and ran each over all the source: 15.6 s against a 15 s limit with Part 7's messages. It now collects `m.<key>` once (under a second);
  - the "Arena being played" story asserted the connected player's join form with no session, so the connection was never asked for; it now has `sampleUser`.
- **The finish review** (the `impeccable-finish-reviewer` agent, against the contract, the comps and 84 screenshots of the production build): "fix", eight items. It kept the plate exactly as it is (the hatching, the double frame, vermilion rings only, coordinates outside, Mukta's clocks, the ink-black dark theme with dimmed paper boards, the Watch grid of plates). The phone's game and analysis pages match the comps: board, clocks and step buttons without a scroll.
  - **Fixed:**
    - **Study comments showed raw `[%anno …]`:** `readComment` now drops any `[%…]` command it doesn't read (a test with `[%anno]` and `[%emt]`).
    - **The home said play and puzzles were "on their way"** (since Task 73): a true intro in both languages, and the "come next" line is gone.
    - **The tournament page's uppercase status above its name** (an eyebrow) is now the first item of the meta line; the streak's flame, a player's title (also on a team's page) and a failed condition's cross were vermilion, which is the annotator's alone: ink, and the danger colour for the cross.
    - **Digits:** a tournament's stats were in Devanagari beside Latin standings. Chess figures (clocks, ratings, ranks, scores and the stats beside them) are Latin in both languages, as the notation is; counts in sentences stay `formatNumber`'s (the guide's pitfall).
    - **Empty cells:** a phone's last row of the play hub's choices left a cell of the ink behind (it read as chosen in dark), and the player's ratings grid a hairline-grey one. The last choice spans its row's rest; the ratings draw their hairlines on the cells.
    - **A player's game thumbnails** (72–80 px) crushed their coordinates: `coordinates={false}`.
  - **Left for the owner** (redesigns, not wrap-up fixes):
    - **The desktop game page:** the board (about 630 px) with the strips above and below is the phone's layout made larger; the comp puts the strips and clocks in the right column and the board at the viewport's height, with a dense three-column move list.
    - **Labelled game actions** (Takeback, Offer draw, Resign) as in the comp, instead of icons beside the step buttons; on a phone they have to fit that row, so it goes with the layout above.
    - **The home as the comp has it:** a grid of paces to play, the daily puzzle's plate and a TV row, in place of the hero and the five "Start here" cards (the contract says no cards; the design record lists them as a departure).
    - **The play hub:** one tap to start with remembered choices, the options behind a disclosure (at 1280, Start is below the fold).
    - **The puzzle page:** the comp's status line above the board (side to move, rating, theme), the annotated move strip and Hint / Solution / Next under it.
    - **Smaller:** one outlined and one filled button style across Chaal (three are mixed), the phone puzzle's frame closer to the right edge than the left (the coordinates take the left), and the annotator's marks, which no default page shows.
  - **The design record** is `docs/design/chaal.md` (the `impeccable-documenter` agent, from the shipped code), stripped with the layer. Its "Departures" list where the build differs from the contract (the home's cards among them).

**Why:** PLAN Task 85.

**Alternatives considered:** a test that every `tests/**/chaal-*` file is in strip-demo's list. The matrix catches it, and the list lives in the script, not in a module a test can import.

## 0276: Part 7 measured (Task 85)

Measured on the owner's Windows machine (Node 24.11, 12 threads, 11.7 GB), 2026-11-10, on the e2e harness's production build.

- **Lighthouse 13.6, mobile, simulated throttling,** behind a local HTTP/2 proxy with brotli (as Vercel serves pages; 0245), three runs each:
  - `/app/chaal`: 98, 99, 98; `/app/chaal/puzzles`: 99, 97, 97. **The plan's ≥ 95 is met.**
  - Accessibility, best practices and SEO 100 on both; LCP and FCP 1.1 s, TBT 130–200 ms, CLS 0.
- **Every page's JavaScript:** 294.6 kB gzip of the 295 kB budget (284.4 after Task 72). Not trimmed: Chaal's share of the entry is its route definitions and search contracts in the main chunk (0151), about 0.3 kB a route; nothing else of Chaal's loads on every page. Part 8's first routes will need room. Chaal's pages add on top (`node scripts/check-bundle.ts --routes=chaal`, new here):
  - the analysis board 109.6 kB, a game 104.1, a local game 84.0, puzzles 80.6, play 77.8, a broadcast 75.2, a study 60.1, a TV channel 58.2, settings 48.4, a player 46.5, a tournament 41.7, a team 34.7, the home 28.5, the lists 10.6–29.0, about 4.8;
  - the layout adds 73.1 kB;
  - the admin's heaviest are curation (213.2 kB, the dnd-kit lists and the dialog) and settings (173.7).
- **The engine** (Stockfish 19 lite, single-threaded, in its worker under the CSP; desktop Chrome): ready (`uci` to `readyok`, the .wasm from the local server) in 138 ms. To depth 12 / 16 / 18 from a fresh `ucinewgame` with 16 MB of hash:
  - the starting position: 32 / 180 / 270 ms;
  - a Queen's Gambit middlegame: 61 / 677 / 1,603 ms;
  - a rook ending: 41 / 147 / 459 ms;
  - 0.46–1.23 million nodes a second. A mid-range phone is still to measure (0263: CDP throttling doesn't slow workers).
- **`pnpm test:e2e`,** the full suite: 3,443 passed and 1 flaky in 65.7 min (2 workers). The flaky one was Chaal's team flow (0275). After the fixes, Chaal's flows passed 63 of 63 (the keyboard flows included) and the review of its game, local and puzzle pages 108 of 108.
- **The rest:** `pnpm test` 190 files and 2,210 tests, run with `--maxWorkers=4`: the default ran this machine out of memory twice with nothing else open. Storybook 140 files, 693 of 694: a core primitive's menu ("UI/Primitives", Overlays) wasn't visible yet under load and passes alone. After the finish review's fixes, Chaal's flows 63 of 63, the review of the changed pages 252 of 252 and Chaal's stories 142 of 142.
- **Template matrix:** see 0275.
