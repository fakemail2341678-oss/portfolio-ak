import { createServerFn } from "@tanstack/react-start";
import { createExpenseInput, expenseIdInput, markDuplicateInput, updateExpenseInput } from "@/features/kharcha/schema";
import { spendListInput } from "@/features/kharcha/search";
import type { ExpenseDetail, ExpenseView, MerchantSuggestion, SpendPage } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as expenses from "@/server/kharcha/expenses/service";
import { getMerchants } from "@/server/kharcha/lists/service";
import { listSpend } from "@/server/kharcha/spend/service";

/**
 * Kharcha's expenses (docs/guides/kharcha.md): anyone signed in, guests included
 * (`requireKharchaUser`); the service resolves what the caller may see and change
 * (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const getKharchaExpense = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(expenseIdInput))
	.handler(({ data, context }): Promise<ExpenseDetail> => expenses.getExpense(context, data.expenseId));

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

/** "Not a duplicate" (`ok`), or "it may be one" again: the caller's own flag. */
export const markKharchaDuplicate = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(markDuplicateInput))
	.handler(({ data, context }): Promise<ExpenseView> => expenses.setNotDuplicate(context, data.expenseId, data.ok));

/** A page of Spend (Tasks 89 and 93): the caller's expenses matching a query in the search language. */
export const listKharchaSpend = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(spendListInput))
	.handler(({ data, context }): Promise<SpendPage> => listSpend(context, data));

/** The merchants of the caller's history, for the expense dialog's completion. */
export const getKharchaMerchants = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<MerchantSuggestion[]> => getMerchants(context));
