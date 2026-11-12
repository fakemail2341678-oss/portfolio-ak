import { createServerFn } from "@tanstack/react-start";
import { createExpenseInput, expenseIdInput, updateExpenseInput } from "@/features/kharcha/schema";
import type { ExpenseView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as expenses from "@/server/kharcha/expenses/service";

/**
 * Kharcha's expenses (docs/guides/kharcha.md): anyone signed in, guests included
 * (`requireKharchaUser`); the service resolves what the caller may see and change
 * (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const getKharchaExpense = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.getExpense(context, data.expenseId));

export const createKharchaExpense = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createExpenseInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.createExpense(context, data));

export const updateKharchaExpense = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateExpenseInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.updateExpense(context, data));

/** To the trash: restorable for 30 days. */
export const deleteKharchaExpense = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.deleteExpense(context, data.expenseId));

export const restoreKharchaExpense = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.restoreExpense(context, data.expenseId));
