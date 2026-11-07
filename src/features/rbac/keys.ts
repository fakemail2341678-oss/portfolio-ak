import { authKeys } from "@/features/auth/keys";
import { createCrudKeys } from "@/lib/crud/keys";
import type { UserListInput } from "./search";

/** Roles: one list, read whole (the shared key shape, src/lib/crud/keys.ts). */
export const roleKeys = createCrudKeys<never>("roles");

const users = createCrudKeys<UserListInput>("users");

export const userKeys = {
	...users,
	/** The roles again, for the users page's filter and dialog (granted by users:read, not roles:read). */
	roleOptions: () => [...users.all, "role-options"] as const,
};

/**
 * What a change to roles, permissions or someone's roles refreshes: both lists,
 * and the signed-in user's own session (their permissions may have changed too).
 */
export const RBAC_REFRESH = [roleKeys.all, userKeys.all, authKeys.session] as const;
