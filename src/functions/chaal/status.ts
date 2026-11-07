import { createServerFn } from "@tanstack/react-start";
import type { ChaalStatus } from "@/features/chaal/schema";
import { withChaalPublic } from "@/middleware/chaal";
import { chaalStatus } from "@/server/chaal/status";

/**
 * Chaal's status for any page (Task 71): the feature switches, and whether this visitor
 * could connect Lichess. Public: starts with `withChaalPublic`.
 */

export const getChaalStatus = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): ChaalStatus => chaalStatus(context.chaal, context.session));
