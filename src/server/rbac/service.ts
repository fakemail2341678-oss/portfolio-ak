import "@tanstack/react-start/server-only";
import { inArray } from "drizzle-orm";
import type { Permission } from "@/features/rbac/permissions";
import type {
	RoleInput,
	RolePermissionsUpdate,
	RoleSummary,
	UserInviteInput,
	UserPage,
	UserRolesInput,
} from "@/features/rbac/schema";
import type { UserListInput } from "@/features/rbac/search";
import { type Actor, canGrant } from "@/features/rbac/types";
import { AppError, ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { type AuditActor, type AuditEntry, changes, recordAudit } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { auditEvent } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { Services } from "@/server/services";
import * as repo from "./repository";

/**
 * The rules of role and permission management. The server functions have
 * already checked that the actor holds the permission for the action
 * (requirePermission); these functions add the rules that depend on WHO is
 * acting and WHAT is changed, so nobody can raise their own privileges or lock
 * everyone out:
 *
 * - The admin role is fixed (every permission) and only admins change who is an admin.
 * - There is always at least one active admin.
 * - Nobody changes their own roles, or bans themselves.
 * - A non-admin can only grant, remove or hand out permissions they hold themselves,
 *   and can't change, ban or sign out an admin.
 * - Only admins impersonate, never another admin, and never from an impersonated session.
 *
 * Every change writes its audit row in the same transaction (withAudit, 0132).
 */

type Reads = Pick<Services, "db">;

const forbidden = (dev: string, user: string) => ruleError("FORBIDDEN", dev, user);

/** A non-admin may only touch permissions they hold. */
function assertWithinOwn(actor: Actor, permissions: ReadonlyArray<Permission>) {
	if (!canGrant(actor, permissions)) throw forbidden("Permissions outside the actor's own", m.rbac_error_subset());
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const listRoles = ({ db }: Reads): Promise<RoleSummary[]> => repo.listRoles(db);

async function customRoleOrThrow(db: Db, id: string) {
	const role = await repo.getRole(db, id);
	if (!role) throw notFound("Role");
	if (role.system) throw forbidden("System roles are fixed", m.rbac_error_system_role());
	return role;
}

const roleTarget = (role: { id: string; name: string }) => ({ type: "role" as const, id: role.id, label: role.name });

export function createRole({ db, actor }: Services, input: RoleInput): Promise<{ id: string; key: string }> {
	return withAudit(db, actor, async (tx, audit) => {
		const role = await repo.createRole(tx, input);
		audit({
			action: "role.create",
			target: roleTarget(role),
			after: { name: role.name, description: role.description },
		});
		return { id: role.id, key: role.key };
	});
}

/** Renames a custom role, if nobody changed it since `version` (else a stale CONFLICT). */
export function updateRole(
	{ db, actor }: Services,
	{ id, updatedAt, ...input }: RoleInput & { id: string; updatedAt: string },
): Promise<void> {
	return withAudit(db, actor, async (tx, audit) => {
		const before = await customRoleOrThrow(tx, id);
		const role = await repo.updateRole(tx, id, input, updatedAt);
		const changed = changes(before, role, ["name", "description"]);
		if (changed) audit({ action: "role.update", target: roleTarget(role), ...changed });
	});
}

export function deleteRole({ db, actor }: Services, id: string): Promise<void> {
	return withAudit(db, actor, async (tx, audit) => {
		const role = await customRoleOrThrow(tx, id);
		// Deleting a role removes its permissions from everyone holding it: same rule as revoking them.
		const permissions = (await repo.rolePermissions(tx, [role.id])).get(role.id) ?? [];
		assertWithinOwn(actor, permissions);
		await repo.deleteRole(tx, id);
		audit({ action: "role.delete", target: roleTarget(role), before: { name: role.name, permissions } });
	});
}

export function updateRolePermissions({ db, actor }: Services, input: RolePermissionsUpdate): Promise<void> {
	return withAudit(db, actor, async (tx, audit) => {
		const role = await repo.getRole(tx, input.roleId);
		if (!role) throw notFound("Role");
		if (role.key === "admin") throw forbidden("The admin role is fixed", m.rbac_error_admin_role_fixed());
		assertWithinOwn(actor, [...input.grant, ...input.revoke]);
		const before = (await repo.rolePermissions(tx, [role.id])).get(role.id) ?? [];
		await repo.updateRolePermissions(tx, role.id, input.grant, input.revoke);
		const after = (await repo.rolePermissions(tx, [role.id])).get(role.id) ?? [];
		const changed = changes({ permissions: [...before].sort() }, { permissions: [...after].sort() }, ["permissions"]);
		if (changed) audit({ action: "role.permissions", target: roleTarget(role), ...changed });
	});
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const listUsers = ({ db }: Reads, input: UserListInput): Promise<UserPage> => repo.listUsers(db, input);

/** Whether an address is free for an invitation (the form's check while typing; inviting checks again). */
export const isEmailFree = ({ db }: Reads, email: string): Promise<boolean> => repo.isEmailFree(db, email);

async function targetOrThrow(db: Db, userId: string) {
	const target = await repo.getUserTarget(db, userId);
	if (!target) throw notFound("User");
	return target;
}

const userTarget = (user: { id: string; email: string }) => ({ type: "user" as const, id: user.id, label: user.email });

/** A non-admin can't act on an admin (roles, ban, sign-out). */
function assertMayActOn(actor: Actor, target: repo.UserTarget) {
	if (target.role === "admin" && !actor.isAdmin) {
		throw forbidden("Non-admin acting on an admin", m.rbac_error_admin_target());
	}
}

/**
 * Refuses a change that takes away the last active admin. The active admins are
 * locked and re-read first, so concurrent demotions run one after the other and
 * the second sees the first's result. Call it inside the change's transaction.
 */
async function keepAnAdmin(tx: Tx, userId: string) {
	const active = await repo.lockActiveAdmins(tx);
	if (active.includes(userId) && active.length <= 1) {
		throw ruleError("CONFLICT", "Last active admin", m.rbac_error_last_admin());
	}
}

const sorted = (values: ReadonlyArray<string>) => [...values].sort();

export async function setUserRoles({ db, actor }: Services, input: UserRolesInput): Promise<void> {
	if (input.userId === actor.id) throw forbidden("Own roles", m.rbac_error_own_roles());
	const target = await targetOrThrow(db, input.userId);
	const wasAdmin = target.role === "admin";
	if (wasAdmin !== input.admin) {
		if (!actor.isAdmin) throw forbidden("Admin flag change by non-admin", m.rbac_error_admin_only());
	} else if (wasAdmin && !actor.isAdmin) {
		throw forbidden("Non-admin editing an admin", m.rbac_error_admin_target());
	}

	// Only custom roles are assignable here; unknown or system ids are refused.
	const requested = [...new Set(input.roleIds)];
	const roles = await repo.getRolesByIds(db, requested);
	if (roles.length !== requested.length || roles.some((role) => role.system)) {
		throw new AppError("BAD_REQUEST", "Unknown or system role id");
	}
	// Roles handed out or taken away must stay within the actor's own permissions.
	const current = await repo.userRoleIds(db, input.userId);
	const changed = [
		...requested.filter((id) => !current.includes(id)),
		...current.filter((id) => !requested.includes(id)),
	];
	assertWithinOwn(actor, [...(await repo.rolePermissions(db, changed)).values()].flat());

	const before = { admin: wasAdmin, roles: sorted((await repo.getRolesByIds(db, current)).map((role) => role.name)) };
	const after = { admin: input.admin, roles: sorted(roles.map((role) => role.name)) };
	await withAudit(db, actor, async (tx, audit) => {
		if (wasAdmin && !input.admin) await keepAnAdmin(tx, input.userId);
		await repo.setUserRoles(tx, input.userId, { admin: input.admin, roleIds: requested, version: input.updatedAt });
		const summary = changes(before, after, ["admin", "roles"]);
		if (summary) audit({ action: "user.roles", target: userTarget(target), ...summary });
	});
}

export async function setUserBanned(
	{ db, actor }: Services,
	{ userId, banned }: { userId: string; banned: boolean },
): Promise<void> {
	if (userId === actor.id) throw forbidden("Ban self", m.rbac_error_ban_self());
	const target = await targetOrThrow(db, userId);
	assertMayActOn(actor, target);
	await withAudit(db, actor, async (tx, audit) => {
		if (target.role === "admin" && banned) await keepAnAdmin(tx, userId);
		await repo.setUserBanned(tx, userId, banned);
		audit({
			action: banned ? "user.ban" : "user.unban",
			target: userTarget(target),
			before: { banned: target.banned === true },
			after: { banned },
		});
	});
}

/** Signs a user out everywhere (deletes their sessions); returns how many there were. */
export async function revokeUserSessions({ db, actor }: Services, userId: string): Promise<{ revoked: number }> {
	if (userId === actor.id) throw forbidden("Own sessions", m.rbac_error_revoke_self());
	const target = await targetOrThrow(db, userId);
	assertMayActOn(actor, target);
	return withAudit(db, actor, async (tx, audit) => {
		const revoked = await repo.deleteUserSessions(tx, userId);
		audit({ action: "user.sessions-revoke", target: userTarget(target), after: { sessions: revoked } });
		return { revoked };
	});
}

/**
 * Invites someone: creates their account (the `user` baseline, address not yet
 * verified, no password), then `send` emails them a link to choose a password
 * (src/functions/rbac.ts issues a Better Auth reset token for it). Choosing the
 * password through that link verifies the address. A taken address is refused
 * by the unique constraint, as a CONFLICT on the email field.
 */
export async function inviteUser(
	{ db, actor }: Services,
	input: UserInviteInput,
	send: (invited: { id: string; name: string; email: string }) => Promise<void>,
): Promise<{ id: string }> {
	const invited = await withAudit(db, actor, async (tx, audit) => {
		const created = await repo.createInvitedUser(tx, { name: input.name, email: input.email.toLowerCase() });
		audit({
			action: "user.invite",
			target: userTarget(created),
			after: { name: created.name, email: created.email, language: input.locale },
		});
		return created;
	});
	await send(invited);
	return { id: invited.id };
}

// ---------------------------------------------------------------------------
// Impersonation (a recipe: decisions.md 0134)
// ---------------------------------------------------------------------------

/**
 * Starts a session as another user. `start` does it (Better Auth's
 * impersonateUser, which swaps the session cookie). The audit row is written
 * first and removed again if `start` fails, so a failed start leaves no row
 * and a failed row no session. Not one transaction: Better Auth writes the
 * session through its own connection, which would wait for the transaction
 * (and the e2e PGlite, one backend, would wait forever).
 *
 * Admins only (the superuser flag): an impersonated session acts with all of the
 * target's permissions, so this isn't a permission a custom role could hold.
 * Admins can't be impersonated, and nobody impersonates from an impersonated session.
 */
export async function impersonateUser({ db, actor }: Services, userId: string, start: () => Promise<void>) {
	if (actor.impersonatorId) throw forbidden("Nested impersonation", m.rbac_error_impersonate_nested());
	if (!actor.isAdmin) throw forbidden("Impersonation by a non-admin", m.rbac_error_impersonate_admin_only());
	if (userId === actor.id) throw forbidden("Impersonate self", m.rbac_error_impersonate_self());
	const target = await targetOrThrow(db, userId);
	if (target.role === "admin") throw forbidden("Impersonate an admin", m.rbac_error_impersonate_admin_target());
	if (target.banned) throw ruleError("CONFLICT", "Impersonate a banned user", m.rbac_error_impersonate_banned());
	await withAuditRow(db, actor, { action: "user.impersonate", target: userTarget(target) }, start);
}

/**
 * Ends an impersonated session (`actor` is that session's: the target, with the
 * admin as impersonatorId). The audit row names the admin as the actor.
 */
export async function stopImpersonating(
	{ db, actor }: Pick<Services, "db"> & { actor: AuditActor },
	stop: () => Promise<void>,
) {
	const admin = actor.impersonatorId;
	if (!admin) throw new AppError("BAD_REQUEST", "Not an impersonated session");
	const target = await targetOrThrow(db, actor.id);
	await withAuditRow(
		db,
		{ id: admin, requestId: actor.requestId, ip: actor.ip },
		{ action: "user.impersonate-stop", target: userTarget(target) },
		stop,
	);
}

/** Records `entry`, runs `action`, and deletes the row again when the action fails. */
async function withAuditRow(db: Db, actor: AuditActor, entry: AuditEntry, action: () => Promise<void>) {
	const ids = await recordAudit(db, actor, entry);
	try {
		await action();
	} catch (error) {
		await db.delete(auditEvent).where(inArray(auditEvent.id, ids));
		throw error;
	}
}
