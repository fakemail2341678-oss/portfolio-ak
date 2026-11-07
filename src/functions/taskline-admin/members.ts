import { createServerFn } from "@tanstack/react-start";
import {
	type AccountOption,
	type AdminInvitation,
	type AdminMemberItem,
	type AdminMemberPage,
	addMembersInput,
	deactivateMemberInput,
	invitationIdInput,
	inviteMemberInput,
	reactivateMemberInput,
	searchAccountsInput,
	updateMemberInput,
} from "@/features/taskline/admin/schema";
import { adminMemberList } from "@/features/taskline/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as invitations from "@/server/taskline/admin/invitations";
import * as members from "@/server/taskline/admin/members";

/**
 * /admin/taskline/members (decision 0212): the team is Taskline's own list. Reads take
 * `taskline:read`, changes and invitations `taskline:manage`; each change is audited.
 */

export const listTasklineMembers = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.validator(zodInput(adminMemberList.input))
	.handler(({ data, context }): Promise<AdminMemberPage> => members.list(context, data));

/** The team's active members, for the admin's pickers (a lead, where tasks go). */
export const listTasklineMemberOptions = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.handler(({ context }): Promise<{ id: string; name: string }[]> => members.options(context));

/** Accounts not on the team (never guests), by name or email: the "Add people" picker. */
export const searchTasklineAccounts = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(searchAccountsInput))
	.handler(({ data, context }): Promise<AccountOption[]> => members.searchAccounts(context, data.q));

export const addTasklineMembers = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(addMembersInput))
	.handler(({ data, context }): Promise<{ added: number }> => members.add(context, data));

export const updateTasklineMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(updateMemberInput))
	.handler(({ data, context }): Promise<AdminMemberItem> => members.update(context, data));

export const deactivateTasklineMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(deactivateMemberInput))
	.handler(({ data, context }): Promise<{ reassigned: number }> => members.deactivate(context, data));

export const reactivateTasklineMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(reactivateMemberInput))
	.handler(({ data, context }): Promise<void> => members.reactivate(context, data));

export const listTasklineInvitations = createServerFn({ method: "GET" })
	.middleware([requirePermission("taskline:read"), withServices])
	.handler(({ context }): Promise<AdminInvitation[]> => invitations.list(context));

export const inviteTasklineMember = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(inviteMemberInput))
	.handler(({ data, context }): Promise<AdminInvitation> => invitations.invite(context, data));

export const resendTasklineInvitation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(invitationIdInput))
	.handler(({ data, context }): Promise<void> => invitations.resend(context, data));

export const revokeTasklineInvitation = createServerFn({ method: "POST" })
	.middleware([requirePermission("taskline:manage"), withServices])
	.validator(zodInput(invitationIdInput))
	.handler(({ data, context }): Promise<void> => invitations.revoke(context, data));
