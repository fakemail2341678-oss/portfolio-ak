# Security

What protects the app, and the rules that keep it that way. Most of it is enforced by tests or the build, not by convention.

## Headers and CSP

- **Every response** (Nitro `routeRules`, `STATIC_SECURITY_HEADERS` in `src/lib/http/csp.ts`):
  - `Strict-Transport-Security`;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy` (camera, microphone, geolocation, payment, usb and topics off);
  - `X-Frame-Options: DENY`;
  - `Cross-Origin-Opener-Policy: same-origin`.
- **HTML pages in production** also get a Content-Security-Policy with a fresh nonce per request (`src/middleware/security-headers.ts`, 0081):
  - scripts only with the nonce, plus `'strict-dynamic'` for their own chunks;
  - no `eval`;
  - `connect-src` and `img-src` limited to the same origin plus Sentry, PostHog and Cloudinary when they're configured;
  - `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`;
  - `report-uri` and `report-to` pointing at `/api/csp-report` (with a `Reporting-Endpoints` header).
- **Violation reports (0139):** `/api/csp-report` takes both report formats, strips query strings, drops extension noise, allows 10 reports a minute per IP and 100 per server instance, and turns each one into a `warn` log line and a Sentry warning grouped by directive and blocked resource. A new third-party origin that shows up there needs adding to `buildCsp`'s options, not a looser policy.
- **Dev has no CSP,** because Vite and the devtools inject inline scripts. Check CSP on a production build.
- **Zod** probes `eval` when a schema is created, so the app imports `"zod"`, which resolves to `src/lib/zod.ts` (jitless). Never import `zod/v4` in app code (0086).

## Server functions and routes

- **Authorization on the server:** every protected function runs `requirePermission("<resource>:<action>")`, resolved from the database on every call; a test lists each one ([rbac.md](rbac.md)). Route guards and hidden buttons are conveniences, never the protection.
- **Input:** every function validates with its Zod schema before the handler runs (`validator(zodInput(schema))`).
- **Escalation:** users can't grant permissions they don't hold or lock out the last admin (`src/server/rbac/service.ts`, 0096).
- **CSRF:** server functions reject cross-site calls (Sec-Fetch-Site, then Origin, then Referer; `src/middleware/csrf.ts`).
- **Errors** never leak details: anything unexpected becomes `INTERNAL` with a request id ([routing-data.md](routing-data.md)).
- **Server-only code** can't reach the browser: import protection fails the build, and `env-boundary.test.ts` scans imports. Only `VITE_` variables are public.
- **Dev-only pages and functions** answer 404 in production (`/dev` layout, `devOnlyMiddleware`).

## Auth (Better Auth)

- **Sessions:** signed cookies (`BETTER_AUTH_SECRET`).
- **Email:** sign-up requires a verified email. An email change sends a notice to the old address.
- **Rate limits:** stored in the database (they hold across serverless instances) and keyed by a trusted client IP (`src/server/auth/client-ip.ts`). Sign-in is limited to 5 a minute. Behind a proxy other than Vercel, set its trusted header there.
- **Redirects:** the sign-in `?redirect=` target must be a same-site path (`src/lib/http/redirect.ts`).
- **Expired sessions:** any server function that answers UNAUTHORIZED in the browser sends the user to `/login?redirect=…` (`src/middleware/session-expiry.ts`, 0113). Client route guards read a session at most a minute old (0111); server functions always check it themselves.
- **Admin plugin endpoints are off:** `/api/auth/admin/*` answers 404 (`src/server/auth/disabled-paths.ts`, 0112), so nothing skips the RBAC rules in `src/server/rbac/service.ts`.
- **Audit log:** role, user and publish/delete changes write an `audit_event` row in the same transaction, with the request id and client IP; `/admin/audit` needs `audit:read` (0132, [rbac.md](rbac.md)).
- **Impersonation:** admins only, never of an admin, at most an hour, audited; the impersonated session can't change the account (password, email, two-factor, linked accounts, sessions, deletion: `OWNER_ONLY_PATHS`, `requireAccountOwnerMiddleware`; 0134).
- **Session tokens stay on the server:** the account page lists sessions by id and revokes them with `revokeMySession` (0114).
- **Two-factor (0126):** TOTP with backup codes (Better Auth `twoFactor`), turned on from the account page; the login form asks for the code after the password. `AUTH_REQUIRE_ADMIN_2FA=true` (default off) holds back every admin permission until it's on: the session comes back with `permissions: []` and `twoFactorRequired`, so every `requirePermission` refuses and `/admin` redirects to the account page. Email-code sign-in is refused for accounts with two-factor on (`src/server/auth/hooks.ts`); Google sign-in relies on Google's own second factor.
- **Breached passwords (0127):** sign-up, reset, change and set-password refuse passwords found in Have I Been Pwned (only 5 hash characters leave the server). `AUTH_BREACHED_PASSWORD_CHECK=false` turns it off (the e2e harness does).
- **Bot protection (0128):** with `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set, register, forgot-password and sign-in-code need a Turnstile token (`CAPTCHA_PATHS`, `src/server/auth/policy.ts`) and the CSP allows Cloudflare's challenge frame. Every auth form has a honeypot field (`bot-check.tsx`).
- **Account lifecycle (0129, 0130):** deleting an account always takes an emailed link to `/account/delete`; the last active admin can't be deleted; unsaved uploads are queued for cleanup. `GET /api/account/export` returns the user's own data (never hashes, tokens or 2FA secrets). Users can add a password, link and unlink Google, but never remove their last way in. Each change to how someone signs in emails a `security-notice`.
- **Rate limits for each endpoint** are in `src/server/auth/auth.ts` (`customRules`): two-factor 10 a minute, account deletion 3, linking and unlinking 5, guest sign-in 30 an hour per address (`GUEST_SIGN_INS_PER_HOUR`, unlimited in dev builds; 0201).
- **Guest sessions (0185, 0186):** visitors try the apps as guests (Better Auth's `anonymous` plugin). A guest holds no permissions, `requireUserMiddleware` refuses them (the apps use `requireAppUser`), Better Auth refuses them every account change (`GUEST_REFUSED_PATHS`), no email goes to their `.invalid` address, analytics never identifies them, and they never publish anything public. Signing up or in moves their data to the account (`onLinkAccount`, then the signed `guest_claim` cookie); the daily cleanup deletes them after 7 days. See [apps.md](apps.md).

## Recipes: last login method, passkeys

Not in the base (0131). Both are Better Auth plugins; add them to `src/server/auth/auth.ts` before `tanstackStartCookies()`, which stays last.

**Last login method** ("you last used Google" on the login page):

```ts
// src/server/auth/auth.ts
import { lastLoginMethod } from "better-auth/plugins";
plugins: [/* … */ lastLoginMethod(), tanstackStartCookies()],

