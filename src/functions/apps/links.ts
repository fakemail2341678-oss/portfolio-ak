import { createServerFn } from "@tanstack/react-start";
import { createLinkInputSchema, linkIdInputSchema, updateLinkInputSchema } from "@/features/apps/links/schema";
import type { LinkItem, LinkList, LinkStats } from "@/features/apps/links/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppsUser, withAppsServices } from "@/middleware/apps";
import * as links from "@/server/apps/links/service";

/**
 * Links (/apps/links, decision 0191): any signed-in user, guests included
 * (`requireAppsUser`), each acting on their own links only; the input validated with
 * the shared schema, then one call into the service. The redirect is a server route
 * (src/routes/l/$slug.ts), not a function.
 */

export const listLinks = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.handler(({ context }): Promise<LinkList> => links.listLinks(context));

export const getLinkStats = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(linkIdInputSchema))
	.handler(({ data, context }): Promise<LinkStats> => links.getLinkStats(context, data.id));

export const createLink = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(createLinkInputSchema))
	.handler(({ data, context }): Promise<LinkItem> => links.createLink(context, data));

export const updateLink = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(updateLinkInputSchema))
	.handler(({ data, context }): Promise<LinkItem> => links.updateLink(context, data));

export const deleteLink = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(linkIdInputSchema))
	.handler(({ data, context }): Promise<void> => links.deleteLink(context, data.id));
