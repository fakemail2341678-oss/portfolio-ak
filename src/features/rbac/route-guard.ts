import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { setErrorStatus } from "@/lib/start/http-status";
import { hasAll, type Permission } from "./permissions";

/**
 * A route's permission gate, for `beforeLoad`. Signed-in users without the
 * permission get the localized FORBIDDEN page with a real 403 during SSR.
 * (The admin layout has already turned anonymous visitors away.) Kept apart from
 * ./can.tsx: it uses Start's isomorphic status helper, which only route modules
 * (compiled by the Start plugin) may import.
 *
 *   beforeLoad: ({ context }) => assertRoutePermission(context.session, "users:read"),
 */
export async function assertRoutePermission(session: Session | null, ...required: Permission[]) {
	if (session && hasAll(session.permissions, required)) return;
	const error = new AppError(session ? "FORBIDDEN" : "UNAUTHORIZED", `Missing permission: ${required.join(", ")}`);
	await setErrorStatus(error);
	throw error;
}
