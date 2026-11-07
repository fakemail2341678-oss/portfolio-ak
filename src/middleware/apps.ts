import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "@/lib/errors";
import { sessionMiddleware } from "./auth";

/**
 * The showcase apps' gate (decision 0185): anyone signed in, guests included.
 * Rejects anonymous calls with UNAUTHORIZED; adds `context.appUser`: the user's id
 * and whether they are a guest (a guest can't publish anything, 0186). An app's
 * functions scope every read and write to `appUser.id` (`ownedBy`), so no
 * permission is involved: each user only ever sees their own rows.
 */
export const requireAppUser = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(({ next, context }) => {
		if (!context.session) throw new AppError("UNAUTHORIZED", "Authentication required");
		return next({
			context: { appUser: { id: context.session.user.id, isGuest: context.session.isAnonymous === true } },
		});
	});

/**
 * The showcase apps' services (decisions 0185, 0187): `context.db`, `context.user`
 * (the caller's id and whether they are a guest) and `context.imageStore` (null when
 * Cloudinary isn't configured; Notes' images, 0190), after `requireAppUser`:
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requireAppUser, withAppServices])
 *     .validator(zodInput(createCardInput))
 *     .handler(({ data, context }) => notes.createNote(context, data));
 */
export const withAppServices = createMiddleware({ type: "function" })
	.middleware([requireAppUser])
	.server(async ({ next, context }) => {
		const [{ db }, { imageStore }] = await Promise.all([
			import("@/server/db/client"),
			import("@/server/attachments/store"),
		]);
		return next({ context: { db, imageStore, user: context.appUser } });
	});