// src/lib/auth-client.ts
import { lastLoginMethodClient } from "better-auth/client/plugins";
plugins: [/* … */ lastLoginMethodClient()],

// login page: "email", "email-otp" or "google"
const last = authClient.getLastUsedLoginMethod();
```

It's a cookie by default, so read it in an effect (the server-rendered page can't know it) and show a small badge that doesn't move the layout. `lastLoginMethod({ storeInDatabase: true })` keeps it on the user row instead: run `pnpm auth:schema` and `pnpm db:generate` for the new column.

**Passkeys** (WebAuthn):

```ts
// pnpm add @better-auth/passkey
// src/server/auth/auth.ts
import { passkey } from "@better-auth/passkey";
plugins: [/* … */ passkey({ rpID: new URL(serverEnv.BETTER_AUTH_URL).hostname, rpName: clientEnv.VITE_APP_TITLE }), tanstackStartCookies()],

// src/lib/auth-client.ts
import { passkeyClient } from "@better-auth/passkey/client";
plugins: [/* … */ passkeyClient()],

// account page: register one for the signed-in user
await authClient.passkey.addPasskey({ name: "This device" });
// login page
await authClient.signIn.passkey();
```

Then `pnpm auth:schema` + `pnpm db:generate` (a `passkey` table), messages in both languages, rate limits for `/passkey/*`, and a decision on how passkeys relate to two-factor: a passkey sign-in doesn't go through the TOTP step, which is fine (a passkey is already two factors: the device and its unlock) but should be written down, together with whether a passkey counts as a "way in" when unlinking Google. `rpID` must be the site's domain, so passkeys made on a preview URL don't work in production.

## Content

- **Rich text:** sanitized on the server before storing and again before sending (`sanitizeRichText`). Pages render it only through `RichTextContent`, which accepts only the sanitizer's `SafeHtml` type.
- **Images:**
  - **Uploads:** they go to Cloudinary with a signature the server makes. The signature fixes where the file goes and which formats are allowed.
  - **Verification:** the server checks each asset's format and size through Cloudinary's Admin API before recording it.
  - **Linking:** only your own pending uploads can be linked to a record ([attachments.md](attachments.md)).
- **JSON-LD** is escaped (`<`, `>` and `&`), so content can't close the script tag.
- **Forms** handled in JavaScript use `method="post"`, so a submit before hydration never puts values (passwords) in the URL (0104).

## Secrets

- **Where:** `.env` holds real secrets and is gitignored. `.env.example` lists names only.
- **Validation:** the server validates its environment at boot and refuses to start with anything missing or malformed. Production also refuses the console email provider.
- **Cron endpoints** need `Authorization: Bearer $CRON_SECRET` (constant-time compare); without the variable they answer 404.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Expired sessions are handled once, globally:** `src/middleware/session-expiry.ts` sends any UNAUTHORIZED server-function answer in the browser to `/login?redirect=…` (0113). Don't add per-call login redirects; FORBIDDEN stays the caller's to show (toast, or the forbidden page via `assertRoutePermission`).
- **Session tokens never go to the browser** (0114): revoke another device with `revokeMySession({ id })`.
- **Auth hardening (0126–0130):** with `AUTH_REQUIRE_ADMIN_2FA=true` an admin without two-factor gets a session with **no permissions** (`twoFactorRequired`), so don't read an empty `permissions` as "not an admin" in that case. Email-code sign-in is refused for two-factor accounts by an `after` hook (`src/server/auth/hooks.ts`); keep it when touching auth hooks. Better Auth's `setPassword` has no path, so the breached-password plugin skips it: `setOwnPassword` checks itself. New auth endpoints get a rate limit in `customRules`. Account deletion goes through `/account/delete?token=…`, never Better Auth's GET callback.
- **CSP reports** go to `/api/csp-report` (0139). A violation in Sentry means a missing origin in `buildCsp`'s options or a real injection; never loosen `script-src` to silence it.
- **Zod and the CSP:** Zod 4 probes eval when a `z.object` is created. Always import `"zod"` (aliased), never `zod/v4` in app code (0086).
