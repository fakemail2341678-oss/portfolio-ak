import { z } from "zod";
import { enumParam, pageParam, pageSizeParam, resolvedPageSize, searchParam } from "@/lib/list/params";

/**
 * Kharcha's URL contracts (src/lib/list): what route files import, never `schema.ts` (0194).
 * Spend (Task 93, decision 0287): `q` in the search language (src/features/kharcha/spend/query),
 * the view, what a chart groups by and its kind, the order and the page.
 */

export const SPEND_SORTS = ["-date", "date", "-amount", "amount"] as const;
export const SPEND_VIEWS = ["list", "table", "chart"] as const;
export type SpendView = (typeof SPEND_VIEWS)[number];
export const SPEND_GROUP_BY = [
	"category",
	"merchant",
	"tag",
	"method",
	"group",
	"friend",
	"day",
	"week",
	"month",
	"year",
] as const;
export type SpendGroupBy = (typeof SPEND_GROUP_BY)[number];
export const SPEND_CHARTS = ["bar", "donut", "line"] as const;

/** `q`'s longest form, in the address and in the server's input. */
export const QUERY_MAX = 300;

/** One of the bar's controls as a form sends it without JavaScript; the page folds it into `q`. */
const barControl = z.string().trim().max(80).optional().catch(undefined);

export const spendSearch = z.object({
	q: searchParam(QUERY_MAX),
	view: enumParam(SPEND_VIEWS, "list"),
	groupBy: enumParam(SPEND_GROUP_BY, "category"),
	chart: enumParam(SPEND_CHARTS, "bar"),
	sort: enumParam(SPEND_SORTS, "-date"),
	page: pageParam(),
	pageSize: pageSizeParam(),
	/** The expense open in the panel over the list (a masked route showing /e/$expenseId). */
	expense: z.uuid().optional().catch(undefined),
	type: barControl,
	category: barControl,
	date: barControl,
});
export type SpendSearch = z.infer<typeof spendSearch>;

/** What Spend's links leave out of the address (stripSearchParams): the defaults. */
export const SPEND_SEARCH_DEFAULTS = {
	q: "",
	view: "list",
	groupBy: "category",
	chart: "bar",
	sort: "-date",
	page: 1,
} as const;

const query = z.string().trim().max(QUERY_MAX).default("");

/** The server's input for a page of Spend: the same params, resolved. */
export const spendListInput = z.strictObject({
	q: query,
	sort: z.enum(SPEND_SORTS).default("-date"),
	page: z.number().int().min(1).max(10_000).default(1),
	pageSize: resolvedPageSize(),
});
export type SpendListInput = z.infer<typeof spendListInput>;

/** A chart of the search: the caller's spending summed by `groupBy`, per currency. */
export const spendChartInput = z.strictObject({ q: query, groupBy: z.enum(SPEND_GROUP_BY) });
export type SpendChartInput = z.infer<typeof spendChartInput>;

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

/** `/settings/$tab`: the profile (Task 91), notifications (Task 92), the lists (Task 89); recurring arrives with Task 94. */
export const SETTINGS_TABS = ["profile", "notifications", "categories", "tags", "methods", "rules"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
