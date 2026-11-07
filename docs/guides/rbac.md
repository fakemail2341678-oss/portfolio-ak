# Roles and permissions (RBAC)

Who may do what, how it's enforced, how to add a permission, and the audit log, invitations and impersonation. Decisions 0094–0097 and 0132–0135 explain the choices.

## The model

| Piece | Where | Notes |
| --- | --- | --- |
| Permission catalog | `src/features/rbac/permissions.ts` | `"<resource>:<action>"`, e.g. `test-crud:publish`. Code, not data. |
| Labels | `src/features/rbac/labels.ts` | One message per resource and per permission (`Record<Permission, …>`: a missing label is a type error). |
| Admin | Better Auth `user.role = "admin"` | Every permission, always. Created with `pnpm db:seed-admin`; made or unmade on the Users page by another admin. |
| Baseline | system role `user` | Applies to every signed-in user. Empty by default. Edit it in the matrix. |
| Custom roles | `role`, `role_permission`, `user_role` tables | Created on the Roles page; permissions ticked in the matrix; assigned on the Users page. |

A user's permissions are: everything (admin), or the baseline plus their custom roles. Banned users have none. They are resolved from the database on every request (`getServerSession` → `permissionsForUser`) and carried in the `Session`.

**Two sources, one rule each (0135):** Better Auth's `user.role === "admin"` is the superuser flag: every permission, plus what only an admin may do (make or unmake admins, act on an admin, impersonate). The RBAC tables hold everything else. The `admin` row in `role` is there for display and has no permission rows; don't assign it in `user_role`. Code that asks "is this an admin?" reads `role === "admin"` (`Actor.isAdmin` in the service, `useActor().isAdmin` in the UI); code that asks "may they do X?" checks the permission.

