import { createServerFn } from "@tanstack/react-start";
import { type ContactMessagePage, messageStateSchema } from "@/features/portfolio/schema";
import { messageList } from "@/features/portfolio/search";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as messages from "@/server/portfolio/messages-service";

/**
 * The contact form's inbox (/admin/portfolio/messages, decision 0176): reading
 * needs messages:read; marking, archiving and deleting messages:manage. The form
 * itself is public (src/functions/portfolio-public.ts).
 */

export const listContactMessages = createServerFn({ method: "GET" })
	.middleware([requirePermission("messages:read"), withServices])
	.validator(zodInput(messageList.input))
	.handler(({ data, context }): Promise<ContactMessagePage> => messages.list(context, data));

export const setContactMessageState = createServerFn({ method: "POST" })
	.middleware([requirePermission("messages:manage"), withServices])
	.validator(zodInput(messageStateSchema))
	.handler(({ data, context }): Promise<{ changed: number }> => messages.setState(context, data));

export const deleteContactMessages = createServerFn({ method: "POST" })
	.middleware([requirePermission("messages:manage"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => messages.remove(context, data.ids));
