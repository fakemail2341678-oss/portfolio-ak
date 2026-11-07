import { fn } from "storybook/test";
import type {
	AccountOption,
	AdminInvitation,
	AdminMemberItem,
	AdminMemberPage,
} from "../../../../src/features/taskline/admin/schema";

// Stand-ins for src/functions/taskline-admin/members.ts.
const sampleMember: AdminMemberItem = {
	id: "55555555-5555-4555-8555-555555555551",
	userId: "user-sita",
	name: "Sita Sharma",
	email: "sita@example.com",
	role: "member",
	title: "Designer",
	capacityMinutesWeek: 2400,
	open: 7,
	overdue: 1,
	projects: 2,
	deactivated: false,
	joinedAt: "2026-09-01T04:00:00.000Z",
};

export const listTasklineMembers = fn(
	async (_options: { data: unknown }): Promise<AdminMemberPage> => ({
		items: [sampleMember, { ...sampleMember, id: "55555555-5555-4555-8555-555555555552", name: "Ram Thapa", open: 3 }],
		total: 2,
		page: 1,
		pageCount: 1,
	}),
).mockName("listTasklineMembers");
export const listTasklineMemberOptions = fn(
	async (): Promise<{ id: string; name: string }[]> => [
		{ id: "55555555-5555-4555-8555-555555555551", name: "Sita Sharma" },
		{ id: "55555555-5555-4555-8555-555555555552", name: "Ram Thapa" },
	],
).mockName("listTasklineMemberOptions");
export const searchTasklineAccounts = fn(
	async (_options: { data: unknown }): Promise<AccountOption[]> => [
		{ value: "user-gita", label: "Gita Rai · gita@example.com" },
	],
).mockName("searchTasklineAccounts");
export const addTasklineMembers = fn(
	async (_options: { data: unknown }): Promise<{ added: number }> => ({
		added: 1,
	}),
).mockName("addTasklineMembers");
export const updateTasklineMember = fn(
	async (_options: { data: unknown }): Promise<AdminMemberItem> => sampleMember,
).mockName("updateTasklineMember");
export const deactivateTasklineMember = fn(
	async (_options: { data: unknown }): Promise<{ reassigned: number }> => ({ reassigned: 0 }),
).mockName("deactivateTasklineMember");
export const reactivateTasklineMember = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"reactivateTasklineMember",
);
const sampleInvitation: AdminInvitation = {
	id: "77777777-7777-4777-8777-777777777777",
	email: "gita@example.com",
	role: "member",
	project: { id: "11111111-1111-4111-8111-111111111111", key: "WEB", name: "Website relaunch" },
	invitedBy: "Sita Sharma",
	expiresAt: "2026-11-07T04:00:00.000Z",
	expired: false,
	createdAt: "2026-10-31T04:00:00.000Z",
};
export const listTasklineInvitations = fn(async (): Promise<AdminInvitation[]> => [sampleInvitation]).mockName(
	"listTasklineInvitations",
);
export const inviteTasklineMember = fn(
	async (_options: { data: unknown }): Promise<AdminInvitation> => sampleInvitation,
).mockName("inviteTasklineMember");
export const resendTasklineInvitation = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"resendTasklineInvitation",
);
export const revokeTasklineInvitation = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"revokeTasklineInvitation",
);
