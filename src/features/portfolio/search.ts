import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";
import { SLUG_PATTERN } from "@/lib/slug";
import { DISCIPLINES, MESSAGE_STATES_FILTER, PORTFOLIO_STATUSES } from "./constants";

/**
 * The portfolio's URL contracts: the public pages' search and path params, and
 * the admin lists'. Route files import from here, never from ./schema.ts (its
 * form schemas stay out of every page's JavaScript, decision 0151).
 */

/**
 * `?preview=1` on a case study or an article: shows a draft to someone holding
 * portfolio:read (the server checks; everyone else gets the published page or a
 * 404). Such pages are noindex.
 */
const preview = z.literal(1).optional().catch(undefined);

/** /work?discipline=frontend. A bad value means "all" (forgiving, like every list URL). */
export const workSearchSchema = z.object({ discipline: z.enum(DISCIPLINES).optional().catch(undefined) });

/** /work/$slug and /journal/$slug: the preview flag. */
export const previewSearchSchema = z.object({ preview });

/** Path params of detail pages: anything that isn't a slug can't exist (the route doesn't match). */
export const portfolioSlugParamSchema = z.object({ slug: z.string().max(80).regex(SLUG_PATTERN) });

// ---------------------------------------------------------------------------
// Admin lists
// ---------------------------------------------------------------------------

const statusFilter = enumParam(["all", ...PORTFOLIO_STATUSES], "all");

/** /admin/portfolio/projects: in display order by default. */
export const projectList = listSchema({
	sorts: ["order", "-updated", "updated", "title", "-title", "-year", "year"],
	filters: { status: statusFilter },
});
export type ProjectSearch = z.output<typeof projectList.search>;
export type ProjectListInput = z.output<typeof projectList.input>;

/** /admin/portfolio/journal: newest first by default (drafts, which have no date yet, first). */
export const postList = listSchema({
	sorts: ["-published", "published", "-updated", "updated", "title", "-title"],
	filters: { status: statusFilter },
});
export type PostSearch = z.output<typeof postList.search>;
export type PostListInput = z.output<typeof postList.input>;

/** /admin/portfolio/messages: the inbox (unread and read), or the archive. */
export const messageList = listSchema({
	sorts: ["-received", "received"],
	filters: { state: enumParam(MESSAGE_STATES_FILTER, "inbox") },
});
export type MessageSearch = z.output<typeof messageList.search>;
export type MessageListInput = z.output<typeof messageList.input>;
