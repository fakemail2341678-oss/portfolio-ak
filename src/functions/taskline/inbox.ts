import { createServerFn } from "@tanstack/react-start";
import { inboxInput, markReadInput, notifySettingsInput } from "@/features/taskline/schema";
import type { InboxPage, NotifySettingsView, UnreadCount } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as inbox from "@/server/taskline/notify/inbox";

/** The caller's inbox and notification settings (Task 50): their own rows only, across their workspaces. */

export const listTasklineInbox = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(inboxInput))
	.handler(({ data, context }): Promise<InboxPage> => inbox.listInbox(context, data));

/** What the sidebar's badge polls every minute. */
export const getTasklineUnread = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<UnreadCount> => inbox.unreadCount(context));

export const markTasklineRead = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(markReadInput))
	.handler(({ data, context }): Promise<UnreadCount> => inbox.markRead(context, data));

export const getTasklineNotifySettings = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<NotifySettingsView> => inbox.getNotifySettings(context));

export const saveTasklineNotifySettings = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(notifySettingsInput))
	.handler(({ data, context }): Promise<NotifySettingsView> => inbox.saveNotifySettings(context, data));
