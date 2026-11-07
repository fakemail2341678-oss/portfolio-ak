import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
	emailCheckSchema,
	type RoleSummary,
	roleInputSchema,
	rolePermissionsUpdateSchema,
	roleUpdateSchema,
	type UserPage,
	userBanSchema,
	userIdSchema,
	userInviteSchema,
	userRolesSchema,
} from "@/features/rbac/schema";
import { userList } from "@/features/rbac/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { auth } from "@/server/auth/auth";
import { sendInvitation } from "@/server/auth/invite";
import * as rbac from "@/server/rbac/service";

/**
 * Roles, permissions and users. EVERY function runs requirePermission first (a
 * test enforces it); the service adds the rules that depend on who acts and what
 * changes (no self-escalation, no lockout) and writes the audit rows.
 */

export const listRoles = createServerFn({ method: "GET" })
	.middleware([requirePermission("roles:read"), withServices])
	.handler(({ context }): Promise<RoleSummary[]> => rbac.listRoles(context));

/** The roles, for the users page (filter and role dialog): same data, granted by users:read. */
export const listRoleOptions = createServerFn({ method: "GET" })
	.middleware([requirePermission("users:read"), withServices])
	.handler(({ context }): Promise<RoleSummary[]> => rbac.listRoles(context));

export const createRole = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage"), withServices])
	.validator(zodInput(roleInputSchema))
	.handler(({ data, context }): Promise<{ id: string; key: string }> => rbac.createRole(context, data));

export const updateRole = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage"), withServices])
	.validator(zodInput(roleUpdateSchema))
	.handler(({ data, context }): Promise<void> => rbac.updateRole(context, data));

export const deleteRole = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<void> => rbac.deleteRole(context, data.id));

export const updateRolePermissions = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage"), withServices])
	.validator(zodInput(rolePermissionsUpdateSchema))
	.handler(({ data, context }): Promise<void> => rbac.updateRolePermissions(context, data));

export const listUsers = createServerFn({ method: "GET" })
	.middleware([requirePermission("users:read"), withServices])
	.validator(zodInput(userList.input))
	.handler(({ data, context }): Promise<UserPage> => rbac.listUsers(context, data));

export const setUserRoles = createServerFn({ method: "POST" })
	.middleware([requirePermission("users:update"), withServices])
	.validator(zodInput(userRolesSchema))
	.handler(({ data, context }): Promise<void> => rbac.setUserRoles(context, data));

export const setUserBanned = createServerFn({ method: "POST" })
	.middleware([requirePermission("users:ban"), withServices])
	.validator(zodInput(userBanSchema))
	.handler(({ data, context }): Promise<void> => rbac.setUserBanned(context, data));

/** Signs a user out on every device. */
export const revokeUserSessions = createServerFn({ method: "POST" })
	.middleware([requirePermission("users:ban"), withServices])
	.validator(zodInput(userIdSchema))
	.handler(({ data, context }): Promise<{ revoked: number }> => rbac.revokeUserSessions(context, data.userId));

/** Whether an address is free (the invite form checks while typing; inviting checks again). */
export const isUserEmailFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("users:invite"), withServices])
	.validator(zodInput(emailCheckSchema))
	.handler(({ data, context }): Promise<boolean> => rbac.isEmailFree(context, data.email));

/** Creates an account and emails the person a link to choose their password, in the language picked. */
export const inviteUser = createServerFn({ method: "POST" })
	.middleware([requirePermission("users:invite"), withServices])
	.validator(zodInput(userInviteSchema))
	.handler(
		({ data, context }): Promise<{ id: string }> =>
			rbac.inviteUser(context, data, (invited) =>
				sendInvitation(invited, { locale: data.locale, inviter: context.user.name }),
			),
	);

/**
 * Opens a session as another user (impersonation, decisions.md 0134). Admins only:
 * the service refuses everyone else, whatever their permissions. The browser then
 * reloads into the user's view; the banner's "Stop" calls stopImpersonating (functions/auth.ts).
 */
export const impersonateUser = createServerFn({ method: "POST" })
	.middleware([requirePermission("users:update"), withServices])
	.validator(zodInput(userIdSchema))
	.handler(async ({ data, context }): Promise<void> => {
		const headers = getRequestHeaders();
		await rbac.impersonateUser(context, data.userId, async () => {
			await auth.api.impersonateUser({ body: { userId: data.userId }, headers });
		});
	});
