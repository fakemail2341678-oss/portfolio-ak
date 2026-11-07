import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";

/**
 * The URL contract of the users list (/admin/users), and the lists' table ids.
 * Route files import from here, never from ./schema.ts (decision 0151).
 */

export const USER_STATUS_FILTERS = ["all", "active", "banned"] as const;
export const USERS_TABLE_ID = "admin-users";
export const ROLES_TABLE_ID = "admin-roles";

/** Filters: `role` is "all", "admin", "user" (no custom role) or a custom role's key, and the status. */
export const userList = listSchema({
	sorts: ["-created", "created", "name", "-name", "email", "-email"],
	filters: {
		role: z
			.string()
			.trim()
			.max(40)
			.regex(/^[a-z0-9-]+$/)
			.default("all")
			.catch("all"),
		status: enumParam(USER_STATUS_FILTERS, "all"),
	},
});
export type UserSearch = z.output<typeof userList.search>;
export type UserListInput = z.output<typeof userList.input>;
