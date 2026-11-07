import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createExpense,
	createExpenseCategory,
	deleteExpense,
	deleteExpenseCategory,
	getExpensesMonth,
	importExpenses,
	listExpenseCategories,
	setExpenseBudget,
	updateExpense,
	updateExpenseCategory,
} from "@/functions/apps/expenses";
import type { BudgetInput, CategoryInput, ExpenseInput, ImportInput } from "./schema";
import type { ExpenseCurrency } from "./types";

/**
 * Expenses' reads and writes (decision 0192): plain Query. Keys carry the user's id, so
 * another account signing in on the same tab never sees cached rows. Every write
 * invalidates the user's keys: a new expense moves the month's totals, the charts,
 * the budgets and the categories' counts at once.
 */
export const expensesKeys = {
	all: ["apps", "expenses"] as const,
	user: (userId: string) => [...expensesKeys.all, userId] as const,
	/** `month` undefined is the current month (the server's, in the app's time zone). */
	month: (userId: string, month: string | undefined, currency: ExpenseCurrency) =>
		[...expensesKeys.user(userId), "month", month ?? "current", currency] as const,
	categories: (userId: string) => [...expensesKeys.user(userId), "categories"] as const,
};

export const expensesMonthQueryOptions = (userId: string, month: string | undefined, currency: ExpenseCurrency) =>
	queryOptions({
		queryKey: expensesKeys.month(userId, month, currency),
		queryFn: () => getExpensesMonth({ data: { month, currency } }),
	});

export const expenseCategoriesQueryOptions = (userId: string) =>
	queryOptions({ queryKey: expensesKeys.categories(userId), queryFn: () => listExpenseCategories() });

const refresh = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: expensesKeys.user(userId) });

/** A write that refreshes everything of the user's once it is settled. */
const write = <TInput, TResult>(queryClient: QueryClient, userId: string, run: (input: TInput) => Promise<TResult>) =>
	mutationOptions({ mutationFn: run, onSettled: () => refresh(queryClient, userId) });

export const expenseMutations = {
	create: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: ExpenseInput) => createExpense({ data: input })),
	update: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: ExpenseInput) => updateExpense({ data: input })),
	delete: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (id: string) => deleteExpense({ data: { id } })),
	createCategory: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CategoryInput) => createExpenseCategory({ data: input })),
	updateCategory: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: CategoryInput) => updateExpenseCategory({ data: input })),
	deleteCategory: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (id: string) => deleteExpenseCategory({ data: { id } })),
	setBudget: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: BudgetInput) => setExpenseBudget({ data: input })),
	import: (queryClient: QueryClient, userId: string) =>
		write(queryClient, userId, (input: ImportInput) => importExpenses({ data: input })),
};
