import "@tanstack/react-start/server-only";
import { and, eq, gt } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { session } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * A user's live sessions, read from the table (decision 0300). Better Auth's
 * `/list-sessions` wants a sign-in from the last day (`freshAge`), so through it the
 * account page failed for anyone signed in longer ago, and so did revoking a device.
 * Listing your own sessions is no sensitive action; revoking one still goes through
 * Better Auth, which checks the session itself.
 */
export const liveSessions = (db: Db, userId: string, now = new Date()) =>
	db
		.select({ id: session.id, token: session.token, createdAt: session.createdAt, userAgent: session.userAgent })
		.from(session)
		.where(and(eq(session.userId, userId), gt(session.expiresAt, now)));

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
