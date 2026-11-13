import { linkOptions } from "@tanstack/react-router";
import type { GroupTab, InsightsSearch, InsightsTab, OldExpensesSearch, SettingsTab } from "./search";

/**
 * Every link into Kharcha (PLAN 14.2, "Name"): pages link through these, so renaming the
 * app is a move of `src/routes/_kharcha/app/kharcha` and this file. Each task adds its pages.
 */
export const kharchaLinks = {
	landing: () => linkOptions({ to: "/app/kharcha" }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/kharcha/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/kharcha/sign-up", search: { redirect } }),
	home: () => linkOptions({ to: "/app/kharcha/home" }),
	/** Home's Updates (Task 92): where the bell goes. */
	updates: () => linkOptions({ to: "/app/kharcha/home", hash: "updates" }),
	account: () => linkOptions({ to: "/app/kharcha/account" }),
	/** Spend, perhaps with a search in its language (`date:2026-10`). */
	spend: (q?: string) => linkOptions({ to: "/app/kharcha/spend", search: q ? { q } : {} }),
	/** A CSV into Spend (Task 93). */
	import: () => linkOptions({ to: "/app/kharcha/import" }),
	/** The expense page; over Spend it opens as a panel (a masked route, `spendExpense`). */
	expense: (expenseId: string) => linkOptions({ to: "/app/kharcha/e/$expenseId", params: { expenseId } }),
	/** Insights (Task 94): a tab, with its month, currency or days. */
	insights: (tab: InsightsTab, search: InsightsSearch = {}) =>
		linkOptions({ to: "/app/kharcha/insights/$tab", params: { tab }, search }),
	settings: (tab: SettingsTab) => linkOptions({ to: "/app/kharcha/settings/$tab", params: { tab } }),
	people: () => linkOptions({ to: "/app/kharcha/people" }),
	/** A group's thread, or one of its other tabs. */
	group: (groupId: string, tab?: GroupTab) =>
		linkOptions({ to: "/app/kharcha/g/$groupId", params: { groupId }, search: tab ? { tab } : {} }),
	/** The thread with a friend. */
	friend: (personId: string) => linkOptions({ to: "/app/kharcha/f/$personId", params: { personId } }),
	join: (token: string) => linkOptions({ to: "/app/kharcha/join/$token", params: { token } }),
};

/**
 * Where an address of the Expenses app goes now (Task 95, decision 0289), and whether for good:
 * its dashboard is Kharcha (a month of it, a Spend search), its categories Settings → Categories,
 * its import Kharcha's. A path it never had goes to Kharcha for now.
 */
export function oldExpensesLink(splat: string, search: OldExpensesSearch) {
	const path = splat.replace(/^\/+|\/+$/g, "");
	if (path === "categories") return { link: kharchaLinks.settings("categories"), permanent: true };
	if (path === "import") return { link: kharchaLinks.import(), permanent: true };
	if (path !== "") return { link: kharchaLinks.landing(), permanent: false };
	if (!search.month) return { link: kharchaLinks.landing(), permanent: true };
	const q = [`date:${search.month}`, ...(search.currency ? [`currency:${search.currency}`] : [])].join(" ");
	return { link: kharchaLinks.spend(q), permanent: true };
}

/** De-localized paths for redirects and `?redirect=` targets. */
export const KHARCHA_PATHS = { landing: "/app/kharcha", home: "/app/kharcha/home" } as const;

/** Kharcha's indexable pages (PLAN 14.5 "SEO"): the sitemap lists them. */
export const KHARCHA_SITEMAP = ["/app/kharcha"] as const;
