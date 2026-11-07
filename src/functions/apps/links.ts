import { createServerFn } from "@tanstack/react-start";
import { createLinkInput, linkIdInput, updateLinkInput } from "@/features/apps/links/schema";
import type { LinkItem, LinkList, LinkStats } from "@/features/apps/links/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppUser, withAppServices } from "@/middleware/apps";
import * as links from "@/server/apps/links/service";

/**
 * Links (/apps/links, decision 0191): any signed-in user, guests included
 * (`requireAppUser`), each acting on their own links only; the input validated with
 * the shared schema, then one call into the service. The redirect is a server route
 * (src/routes/l/$slug.ts), not a function.
 */

export const listLinks = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.handler(({ context }): Promise<LinkList> => links.listLinks(context));

export const getLinkStats = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(linkIdInput))
	.handler(({ data, context }): Promise<LinkStats> => links.getLinkStats(context, data.id));

export const createLink = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(createLinkInput))
	.handler(({ data, context }): Promise<LinkItem> => links.createLink(context, data));

export const updateLink = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(updateLinkInput))
	.handler(({ data, context }): Promise<LinkItem> => links.updateLink(context, data));

export const deleteLink = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(linkIdInput))
	.handler(({ data, context }): Promise<void> => links.deleteLink(context, data.id));
