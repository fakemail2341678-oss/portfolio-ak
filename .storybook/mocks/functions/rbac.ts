import { fn } from "storybook/test";
import type { RoleSummary, UserPage } from "../../../src/features/rbac/schema";
import { sampleRoles, sampleUsers } from "../data";

// Stand-ins for src/functions/rbac.ts.
export const listRoles = fn(async (): Promise<RoleSummary[]> => sampleRoles).mockName("listRoles");
export const listRoleOptions = fn(async (): Promise<RoleSummary[]> => sampleRoles).mockName("listRoleOptions");
export const createRole = fn(async (_options: { data: unknown }) => ({ id: "role-new", key: "new" })).mockName(
	"createRole",
);
export const updateRole = fn(async (_options: { data: unknown }) => {}).mockName("updateRole");
export const deleteRole = fn(async (_options: { data: unknown }) => {}).mockName("deleteRole");
export const updateRolePermissions = fn(async (_options: { data: unknown }) => {}).mockName("updateRolePermissions");
export const listUsers = fn(
	async (): Promise<UserPage> => ({ items: sampleUsers, total: sampleUsers.length, page: 1, pageCount: 1 }),
).mockName("listUsers");
export const setUserRoles = fn(async (_options: { data: unknown }) => {}).mockName("setUserRoles");
export const setUserBanned = fn(async (_options: { data: unknown }) => {}).mockName("setUserBanned");
export const revokeUserSessions = fn(async (_options: { data: unknown }) => ({ revoked: 2 })).mockName(
	"revokeUserSessions",
);
export const isUserEmailFree = fn(
	async (options: { data: { email: string } }): Promise<boolean> => options.data.email !== "taken@example.com",
).mockName("isUserEmailFree");
export const inviteUser = fn(async (_options: { data: unknown }) => ({ id: "user-new" })).mockName("inviteUser");
export const impersonateUser = fn(async (_options: { data: unknown }) => {}).mockName("impersonateUser");
