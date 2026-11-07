import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { Versioned } from "@/components/crud/use-crud-form";
import {
	createRole,
	deleteRole,
	impersonateUser,
	inviteUser,
	listRoleOptions,
	listRoles,
	listUsers,
	revokeUserSessions,
	setUserBanned,
	setUserRoles,
	updateRole,
	updateRolePermissions,
} from "@/functions/rbac";
import { roleKeys, userKeys } from "./keys";
import type { RoleInput, RolePermissionsUpdate, UserInviteInput, UserRolesInput } from "./schema";
import type { UserListInput } from "./search";

export const rolesQueryOptions = () => queryOptions({ queryKey: roleKeys.lists(), queryFn: () => listRoles() });

/** The same roles for the users page (needs users:read instead of roles:read). */
export const roleOptionsQueryOptions = () =>
	queryOptions({ queryKey: userKeys.roleOptions(), queryFn: () => listRoleOptions() });

export const usersListQueryOptions = (input: UserListInput) =>
	queryOptions({ queryKey: userKeys.list(input), queryFn: () => listUsers({ data: input }) });

/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */
export const roleMutations = {
	create: () =>
		mutationOptions({
			mutationKey: [...roleKeys.all, "create"],
			mutationFn: (input: RoleInput) => createRole({ data: input }),
		}),
	update: () =>
		mutationOptions({
			mutationKey: [...roleKeys.all, "update"],
			mutationFn: (input: RoleInput & Versioned) => updateRole({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: [...roleKeys.all, "delete"],
			mutationFn: (id: string) => deleteRole({ data: { id } }),
		}),
	permissions: () =>
		mutationOptions({
			mutationKey: [...roleKeys.all, "permissions"],
			mutationFn: (change: RolePermissionsUpdate) => updateRolePermissions({ data: change }),
		}),
};

export const userMutations = {
	invite: () =>
		mutationOptions({
			mutationKey: [...userKeys.all, "invite"],
			mutationFn: (input: UserInviteInput) => inviteUser({ data: input }),
		}),
	roles: () =>
		mutationOptions({
			mutationKey: [...userKeys.all, "roles"],
			mutationFn: ({ id, ...input }: Omit<UserRolesInput, "userId"> & { id: string }) =>
				setUserRoles({ data: { ...input, userId: id } }),
		}),
	ban: () =>
		mutationOptions({
			mutationKey: [...userKeys.all, "ban"],
			mutationFn: (input: { userId: string; banned: boolean }) => setUserBanned({ data: input }),
		}),
	revokeSessions: () =>
		mutationOptions({
			mutationKey: [...userKeys.all, "sessions"],
			mutationFn: (userId: string) => revokeUserSessions({ data: { userId } }),
		}),
	impersonate: () =>
		mutationOptions({
			mutationKey: [...userKeys.all, "impersonate"],
			mutationFn: (userId: string) => impersonateUser({ data: { userId } }),
		}),
};
