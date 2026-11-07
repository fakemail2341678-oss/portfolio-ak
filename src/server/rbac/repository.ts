import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, exists, inArray, isNull, ne, notExists, or, type SQL, sql } from "drizzle-orm";
import { ALL_PERMISSIONS, isPermission, type Permission, SYSTEM_ROLE_KEYS } from "@/features/rbac/permissions";
import {
	type RoleInput,
	type RoleSummary,
	roleSummary,
	type UserListItem,
	type UserPage,
	userListItem,
} from "@/features/rbac/schema";
import type { UserListInput } from "@/features/rbac/search";
import { slugify } from "@/lib/slug";
import { m } from "@/paraglide/messages";
import { isValueFree, listPage, uniqueSlug, uniqueViolation, updateVersioned } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { role, rolePermission, session, user, userRole } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Roles, permissions and user-role data access. Plain functions over an
 * injected Drizzle db (tested on PGlite). The rules about WHO may change what
 * live in ./service.ts; these functions just read and write (writes take the
 * service's transaction).
 */

/** The fields of a user that decide their permissions. */
export type AuthSubject = { id: string; role: string | null; banned: boolean | null; isAnonymous?: boolean | null };

/**
 * Everything `subject` may do, resolved from the database on every request:
 * admins get the whole catalog; everyone else gets the `user` baseline plus their
 * custom roles. Banned users and guests (decision 0185) get nothing: the baseline
 * role never reaches a guest, so a guest can't enter the admin area. Unknown strings
 * (a permission removed from the catalog) are ignored.
 */
export async function permissionsForUser(db: Db, subject: AuthSubject): Promise<Permission[]> {
	if (subject.banned || subject.isAnonymous) return [];
	if (subject.role === "admin") return [...ALL_PERMISSIONS];
	const rows = await db
		.selectDistinct({ permission: rolePermission.permission })
		.from(rolePermission)
		.innerJoin(role, eq(role.id, rolePermission.roleId))
		.where(
			or(
				eq(role.key, "user"),
				inArray(
					rolePermission.roleId,
					db.select({ id: userRole.roleId }).from(userRole).where(eq(userRole.userId, subject.id)),
				),
			),
		);
	const granted = new Set(rows.map((row) => row.permission));
	// Catalog order, so lists are stable.
	return ALL_PERMISSIONS.filter((permission) => granted.has(permission));
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

type RoleRow = typeof role.$inferSelect;

export async function getRole(db: Db, id: string): Promise<RoleRow | null> {
	const [row] = await db.select().from(role).where(eq(role.id, id));
	return row ?? null;
}

export async function getRolesByIds(db: Db, ids: ReadonlyArray<string>): Promise<RoleRow[]> {
	if (ids.length === 0) return [];
	return db
		.select()
		.from(role)
		.where(inArray(role.id, [...ids]));
}

export async function rolePermissions(db: Db, roleIds: ReadonlyArray<string>): Promise<Map<string, Permission[]>> {
	const map = new Map<string, Permission[]>();
	if (roleIds.length === 0) return map;
	const rows = await db
		.select()
		.from(rolePermission)
		.where(inArray(rolePermission.roleId, [...roleIds]));
	for (const row of rows) {
		if (!isPermission(row.permission)) continue;
		map.set(row.roleId, [...(map.get(row.roleId) ?? []), row.permission]);
	}
	return map;
}

/** Every role with its permissions and how many users hold it (system roles first). */
export async function listRoles(db: Db): Promise<RoleSummary[]> {
	const [roles, permissionRows, assignments, [admins], [everyone]] = await Promise.all([
		db.select().from(role).orderBy(desc(role.system), asc(role.key)),
		db.select().from(rolePermission),
		db.select({ roleId: userRole.roleId, total: count() }).from(userRole).groupBy(userRole.roleId),
		db.select({ total: count() }).from(user).where(eq(user.role, "admin")),
		db.select({ total: count() }).from(user).where(isAccount),
	]);
	const counts = new Map(assignments.map((row) => [row.roleId, row.total]));
	return roles.map((row) => {
		const stored = permissionRows
			.filter((permission) => permission.roleId === row.id)
			.map((permission) => permission.permission)
			.filter(isPermission);
		return roleSummary.parse({
			...row,
			permissions: row.key === "admin" ? [...ALL_PERMISSIONS] : ALL_PERMISSIONS.filter((p) => stored.includes(p)),
			userCount:
				row.key === "admin"
					? (admins?.total ?? 0)
					: row.key === "user"
						? (everyone?.total ?? 0)
						: (counts.get(row.id) ?? 0),
		});
	});
}

/** A taken name (any case) is a CONFLICT on the name field; anything else propagates. */
const roleSaveError = (error: unknown) =>
	uniqueViolation(error, { role_name_lower_unique: { field: "name", message: m.rbac_error_role_name_taken } });

/** Creates a custom role; its key comes from the name ("editor", then "editor-2"; "role" for non-Latin names). */
export async function createRole(tx: Tx, input: RoleInput): Promise<RoleRow> {
	try {
		const key = await uniqueSlug(tx, role, role.key, slugify(input.name, 40) || "role", SYSTEM_ROLE_KEYS);
		const [created] = await tx
			.insert(role)
			.values({ key, name: input.name, description: input.description })
			.returning();
		if (!created) throw new Error("Role insert returned no row");
		return created;
	} catch (error) {
		throw roleSaveError(error);
	}
}

/** Renames a role if it still has `version` (its `updatedAt`); else NOT_FOUND or a stale CONFLICT. */
export async function updateRole(tx: Tx, id: string, input: RoleInput, version: string): Promise<RoleRow> {
	try {
		return await updateVersioned(tx, role, {
			id,
			version,
			set: { name: input.name, description: input.description },
			what: "Role",
		});
	} catch (error) {
		throw roleSaveError(error);
	}
}

/** Deletes a role; its permissions and assignments go with it (FK cascade). */
export async function deleteRole(tx: Tx, id: string): Promise<void> {
	await tx.delete(role).where(eq(role.id, id));
}

/** Adds and removes permissions on one role. */
export async function updateRolePermissions(
	tx: Tx,
	roleId: string,
	grant: ReadonlyArray<Permission>,
	revoke: ReadonlyArray<Permission>,
): Promise<void> {
	if (grant.length > 0) {
		await tx
			.insert(rolePermission)
			.values(grant.map((permission) => ({ roleId, permission })))
			.onConflictDoNothing();
	}
	if (revoke.length > 0) {
		await tx
			.delete(rolePermission)
			.where(and(eq(rolePermission.roleId, roleId), inArray(rolePermission.permission, [...revoke])));
	}
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getAuthSubject(db: Db, userId: string): Promise<AuthSubject | null> {
	const [row] = await db
		.select({ id: user.id, role: user.role, banned: user.banned })
		.from(user)
		.where(eq(user.id, userId));
	return row ?? null;
}

/** A user as the user-management rules see them (and as audit rows name them). */
export type UserTarget = AuthSubject & { name: string; email: string };

export async function getUserTarget(db: Db, userId: string): Promise<UserTarget | null> {
	const [row] = await db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned })
		.from(user)
		.where(eq(user.id, userId));
	return row ?? null;
}

/** Whether no account uses this address (stored lowercase): the invite form's check while typing. */
export const isEmailFree = (db: Db, email: string) => isValueFree(db, user, user.email, email.toLowerCase());

/** An invited account: the baseline role, no password and no sessions until they accept. A taken address is a CONFLICT on the email field. */
export async function createInvitedUser(tx: Tx, input: { name: string; email: string }) {
	try {
		const [created] = await tx
			.insert(user)
			.values({ id: crypto.randomUUID(), name: input.name, email: input.email, emailVerified: false, role: "user" })
			.returning({ id: user.id, name: user.name, email: user.email });
		if (!created) throw new Error("User insert returned no row");
		return created;
	} catch (error) {
		throw uniqueViolation(error, { user_email_unique: { field: "email", message: m.users_invite_email_taken } });
	}
}

/** Deletes every session of a user (signed out everywhere); returns how many there were. */
export async function deleteUserSessions(tx: Tx, userId: string): Promise<number> {
	const deleted = await tx.delete(session).where(eq(session.userId, userId)).returning({ id: session.id });
	return deleted.length;
}

/**
 * Ids of the admins who can still sign in, with their rows locked until the
 * transaction ends. The lockout guard uses this so two concurrent demotions
 * can't both see "another admin is left".
 */
export async function lockActiveAdmins(tx: Tx): Promise<string[]> {
	const rows = await tx
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.role, "admin"), or(eq(user.banned, false), sql`${user.banned} is null`)))
		.for("update");
	return rows.map((row) => row.id);
}

