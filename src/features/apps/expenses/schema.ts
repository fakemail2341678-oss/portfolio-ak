import { z } from "zod";
import { formatNumber } from "@/lib/i18n/intl";
import { isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { APP_COLORS } from "../colors";
import { MONTH_PATTERN } from "./search";
import { CATEGORY_ICONS, EXPENSE_CURRENCIES, EXPENSES_QUOTAS, MINOR_UNITS } from "./types";

/**
 * Expenses' inputs (decision 0192), checked on the server and by the forms. Ids of new
 * rows come from the browser (`crypto.randomUUID()`), so a retried create can't make
 * two. Amounts travel in minor units (integers).
 */
const id = z.uuid();

export const CATEGORY_NAME_MAX = 40;
export const EXPENSE_NOTE_MAX = 200;
/** The largest single amount: a hundred million in major units. */
export const AMOUNT_MAX_MINOR = 100_000_000 * MINOR_UNITS;

export const expenseCurrency = () => z.enum(EXPENSE_CURRENCIES);

/** A positive amount in minor units, at most AMOUNT_MAX_MINOR. */
export const amountMinor = () =>
	z
		.number({ error: () => m.validation_number() })
		.int({ error: () => m.validation_number() })
		.min(1, { error: () => m.expenses_error_amount_positive() })
		.max(AMOUNT_MAX_MINOR, {
			error: () => m.validation_number_max({ max: formatNumber(AMOUNT_MAX_MINOR / MINOR_UNITS) }),
		});

const note = () => z.string().trim().max(EXPENSE_NOTE_MAX);

export const expenseInput = z.strictObject({
	id,
	categoryId: id.nullable(),
	amountMinor: amountMinor(),
	currency: expenseCurrency(),
	occurredOn: isoDate(),
	note: note(),
});
export const expenseIdInput = z.strictObject({ id });

export const categoryName = () => required({ max: CATEGORY_NAME_MAX });

export const categoryInput = z.strictObject({
	id,
	name: categoryName(),
	color: z.enum(APP_COLORS),
	icon: z.enum(CATEGORY_ICONS),
});

export const monthInput = () => z.string().regex(MONTH_PATTERN);

export const expensesMonthInput = z.strictObject({ month: monthInput().optional(), currency: expenseCurrency() });

/** Sets a category's budget for one month and currency; null removes it. */
export const budgetInput = z.strictObject({
	categoryId: id,
	month: monthInput(),
	currency: expenseCurrency(),
	amountMinor: amountMinor().nullable(),
});

/** One row of a CSV import, as the import page sends it after mapping (and the server checks again). */
export const importRowSchema = z.object({
	occurredOn: isoDate(),
	amountMinor: amountMinor(),
	currency: expenseCurrency(),
	/** A category's name: matched without case, made when missing; "" is uncategorized. */
	category: z
		.string()
		.trim()
		.max(CATEGORY_NAME_MAX, { error: () => m.expenses_error_category_long({ max: formatNumber(CATEGORY_NAME_MAX) }) }),
	note: note(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const importInput = z.strictObject({
	/** One key per import the user means to make (docs/guides/routing-data.md, "Idempotency keys"). */
	key: id,
	rows: z.array(importRowSchema).min(1).max(EXPENSES_QUOTAS.importRows),
});

export type ExpenseInput = z.infer<typeof expenseInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type BudgetInput = z.infer<typeof budgetInput>;
export type ImportInput = z.infer<typeof importInput>;
