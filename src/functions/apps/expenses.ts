import { createServerFn } from "@tanstack/react-start";
import {
	budgetInput,
	categoryInput,
	expenseIdInput,
	expenseInput,
	expensesMonthInput,
	importInput,
} from "@/features/apps/expenses/schema";
import type {
	CategoryWithUsage,
	ExpenseCategory,
	ExpenseExportRow,
	ExpenseItem,
	ExpensesMonth,
	ImportResult,
} from "@/features/apps/expenses/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppUser, withAppServices } from "@/middleware/apps";
import * as expenses from "@/server/apps/expenses/service";

/**
 * Expenses (/apps/expenses, decision 0192): any signed-in user, guests included
 * (`requireAppUser`), each acting on their own rows only; the input validated with the
 * shared schema, then one call into the service.
 */

export const getExpensesMonth = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(expensesMonthInput))
	.handler(({ data, context }): Promise<ExpensesMonth> => expenses.getMonth(context, data));

export const createExpense = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(expenseInput))
	.handler(({ data, context }): Promise<ExpenseItem> => expenses.createExpense(context, data));

export const updateExpense = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(expenseInput))
	.handler(({ data, context }): Promise<ExpenseItem> => expenses.updateExpense(context, data));

export const deleteExpense = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<void> => expenses.deleteExpense(context, data.id));

export const listExpenseCategories = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.handler(({ context }): Promise<CategoryWithUsage[]> => expenses.listCategories(context));

export const createExpenseCategory = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(categoryInput))
	.handler(({ data, context }): Promise<ExpenseCategory> => expenses.createCategory(context, data));

export const updateExpenseCategory = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(categoryInput))
	.handler(({ data, context }): Promise<ExpenseCategory> => expenses.updateCategory(context, data));

export const deleteExpenseCategory = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<void> => expenses.deleteCategory(context, data.id));

export const setExpenseBudget = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(budgetInput))
	.handler(({ data, context }): Promise<void> => expenses.setBudget(context, data));

export const importExpenses = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(importInput))
	.handler(({ data, context }): Promise<ImportResult> => expenses.importExpenses(context, data));

export const exportExpenses = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.handler(({ context }): Promise<ExpenseExportRow[]> => expenses.exportExpenses(context));
