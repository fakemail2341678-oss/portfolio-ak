import { z } from "zod";
import { versionSchema } from "@/lib/concurrency";
import { isoDateTime } from "@/lib/crud/schema";
import type { Paged } from "@/lib/list/paging";
import { email, optionalText, required } from "@/lib/validation";
import { locales } from "@/paraglide/runtime";
import { isPermission, type Permission } from "./permissions";

/** One permission from the catalog; anything else is rejected. */
export const permissionSchema = z.custom<Permission>((value) => typeof value === "string" && isPermission(value));

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLE_NAME_MAX = 40;

/** Create / rename a custom role (one schema for the dialog and the server). */
export const roleInputSchema = z.strictObject({
	name: required({ max: ROLE_NAME_MAX }),
	description: optionalText({ max: 200 }),
});
export type RoleInput = z.output<typeof roleInputSchema>;
export type RoleFormValues = z.input<typeof roleInputSchema>;

/** Rename: plus which role and the version the edit started from (its `updatedAt`). */
export const roleUpdateSchema = roleInputSchema.extend({ id: z.uuid(), updatedAt: versionSchema() });

/** Matrix edits: permissions to add to and remove from one role (a checkbox, or a whole resource). */
export const rolePermissionsUpdateSchema = z.strictObject({
	roleId: z.uuid(),
	grant: z.array(permissionSchema).max(100),
	revoke: z.array(permissionSchema).max(100),
});
export type RolePermissionsUpdate = z.output<typeof rolePermissionsUpdateSchema>;

export const roleSummary = z.object({
	id: z.string(),
	key: z.string(),
	/** Custom roles' own name; system roles are labelled with messages (see roleLabel). */
	name: z.string(),
	description: z.string(),
	system: z.boolean(),
	/** Stored permissions; for `admin` this is every permission (implicit). */
	permissions: z.array(permissionSchema),
	userCount: z.number(),
	/** Changes on rename only (the version the role dialog sends back); permission edits are deltas. */
	updatedAt: isoDateTime(),
});
export type RoleSummary = z.output<typeof roleSummary>;

// ---------------------------------------------------------------------------
// Users (the list's URL contract is in ./search.ts)
// ---------------------------------------------------------------------------

export const userListItem = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	isAdmin: z.boolean(),
	roles: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
	banned: z.boolean(),
	createdAt: isoDateTime(),
	/** The version the roles dialog sends back. */
	updatedAt: isoDateTime(),
});
export type UserListItem = z.output<typeof userListItem>;
export type UserPage = Paged<UserListItem>;

/** The roles a user holds: the admin flag plus custom roles (the `user` baseline is implicit), from the version opened. */
export const userRolesSchema = z.strictObject({
	userId: z.string().min(1).max(100),
	admin: z.boolean(),
	roleIds: z.array(z.uuid()).max(50),
	updatedAt: versionSchema(),
});
export type UserRolesInput = z.output<typeof userRolesSchema>;

export const userBanSchema = z.strictObject({ userId: z.string().min(1).max(100), banned: z.boolean() });

/** One user, by id (sign out everywhere, impersonate). */
export const userIdSchema = z.strictObject({ userId: z.string().min(1).max(100) });

/** Invite someone: their name, address and the language of the invitation email. */
export const userInviteSchema = z.strictObject({
	name: required({ max: 80 }),
	email: email(),
	locale: z.enum(locales),
});
export type UserInviteInput = z.output<typeof userInviteSchema>;
export type UserInviteValues = z.input<typeof userInviteSchema>;

/** The invite form's check while typing: is this address free? */
export const emailCheckSchema = z.strictObject({ email: z.string().max(320) });
