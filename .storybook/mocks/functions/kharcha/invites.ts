import { fn } from "storybook/test";
import type { InviteResult, JoinedInvite } from "../../../../src/features/kharcha/types";

// Stand-ins for src/functions/kharcha/invites.ts.
export const inviteKharchaFriend = fn(
	async (): Promise<InviteResult> => ({
		url: "https://example.com/app/kharcha/join/Zk3pQ9xR2mT7vB4nL8sW1yC6hJ0dF5gA",
		expiresAt: "2026-11-26T08:00:00.000Z",
		sent: true,
	}),
).mockName("inviteKharchaFriend");
export const acceptKharchaInvite = fn(
	async (): Promise<JoinedInvite> => ({ groupId: "g-trip", inviterId: "p-asha" }),
).mockName("acceptKharchaInvite");
