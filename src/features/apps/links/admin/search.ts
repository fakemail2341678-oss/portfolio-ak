import type { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";

/** The URL contract of /admin/links (decision 0191; route files import this). */

export const LINK_MODERATION_TABLE_ID = "admin-links";
export const LINK_MODERATION_STATES = ["all", "live", "blocked", "guest"] as const;

/** Newest first. Filters: `q` (slug, target, title, the owner's name or email) and the state. */
export const linkModerationList = listSchema({
	sorts: ["-created", "created", "slug", "-slug"],
	filters: { state: enumParam(LINK_MODERATION_STATES, "all") },
});
export type LinkModerationSearch = z.output<typeof linkModerationList.search>;
export type LinkModerationInput = z.output<typeof linkModerationList.input>;
