import { fn } from "storybook/test";
import type { ChaalLabState, ChaalLaneCheck } from "../../../../src/features/chaal/schema";

// Stand-ins for src/functions/chaal-admin/lab.ts.
export const getChaalLab = fn(
	async (): Promise<ChaalLabState> => ({
		setup: {
			tokenKey: true,
			keyId: "Ab12Cd34",
			appToken: false,
			clientId: "chaal",
			apiBase: "https://lichess.org",
			redirectUri: "http://localhost:3000/api/chaal/oauth/callback",
		},
		scopes: ["board:play", "challenge:read", "challenge:write"],
		streamWindowSeconds: 270,
		publicCooldownUntil: null,
		counters: [{ endpoint: "puzzle-daily", calls: 1, errors: 0, rateLimited: 0, avgMs: 210, lastStatus: 200 }],
	}),
).mockName("getChaalLab");
export const checkChaalPublicLane = fn(
	async (): Promise<ChaalLaneCheck> => ({ puzzleId: "PE1hIV9v", rating: 1902, ms: 212 }),
).mockName("checkChaalPublicLane");
