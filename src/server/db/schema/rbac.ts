import { sql } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Roles and permissions (docs/decisions.md 0094).
 *
 * - `role`: the system roles `admin` and `user` (seeded by migration 0005) plus
 *   roles admins create. `admin` holds every permission implicitly (no rows in
 *   role_permission) and is assigned through Better Auth's `user.role = "admin"`.
 *   `user` is every signed-in user's baseline.
 * - `role_permission`: "<resource>:<action>" strings from the catalog in
 *   src/features/rbac/permissions.ts.
 * - `user_role`: custom roles assigned to users (system roles are never stored here).
 */
export const role = pgTable(
	"role",
	{
		id: uuid().primaryKey().defaultRandom(),
		/** Stable identifier ("admin", "user", "editor"); never changes after creation. */
		key: text().notNull().unique(),
		/** Display name for custom roles; system roles use localized messages instead. */
		name: text().notNull(),
		description: text().notNull().default(""),
		system: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// Names are unique ignoring case: saves insert and map the violation to the name field (0173).
	(table) => [uniqueIndex("role_name_lower_unique").on(sql`lower(${table.name})`)],
);

export const rolePermission = pgTable(
	"role_permission",
	{
		roleId: uuid()
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		permission: text().notNull(),
	},
	(table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

export const userRole = pgTable(
	"user_role",
	{
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: uuid()
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.roleId] }), index("user_role_role_idx").on(table.roleId)],
);
