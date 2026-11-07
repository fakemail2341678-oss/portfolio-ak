import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "@/lib/errors";
import { sessionMiddleware } from "./auth";

/**
 * Chaal's public gate (PLAN 13.5, decision 0254): open to everyone, signed in or not.
 * Adds `context.chaal`: the Lichess client, its cache, the controls and the settings.
 * Anonymous calls over HTTP are limited per IP. Every public function in src/functions/chaal
 * starts with it (tests/server/guarded-functions.test.ts):
 *
 *   createServerFn({ method: "GET" })
 *     .middleware([withChaalPublic])
 *     .handler(({ context }) => status.chaalStatus(context.chaal, context.session));
 *
 * The server modules are imported inside `.server()`, which the client build strips.
 */
export const withChaalPublic = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(async ({ next, context }) => {
		const { chaalPublic } = await import("@/server/chaal/context");
		return next({ context: { chaal: await chaalPublic(context.session) } });
	});

/**
 * Chaal's personal gate (PLAN 13.5): anyone with a session, guests included (a guest can
 * connect Lichess too). Rejects anonymous calls with UNAUTHORIZED and blocked users
 * (`ch_block`) with FORBIDDEN; adds `context.chaalUser`.
 */
export const requireChaalUser = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(async ({ next, context }) => {
		// Refused before the server module loads: an anonymous call builds nothing.
		if (!context.session) throw new AppError("UNAUTHORIZED", "Authentication required");
		const { chaalUser } = await import("@/server/chaal/context");
		return next({ context: { chaalUser: await chaalUser(context.session) } });
	});

/**
 * Chaal's services, after `requireChaalUser`: `context.db`, the Lichess client, the vault,
 * the controls, the cache and `context.user`. Each service checks the feature's switch and
 * the connection's scopes before a token is opened (`withToken`):
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requireChaalUser, withChaalServices])
 *     .handler(({ context }) => connect.disconnect(context, context.user.id));
 */
export const withChaalServices = createMiddleware({ type: "function" })
	.middleware([requireChaalUser])
	.server(async ({ next, context }) => {
		const { chaalServices } = await import("@/server/chaal/context");
		return next({ context: await chaalServices(context.chaalUser) });
	});
