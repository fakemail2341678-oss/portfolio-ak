import { hasAll, type Permission } from "./permissions";

/**
 * Who is acting: the signed-in user as the permission rules see them. One type on
 * both sides: the server builds it for every protected call (`context.actor`,
 * src/middleware/services.ts) with where the call came from, for the audit log;
 * the browser gets it from the session (`useActor`, ./can.tsx) to disable what
 * the server would refuse.
 */
export type Actor = {
	id: string;
	/** Better Auth's `role = "admin"`: every permission, and the only one who makes admins (0135). */
	isAdmin: boolean;
	permissions: ReadonlyArray<Permission>;
	/** The admin behind an impersonated session (server only). */
	impersonatorId?: string | null;
	/** The request's id, for the audit log (server only). */
	requestId?: string | null;
	ip?: string | null;
};

/**
 * Whether `actor` may grant, revoke or hand out these permissions: admins any,
 * everyone else only permissions they hold themselves (no self-escalation). The
 * server enforces it (src/server/rbac/service.ts); the matrix and the user-roles
 * dialog disable what it would refuse.
 */
export const canGrant = (actor: Pick<Actor, "isAdmin" | "permissions">, permissions: ReadonlyArray<Permission>) =>
	actor.isAdmin || hasAll(actor.permissions, permissions);