- **Guests** (the showcase apps' visitors, decision 0185) hold no permissions at all, not even the baseline role's, and are never listed in `/admin/users` or counted in the role counts. App data isn't permission-guarded: every app query is scoped to its owner ([apps.md](apps.md)).

## Enforcing a permission (all three layers)

1. **Server function:** the real protection:

   ```ts
   export const publishProject = createServerFn({ method: "POST" })
   	.middleware([requirePermission("projects:publish")])
   	.validator(zodInput(projectIdSchema))
   	.handler(({ data, context }) => service.publish(db, data.id, context.user.id));
   ```

   Add the function and its permission to `GUARDED_FUNCTIONS` in `tests/server/guarded-functions.test.ts`. The test fails if a function skips the middleware or checks a different permission, and if any file in `src/functions` is in neither `GUARDED_FUNCTIONS` nor `UNGUARDED_FILES` (deliberately public, per-user or dev-only, with a reason). The showcase apps’ files are in a third list, `APP_FUNCTIONS`: each function runs `requireAppUser` then `withAppServices` (no permission; every query is scoped to its owner, [apps.md](apps.md)).

2. **Route:** so a direct visit gives the localized 403 page (a real 403 during SSR):

   ```ts
   // src/routes/_admin/admin/projects/route.tsx
   beforeLoad: ({ context }) => assertRoutePermission(context.session, "projects:read"), // from @/features/rbac/route-guard
   ```

3. **UI:** hide what the user can't use (a courtesy, never the protection):

   ```tsx
   <Can permission="projects:create"><NewProjectButton /></Can>
   const canPublish = useCan("projects:publish");
   ```

   Add the section to `src/features/admin/sections.ts` with its `permission`: the sidebar and the dashboard filter by it.

## Adding a permission or a resource

1. Add it to `PERMISSION_CATALOG`.
2. Add its label in `labels.ts` and the message in `messages/en.json` and `ne.json`.
3. Guard the server functions and routes as above.

The matrix shows the new permission at once. Admins have it automatically; everyone else gets it when an admin ticks it.

Removing a permission from the catalog makes stored grants of it inert: resolution filters unknown strings out.

## Rules (server-side, `src/server/rbac/service.ts`)

- The Admin role is fixed and only admins make or unmake admins.
- There is always at least one active admin. Demoting or banning an admin locks the admin rows inside the change's transaction, so two at once can't both pass (0115).
- Nobody changes their own roles or bans themselves.
- A non-admin only grants, revokes, assigns or removes permissions they hold themselves, and can't change an admin's roles, ban an admin or sign one out.
- Nobody signs themselves out everywhere from the Users page (the account page does that).
- Only admins impersonate, never another admin or a banned user, and never from an impersonated session (0134).
- System roles can't be renamed or deleted, and role names are unique.

Each violation is a `ruleError` with a localized message (`fieldErrors._form`), shown by `errorMessage()`. The UI disables what the actor can't change, using the same rule (`canGrant(actor, permissions)`, `features/rbac/types.ts`: `UserRolesDialog`, `PermissionMatrix`). The actor is one type on both sides (`Actor`): the server builds it for every call (`context.actor`, from `withServices`), the browser reads it from the session (`useActor()`). Elsewhere the UI checks only with `useCan` and `<Can>`.

These rules only hold because every change goes through `src/functions/rbac.ts`: Better Auth's own `/api/auth/admin/*` endpoints are disabled (0112). Don't use `authClient.admin.*`.

## The audit log (0132)

Every change above, and every create, edit and delete of content (0173), writes an `audit_event` row **in the same transaction** as the change, so a refused or failed change leaves none. A new admin action follows the same shape:

```ts
// src/server/<feature>/service.ts: the call's services come from withServices (context.db, context.actor)
export function archiveProject({ db, actor }: Services, id: string) {
	return withAudit(db, actor, async (tx, audit) => {
		const before = await repo.getProject(tx, id);
		await repo.archive(tx, id);
		audit({
			action: "project.archive", // add it to AUDIT_ACTIONS and AUDIT_ACTION_LABELS
			target: { type: "project", id, label: before.name }, // a new type goes in AUDIT_TARGETS
			before: { status: before.status },
			after: { status: "archived" },
		});
	});
}
```

An edit records only what changed: `changes(before, after, compared, recorded)` (`src/server/audit/record.ts`) returns null when nothing did (no row), and long fields count without being copied.

- **What's recorded:** the actor (and the admin behind an impersonated session), the action, the target and its name at the time, the fields that changed (summaries, never secrets), the request id (the same as the response's `x-request-id`, the logs and Sentry) and the client IP.
- **Reading it:** `/admin/audit` (`audit:read`) filters by target name, id or request id, by actor, action, target type and day. Paste a request id from an error page or a log line into the search to find what that request changed.
- **Deleted accounts** stay named by their email from the time (`actor_label`).

## Inviting users and signing them out (0133)

- **Invite** (`users:invite`): name, email and the email's language. The account is created at once with the baseline role; the email links to `/reset-password?token=…&invite=1` (a reset token valid for 3 days). Choosing the password verifies the address. Give roles from the list afterwards. An expired invitation: "Forgot password" with the same address.
- **Sign out everywhere** (`users:ban`): deletes all of the user's sessions. Banning does it too.

## Impersonation (0134)

"View as this user" (admins only) opens a session as that user for up to an hour: their permissions, their data, a banner on every page with "Back to my account". Start and stop are audited, and rows written meanwhile name the admin as impersonator. The impersonated session can read everything the user can, but can't change their password, email, two-factor, linked accounts or sessions, or delete the account (`OWNER_ONLY_PATHS` and `requireAccountOwnerMiddleware`). It's a recipe: to remove it, delete the row action on `/admin/users`, `impersonateUser`, `stopImpersonating` and `ImpersonationBanner`.

## What users see when refused

- **A route they may not open** (`assertRoutePermission` in `beforeLoad`): the forbidden page, "Access denied", with a real 403 during SSR and a "Go back" action (`src/components/errors/error-page.tsx`).
- **Signed out, or the session expired:** layouts redirect to `/login?redirect=…`. A server function answering UNAUTHORIZED in the browser does the same, through the global `sessionExpiryMiddleware` (0113).
- **An admin without two-factor, when `AUTH_REQUIRE_ADMIN_2FA=true`:** their session carries no permissions (`twoFactorRequired`), so every guarded function refuses; entering `/admin` redirects to `/account?twoFactor=required#two-factor` (FORBIDDEN with the `two-factor-required` reason, 0126). Turning two-factor on gives the permissions back on the next request.
- **An action they may not take:** the server function answers FORBIDDEN and the caller shows `errorMessage(error)` in a toast. Hide the control with `useCan`/`<Can>` so this is rare.

