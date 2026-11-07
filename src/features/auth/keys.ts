/**
 * Auth query keys. Kept apart from ./queries.ts (which imports the auth server
 * functions) so the global session-expiry middleware can use them without
 * pulling server function modules into src/start.ts.
 */
export const authKeys = {
	all: ["auth"] as const,
	session: ["auth", "session"] as const,
	features: ["auth", "features"] as const,
	sessions: ["auth", "sessions"] as const,
	security: ["auth", "security"] as const,
};
