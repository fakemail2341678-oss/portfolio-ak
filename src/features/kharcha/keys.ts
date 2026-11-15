import type { PeopleInput, SettleUpInput } from "./schema";
import type { InsightsInput, SpendChartInput, SpendListInput, StatementInput } from "./search";

/**
 * Kharcha's queries (TanStack Query only, PLAN 14.5 "Client state"). Every key starts with
 * the caller's id, so a change of session never shows another's data, and `kharchaKeys.user`
 * is what a moved `rev` refetches.
 */
export const kharchaKeys = {
	all: ["kharcha"] as const,
	user: (userId: string) => [...kharchaKeys.all, userId] as const,
	me: (userId: string) => [...kharchaKeys.user(userId), "me"] as const,
	home: (userId: string) => [...kharchaKeys.user(userId), "home"] as const,
	spend: (userId: string, input: SpendListInput) => [...kharchaKeys.user(userId), "spend", input] as const,
	spendChart: (userId: string, input: SpendChartInput) => [...kharchaKeys.user(userId), "spend-chart", input] as const,
	expense: (userId: string, expenseId: string) => [...kharchaKeys.user(userId), "expense", expenseId] as const,
	lists: (userId: string) => [...kharchaKeys.user(userId), "lists"] as const,
	merchants: (userId: string) => [...kharchaKeys.user(userId), "merchants"] as const,
	people: (userId: string, input: PeopleInput) => [...kharchaKeys.user(userId), "people", input] as const,
	friends: (userId: string) => [...kharchaKeys.user(userId), "friends"] as const,
	groups: (userId: string) => [...kharchaKeys.user(userId), "groups"] as const,
	groupThread: (userId: string, groupId: string) => [...kharchaKeys.user(userId), "group", groupId] as const,
	friendThread: (userId: string, personId: string) => [...kharchaKeys.user(userId), "friend", personId] as const,
	groupTotals: (userId: string, groupId: string) => [...kharchaKeys.user(userId), "group-totals", groupId] as const,
	settleUp: (userId: string, input: SettleUpInput) => [...kharchaKeys.user(userId), "settle-up", input] as const,
	payment: (userId: string, paymentId: string) => [...kharchaKeys.user(userId), "payment", paymentId] as const,
	/** Task 94: budgets, recurring expenses and insights. */
	budgets: (userId: string) => [...kharchaKeys.user(userId), "budgets"] as const,
	recurring: (userId: string) => [...kharchaKeys.user(userId), "recurring"] as const,
	insights: (userId: string, tab: "overview" | "trends" | "statement", input: InsightsInput | StatementInput) =>
		[...kharchaKeys.user(userId), "insights", tab, input] as const,
	/** Outside `user`: a visitor without a session reads it too. */
	join: (token: string) => [...kharchaKeys.all, "join", token] as const,
	/** Outside `user`: polling it mustn't refetch itself. */
	rev: (userId: string) => [...kharchaKeys.all, "rev", userId] as const,
};
