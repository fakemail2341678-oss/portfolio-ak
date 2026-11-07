import "@tanstack/react-start/server-only";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { Role, Session } from "@/lib/session";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
import { forgetRequestMemo, requestMemo } from "@/server/http/request-scope";
import { permissionsForUser } from "@/server/rbac/repository";
import { auth } from "./auth";
import { mustSetUpTwoFactor } from "./policy";

const toRole = (value: unknown): Role => (value === "admin" ? "admin" : "user");

const SESSION_MEMO = "session";

/**
 * The signed-in user for the current request, validated against the database
 * by Better Auth (expired, revoked and banned sessions return null), with their
 * permissions resolved from the database for this request.
 *
 * Resolved once per request (decision 0153): the root route, the admin gate and
 * every server function called while rendering the page share one lookup, instead
 * of each running Better Auth's session query and the permissions query again.
 *
 * With AUTH_REQUIRE_ADMIN_2FA on, a user with admin permissions and no second
 * factor gets none of them until they turn it on (`twoFactorRequired`), so every
 * `requirePermission` refuses and the admin gate sends them to set it up.
 */
export const getServerSession = (): Promise<Session | null> => requestMemo(SESSION_MEMO, loadSession);

/** For a request that changes the session (e.g. stopping impersonation): the next read looks it up again. */
export const forgetSession = () => forgetRequestMemo(SESSION_MEMO);

const loadSession = async (): Promise<Session | null> => {
	const result = await auth.api.getSession({ headers: getRequestHeaders() });
	if (!result) return null;
	const { user } = result;
	const impersonation = result.session.impersonatedBy ? { impersonatedBy: result.session.impersonatedBy } : {};
	const role = toRole(user.role);
	const twoFactorEnabled = user.twoFactorEnabled === true;
	const sessionUser = { id: user.id, email: user.email, name: user.name, role, twoFactorEnabled };
	// A guest (decision 0185) holds no permissions: permissionsForUser returns none without a query.
	const isAnonymous = user.isAnonymous === true;
	const permissions = await permissionsForUser(db, { id: user.id, role, banned: user.banned ?? false, isAnonymous });
	if (isAnonymous) return { user: sessionUser, permissions, isAnonymous: true };
	if (mustSetUpTwoFactor({ required: serverEnv.AUTH_REQUIRE_ADMIN_2FA, permissions, twoFactorEnabled })) {
		return { user: sessionUser, permissions: [], twoFactorRequired: true, ...impersonation };
	}
	return { user: sessionUser, permissions, ...impersonation };
};
