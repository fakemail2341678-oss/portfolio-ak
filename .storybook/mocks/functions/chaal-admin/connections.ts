import { fn } from "storybook/test";
import type { ChaalAdminConnection, ChaalAdminConnectionPage } from "../../../../src/features/chaal/admin/schema";

// Stand-ins for src/functions/chaal-admin/connections.ts.
const PLAY = ["board:play", "challenge:read", "challenge:write", "puzzle:read", "puzzle:write"];

export const chaalAdminConnections: ChaalAdminConnection[] = [
	{
		id: "user-1",
		userName: "Sita Sharma",
		userEmail: "sita@example.com",
		guest: false,
		lichessId: "sita_k",
		username: "Sita_K",
		title: "WFM",
		scopes: PLAY,
		connectedAt: "2026-11-02T09:00:00.000Z",
		lastUsedAt: "2026-11-09T07:30:00.000Z",
		expiresAt: "2027-11-02T09:00:00.000Z",
		state: "active",
		cooldownUntil: null,
		blocked: false,
	},
	{
		id: "guest-2",
		userName: "Guest",
		userEmail: null,
		guest: true,
		lichessId: "pawnstorm",
		username: "pawnstorm",
		title: null,
		scopes: PLAY,
		connectedAt: "2026-11-05T15:10:00.000Z",
		lastUsedAt: null,
		expiresAt: "2027-11-05T15:10:00.000Z",
		state: "revoked",
		cooldownUntil: null,
		blocked: true,
	},
];

export const listChaalConnections = fn(
	async (): Promise<ChaalAdminConnectionPage> => ({
		items: chaalAdminConnections,
		total: chaalAdminConnections.length,
		page: 1,
		pageCount: 1,
	}),
).mockName("listChaalConnections");
export const revokeChaalConnections = fn(async (): Promise<{ revoked: number }> => ({ revoked: 1 })).mockName(
	"revokeChaalConnections",
);
