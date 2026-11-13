import { createServerFn } from "@tanstack/react-start";
import { budgetIdInput, budgetMonthInput, createBudgetInput, updateBudgetInput } from "@/features/kharcha/schema";
import type { BudgetView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import {
	createBudget,
	deleteBudget,
	listBudgets,
	setBudgetMonth,
	updateBudget,
} from "@/server/kharcha/budgets/service";

/**
 * Budgets (Task 94): the caller's own, each change answering with all of them. Anyone
 * signed in, guests included (`requireKharchaUser`); another's budget is NOT_FOUND (the
 * access matrix: tests/server/kharcha-access.test.ts).
 */

export const listKharchaBudgets = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<BudgetView[]> => listBudgets(context));

export const createKharchaBudget = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createBudgetInput))
	.handler(({ data, context }): Promise<BudgetView[]> => createBudget(context, data));

export const updateKharchaBudget = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateBudgetInput))
	.handler(({ data, context }): Promise<BudgetView[]> => updateBudget(context, data));

/** A monthly budget's own amount for one month (null: the budget's amount again). */
export const setKharchaBudgetMonth = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(budgetMonthInput))
	.handler(({ data, context }): Promise<BudgetView[]> => setBudgetMonth(context, data));

export const deleteKharchaBudget = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(budgetIdInput))
	.handler(({ data, context }): Promise<BudgetView[]> => deleteBudget(context, data.budgetId));
