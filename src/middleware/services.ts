import { createMiddleware } from "@tanstack/react-start";
import { requireUserMiddleware } from "./auth";

/**
 * Adds what a handler hands to its service (decision 0173): `context.db`,
 * `context.actor` (who acts, for the rules and the audit log) and
 * `context.imageStore`. It goes after the permission check, so a refused call
 * builds nothing:
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requirePermission("projects:create"), withServices])
 *     .validator(zodInput(projectInputSchema))
 *     .handler(({ data, context }): Promise<ProjectDetail> => createProject(context, data));
 *
 * The server modules are imported inside `.server()`, which the client build
 * strips: this file reaches the browser through the server-function modules.
 */
export const withServices = createMiddleware({ type: "function" })
	.middleware([requireUserMiddleware])
	.server(async ({ next, context }) => {
		const { servicesFor } = await import("@/server/services");
		return next({ context: servicesFor(context) });
	});

/** For public reads (no user): `context.db` and `context.imageStore`. Their functions decide what's public. */
export const withPublicServices = createMiddleware({ type: "function" }).server(async ({ next }) => {
	const { publicServices } = await import("@/server/services");
	return next({ context: publicServices() });
});
