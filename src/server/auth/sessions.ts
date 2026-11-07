import "@tanstack/react-start/server-only";
import { AppError } from "@/lib/errors";

/** The parts of Better Auth's API this needs (`auth.api`), injected so it can be tested. */
export type SessionApi = {
	listSessions: (input: { headers: Headers }) => Promise<Array<{ id: string; token: string }>>;
	getSession: (input: { headers: Headers }) => Promise<{ session: { id: string } } | null>;
	revokeSession: (input: { body: { token: string }; headers: Headers }) => Promise<unknown>;
};

/**
 * Signs out one of the caller's OTHER sessions, chosen by id. Session tokens are
 * bearer credentials, so they stay on the server: the browser only ever sees ids.
 * Ids that aren't the caller's are NOT_FOUND; the current session is refused
 * (signing out is a different action).
 */
export async function revokeOwnSession(api: SessionApi, headers: Headers, id: string): Promise<void> {
	const [sessions, current] = await Promise.all([api.listSessions({ headers }), api.getSession({ headers })]);
	if (current?.session.id === id) throw new AppError("BAD_REQUEST", "Use sign-out for the current session");
	const target = sessions.find((session) => session.id === id);
	if (!target) throw new AppError("NOT_FOUND", "Session not found");
	await api.revokeSession({ body: { token: target.token }, headers });
}