## Trying it by hand

`pnpm db:seed-demo --password "<12+ characters>"` adds `editor@example.com` (Test CRUD editor), `viewer@example.com` (read-only admin) and `member@example.com` (no role: `/admin` shows the forbidden page), all with that password (0117).

## Pages

- `/admin/users` (`users:read`): filter by role or status. Inviting needs `users:invite`; edit roles needs `users:update`; ban/unban and sign out everywhere need `users:ban`; view as this user needs the admin flag.
- `/admin/roles` (`roles:read`): create, rename or delete custom roles (`roles:manage`).
- `/admin/roles/permissions` (`roles:read`): the matrix. Editing needs `roles:manage`, and each change saves at once with rollback.
- `/admin/audit` (`audit:read`): the audit log, read only.

## Testing

- **`tests/server/rbac.test.ts`:** resolution, role management and every escalation or lockout rule, on PGlite.
- **`tests/server/audit.test.ts`:** a row (with its request id) for every admin action, none for refused ones, the list filters, invitations, sign-out-everywhere and the impersonation rules.
- **`tests/server/auth-hardening.test.ts`:** an impersonated session refused on Better Auth's account endpoints, on a real Better Auth instance.
- **`tests/server/auth-middleware.test.ts`:** `requirePermission` and the admin gate.
- **`tests/server/route-guards.test.ts`:** the `_admin` layout.
- **`tests/components/rbac/can.test.tsx`:** `<Can>`, `useCan` and the sidebar per permission.
- **`src/features/rbac/components/rbac.stories.tsx`:**
  - the matrix: save, rollback, manager limits and read-only;
  - the role dialog;
  - the user-roles dialog and the invite dialog;
  - the audit table (`src/features/audit/components/audit.stories.tsx`) and the impersonation banner (`layout.stories.tsx`).
- **`e2e/flows/admin-users.spec.ts`:** an invitation from email to sign-in, sign out everywhere, impersonation and back, each found in the audit log by its request id; an editor refused on the audit page and its function.
- **Live checks:** replay a captured server call from a session without the permission. Server-function errors come back as a serialized payload with HTTP 200 (`x-tss-serialized`), so assert the `FORBIDDEN` code in the body, and that the data didn't change.

## Live example

- **useCan, <Can> and guarded server functions:** `/dev/examples/permissions` (`src/routes/dev/examples/permissions.tsx`), with `pnpm dev`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Admin guard:** `_admin` checks the server on entering the area and on SSR (any permission opens it); inner navigations reuse the session (0090). Never rely on it for data safety: every server function has its own `requirePermission`.
- **Better Auth's `/api/auth/admin/*` endpoints are disabled** (0112). Manage users, roles and bans through `src/functions/rbac.ts`, never `authClient.admin.*`; a Better Auth upgrade that adds an admin endpoint fails `auth-disabled-paths.test.ts` until it's listed.
- **Admin actions are audited in their transaction** (0132, 0173): a service that changes anything runs it in `withAudit(db, actor, (tx, audit) => …)` and reports its rows with `audit(…)`; the actor is `context.actor` from `withServices`. Writing the row after the transaction, or with `db` instead of `tx`, can leave a change without its row. A new action goes in `AUDIT_ACTIONS` and its label. Never await a Better Auth call (or anything using the shared `db`) inside a transaction: it runs on another connection and waits for the transaction; write the row first and delete it if the call fails (`withAuditRow`, 0134).
- **Impersonated sessions** (0134) carry `impersonatedBy`. Account changes are refused for them: a new Better Auth account endpoint goes in `OWNER_ONLY_PATHS`, a new app function that changes the account uses `requireAccountOwnerMiddleware`. Impersonation is checked on `user.role === "admin"` (the superuser flag, 0135), not a permission.
