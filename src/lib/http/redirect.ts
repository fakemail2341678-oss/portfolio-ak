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

export const redirectSearchSchema = z.object({
	redirect: safeRedirectPath.optional().catch(undefined),
});

export type RedirectSearch = z.infer<typeof redirectSearchSchema>;
