import { createServerFn } from "@tanstack/react-start";
import {
	pauseRecurringInputSchema,
	recurringIdInputSchema,
	repeatExpenseInputSchema,
	updateRecurringInputSchema,
} from "@/features/kharcha/schema";
import type { RecurringView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import {
	deleteRecurring,
	listRecurring,
	pauseRecurring,
	repeatExpense,
	skipRecurring,
	updateRecurring,
} from "@/server/kharcha/recurring/service";

/**
 * Recurring expenses (Task 94): "Repeat…" on an expense, and the caller's own in Settings
 * → Recurring, each change answering with all of them. Anyone signed in, guests included;
 * another's is NOT_FOUND (tests/server/kharcha-access.test.ts). The daily job makes them.
 */

export const listKharchaRecurring = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<RecurringView[]> => listRecurring(context));

export const createKharchaRecurring = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(repeatExpenseInputSchema))
	.handler(({ data, context }): Promise<RecurringView[]> => repeatExpense(context, data));

export const updateKharchaRecurring = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateRecurringInputSchema))
	.handler(({ data, context }): Promise<RecurringView[]> => updateRecurring(context, data));

export const setKharchaRecurringPaused = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(pauseRecurringInputSchema))
	.handler(({ data, context }): Promise<RecurringView[]> => pauseRecurring(context, data));

/** Skip the next one: it is never made. */
export const skipKharchaRecurring = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(recurringIdInputSchema))
	.handler(({ data, context }): Promise<RecurringView[]> => skipRecurring(context, data.recurringId));

export const deleteKharchaRecurring = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(recurringIdInputSchema))
	.handler(({ data, context }): Promise<RecurringView[]> => deleteRecurring(context, data.recurringId));