/** Custom role ids a user holds. */
export async function userRoleIds(db: Db, userId: string): Promise<string[]> {
	const rows = await db.select({ id: userRole.roleId }).from(userRole).where(eq(userRole.userId, userId));
	return rows.map((row) => row.id);
}

const SORT_COLUMNS = { name: user.name, email: user.email, created: user.createdAt };

const notBanned = or(eq(user.banned, false), sql`${user.banned} is null`);

/**
 * Accounts only: guests (decision 0185) are visitors trying the apps, deleted after a
 * week. They aren't listed, counted or given roles in the admin area.
 */
export const isAccount = sql`not coalesce(${user.isAnonymous}, false)`;

/** "all", "admin", "user" (the baseline only: no admin flag, no custom role) or a custom role's key. */
function roleFilter(db: Db, key: string): SQL | undefined {
	if (key === "all") return undefined;
	if (key === "admin") return eq(user.role, "admin");
	if (key === "user") {
		return and(
			or(ne(user.role, "admin"), isNull(user.role)),
			notExists(db.select({ one: sql`1` }).from(userRole).where(eq(userRole.userId, user.id))),
		);
	}
	return exists(
		db
			.select({ one: sql`1` })
			.from(userRole)
			.innerJoin(role, eq(role.id, userRole.roleId))
			.where(and(eq(userRole.userId, user.id), eq(role.key, key))),
	);
}

