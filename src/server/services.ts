import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import type { Actor } from "@/features/rbac/types";
import type { Session } from "@/lib/session";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { imageStore } from "@/server/attachments/store";
import { trustedClientIp } from "@/server/auth/client-ip";
import { db } from "@/server/db/client";
import type { Db } from "@/server/db/types";
import { currentRequestId } from "@/server/http/request-scope";

/**
 * What every service function works with (decision 0173): the database, who is
 * acting (rules and the audit log) and the image store (null when Cloudinary
 * isn't configured). Server functions get it from the `withServices` middleware
 * (src/middleware/services.ts) as `context`; tests pass their own:
 *
 *   createItem({ db, actor: { id: "admin-1", isAdmin: true, permissions: [] }, imageStore: null }, input)
 */
export type Services = { db: Db; actor: Actor; imageStore: ImageStore | null };

/** What a public read works with: no one is signed in, so there is no actor. */
export type PublicServices = Pick<Services, "db" | "imageStore">;

export const publicServices = (): PublicServices => ({ db, imageStore });

/** The signed-in user of a server-function call, as `requireUserMiddleware` puts them in its context. */
type CallContext = { user: Session["user"]; permissions: Session["permissions"]; impersonatedBy: string | null };

/**
 * The services of one call: the app's database and store, and the actor with the
 * admin behind an impersonated session, the request id (AsyncLocalStorage, 0123)
 * and the client IP from the same trusted source as the rate limits.
 */
export const servicesFor = (context: CallContext): Services => ({
	db,
	imageStore,
	actor: {
		id: context.user.id,
		isAdmin: context.user.role === "admin",
		permissions: context.permissions,
		impersonatorId: context.impersonatedBy,
		requestId: currentRequestId() ?? null,
		ip: trustedClientIp(getRequest()) ?? null,
	},
});
