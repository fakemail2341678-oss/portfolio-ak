import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "@/lib/errors";
import { sessionMiddleware } from "./auth";

/**
 * Kharcha's gate (docs/guides/kharcha.md, decision 0277): anyone signed in, guests
 * included (they have sample data of their own). Rejects anonymous calls with
 * UNAUTHORIZED; adds `context.kharchaUser`: the caller's id, whether they are a guest,
 * and their RBAC permissions. What they may see and change is the service's question,
 * answered by the resolvers (src/server/kharcha/access.ts) before anything else.
 */
export const requireKharchaUser = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(({ next, context }) => {
		if (!context.session) throw new AppError("UNAUTHORIZED", "Authentication required");
		return next({
			context: {
				kharchaUser: {
					id: context.session.user.id,
					isGuest: context.session.isAnonymous === true,
					permissions: context.session.permissions,
				},
			},
		});
	});

/**
 * Kharcha's services: `context.db`, `context.user` (from `requireKharchaUser`) and
 * `context.imageStore` (Cloudinary, for receipts; null when it isn't configured):
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requireKharchaUser, withKharchaServices])
 *     .validator(zodInput(createExpenseInput))
 *     .handler(({ data, context }) => expenses.createExpense(context, data));
 */
export const withKharchaServices = createMiddleware({ type: "function" })
	.middleware([requireKharchaUser])
	.server(async ({ next, context }) => {
		const [{ db }, { imageStore }] = await Promise.all([
			import("@/server/db/client"),
			import("@/server/attachments/store"),
		]);
		return next({ context: { db, imageStore, user: context.kharchaUser } });
	});
