import { z } from "zod";
import { dateParam, enumParam, pageParam, pageSizeParam, resolvedPageSize, searchParam } from "@/lib/list/params";

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

/** `/settings/$tab`: the profile (Task 91), notifications (Task 92), the lists (Task 89), recurring expenses (Task 94). */
export const SETTINGS_TABS = [
	"profile",
	"notifications",
	"categories",
	"tags",
	"methods",
	"rules",
	"recurring",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** `/insights/$tab` (Task 94, decision 0288): the overview, budgets, trends and a statement. */
export const INSIGHTS_TABS = ["overview", "budgets", "trends", "statement"] as const;
export type InsightsTab = (typeof INSIGHTS_TABS)[number];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const CODE = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Insights' address: the month the overview and trends end at, the currency shown (each
 * total is one currency's), and a statement's days. Missing, the page's: this month, the
 * caller's home currency or the one they spent most in, this month's days.
 */
export const insightsSearch = z.object({
	month: z.string().regex(MONTH).optional().catch(undefined),
	currency: z.string().regex(CODE).optional().catch(undefined),
	from: dateParam(),
	to: dateParam(),
});
export type InsightsSearch = z.infer<typeof insightsSearch>;

/** The overview's and the trends' input: the month (else this one) and the currency (else the page picks). */
export const insightsInput = z.strictObject({
	month: z.string().regex(MONTH).optional(),
	currency: z.string().regex(CODE).optional(),
});
export type InsightsInput = z.infer<typeof insightsInput>;

/** Expenses a statement lists; its totals count them all. */
export const STATEMENT_LINES_MAX = 1_000;

/** The longest statement, in days. */
export const STATEMENT_DAYS_MAX = 731;

/** A statement's days (else this month's), the first not after the last, at most two years. */
export const statementInput = z
	.strictObject({ from: z.string().regex(DAY).optional(), to: z.string().regex(DAY).optional() })
	.refine(
		({ from, to }) =>
			!from ||
			!to ||
			(from <= to &&
				(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 < STATEMENT_DAYS_MAX),
	);
export type StatementInput = z.infer<typeof statementInput>;

/**
 * A statement's days from the address: in order, and at most `STATEMENT_DAYS_MAX` long
 * (counted back from the last), so a hand-typed address never fails the server's check.
 */
export function statementOf(search: Pick<InsightsSearch, "from" | "to">): StatementInput {
	let { from, to } = search;
	if (from && to && from > to) [from, to] = [to, from];
	if (from && to) {
		const earliest = new Date(Date.parse(`${to}T00:00:00Z`) - (STATEMENT_DAYS_MAX - 1) * 86_400_000)
			.toISOString()
			.slice(0, 10);
		if (from < earliest) from = earliest;
	}
	return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

/**
 * The Expenses app's old addresses (Task 95, decision 0289): `/apps/expenses?month=2026-10&currency=USD`
 * showed a month in a currency. Anything else in them is dropped.
 */
export const oldExpensesSearch = z.object({
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.optional()
		.catch(undefined),
	currency: z.enum(["NPR", "USD"]).optional().catch(undefined),
});
export type OldExpensesSearch = z.infer<typeof oldExpensesSearch>;
