import { z } from "zod";
import { enumParam } from "@/lib/list/params";

/** A calendar month in a URL or an input: "2026-10". */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * /apps/expenses: the month on screen (absent is the current one, in the app's time
 * zone) and the currency its totals, charts and budgets are in.
 */
export const expensesSearchSchema = z.object({
	month: z
		.preprocess((value) => (value === "" ? undefined : value), z.string().regex(MONTH_PATTERN).optional())
		.catch(undefined),
	currency: enumParam(["NPR", "USD"] as const, "NPR"),
});
export type ExpensesSearch = z.output<typeof expensesSearchSchema>;
