import { createMiddleware } from "@tanstack/react-start";
import { AppError } from "@/lib/errors";
import { sessionMiddleware } from "./auth";

/**
 * Taskline's gate (docs/guides/taskline.md, decision 0204): anyone signed in, guests
 * included (they have a sandbox). Rejects anonymous calls with UNAUTHORIZED; adds
 * `context.tasklineUser`: the caller's id, whether they are a guest, and their RBAC
 * permissions (`taskline:read` and `taskline:manage` reach into team projects).
 * Which workspace and project they may touch is the service's question, answered by
 * one resolver (src/server/taskline/access.ts) before anything else.
 */
export const requireTasklineUser = createMiddleware({ type: "function" })
	.middleware([sessionMiddleware])
	.server(({ next, context }) => {
		if (!context.session) throw new AppError("UNAUTHORIZED", "Authentication required");
		return next({
			context: {
				tasklineUser: {
					id: context.session.user.id,
					isGuest: context.session.isAnonymous === true,
					permissions: context.session.permissions,
				},
			},
		});
	});

/**
 * Taskline's services: `context.db`, `context.user` (from `requireTasklineUser`),
 * `context.imageStore` (null when Cloudinary isn't configured) and `context.deliver`
 * (instant notification emails after the write's commit, Task 50):
 *
 *   createServerFn({ method: "POST" })
 *     .middleware([requireTasklineUser, withTasklineServices])
 *     .validator(zodInput(createTaskInput))
 *     .handler(({ data, context }) => tasks.createTask(context, data));
 */
export const withTasklineServices = createMiddleware({ type: "function" })
	.middleware([requireTasklineUser])
	.server(async ({ next, context }) => {
		const [{ db }, { imageStore }, { backgroundDelivery }] = await Promise.all([
			import("@/server/db/client"),
			import("@/server/attachments/store"),
			import("@/server/taskline/notify/deliver"),
		]);
		return next({ context: { db, imageStore, deliver: backgroundDelivery(db), user: context.tasklineUser } });
	});
