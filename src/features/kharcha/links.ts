import { linkOptions } from "@tanstack/react-router";
import type { GroupTab, SettingsTab } from "./search";

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
	spend: () => linkOptions({ to: "/app/kharcha/spend" }),
	/** A CSV into Spend (Task 93). */
	import: () => linkOptions({ to: "/app/kharcha/import" }),
	/** The expense page; over Spend it opens as a panel (a masked route, `spendExpense`). */
	expense: (expenseId: string) => linkOptions({ to: "/app/kharcha/e/$expenseId", params: { expenseId } }),
	settings: (tab: SettingsTab) => linkOptions({ to: "/app/kharcha/settings/$tab", params: { tab } }),
	people: () => linkOptions({ to: "/app/kharcha/people" }),
	/** A group's thread, or one of its other tabs. */
	group: (groupId: string, tab?: GroupTab) =>
		linkOptions({ to: "/app/kharcha/g/$groupId", params: { groupId }, search: tab ? { tab } : {} }),
	/** The thread with a friend. */
	friend: (personId: string) => linkOptions({ to: "/app/kharcha/f/$personId", params: { personId } }),
	join: (token: string) => linkOptions({ to: "/app/kharcha/join/$token", params: { token } }),
};

/** De-localized paths for redirects and `?redirect=` targets. */
export const KHARCHA_PATHS = { landing: "/app/kharcha", home: "/app/kharcha/home" } as const;

/** Kharcha's indexable pages (PLAN 14.5 "SEO"): the sitemap lists them. */
export const KHARCHA_SITEMAP = ["/app/kharcha"] as const;
