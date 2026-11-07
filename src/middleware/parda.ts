import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "@/lib/errors";
import { sessionMiddleware } from "./auth";

/**
 * Parda's catalogue gate (PLAN 12.5, decision 0234): open to everyone, signed in or
 * not. Adds `context.catalog`: TMDB, its cache and the controls (takedowns, settings),
 * with the region and the kids' cap, or null when the catalogue isn't configured.
 * Anonymous calls over HTTP are limited per IP. Every function in src/functions/parda
 * that reads the catalogue starts with it (tests/server/guarded-functions.test.ts):
 *
 *   createServerFn({ method: "GET" })
 *     .middleware([withPardaCatalog])
 *     .validator(zodInput(hubInput))
 *     .handler(({ data, context }) => …);
 *
 * The server module is imported inside `.server()`, which the client build strips.
 */
export const withPardaCatalog = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(async ({ next, context }) => {
		const { pardaCatalog } = await import("@/server/parda/catalog/context");
		return next({ context: { catalog: await pardaCatalog(context.session) } });
	});

/**
 * Parda's library gate (PLAN 12.5, decision 0236): anyone with a session, guests
 * included. Rejects anonymous calls with UNAUTHORIZED, and adds `context.pardaViewer`:
 * the user and the active profile (the `pd_profile` cookie's, when it names one of
 * theirs, else the default profile, made on the first call `on conflict do nothing`).
 */
export const requirePardaViewer = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(async ({ next, context }) => {
		if (!context.session) throw new AppError("UNAUTHORIZED", "Authentication required");
		const [{ db }, { resolveViewer, PROFILE_COOKIE }, { getCookie }, { getLocale }] = await Promise.all([
			import("@/server/db/client"),
			import("@/server/parda/profiles/service"),
			import("@tanstack/react-start/server"),
			import("@/paraglide/runtime"),
		]);
		const pardaViewer = await resolveViewer(db, context.session, getCookie(PROFILE_COOKIE), getLocale());
		return next({ context: { pardaViewer } });
	});

/**
 * The library's services: `context.db`, `context.viewer` (from `requirePardaViewer`) and
 * `context.catalog` (for a series' seasons, through the catalogue service, so takedowns apply):
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requirePardaViewer, withPardaServices])
 *     .validator(zodInput(progressInput))
 *     .handler(({ data, context }) => library.saveProgress(context, data));
 */
export const withPardaServices = createMiddleware({ type: "function" })
	.middleware([requirePardaViewer])
	.server(async ({ next, context }) => {
		const [{ db }, { pardaCatalog }] = await Promise.all([
			import("@/server/db/client"),
			import("@/server/parda/catalog/context"),
		]);
		return next({ context: { db, viewer: context.pardaViewer, catalog: await pardaCatalog(context.session) } });
	});
