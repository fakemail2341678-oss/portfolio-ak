import { fn } from "storybook/test";
import type { InboxPage, NotifySettingsView, UnreadCount } from "../../../../src/features/taskline/types";
import { sampleInbox, sampleNotifySettings } from "../../taskline";

// Stand-ins for src/functions/taskline/inbox.ts.
export const listTasklineInbox = fn(async (): Promise<InboxPage> => sampleInbox).mockName("listTasklineInbox");
export const getTasklineUnread = fn(async (): Promise<UnreadCount> => ({ unread: sampleInbox.unread })).mockName(
	"getTasklineUnread",
);
export const setTasklineNotificationsRead = fn(async (): Promise<UnreadCount> => ({ unread: 0 })).mockName(
	"setTasklineNotificationsRead",
);
export const getTasklineNotifySettings = fn(async (): Promise<NotifySettingsView> => sampleNotifySettings).mockName(
	"getTasklineNotifySettings",
);
export const setTasklineNotifySettings = fn(async (): Promise<NotifySettingsView> => sampleNotifySettings).mockName(
	"setTasklineNotifySettings",
);
