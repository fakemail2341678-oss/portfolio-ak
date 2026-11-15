import { fn } from "storybook/test";
import type { FollowingSchedule, InboxData } from "../../../../src/features/parda/schedule/types";

// Stand-ins for src/functions/parda/alerts.ts: nobody is signed in to the workshop, so nothing is followed.
export const getPardaInbox = fn(async (): Promise<InboxData> => ({ imageBase: "", items: [], unread: 0 })).mockName(
	"getPardaInbox",
);
export const setPardaInboxRead = fn(async () => ({ ok: true as const })).mockName("setPardaInboxRead");
export const getPardaFollowing = fn(async (): Promise<FollowingSchedule> => ({ imageBase: "", entries: [] })).mockName(
	"getPardaFollowing",
);
