import { fn } from "storybook/test";
import type { ChaalConnection } from "../../../../src/features/chaal/schema";

// Stand-ins for src/functions/chaal/connection.ts.
const sampleConnection: ChaalConnection = {
	lichessId: "e2e_player",
	username: "E2E_Player",
	title: null,
	scopes: ["board:play", "challenge:read", "challenge:write", "puzzle:read", "puzzle:write"],
	connectedAt: "2026-11-07T10:00:00.000Z",
	lastUsedAt: null,
	expiresAt: "2027-11-07T10:00:00.000Z",
	revoked: false,
	needsScopesFor: [],
};

export const getChaalConnection = fn(async (): Promise<ChaalConnection | null> => sampleConnection).mockName(
	"getChaalConnection",
);
export const disconnectChaal = fn(async (): Promise<void> => {}).mockName("disconnectChaal");
