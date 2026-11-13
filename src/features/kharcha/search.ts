import { z } from "zod";
import { arrayParam, enumParam, pageParam, pageSizeParam, resolvedPageSize, searchParam } from "@/lib/list/params";

/**
 * Kharcha's URL contracts (src/lib/list): what route files import, never `schema.ts` (0194).
 * Spend (Task 89): this month by default, newest first; Task 93 adds the search language and views.
 */

export const SPEND_SORTS = ["-date", "date", "-amount", "amount"] as const;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** `?month=2026-11`, or `all`; absent: this month in the caller's time zone. */
const month = z.union([z.literal("all"), z.string().regex(MONTH)]);
/** A category of the caller's, or `none`: uncategorized. */
const categoryValue = z.union([z.literal("none"), z.uuid()]);

export const spendSearch = z.object({
	q: searchParam(),
	month: month.optional().catch(undefined),
	category: arrayParam(categoryValue),
	sort: enumParam(SPEND_SORTS, "-date"),
	page: pageParam(),
	pageSize: pageSizeParam(),
	/** The expense open in the panel over the list (a masked route showing /e/$expenseId). */
	expense: z.uuid().optional().catch(undefined),
});
export type SpendSearch = z.infer<typeof spendSearch>;

/** What Spend's links leave out of the address (stripSearchParams): the defaults. */
export const SPEND_SEARCH_DEFAULTS = { q: "", category: [] as string[], sort: "-date", page: 1 } as const;

/** The server's input for a page of Spend: the same params, resolved. */
export const spendListInput = z.strictObject({
	q: z.string().trim().max(80).default(""),
	month: month.optional(),
	category: z.array(categoryValue).max(20).default([]),
	sort: z.enum(SPEND_SORTS).default("-date"),
	page: z.number().int().min(1).max(10_000).default(1),
	pageSize: resolvedPageSize(),
});
export type SpendListInput = z.infer<typeof spendListInput>;

/** `/people` (Task 90): a search over the caller's friends and groups, and whether hidden friends are listed. */
export const peopleSearch = z.object({
	q: searchParam(),
	hidden: z.literal(true).optional().catch(undefined),
});
export type PeopleSearch = z.infer<typeof peopleSearch>;
export const PEOPLE_SEARCH_DEFAULTS = { q: "" } as const;

/** A group's tabs: its thread and settings (Task 90), its balances and totals (Task 91). */
export const GROUP_TABS = ["thread", "balances", "totals", "settings"] as const;
export type GroupTab = (typeof GROUP_TABS)[number];

/** `/g/$groupId` and `/f/$personId`: the tab, and the expense open in the panel over the thread (a masked route). */
export const threadSearch = z.object({
	tab: enumParam(GROUP_TABS, "thread"),
	expense: z.uuid().optional().catch(undefined),
});
export type ThreadSearch = z.infer<typeof threadSearch>;
export const THREAD_SEARCH_DEFAULTS = { tab: "thread" } as const;

/** An invite link's token: 32 characters of base64url (src/server/kharcha/invites/service.ts). */
export const JOIN_TOKEN = /^[\w-]{32}$/;

/** `/settings/$tab`: the profile (Task 91), the lists (Task 89); notifications and recurring arrive with theirs. */
export const SETTINGS_TABS = ["profile", "categories", "tags", "methods", "rules"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