export function listUsers(db: Db, input: UserListInput): Promise<UserPage> {
	return listPage(db, user, {
		input,
		where: allOf(
			isAccount,
			textSearch(input.q, [user.name, user.email]),
			input.status === "banned" ? eq(user.banned, true) : input.status === "active" ? notBanned : undefined,
			roleFilter(db, input.role),
		),
		sort: { columns: SORT_COLUMNS, fallback: "created" },
		// The page's custom roles in one query.
		map: async (rows): Promise<UserListItem[]> => {
			const assigned =
				rows.length === 0
					? []
					: await db
							.select({ userId: userRole.userId, id: role.id, key: role.key, name: role.name })
							.from(userRole)
							.innerJoin(role, eq(role.id, userRole.roleId))
							.where(
								inArray(
									userRole.userId,
									rows.map((row) => row.id),
								),
							)
							.orderBy(asc(role.name));
			return rows.map((row) =>
				userListItem.parse({
					...row,
					isAdmin: row.role === "admin",
					roles: assigned.filter((entry) => entry.userId === row.id),
					banned: row.banned === true,
				}),
			);
		},
	});
}

/**
 * Sets the admin flag (Better Auth's user.role) and the custom roles of a user,
 * if the user still has `version` (their `updatedAt` when the dialog opened).
 */
export async function setUserRoles(
	tx: Tx,
	userId: string,
	{ admin, roleIds, version }: { admin: boolean; roleIds: ReadonlyArray<string>; version: string },
): Promise<void> {
	await updateVersioned(tx, user, { id: userId, version, set: { role: admin ? "admin" : "user" }, what: "User" });
	await tx.delete(userRole).where(eq(userRole.userId, userId));
	if (roleIds.length > 0) {
		await tx.insert(userRole).values(roleIds.map((roleId) => ({ userId, roleId })));
	}
}

/**
 * Bans (or unbans) a user. Banning also deletes their sessions, so they're
 * signed out everywhere at once; Better Auth's admin plugin refuses new
 * sign-ins while `banned` is set.
 */
export async function setUserBanned(tx: Tx, userId: string, banned: boolean): Promise<void> {
	await tx.update(user).set({ banned, banReason: null, banExpires: null }).where(eq(user.id, userId));
	if (banned) await tx.delete(session).where(eq(session.userId, userId));
}
