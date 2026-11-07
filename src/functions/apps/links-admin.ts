import { createServerFn } from "@tanstack/react-start";
import { blockLinksInput, deleteLinksInput, type LinkModerationPage } from "@/features/apps/links/admin/schema";
import { linkModerationList } from "@/features/apps/links/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as links from "@/server/apps/links/service";

/** /admin/links (decision 0191): every user's short links, to block, unblock or delete (audited). */

export const listLinksForModeration = createServerFn({ method: "GET" })
	.middleware([requirePermission("links:moderate"), withServices])
	.validator(zodInput(linkModerationList.input))
	.handler(({ data, context }): Promise<LinkModerationPage> => links.listForModeration(context, data));

export const setLinksBlocked = createServerFn({ method: "POST" })
	.middleware([requirePermission("links:moderate"), withServices])
	.validator(zodInput(blockLinksInput))
	.handler(({ data, context }): Promise<void> => links.setLinksBlocked(context, data));

export const deleteModeratedLinks = createServerFn({ method: "POST" })
	.middleware([requirePermission("links:moderate"), withServices])
	.validator(zodInput(deleteLinksInput))
	.handler(({ data, context }): Promise<void> => links.deleteLinks(context, data.ids));
