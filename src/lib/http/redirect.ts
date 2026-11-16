import { z } from "zod";

/**
 * A same-site return path for ?redirect=. Only "/..." paths are allowed, never
 * "//host" or "/\host" (protocol-relative) or absolute URLs, so login can't be
 * turned into an open redirect.
 */
export const safeRedirectPath = z
	.string()
	.max(2048)
	.refine((value) => value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\"));

/**
 * The search of the sign-in pages: where to go afterwards, and why the visitor was sent
 * here. "session-ended": a page they had open asked the server for something after their
 * session expired or was revoked (src/middleware/session-expiry.ts); the login page says so.
 */
export const redirectSearchSchema = z.object({
	redirect: safeRedirectPath.optional().catch(undefined),
	reason: z.enum(["session-ended"]).optional().catch(undefined),
});

export type RedirectSearch = z.infer<typeof redirectSearchSchema>;
